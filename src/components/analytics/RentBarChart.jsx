import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatMil } from '../../data/currency.js'
import { t } from '../../data/i18n.js'
import { getChartColors } from '../../data/theme.js'

/**
 * RentBarChart — expected rent vs collected / due soon / upcoming / overdue for the last 6 months.
 * Collected, Due Soon, Upcoming and Overdue are stacked and sum to the Expected figure;
 * Vacancy Loss (rent of empty units, not part of Expected) is a separate bar.
 *
 * @param {{ months: Array<Object> }} props
 */
export default function RentBarChart({ months }) {
  const c = getChartColors()
  const data = months.map((m) => ({
    name: m.label,
    [t('Expected')]: m.rentExpected,
    [t('Collected')]: m.rentCollected,
    [t('Due Soon')]: m.rentDueSoon,
    [t('Upcoming')]: m.rentUpcoming,
    [t('Overdue')]: m.rentOverdue,
    [t('Vacancy Loss')]: m.vacancyLoss,
  }))

  return (
    <div className="bg-surface rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
      <h3 className="text-base font-semibold text-gray-900 mb-4">{t('Rent Expected vs Collected, Due Soon, Upcoming & Overdue (Last 6 Months)')}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 13, fill: c.axis }} />
          <YAxis
            tickFormatter={formatMil}
            tick={{ fontSize: 13, fill: c.axis }}
            width={64}
            label={{ value: t('COP mil'), angle: -90, position: 'insideLeft', fontSize: 12, fill: c.axisLabel }}
          />
          <Tooltip
            formatter={formatCurrency}
            contentStyle={{ background: c.tooltipBackground, borderColor: c.tooltipBorder, borderRadius: 8 }}
            labelStyle={{ color: c.tooltipText }}
            itemStyle={{ color: c.tooltipText }}
          />
          <Legend wrapperStyle={{ color: c.axis, fontSize: 13 }} />
          <Bar dataKey={t('Expected')} fill={c.expected} radius={[3, 3, 0, 0]} />
          <Bar dataKey={t('Collected')} stackId="status" fill={c.paid} />
          <Bar dataKey={t('Due Soon')} stackId="status" fill={c.dueSoon} />
          <Bar dataKey={t('Upcoming')} stackId="status" fill={c.upcoming} />
          <Bar dataKey={t('Overdue')} stackId="status" fill={c.overdue} radius={[3, 3, 0, 0]} />
          <Bar dataKey={t('Vacancy Loss')} fill={c.vacancy} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
