import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '../../data/currency.js'

const COLORS = {
  Plumbing: '#60a5fa',
  Electrical: '#f59e0b',
  'General Repairs': '#10b981',
  Other: '#9ca3af',
}

/**
 * MaintenancePie — donut chart of maintenance costs by category for the latest month.
 *
 * @param {{ month: Object }} props
 */
export default function MaintenancePie({ month }) {
  const data = Object.entries(month.maintenanceCosts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Maintenance by Category</h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No maintenance costs this month</p>
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
              dataKey="value"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={COLORS[d.name] ?? COLORS.Other} />
              ))}
            </Pie>
            <Tooltip formatter={formatCurrency} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
