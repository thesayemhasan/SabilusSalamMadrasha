import { useState } from 'react'

// রং: যাচাই করা ক্যাটাগরিক্যাল প্যালেট (CSS ভ্যারিয়েবলে লাইট/ডার্ক আলাদা)
export const SERIES = ['var(--v1)', 'var(--v2)', 'var(--v3)', 'var(--v4)', 'var(--v5)']
const bn = (n) => Number(n || 0).toLocaleString('bn-BD')

// চার্টের কার্ড: শিরোনাম, চার্ট/তালিকা বদল
export function ChartCard({ title, sub, table, children, wide }) {
  const [view, setView] = useState('chart')
  return (
    <div className={`card viz ${wide ? 'wide' : ''}`}>
      <div className="viz-head">
        <div><h3>{title}</h3>{sub && <span className="muted">{sub}</span>}</div>
        {table && <button type="button" className="viz-toggle" onClick={() => setView(view === 'chart' ? 'table' : 'chart')}>{view === 'chart' ? 'তালিকা' : 'চার্ট'}</button>}
      </div>
      {view === 'chart' || !table ? children : (
        <div className="table-wrap"><table><tbody>{table.map(([a, b], i) => <tr key={i}><td>{a}</td><td style={{ textAlign: 'end' }}>{b}</td></tr>)}</tbody></table></div>
      )}
    </div>
  )
}

// আনুভূমিক বার (একটি সিরিজ): [{label, value}]
export function HBars({ data, fmt = bn, empty = 'কোনো তথ্য নেই' }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  if (!data.length || data.every((d) => !d.value)) return <p className="muted">{empty}</p>
  return (
    <div className="vz-hbars">
      {data.map((d) => (
        <div className="vz-hb" key={d.label} title={`${d.label}: ${fmt(d.value)}`}>
          <span className="vz-hb-l">{d.label}</span>
          <span className="vz-hb-track"><span className="vz-hb-fill" style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }} /></span>
          <span className="vz-hb-v">{fmt(d.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ডোনাট: [{label, value}] (সর্বোচ্চ ৫টি; বাকিগুলো "অন্যান্য")
export function Donut({ data, size = 150 }) {
  const [hi, setHi] = useState(null)
  let items = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value)
  if (items.length > 5) items = [...items.slice(0, 4), { label: 'অন্যান্য', value: items.slice(4).reduce((a, d) => a + d.value, 0) }]
  const total = items.reduce((a, d) => a + d.value, 0)
  if (!total) return <p className="muted">কোনো তথ্য নেই</p>
  const r = 52; const C = 2 * Math.PI * r
  let off = 0
  const cur = hi != null ? items[hi] : null
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label="ডোনাট চার্ট">
        <g transform="rotate(-90 70 70)">
          {items.map((d, i) => {
            const len = (d.value / total) * C
            const el = <circle key={d.label} cx="70" cy="70" r={r} fill="none" stroke={SERIES[i]} strokeWidth={hi === i ? 20 : 16} strokeDasharray={`${Math.max(0, len - 2)} ${C - Math.max(0, len - 2)}`} strokeDashoffset={-off} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} style={{ transition: 'stroke-width .4s var(--ease)' }}><title>{`${d.label}: ${bn(d.value)} (${Math.round((d.value / total) * 100)}%)`}</title></circle>
            off += len
            return el
          })}
        </g>
        <text x="70" y="66" textAnchor="middle" className="donut-n">{bn(cur ? cur.value : total)}</text>
        <text x="70" y="84" textAnchor="middle" className="donut-s">{cur ? cur.label : 'মোট'}</text>
      </svg>
      <ul className="vz-legend">
        {items.map((d, i) => <li key={d.label} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}><i style={{ background: SERIES[i] }} />{d.label} <b>{bn(d.value)}</b> <span className="muted">({Math.round((d.value / total) * 100)}%)</span></li>)}
      </ul>
    </div>
  )
}

// জোড়া কলাম (২ সিরিজ): labels[], a[], b[]
export function Columns({ labels, a, b, nameA, nameB, fmt = (n) => `৳ ${bn(Math.round(n))}` }) {
  const [hi, setHi] = useState(null)
  const max = Math.max(1, ...a, ...b)
  const W = 100 / labels.length
  return (
    <div className="vz-cols-wrap">
      <ul className="vz-legend row">
        <li><i style={{ background: SERIES[0] }} />{nameA}</li><li><i style={{ background: SERIES[1] }} />{nameB}</li>
      </ul>
      <div className="vz-cols">
        {labels.map((l, i) => (
          <div className="vz-col" key={l} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onClick={() => setHi(hi === i ? null : i)}>
            {hi === i && <div className="vz-tip"><b>{l}</b><div><i style={{ background: SERIES[0] }} />{nameA}: {fmt(a[i])}</div><div><i style={{ background: SERIES[1] }} />{nameB}: {fmt(b[i])}</div></div>}
            <div className="vz-bars">
              <span className="vz-bar" style={{ height: `${(a[i] / max) * 100}%`, background: SERIES[0] }} />
              <span className="vz-bar" style={{ height: `${(b[i] / max) * 100}%`, background: SERIES[1] }} />
            </div>
            <span className="vz-cl">{l}</span>
          </div>
        ))}
      </div>
      <span className="muted" style={{ fontSize: '.8rem', width: `${W * 0 + 100}%` }}>সর্বোচ্চ: {fmt(max)}</span>
    </div>
  )
}
