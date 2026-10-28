# LandlordIQ — Code Mode Context

Extends the root `AGENTS.md` with guidance specific to writing and modifying code in this project.

---

## Working in This Codebase

### File ownership rules
- **UI only** → `src/components/`
- **Data & logic** → `src/data/` (never put transforms inside components)
- **Styles** → Tailwind classes on JSX elements; `src/styles/index.css` for base layer only

### Component pattern
Every component file follows this shape:
```jsx
/**
 * ComponentName — one-line description.
 *
 * @param {{ propA: Type, propB: Type }} props
 */
export default function ComponentName({ propA, propB }) {
  // ...
}
```
No default export at the bottom — `export default function` inline.

### State refresh pattern
When a unit toggle occurs the re-render chain is:
1. `UnitCard` calls `onTogglePaid(id, paid)`
2. `Dashboard.handleTogglePaid` → `setPaymentStatus()` → `setRefreshKey(k+1)` → `onStatsChange()`
3. `App` receives `onStatsChange` → `setStatsKey(k+1)`
4. `SummaryStrip` re-renders because its `refreshKey` prop changed

Do not add module-level caching to `tenants.js` — the read-on-every-call pattern is intentional.

### Adding a new component
1. Place it in the correct subfolder (`layout/`, `dashboard/`, or `analytics/`).
2. Add a JSDoc block above the function.
3. Import it in the parent orchestrator (`App.jsx`, `Dashboard.jsx`, or `Analytics.jsx`).
4. Do not import it anywhere else without a good reason.

### Recharts usage
- Always wrap charts in `<ResponsiveContainer width="100%" height={N}>`.
- Use `tickFormatter` on `YAxis` to abbreviate large dollar values (`$63k` not `63000`).
- Use `formatter` on `<Tooltip>` to show full `Intl.NumberFormat` USD values.

### Tailwind gotchas
- Content paths are `["./index.html","./src/**/*.{js,jsx}"]` — no TypeScript.
- Never construct class names dynamically with template literals (Tailwind purges them).
  Use full class name strings: `'border-green-500 bg-green-50'` — not `'border-' + color`.
- Status colour maps are defined as plain objects in each component that needs them.

### Running the project
```bash
npm run dev       # http://localhost:5173
npm run build     # dist/ — verify zero errors before committing
```
