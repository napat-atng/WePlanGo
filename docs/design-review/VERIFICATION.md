# Design verification

Updated the shared frontend toward the approved Airbnb clarity / Wanderlog planning direction. The prototype remains browser-only; no authentication, database schema, or permission changes were made.

Checks passed:
- npm run lint
- npm run build
- npm test: 24 passing tests
- Chrome: Thai Buddhist date display, Gregorian ISO form values, minimum-date disabling, 29 February 2028, 24-hour time values, keyboard open/Escape dismissal, reduced-motion behavior, and 390px viewport overflow.
- Visual inspection: desktop and mobile public home, loading state, isolated calendar, and browser-only mockup workspace.

Screenshots in this folder are local development captures. workspace-* screenshots show sample prototype data; calendar-mobile.png shows an isolated component test. The temporary component-preview route was removed after checking. Authenticated two-account invite/vote/confirm/RSVP integration was not rerun for these presentation changes.

The design detector completed and reported advisory mismatches against legacy literal colors, sizes, and the old sidecar. DESIGN.md is the updated visual authority.

## 24-hour time selector follow-up

Replaced the browser-native time input with explicit ThaiTimeInput hour (00–23) and minute (00–59) selects. Chrome checks passed with both en-US and th-TH browser locales for 00:00, 12:00, 14:30, and 23:59; hidden ISO datetime values stayed correct. Desktop and 390px mobile screenshots are time-en-US.png and time-th-TH.png. Lint, production build, and all 24 automated tests passed.

## Six UI tickets follow-up

1. Trip creation fields are immediately visible; checked in the mobile prototype.
2. Shared date controls are read-only with inputMode=none. Browser checks confirmed typing does not change the display, deadline selection retains the time, and empty required dates remain invalid.
3. Expanded trip metadata stays inside the hero bounds on 1440px and 390px viewports; open/close behavior passed.
4. Invitation buttons in the real Workspace component have equal top position, width, and height on desktop/mobile.
5. Next-step trip buttons have equal top position and height on desktop; mobile wraps without horizontal overflow.
6. Calendar buttons have at least 16px spacing; connected and disconnected states render correctly on desktop/mobile.

Tickets 4–6 used a temporary route rendering the real Workspace component with explicit sample data. All POST requests were blocked, so no invitation or calendar mutations ran. Its expected refresh-error notice is visible in the screenshots. The temporary route was removed before the final build. This is UI verification, not an authenticated integration test.

Final checks: lint passed, 24 tests passed, production build passed. Changes were committed and pushed separately per ticket.
