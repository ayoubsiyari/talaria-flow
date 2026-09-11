# Talaria Flow design system

Obsidian / Ledger edition. Tokens: `public/assets/css/tokens.css` (the single source of truth the pages load; the original handoff contract was merged into it). Colours are listed in the contract; `#2EE8FF` cyan is interactive only, `#FF37B0` magenta is status only, `#FBBF24` amber is review/pending.

Components live as plain HTML + `public/assets/css/site.css` + `public/assets/js/*.js`: header/footer markup is repeated in every `public/**/index.html` and kept in sync by `site.js`; the tutorial player is `public/assets/js/tutorial-player.js` + `src/tutorial/*.jsx`; the admin shell is `public/assets/js/components/AdminShell.js`; emails are rendered from `emails/templates.json` by `emails/render.js`.

---

# Style rules

## Never
- No gradients except: the user avatar (cyan→magenta 135°) and the Talaria Log mark. No gradient text, no gradient backgrounds, no glows, no blur blobs.
- No box-shadow except dropdown menus (`--shadow-menu`).
- No rounded corners on: tables, KPI strips, ledger rows, the hero ladder, rules. Rounded corners (10–16px) only on controls, inputs, cards, panels, menus, dialogs.
- No third typeface. Archivo (Latin) + Cairo (Arabic) for text, Geist Mono for numbers/labels. Never set Arabic in Archivo or Geist Mono when Cairo is available; the stacks already fall back.
- No negative letter-spacing on Arabic. No uppercase transform on Arabic (mono labels keep the size, drop `text-transform`).
- No emoji, no illustrations drawn in CSS/SVG, no stock icons other than the 24px 2px-stroke set described below.
- No centred marketing layouts. Content is left-aligned against the 96px axis column.
- No cards on marketing pages. Rows on rules. Panels only where a task lives (forms, admin detail, dialogs).
- No page title above 44px except the Home hero. No `clamp()` on app pages (account, admin, auth).
- Cyan and magenta never on the same element (exceptions: logo, hero ladder).

## Interactive states
Primary button: fill cyan, text on-cyan; hover cyan-2; active cyan-2 + translateY(1px); focus-visible 3px cyan-ring outside; disabled opacity .5 + cursor not-allowed; loading: label replaced by 16px spinner, width kept.
Outline button: 1px cyan border, cyan text; hover cyan-dim fill; focus as primary; disabled opacity .5.
Neutral button: 1px line-strong, text; hover border text; used for secondary actions in panels.
Text link: cyan, 1px underline at 40% alpha, 100% on hover; inline body links: text colour with 30% underline.
Icon button (30–40px): transparent, 1px line-strong or none; hover sheen-hover or border text; always `aria-label`; tooltip on hover/focus (not on toggle buttons, not on touch).
Inputs (boxed, app/auth): 46px, surface fill, 1px line-strong, r-input, 15px text; focus cyan border + 3px cyan-ring; error magenta-2 border + 12.5px magenta-2 message with icon below, `aria-invalid`, `role=alert`; disabled text-4 on bg; placeholder text-4.
Inputs (line, marketing forms): transparent, 1px bottom rule line-strong → cyan on focus; no ring.
Select: boxed input + 14px chevron at right 14px; native menu.
Checkbox: 16px, accent cyan. Toggle: 40×22, track line-strong → cyan, 16px white knob, 150ms.
Segmented: 1px line-strong frame r-btn, 36px items, 1px dividers, active sheen + text, inactive text-3.
Nav item: text-2, hover text; active text + 2px cyan rule on the header's bottom edge (slides between items, 200ms ease).
Menu row: 38–48px, r-menu-row, hover sheen-hover, current cyan-wash; Escape/outside/route-change close.
Table row: 1px line rule; hover rgba(255,255,255,.03); selected 2px cyan left edge + cyan-wash 5%; sortable head shows ↑/↓ and text colour.
Status tag: mono caps, 6px square dot, 1px border in status colour, r-tag, never wraps.
Card: surface, 1px line, r-card; hover border line-hover only when clickable; stateful cards get a 2px top rule in the status colour.
Dialog: overlay backdrop, surface, 1px line-strong, r-dialog, max 92vh scroll inside; z-dialog; focus trapped; Escape/backdrop close.
Toast: bottom-left, surface, 1px line-strong, r-card, 13.5px, 4s, z-toast, cyan check or magenta icon.
Tooltip: 400ms delay, surface, 1px line-strong, r-thumb, 6px 10px, 12.5px, z-tooltip, dismissed on click/Escape/route change.
Skeleton: bg-2 blocks r-thumb, 1.2s pulse opacity .5→1; never spinners for page loads.

