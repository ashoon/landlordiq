import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatMil } from '../../data/currency.js'

/**
 * RentBarChart — expected rent vs collected / due soon / upcoming / overdue for the last 6 months.
 * Collected, Due Soon, Upcoming and Overdue are stacked and sum to the Expected figure;
 * Vacancy Loss (rent of empty units, not part of Expected) is a separate bar.
 *
 * @param {{ months: Array<Object> }} props
 */
export default function RentBarChart({ months }) {
  const data = months.map((m) => ({
    name: m.label,
    Expected: m.rentExpected,
    Collected: m.rentCollected,
    'Due Soon': m.rentDueSoon,
    Upcoming: m.rentUpcoming,
    Overdue: m.rentOverdue,
    'Vacancy Loss': m.vacancyLoss,
  }))

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Rent Expected vs Collected, Due Soon, Upcoming & Overdue (Last 6 Months)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis
            tickFormatter={formatMil}
            tick={{ fontSize: 12 }}
            width={64}
            label={{ value: 'COP mil', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#9ca3af' }}
          />
          <Tooltip formatter={formatCurrency} />
          <Legend />
          <Bar dataKey="Expected" fill="#93c5fd" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Collected" stackId="status" fill="#22c55e" />
          <Bar dataKey="Due Soon" stackId="status" fill="#fbbf24" />
          <Bar dataKey="Upcoming" stackId="status" fill="#9ca3af" />
          <Bar dataKey="Overdue" stackId="status" fill="#ef4444" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Vacancy Loss" fill="#d1d5db" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
