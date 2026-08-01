import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// Горизонтальный бар «сколько контейнеров на каждом этапе коридора».
export default function StageChart({ data }) {
  const rows = data.map((d) => ({ name: d.title, count: d.count, stage: d.stage }))
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 34)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" allowDecimals={false} hide />
        <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11, fill: '#5b6b76' }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: '#eef0ee' }}
          contentStyle={{ borderRadius: 8, border: '1px solid #dfe3e2', fontSize: 12 }}
        />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={18}>
          {rows.map((r) => (
            <Cell key={r.stage} fill={r.stage === 'ferry_wait' ? '#D98A2B' : '#2E7D8A'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