## Density
Marketing: section padding clamp(64,9vw,120), rows 26px vertical. App: 24–28px page padding, 10–14px cells, 38px nav rows, 8px gaps. Touch targets ≥ 44px on <1000px (rows may be 44px min-height).

## Numbers
Always Geist Mono, `font-variant-numeric: tabular-nums`, Latin digits in both languages, right-aligned in tables, prices with thousands separator and 2 decimals, dates "5 Sep 2026", times 24h "09:20". Deltas signed (+412 / −88). Currency prefixed ($0).

## Icons
24px viewBox, 2–2.4px stroke, round caps/joins, currentColor, rendered at 13–16px. Sources: the inline SVGs in the design files (arrow, external, chevron, check, refresh, mail, dots, lock, eye, upload, globe, user, dashboard, logout). No filled icons, no icon fonts.

## Overlays and layering
Sticky header z-50 with backdrop blur 14px at 88% bg. Menus z-60 anchored to their trigger (left for nav/brand, right for language/user), 6–8px offset. Dialogs z-80 centred, 20px viewport padding. Toasts z-90. Tooltips z-100. Only one menu open at a time.

## RTL / Arabic
Layout never mirrors. `<html dir="ltr">` always. Every element that contains Arabic text gets `dir="rtl"` and keeps `text-align:left`. Never `dir` on flex/grid containers. Inputs for email/password stay `dir="ltr"`. Names and concepts (Talaria Flow, NinjaTrader, Order Flow, Footprint, VWAP, Delta, POC…) stay Latin inside Arabic sentences. Compliance strings stay English verbatim. No terminal full stops on headings/labels/buttons; Arabic comma only when unavoidable. Language state: `localStorage['tf-lang']` + `tf-lang` window event; the switch shows the current language.

## Accessibility minimums
Text contrast ≥ 4.5:1 (text-3 on bg = 5.9:1; text-4 only for placeholders/disabled). Focus ring visible on every control (3px cyan-ring). Targets ≥ 44px on touch. All icon buttons labelled. Live regions for form errors and toasts. Reduced motion: stop ladder/marquee, keep fades. Skip link to main.

---

# Component inventory

Each entry: anatomy · sizes · states · spacing · tokens. Reference markup lives in `design/*.dc.html` (search the component name).

## Buttons
- **Primary** — label [+ 16px arrow]. Sizes lg 52/pad 24, md 48/22, sm 36/16 (app: 40/16, 32/12 in bulk bars). States per STYLE-RULES. Tokens: cyan, on-cyan, cyan-2, r-btn, font-sans 600 15/14.5/13.5.
- **Outline** — same sizes; line = cyan; hover cyan-dim. External links add a 14px ↗ icon and `rel="sponsored noopener"` for affiliate.
- **Neutral** — line-strong border; used inside panels.
- **Text link** — cyan 600 + 16px arrow, underline 40%.
- **Icon button** — 30 (table), 34 (input eye), 40 (header hamburger); r-thumb/r-btn.

## Inputs
- **Line input** (marketing waitlist, legacy auth) — label mono 10.5 caps above, transparent, bottom rule.
- **Boxed input** (auth, account, admin) — 46px (app 38–42), surface, line-strong, r-input, 15px; help 12px text-4 below; error message row 12.5px magenta-2 with icon.
- **Password** — boxed + eye toggle button at right 6px.
- **Select** — boxed + chevron; native list.
- **Textarea** — boxed, min 64–96px, resize vertical, pad 10–12/12–14.
- **Search** — boxed 36px with `type=search`, 220px in toolbars.
- **Checkbox** 16px accent cyan; label 14px text-2 grid 18px/1fr gap 12.
- **Toggle** 40×22 (see STYLE-RULES).
- **Dropzone** — 1px line-strong, r-btn, bg, 36/24 pad, cyan upload glyph 26px, "Drop screenshots here or click to choose", meta line mono 11.5; hover border cyan; drag-over cyan-wash; error border magenta-2.
- **Date/time** — boxed 36px mono 13, `color-scheme:dark`.

