import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '../../data/currency.js'
import { t } from '../../data/i18n.js'
import { getChartColors } from '../../data/theme.js'

/**
 * MaintenancePie — donut chart of maintenance costs by category for the latest month.
 *
 * @param {{ month: Object }} props
 */
export default function MaintenancePie({ month }) {
  const c = getChartColors()
  const data = Object.entries(month.maintenanceCosts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: t(name), key: name, value }))

  return (
    <div className="bg-surface rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
      <h3 className="text-base font-semibold text-gray-900 mb-4">{t('Maintenance by Category')}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">{t('No maintenance costs this month')}</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
              stroke="none"
              dataKey="value"
            >
              {data.map((d) => (
                <Cell key={d.key} fill={c.categories[d.key] ?? c.categories.Other} />
              ))}
            </Pie>
            <Tooltip
              formatter={formatCurrency}
              contentStyle={{ background: c.tooltipBackground, borderColor: c.tooltipBorder, borderRadius: 8 }}
              labelStyle={{ color: c.tooltipText }}
              itemStyle={{ color: c.tooltipText }}
            />
            <Legend wrapperStyle={{ color: c.axis, fontSize: 13 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
