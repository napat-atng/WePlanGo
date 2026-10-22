---
name: WePlanGo
description: A friendly shared travel workspace, inspired by Airbnb clarity and Wanderlog planning.
colors:
  ink: "#243b3b"
  muted: "#596c6b"
  primary: "#087f79"
  primary-deep: "#06645f"
  primary-soft: "#e7f3ef"
  line: "#dce5e2"
  paper: "#ffffff"
  ground: "#f7f8f5"
  sun: "#ffb75b"
  danger: "#a3303d"
typography:
  heading:
    fontFamily: "Trip Thai, Leelawadee UI, sans-serif"
    fontSize: "clamp(1.7rem, 2.9vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Trip Thai, Leelawadee UI, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.6
rounded:
  control: "10px"
  surface: "16px"
spacing:
  tight: "8px"
  regular: "16px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
---

# WePlanGo design system

## Approved direction

A welcoming travel workspace for friends on phones and desktop. Airbnb informs the clear hierarchy, generous spacing, destination photography, and approachable date selection. Wanderlog informs the organization of dates, places, and shared decisions. These are references, not copied screens or added product capabilities.

The interface uses warm white surfaces, a quiet neutral green ground, dark green ink, and teal actions. Preserve the WePlanGo mountain mark and existing travel photographs. The earlier dark-ink and yellow Journey Notebook direction is superseded by this system.

References: https://www.airbnb.com/, https://wanderlog.com/, https://m3.material.io/styles/motion/overview/how-it-works

## Layout and hierarchy

Mode: Operate for workspace routes; Persuade for the sign-in page.

Keep the trip identity and photograph together above the task navigation. Tabs follow the actual trip workflow: trip, availability, places, chat, and members. Place the current decision and its next action before administrative settings. Preserve all existing permissions, votes, RSVP behavior, and Thai product copy.

Use a flexible primary column with a 340px chat column on wide screens. Below the existing desktop breakpoint the active task becomes a single column; chat stays available through its tab. Use 24px section gaps and 20–32px panel padding. Panels and trip covers have 16px corners; controls have 10px corners and at least 44px height. Calendar day targets are at least 40px high.

## Typography and surfaces

Use the existing self-hosted Trip Thai regular and semibold fonts. Body text is 16px with 1.6 line height. Headings scale to the viewport, with compact but readable Thai line spacing. Use tabular numerals for dates and counts. Muted text must remain readable against its surface. Inputs use the primary color for the caret, a clear focus outline, and readable placeholders.

White panels are separated by spacing on the warm ground. Reserve soft downward shadows for date popovers and floating UI. Travel photographs provide character; functional information stays outside the photograph. Avoid decorative gradients, excessive nested cards, and animated backgrounds.

## Thai dates and time

Display day and month names in Thai, years in the Buddhist calendar (พ.ศ.), and Arabic numerals. Example: 22 ตุลาคม 2569. Use a 24-hour time field, never AM/PM. The date picker has Thai month names, Buddhist year choices, Thai weekday headings, selected and disabled states, keyboard focus, Escape dismissal, and a close action.

Use ThaiDateInput for real workspace date and datetime fields and the legacy voting and confirmation forms. Keep the standalone browser prototype separate from authentication and real mutations. MonthPicker continues to display Thai months and Buddhist years.

Submit dates as Gregorian ISO YYYY-MM-DD and local wall times as YYYY-MM-DDTHH:mm. Formatting must never add 543 to stored values. Preserve the existing time-zone conversion on the server. Calendar bounds disable out-of-range dates and form validity checks enforce supplied date/time bounds. Dates without a time are formatted in UTC to prevent day shifts; room deadlines follow the room's existing time-zone rules.

## Loading and feedback

The route loading screen uses the same brand, ground, cover shape, tabs, and two-column workspace proportions. Neutral skeletons indicate content structure and gently pulse while fetching; do not show invented progress percentages. Announce loading through a status message and aria-busy. On mobile, keep one skeleton content column.

Keep error, empty, pending, selected, disabled, and success states legible. Color supplements explicit status text. Save feedback stays visible through the existing status announcement.

## Motion

