import { useState } from 'react'
import { getFinancials } from '../../data/financials.js'
import KpiStrip from './KpiStrip.jsx'
import RentBarChart from './RentBarChart.jsx'
import MaintenancePie from './MaintenancePie.jsx'
import MaintenanceExpenses from './MaintenanceExpenses.jsx'
import TaxPayments from './TaxPayments.jsx'
import TenantInsights from './TenantInsights.jsx'

/**
 * Analytics — orchestrates all financial analytics sections, including the maintenance
 * expense log and annual tax payments that feed the pie chart and KPIs.
 *
 * @param {{ refreshKey?: number, month: string }} props
 */
export default function Analytics({ refreshKey, month }) {
  // Bumped when an expense or tax payment changes so everything re-reads from financials.js
  const [expensesVersion, setExpensesVersion] = useState(0)
  void expensesVersion
  const { months: last6Months, selected: latestMonth } = getFinancials(month)

  return (
    <div key={refreshKey} className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <KpiStrip month={latestMonth} />
      <RentBarChart months={last6Months} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MaintenancePie month={latestMonth} />
        <MaintenanceExpenses month={month} onChange={() => setExpensesVersion((v) => v + 1)} />
      </div>
      <TaxPayments onChange={() => setExpensesVersion((v) => v + 1)} />
      <TenantInsights month={month} />
    </div>
  )
}