## Navigation
- **Top bar** — 68px (60 mobile), sticky, blur; brand (logo 24 + wordmark 17) with sites chevron; nav 14/500 gap 28 with 2px active rule; right: language button 36px, then Log in + Create account (logged out) or user chip (logged in); hamburger 40px under 1000.
- **Brand menu** — 200px, rows 40px: Talaria Flow (cyan dot), Talaria Log (↗).
- **Language menu** — 160px, rows 40px English / العربية, cyan dot on current.
- **User menu** — 220px, header (name + email), rows 38px: Dashboard, Profile, Change password, divider, Log out.
- **Mobile drawer** — full-width under header, rows 52px, language segmented row, Log in/Create account 48px 50/50 (logged out only).
- **Account sub-nav** — 220px sticky, avatar block, rows 38px r-menu-row, Log out; horizontal scroll row under 900.
- **Admin sidebar** — 220px sticky, logo + ADMIN tag, groups with mono 10px captions, rows 38px with mono badges, account + Log out pinned; tab row under 960.
- **Breadcrumb** — 13px text-3, "/" separators, links hover text; account pages only.
- **Tabs / segmented** — 36px; also used as filter bars with mono counts.
- **Pagination** — not used; tables show "n of N" mono 11 footer and load 50 rows, "Load more" neutral button.

## Data display
- **Ledger rows** — step row 64/1fr/1.5fr gap 20 pad 26; module row 56/1fr/auto pad 20; list row 40/1fr/auto pad 14; all 1px line top rule, last gets bottom rule.
- **Axis column** — 96px: numeral 13px text + label 11px mono caps text-3; collapses above content under 900.
- **KPI strip** — equal columns split by 1px vertical rules, numeral 28 (admin)/36, mono caps label; clickable cells hover 3% white.
- **Table** — head mono 10.5 caps on line-strong rule, sortable heads with arrow; cells pad 10–16; row states above; overflow-x inside its container (min-width 640–760); sticky first column optional. Rows: checkbox 32px col, actions col right-aligned icon buttons. Empty state: one 14px text-3 line + primary action, 48px padding, no illustration. Loading: 6 skeleton rows 44px. Error: magenta banner above table with Retry.
- **Status tag** — see rules; colours: none text-3/line-strong, review warn, approved cyan, rejected magenta-2, sent text-2, failed magenta-2, cancelled text-4.
- **Timeline** — 4 columns, 2px top rules (cyan done, magenta now, 12% white todo), mono caps 10.5.
- **Progress bar** — 4px track line, cyan fill, r 2.
- **Avatar** — 40 (sub-nav) / 26 (header) / 20 (menu), avatar-gradient, initials on-cyan 700.
- **Hero ladder / chart frame** — 1px line-strong top and bottom rules, 42px rows, 84px price column, bars inset 8px, mono 12.5; bid magenta-2 text / bid-fill, ask cyan-2 / ask-fill; footer Delta/Volume mono 11. Canvas variant: `src/hero-sequence.js`.
- **Activity list** — 8px/1fr/auto grid, 6px square dot in event colour, 13.5 text-2, mono 11 time.
- **Email preview frame** — surface, 1px line, r-panel, From/Subject bar mono 11.5, iframe 520–560px white.

## Containers
- **Card** (account overview, compose steps) — surface, 1px line, r-card, pad 16–20; stateful top rule 2px.
- **Panel** (admin detail, upload) — surface, 1px line, r-panel, pad 20–28, sticky top 20 in split layouts.
- **Partner plate** — pure black, 1px line, r-panel, logo centred, never recoloured.
- **Teaser strip** — bg-2, 1px line, r-card, magenta tag + one sentence.
- **Banner** (error/notice) — 12/14 pad, wash background, 1px border at 40% of the colour, r-btn, icon + text.
- **Dialog** — 1040 (send email, two columns), 480 (confirm), r-dialog.
- **Toast**, **Tooltip** — see rules.

## Page states
- **Empty** — title + one sentence + primary action, left-aligned in the content column.
- **Loading** — skeletons matching the layout; header renders immediately.
- **Error** — banner at top of content with Retry; never a blank page.
- **404** — header + "Page not found" h1-app + "Back to home" primary.
- **No access** (admin) — header + "You need an owner account" + Log in outline; never redirect silently.
- **Offline / saved** — toast.
