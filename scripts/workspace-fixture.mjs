// Temporary accounts for the real-data browser check. Never commit credentials.
import { randomBytes } from "node:crypto";
import { access, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const command = process.argv[2];
if (!["create", "remove"].includes(command))
  throw new Error("Use: node scripts/workspace-fixture.mjs create|remove");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error("Server-only Supabase service-role key required");
const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const path =
  process.env.WORKSPACE_FIXTURE ?? join(tmpdir(), "weplango-real-e2e.json");
function checked(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
if (command === "create") {
  if (
    await access(path).then(
      () => true,
      () => false,
    )
  )
    throw new Error(
      "Fixture already exists; remove it before creating another",
    );
  const fixture = {
    password: randomBytes(32).toString("base64url"),
    users: [],
  };
  await writeFile(path, JSON.stringify(fixture), { mode: 0o600, flag: "wx" });
  for (const [index, name] of [
    "E2E Owner",
    "E2E Member",
    "E2E Outsider",
  ].entries()) {
    const email = `weplango-e2e-${Date.now()}-${index}@example.invalid`;
    const { user } = checked(
      await admin.auth.admin.createUser({
        email,
        password: fixture.password,
        email_confirm: true,
        app_metadata: { weplango_test_fixture: true },
      }),
    );
    fixture.users.push({ id: user.id, email, name });
    await writeFile(path, JSON.stringify(fixture), { mode: 0o600 });
    checked(
      await admin
        .from("profiles")
        .upsert({ user_id: user.id, display_name: name }),
    );
  }
  console.log(
    "Created three temporary test accounts; credentials remain in the local temp directory.",
  );
} else {
  const fixture = JSON.parse(await readFile(path, "utf8"));
  while (fixture.users.length) {
    const record = fixture.users[0];
    const { user } = checked(await admin.auth.admin.getUserById(record.id));
    if (
      !user?.app_metadata?.weplango_test_fixture ||
      !user.email?.startsWith("weplango-e2e-") ||
      !user.email.endsWith("@example.invalid")
    )
      throw new Error(
        "Refusing to remove an account without test fixture markers",
      );
    const client = createClient(
      url,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    checked(
      await client.auth.signInWithPassword({
        email: record.email,
        password: fixture.password,
      }),
    );
    const rooms = checked(
      await client
        .from("trip_rooms")
        .select("id")
        .eq("organizer_id", record.id),
    );
    for (const room of rooms)
      checked(
        await client.rpc("room_command", {
          p_action: "delete",
          p: { room: room.id },
        }),
      );
    const photos = checked(
      await client.storage.from("profile-avatars").list(record.id),
    );
    if (photos.length)
      checked(
        await client.storage
          .from("profile-avatars")
          .remove(photos.map((photo) => `${record.id}/${photo.name}`)),
      );
    checked(await client.auth.signOut({ scope: "global" }));
    checked(await admin.auth.admin.deleteUser(record.id));
    fixture.users.shift();
    await writeFile(path, JSON.stringify(fixture), { mode: 0o600 });
  }
  await unlink(path);
  console.log(
    "Removed fixture rooms, photos, sessions, accounts and local credentials.",
  );
}
