# Tenant Insights — Plan

## Overview

**Goal:** help the landlord spot tenants who pay late or who pay in parts, using the payment data the app already stores.

**Scope (confirmed with the user):**
- An **insights table on the Analytics tab**, and a small **"Watch" tag on the unit tiles** for flagged tenants.
- Only **late payers** and **part payers**. Maintenance-per-tenant is out of scope for this version (expenses are not linked to units today; revisit later).
- **No new stored data and no new inputs.** Everything is worked out from payment records when the screen is drawn, the same way payment status is.

**Rules (decided with the user):**

| Term | Definition |
|---|---|
| Grace days | 7. |
| Window | The last 6 months, ending with the current month. Never before the tracking start (`getTrackingStart`), and never before the tenant moved in. |
| Month is judged | Once its due date + 7 days has passed, or earlier if the rent is already fully paid. Future and still-open months are ignored. |
| Late month | The full rent was reached more than 7 days after the due date, **or** the rent is still not fully paid and today is more than 7 days past the due date. A past month with nothing recorded therefore counts as late (the user accepted that forgotten months count against the tenant until marked). |
| Due date used | The month's due date as shown on the tile, including any date edited for that month. |
| Part-payment month | The first dated payment of the month was less than the rent, or the rent is still incomplete with some money received. Marking a month paid in one go with "Paid in full" is not a part-payment month. |
| Flag "Pays late" | 2 or more late months among the judged months in the window. |
| Flag "Pays in parts" | 2 or more part-payment months in the window. |

**Shown per tenant (so the reason is visible, not just a tag):**
- Months judged, late months, on-time months.
- Average days late (over late months that have a paid date) and the worst month.
- Part-payment months and whether a balance is open now.
- The two flags.

**Watch tag on tiles (decided with the user):**
- A tile shows a small "Watch" tag when its tenant has **either** flag ("Pays late" or "Pays in parts").
- Hovering or long-pressing the tag explains why, for example "Pays late: 3 of the last 6 months". The tag text and the reasons are translated.
- The tag uses a colour that is not green-500, amber-400 or red-500, so it cannot be mistaken for the tile's payment status. The tile border and background stay driven by payment status only.
- Vacant tiles never show it.
- The tag does not change sorting, filtering, the due date, the status or any totals. Status and overdue logic stay exactly as they are.

**Approach:** a new data module `src/data/insights.js` reads each month in the window through the existing `getAllTenants(month)`, which already returns the tenant who owes that month with `dueDate`, `paidDate`, `paymentLog`, `amountPaid`, `balance` and the tenancy `payKey`. Rows are grouped by `payKey ?? id`, so a replacement tenant never inherits the previous tenant's record. A new component renders the table, and `Dashboard.jsx` looks up each tile's flags from the same function and passes them to `UnitCard`. `tenants.js` does not import `insights.js` (that would be circular), so the tile data is joined in the Dashboard.

**Architecture constraints that apply** (from `AGENTS.md` and `landlordiq-rules.md`):
- All calculations live in `src/data/`; the component only presents.
- Tailwind classes only, written out in full.
- Every new text goes through `t()` and gets a Spanish entry in `src/data/translations.es.js`.
- Currency through `formatCurrency` / `formatCurrencyMil`.
- Dates come from `new Date()`, never hardcoded.
- The payment-status colours (green-500, amber-400, red-500) belong to payment status. The flag badges use other colours so they cannot be mistaken for a tile status.
- New components need a JSDoc comment and an inline `export default function`.

```
getAllTenants(month) x up to 6 months
        |
        v
insights.js: group by payKey or id, judge months, count late and part
        |
        +--> Analytics.jsx --> TenantInsights.jsx (table, flagged tenants first)
        |
        +--> Dashboard.jsx --> UnitCard.jsx (Watch tag, reasons on hover)
```

---

## Sub-task 1 — Insights data module

**Status:** [x] done

**Intent:** compute per-tenant payment behaviour from existing data, with the rules above, in one place.

**Expected outcomes:**
- `getTenantInsights()` returns one entry per tenant who owed rent in the window: identity (unit id, address, tenant name), counts (judged, late, on-time, part-payment), average days late, worst month, open balance, and the two flags.
- Late and part-payment rules match the table in the overview.
- A replacement tenant in the same unit appears as their own entry, with only their own months.
- Tenants with no judged months are returned with zero counts and no flags (the component decides how to show them).
- Nothing is stored or written.

