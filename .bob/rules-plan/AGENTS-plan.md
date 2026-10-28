# LandlordIQ — Plan Mode Context

Extends the root `AGENTS.md` with guidance specific to planning and architecture decisions.

---

## Architectural Boundaries (do not cross without discussion)

| Boundary | Reason |
|---|---|
| No backend / server | Demo must deploy as static files |
| No global state library | Project is small enough for prop-drilling + localStorage |
| No URL routing | Single-page tab toggle is sufficient for the demo scope |
| No TypeScript | Project is JSX only; adding TS requires config changes |

## Open Implementation Steps

The following steps from `landlordiq-demo/plans/02-implementation-checklist.md` are still pending
and represent the remaining implementation work:

- **Step 5** — Unit Cards Dashboard (UnitCard, FilterBar, Dashboard fully wired — *scaffolded, needs full UI implementation*)
- **Step 6** — Financial Analytics View (all charts wired — *scaffolded, needs full UI implementation*)
- **Step 7** — Polish and static build verification

## Decision Log

| Decision | Rationale |
|---|---|
| `statsKey` in App drives SummaryStrip refresh | Avoids prop-drilling a setter through Dashboard → UnitCard |
| `refreshKey` as UnitCard key prop | Guarantees full re-render after localStorage write without a separate state store |
| `label` field in `financials.json` | Avoids parsing month strings in chart components |
| Tailwind v3 (not v4) | v4 changes the config format; v3 is stable and widely documented |

## When Proposing Changes

- Check `landlordiq-demo/plans/01-architecture-overview.md` for the component responsibility matrix.
- Any new data field must go in `tenants.json` or `financials.json` — not hardcoded in components.
- Any new derived value must be computed in `src/data/tenants.js` — not in components.
