# UI design — Light House Mess Meal Manager

Reference designs for the phone app and web app. They are the visual spec for Phase 4 — not app code, and not built or deployed by CI.

Canvas (live, editable): https://claude.ai/artifact/1pv2CbeGgS2i61MCnuigEP

| File | Screen |
|---|---|
| Main.dc.html | Phone · Today (meal stepper, cutoff countdown, manager grid) |
| Phone-Meals.dc.html | Phone · Meals month grid (sticky date column) |
| Phone-Bazar.dc.html | Phone · Add bazar sheet (itemized auto-sum, inline validation, undo) |
| Phone-Report.dc.html | Phone · Report (overview + per-member breakdown) |
| Phone-Close.dc.html | Phone · Close month stepper + activity log |
| Web-Report.dc.html | Web · Report (sidebar, full sheet-column table) |
| Web-Status.dc.html | Web · /status (pipeline cards, health JSON, gate log) |

Tokens: bg #050807 · accent #22E07A · info #5AA9FF · warn #F5B83D · due #FF5C5C · text #E8F0EC / #8A9A92.
Glass: rgba(255,255,255,0.04), blur(20px) saturate(160%), 1px rgba(255,255,255,0.08) border, brighter top edge, radius 16.
Type: system-ui for UI; JetBrains Mono + tabular-nums for numbers, dates, logs.

Numbers come from the golden October-2026 fixture. Day-by-day meal values in the grid are illustrative.
The .dc.html files need the canvas runtime to render; open the canvas link to view them.
