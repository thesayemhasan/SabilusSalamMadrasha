import { useEffect, useState } from 'react'
import { useSite } from '../lib/store'
import { dig } from '../lib/util'

// ইভেন্টের টাইমার: শুরুর আগে "শুরু হতে বাকি", চলাকালে "শেষ হতে বাকি"
export default function Countdown({ start, end, showStart, showEnd }) {
  const { t, lang } = useSite()
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i) }, [])
  if (!showStart && !showEnd) return null
  const s = start ? new Date(start).getTime() : null
  const e = end ? new Date(end).getTime() : null
  let label = '', target = null, kind = 'start'
  if (s && now < s) { if (showStart) { label = t('events.timer.start'); target = s } }
  else if (e && now < e) { kind = 'end'; if (showEnd) { label = t('events.timer.end'); target = e } else return <span className="cd-chip live">{t('events.timer.running')}</span> }
  else if (e && now >= e) return <span className="cd-chip">{t('events.timer.ended')}</span>
  else if (s && now >= s) return <span className="cd-chip live">{t('events.timer.running')}</span>
  if (!target) return null
  let d = Math.max(0, Math.floor((target - now) / 1000))
  const days = Math.floor(d / 86400); d %= 86400
  const hrs = Math.floor(d / 3600); d %= 3600
  const min = Math.floor(d / 60)
  const sec = d % 60
  const cell = (n, k) => <div className="cd-cell"><b>{dig(String(n).padStart(2, '0'), lang)}</b><small>{t(k)}</small></div>
  return (
    <div className={`cd ${kind}`}>
      <span className="cd-label">{label}</span>
      <div className="cd-cells">{cell(days, 'timer.d')}{cell(hrs, 'timer.h')}{cell(min, 'timer.m')}{cell(sec, 'timer.s')}</div>
    </div>
  )
}
