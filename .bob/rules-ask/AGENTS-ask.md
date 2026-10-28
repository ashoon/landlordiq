# LandlordIQ — Ask Mode Context

Extends the root `AGENTS.md` with guidance for answering questions about this project.

---

## Quick Reference

### What the app does
- Two-tab SPA: **Units Dashboard** (rent status grid) + **Financial Analytics** (charts)
- 28 tenants seeded across three states: paid (12), due soon (8), overdue (10)
- User can toggle any unit between paid/unpaid; state survives page refresh via `localStorage`
- No authentication, no backend, no routing — pure static deployment

### Where to find things

| Question | Look here |
|---|---|
| How is status calculated? | `src/data/tenants.js` → `getStatusForTenant()` |
| Where is the seed data? | `src/data/tenants.json`, `src/data/financials.json` |
| How does the tab switch work? | `src/App.jsx` — `activeTab` state |
| How does the summary strip update? | `statsKey` in `App.jsx` incremented via `onStatsChange` callback |
| How are charts built? | `src/components/analytics/` — each chart is its own component using Recharts |
| What are the deployment options? | `landlordiq-demo/plans/03-cost-considerations.md` |

### Key numbers (from seed data)
- Monthly rent expected: **$63,550** (28 units, $1,200–$3,500 range)
- localStorage key: `"landlordiq_payments"`
- Maintenance categories: Plumbing, Electrical, HVAC, Appliances, General Repairs

### Build output
- `npm run build` → `dist/` folder, ~640 KB JS (Recharts is large but acceptable for a demo)
- Zero build errors; one chunk-size advisory (expected, not a problem)