**Todo list:**
1. Create `src/data/insights.js` with the rule constants (grace days 7, window 6 months, flag threshold 2) exported so they are easy to find and change.
2. Build the list of months in the window from today, stopping at the tracking start.
3. For each month call `getAllTenants(month)`, skip vacant rows, and group rows by `payKey ?? id`.
4. Skip months before the tenant's move-in and months not yet judged (due date + 7 days not passed and not fully paid).
5. Classify each judged month as late or on time, and as a part-payment month or not, using `dueDate`, `paidDate`, `paymentLog` and `amountPaid`.
6. Work out average days late, worst month, open balance (from the current month's row) and the two flags.
7. Sort so flagged tenants come first, then by late months, then by address (natural order, same as the unit lists).
8. Expose a lookup by tenant key (`payKey ?? id`) for the tile tag, so the Dashboard does not repeat the grouping logic. It returns the same entry as the table, so tile and table can never disagree.
9. Add JSDoc to every exported function.
10. Verify with a throwaway Node script and a fake `localStorage` (the same approach used earlier for the i18n and part-payment checks), covering these cases:
   - on time
   - paid 8 days late (late) vs 7 days late (not late)
   - never paid in a past month (late)
   - paid in full in one go (not a part-payment month)
   - part payment then the rest later
   - replacement tenant in the same unit
   - month before the tracking start
   - edited due date
   - current month still open (ignored)
   Delete the script afterwards.

**Relevant context:**
- `src/data/tenants.js`: `getAllTenants`, `paymentEntries` (private, shows how the `payments[]` list and the old total-only `amountPaid` are read), `getStatusForTenant`, `DAYS_PER_MONTH`, `getDaysRelative`.
- `src/data/tracking.js`: `getTrackingStart`.
- `src/data/financials.js`: `getFinancials`, which already loops over months with `getSummaryStats` and is a pattern to follow.
- An old total-only `amountPaid` record has no date; treat it as "some money received, date unknown" and do not use it to compute days late.

**Notes for Sub-task 2:**
- **File:** `src/data/insights.js`
- **Exported functions:**
  - `getTenantInsights(endMonthKey?)` → `TenantInsightEntry[]` (sorted: flagged first, then by lateMonths desc, then address)
  - `getTenantInsightMap(endMonthKey?)` → `Map<tenantKey, TenantInsightEntry>` (for the Dashboard tile lookup)
  - Constants: `GRACE_DAYS` (7), `WINDOW_MONTHS` (6), `FLAG_THRESHOLD` (2)
- **Shape of a `TenantInsightEntry`:**
  ```js
  {
    unitId: string,          // unit id
    tenantKey: string,       // payKey ?? id
    address: string,
    tenantName: string | null,
    judged: number,          // months judged in the window
    lateMonths: number,
    onTimeMonths: number,
    partMonths: number,
    avgDaysLate: number | null,   // average days late over late months with a paidDate
    worstMonth: string | null,    // "YYYY-MM" of the most-days-late month
    balance: number,              // open balance in the current (end) month
    paysLate: boolean,            // lateMonths >= FLAG_THRESHOLD
    paysInParts: boolean,         // partMonths >= FLAG_THRESHOLD
  }
  ```
- The component should render constants directly (`GRACE_DAYS`, `WINDOW_MONTHS`, `FLAG_THRESHOLD`) in the rule-explanation line so text and code stay in sync.
- Tenants with `judged === 0` are included in the array; the component can note "no judged months yet".

---

## Sub-task 2 — Insights table on the Analytics tab

**Status:** [x] done (not committed yet). The Flags column was dropped: the flag badges sit under the tenant name so they show on a phone without sideways scrolling. Component: `src/components/analytics/TenantInsights.jsx`, takes the selected `month`.

**Intent:** show the results where the landlord already reviews finances, readable on a phone.

**Expected outcomes:**
- A "Tenant insights" section on the Analytics tab, below the existing sections.
- One row per tenant with the numbers above and the flag badges. Flagged tenants appear first.
- On a 390 px wide phone the table scrolls sideways or stacks without breaking the layout (Manage Units already uses `overflow-x-auto`).
- A short line explains the rules in plain words (7 days of grace, last 6 months, 2 or more months to be flagged), written from the constants so text and rules cannot disagree.
- An empty state when there are no tenants yet, and a note when a tenant has fewer judged months than the window (so a low count is not mistaken for good behaviour).
- Spanish and English both work, including the flag names.

**Todo list:**
1. Create `src/components/analytics/TenantInsights.jsx` (JSDoc, inline default export, Tailwind only, no data calculation).
2. Render the table from `getTenantInsights()`: tenant, address, months judged, late months, average days late, part-payment months, open balance, flags.
3. Style the two flag badges with colours that are not green-500, amber-400 or red-500, and add an accessible label.
4. Add the plain-words rule line and the empty and short-history states.
5. Add the section to `src/components/analytics/Analytics.jsx`.
6. Add every new text to `src/data/translations.es.js` using the English text as the key; use `{name}` placeholders for numbers.
7. Run `npm run lint` and `npm run build`.
8. Check the English and Spanish views at 390 px in headless Firefox, with a temporary seed script in `index.html` that is removed afterwards. Use invented units only, never `private/tenants.json`. Note that the charts render blank in headless screenshots even before this feature, so they are not a signal.

**Relevant context:**
- `src/components/analytics/Analytics.jsx`: where sections are composed; `key={refreshKey}` re-reads after changes.
- `src/components/analytics/TaxPayments.jsx` and `MaintenanceExpenses.jsx`: card styling to match.
- `src/components/dashboard/ManageUnits.jsx`: an example of a responsive table with `overflow-x-auto`.
- `src/data/i18n.js` and `src/data/translations.es.js`: `t()` usage rules.
- Headless Firefox screenshot recipe from the earlier mobile test: `firefox --headless --window-size 390,1500 --screenshot <path-inside-workspace> <url>`. The tools can only read images inside the workspace, so write them to `dist/` and delete them afterwards.

---

## Sub-task 3 — "Watch" tag on unit tiles

**Status:** [x] done (not committed yet). `Dashboard.jsx` builds `getTenantInsightMap(month)` once per `refreshKey`/month and passes `insight` to each `UnitCard`, which shows a violet "Watch" tag before the status badge. The tag's hover/aria text gives the reasons ("Pays late: 3 of 5 months"). `tenants.js` was not modified.

**Intent:** make flagged tenants visible on the dashboard, where the landlord works day to day, without touching payment status.

**Expected outcomes:**
- A flagged tenant's tile shows a small "Watch" tag (Spanish equivalent in Spanish) next to the status badge, with the reasons in its hover text and an accessible label.
- Tiles of unflagged tenants and vacant tiles look exactly as before.
- Tile colours, sort order, filters, due dates, statuses and the summary totals are unchanged.
- The tag still fits on a 390 px phone with two tiles per row (tiles are narrow: the address and the status badge already share the top line).
- The tag updates after a payment is marked, because the Dashboard re-reads on its existing `refreshKey`.

**Todo list:**
1. In `Dashboard.jsx`, read the insights once per render cycle (not once per tile) and pass each tile its own flags, keyed by `payKey ?? id`. Keep all calculation in `insights.js`.
2. In `UnitCard.jsx`, add an optional `insight` prop and render the tag only when a flag is set and the tile is not vacant. Update the component JSDoc for the new prop.
3. Pick a tag colour that is not green-500, amber-400 or red-500 (written as full Tailwind class strings, no string-built class names) and decide where it sits on the narrow tile top line without crowding the address.
4. Add the tag text and the reason sentences to `src/data/translations.es.js`, using placeholders for the counts.
5. Run `npm run lint` and `npm run build`.
6. Check English and Spanish at 390 px in headless Firefox with invented units that include a late payer, a part payer, a tenant with both flags, a vacant unit and a clean tenant. Confirm the clean and vacant tiles are unchanged.
7. Confirm by reading the code and by a quick Node check that `getSummaryStats` and the tile sort order give identical results with and without the feature.

**Relevant context:**
- `src/components/dashboard/Dashboard.jsx`: `getAllTenants(month)` per render, `refreshKey`, `pinned` order; this is where the lookup is joined to the tiles.
- `src/components/dashboard/UnitCard.jsx`: `badgeStyles` / `badgeLabels` (the status badge the tag sits beside), the top line layout, and the phone sizing classes (`text-[11px] sm:text-xs`).
- `tenants.js` must not import `insights.js` (circular), so the join happens in the Dashboard.
- The user explicitly wants due date and overdue logic left unchanged; this sub-task must not alter either.

---

## Sub-task 4 — Documentation, validation and release

**Status:** [x] done (docs added; committed and deployed)

**Intent:** record the feature so later work follows the same rules, then ship it.

**Expected outcomes:**
- `AGENTS.md` has a short "Tenant insights" section stating the rules, the files, that no data is stored, and that the Watch tag does not affect status or totals.
- The README mentions the table, the Watch tag and how the flags are decided.
- Lint and build pass with no new warnings; the deploy succeeds.

**Todo list:**
1. Add the "Tenant insights" section and the new files to the repository layout in `AGENTS.md`.
2. Add a short README paragraph next to the Analytics description.
3. Run `npm run lint` and `npm run build`.
4. Commit, push to `main`, wait about 80 seconds and confirm with `gh run list -R ashoon/landlordiq --limit 1` that "Deploy to GitHub Pages" succeeded.
5. Tell the user plainly that the numbers are only as good as the payments marked, and that tenants will look worse until forgotten months are marked.

**Relevant context:**
- Deploy checks use `gh`, already authenticated as `ashoon`.
- `private/tenants.json` must never be committed or put in screenshots.

---

## Out of scope / possible later work

- Maintenance per tenant or per unit (needs an optional Unit field on expenses, and a decision on whether cost belongs to the unit or the tenant).
- A free-text note per tenant.
- Moving the tracking start earlier so older history can be included.

## Open risks to keep in mind

- **Forgotten months count as late.** This is the user's choice, but it will flag tenants unfairly until payments are marked. The "judged months" column and the rule line should make that visible.
- **Short history.** The tracking start can only be the first month the app was used, so most tenants will have few judged months at first.
- **Old total-only payment records** have no date, so they can show a part payment but not how late it was.
