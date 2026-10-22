/** Keep OAuth return destinations inside this application. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/trips";
  }

  if (/[\\\u0000-\u001f\u007f]/.test(value) || /%(?:2f|5c)/i.test(value)) {
    return "/trips";
  }

  try {
    const url = new URL(value, "https://app.invalid");
    if (url.origin !== "https://app.invalid") return "/trips";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/trips";
  }
}
