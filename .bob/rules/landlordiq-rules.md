# LandlordIQ — Project Rules

This document standardises how Bob must behave when working on the **LandlordIQ** codebase. All code contributions, modifications, and refactors must strictly adhere to these rules.

---

## Core Engineering Rules

### 1. Styling & CSS
- **Always use Tailwind CSS utility classes, never inline styles.**
- Do not construct dynamic class names with string interpolation (e.g. `` `bg-${color}` ``), as Tailwind will purge them during build. Use explicit, full class strings (e.g. `'bg-green-500'`, `'bg-amber-400'`, `'bg-red-500'`).

### 2. Currency Formatting
- **All monetary values are Colombian pesos (COP).**
- Always format through `formatCurrency()` / `formatCurrencyCompact()` from `src/data/currency.js` (whole pesos, no decimals) across all UI elements, tooltips, tables, charts, and summaries. Never inline `Intl.NumberFormat` or hardcode a currency symbol.

### 3. Status Colours
- **Status colours must strictly follow the defined palette:**
  - `paid` → **`green-500`** (e.g., text/border `text-green-500`, `border-green-500`, background `bg-green-50`)
  - `due-soon` → **`amber-400`** (e.g., text/border `text-amber-400`, `border-amber-400`, background `bg-amber-50`)
  - `overdue` → **`red-500`** (e.g., text/border `text-red-500`, `border-red-500`, background `bg-red-50`)

### 4. Component Documentation & Structure
- **All new components must have a JSDoc comment describing their purpose and props.**
- Export components inline using `export default function ComponentName({ ... })`.
- Example format:
  ```jsx
  /**
   * ComponentName — description of component functionality.
   *
   * @param {{ propA: string, propB: number }} props
   */
  export default function ComponentName({ propA, propB }) {
    // ...
  }
  ```

### 5. Date Handling
- **Never hardcode dates — always derive from today's date dynamically.**
- Use `new Date()` runtime derivations for all date calculations, relative day counts, and header date displays.

### 6. Data Architecture & Separation of Concerns
- **All data transformations must live in `/src/data/`, not inside components.**
- Components are purely presentation layers. Calculations, filtering, aggregations, and `localStorage` interactions must reside in data modules (`src/data/tenants.js`, `src/data/financials.js`).