Use CSS with no animation dependency. Controls acknowledge presses with a small scale change and 150ms color transitions. Date popovers reveal with a 180ms clip; task panels transition over 220ms; save and alert feedback arrives over 220ms. Travel card photographs may zoom gently by 2.5% on hover. Skeleton opacity breathes over 1.6 seconds.

Use cubic-bezier(.16, 1, .3, 1) for arrivals. Never delay access to controls or hide content awaiting JavaScript. Reduced-motion preferences disable movement, transitions, skeleton pulsing, and smooth scrolling while preserving all status text and selected states.

## Implementation map

- src/components/ui/workspace.css: shared travel surfaces, tokens, responsive layout, loading, and motion.
- src/features/trips/workspace-live.css: real workspace navigation and chat composition.
- src/components/ui/ThaiDateInput.tsx and thai-date.css: Thai calendar and ISO form values.
- src/components/ui/MonthPicker.tsx: Thai month navigation.
- src/app/loading.tsx: route-level workspace skeleton.

DESIGN.md is the visual source of truth; the older .impeccable/design.json sidecar is not authoritative for this direction.

## Supporting tokens

Compact calendar days use 8px corners. Metadata and weekday labels use .8rem; supporting copy uses .9rem. Form control borders use #c6d5d0, strong text on the soft primary surface uses #25645b, and skeleton fills use #e5ebe5. Preserve semantic success, pending, and danger colors already used by the voting UI rather than mapping every status to teal.

The browser-only mockup shares the Thai date component and visual primitives, but retains its independent local sample state. No authentication or real mutation is added to it.

### Time selector implementation

ThaiTimeInput uses explicit hour options 00–23 and minute options 00–59, with Thai accessible labels and the suffix น. It does not use the browser-native time input, whose visible clock may follow an AM/PM operating-system locale. ThaiDateInput continues to submit the combined ISO local datetime value.

### Forms and action layout follow-up

The trip creation form shows its description, date range, and voting deadline immediately; these fields are not behind a disclosure. Date display inputs are native read-only with inputMode=none, while a separate validation control preserves required and range validation. All dates and deadline dates are chosen through the shared calendar; hours and minutes remain selection-only.

Expanded trip metadata participates in the hero's normal layout instead of floating outside its clipped cover. Invitation actions use equal-width grid columns with a 12px gap. Trip next-step and RSVP buttons use a flex row with equal minimum heights and wrap on narrow screens. Google Calendar actions use a 16px gap in both connected and disconnected states.

## Motion system — shared across screens

The app-wide motion stylesheet is src/components/ui/motion.css. InteractionEffects mounts once in the root layout and gives enabled buttons and links a short pointer ripple without changing their click or focus behavior. Feedback overlays are limited to four, removed after 380ms, and cleared on scroll, hidden documents, reduced-motion changes, and component cleanup. Keyboard controls retain their normal focus and active states.

Public sign-in uses one 600ms destination-photo reveal. Workspace pages enter over 300ms; month grids transition over 240ms; tabs retain their 220ms content transition with an animated active underline. New chat messages arrive from their author's side. Notices and confirmation dialogs have short entrance feedback. Vote totals ease to their updated bar size. Detail disclosures reveal their content without clipping or changing the earlier form rules.

JourneyProgress replaces the plain step caption with the same caption plus a small five-stop route. Its marker moves to the active planning step over 360ms. The route represents the existing stage calculation, not a claim that earlier steps are completed.

Error, not-found, and sign-in-error pages share StateScreen, the current mountain mark, Thai fonts, teal palette, and a single icon entrance. Font-face declarations live in globals.css so directly opening a recovery route uses the same self-hosted Thai fonts as the workspace.

All animations leave content visible by default. Hover effects apply only on devices with a fine pointer. Reduced motion disables spatial animations, transitions, ripples, and smooth scrolling while preserving labels and state feedback. No new animation dependency, scroll polling, autoplay media, or endless decorative loop is added.

Supporting motion tokens: progress labels use .85rem on desktop and .78rem on mobile. The active route marker is 28px, and recovery emblems are 72px with 24px corners; these are icon containers, not content cards. Press feedback uses the control's actual foreground color and corner radius.
