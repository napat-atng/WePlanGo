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
