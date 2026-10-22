# Motion verification

The shared motion layer covers the public landing page; real Workspace home, create, profile/calendar, invite, and all five room tabs; loading; and shared recovery screens.

Passed Chrome checks at 1440px and 390px:
- All five Workspace modes render without horizontal overflow.
- All five room tabs remain usable, and selected panels use their transition.
- Journey marker reflects the selected stage and has a 360ms transition.
- Pointer feedback creates a visual overlay without swallowing the native action.
- The calendar animates after changing months.
- Invitation-revocation confirmation opens with modal motion and cancels normally.
- Real public landing, auth-error, and not-found screens render without overflow.
- Reduced motion disables page/panel entry, marker transitions, and pointer ripples.
- No uncaught browser page errors.

Workspace screenshots use a temporary route rendering the real Workspace component with explicit sample data. POST requests were blocked: the refresh-error notice is expected in those captures. No invitations, votes, calendar syncs, or real account data were changed during this UI check. The temporary route was removed before the final production build. The error-boundary screen shares StateScreen with the two directly inspected recovery routes; an actual server error was not induced.

Screenshots capture final layouts with animations completed, so they do not themselves demonstrate the movement. check.json records the browser assertions. Authenticated two-account integration was not rerun for these presentation-only changes.

Final checks passed: npm run lint, npm test (24 passing), npm run build, and git diff --check. The mechanical design scan returned 12 advisory findings about supporting tokens; no blocking severity was reported. The .85rem/.78rem progress labels, 28px route marker, 72px state emblem, and 24px emblem radius are intentional compact supporting styles.
