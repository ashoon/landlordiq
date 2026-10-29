import { formatMil } from '../../data/currency.js'
import { t } from '../../data/i18n.js'

/**
 * KpiStrip — top-level financial KPI figures: rent expected / collected, collection rate,
 * net operating income, occupancy and vacancy loss. Money values are shown in "mil"
 * (thousands of COP), e.g. 16,545 = COP 16,545,000, with a "COP mil" caption above.
 *
 * @param {{ month: Object }} props - The selected month from getFinancials()
 */
export default function KpiStrip({ month }) {
  const totalMaintenance = Object.values(month.maintenanceCosts).reduce((a, b) => a + b, 0)
  const totalExpenses = month.propertyTax + totalMaintenance
  const noi = month.rentCollected - totalExpenses

  const kpis = [
    { label: t('Total Rent Expected'), value: formatMil(month.rentExpected), money: true },
    { label: t('Total Collected'), value: formatMil(month.rentCollected), money: true },
    { label: t('Collection Rate %'), value: `${month.collectionRate.toFixed(1)}%` },
    { label: t('Net Operating Income'), value: formatMil(noi), money: true },
    {
      label: t('Occupancy'),
      value: `${month.occupancyRate.toFixed(0)}%`,
      note: `${month.vacantUnits} ${t('vacant')}`,
    },
    { label: t('Vacancy Loss'), value: formatMil(month.vacancyLoss), money: true },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{kpi.label}</p>
          <p className="h-4 text-xs font-medium text-gray-400 mt-1">{kpi.money ? t('COP mil') : ''}</p>
          <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
          {kpi.note && <p className="text-xs text-gray-500 mt-0.5">{kpi.note}</p>}
        </div>
      ))}
    </div>
  )
}
