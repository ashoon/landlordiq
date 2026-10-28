# LandlordIQ — Advanced Mode Context

Extends the root `AGENTS.md` with context for advanced operations: debugging, performance,
refactoring, and non-standard tooling tasks.

---

## Known Non-Issues (do not flag these)

| Observation | Why it is not a problem |
|---|---|
| `dist/assets/index-*.js` ~640 KB | Recharts + D3 bundled monolithically; acceptable for a static demo |
| `fsevents` install-scripts warning | macOS file-watcher; benign |
| `npm` version advisory (12.x available) | Not relevant to the app |
| `void refreshKey` in SummaryStrip | Intentional; suppresses linter unused-var warning on a prop used only for re-render triggering |

## Performance Notes

- `getAllTenants()` reads `localStorage` on every call — no caching. Intentional for correctness.
  At 28 units this is negligible. If the unit count grew to thousands, memoise with a version counter.
- Charts are not lazy-loaded. For a demo this is fine. For production, use `React.lazy()` + `Suspense`
  around `<Analytics>` to defer loading Recharts until the analytics tab is first opened.

## Debugging Tips

- Payment overrides: open DevTools → Application → localStorage → `landlordiq_payments`
- To reset all overrides: `localStorage.removeItem('landlordiq_payments')` in the console
- To simulate a different "today" for status testing: temporarily override `new Date()` in `tenants.js`

## Extension Points

If the project grows beyond the demo:
- **Backend**: swap `tenants.json` import for a `fetch()` call in `getAllTenants()`; the component layer is unchanged
- **Auth**: wrap `App.jsx` with a guard component; no other changes needed
- **Routing**: replace the `activeTab` state with `react-router-dom` — one refactor in `App.jsx`
- **More units**: the grid is CSS-grid responsive; no layout changes needed
