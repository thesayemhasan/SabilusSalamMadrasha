import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite, pick } from '../../lib/store'
import { dig } from '../../lib/util'
import PageHead from '../../components/PageHead'
import Icon from '../../components/Icon'

// মার্কশিটের QR স্ক্যান করলে এই পাতা খোলে
export default function Verify() {
  const { code } = useParams()
  const { t, lang } = useSite()
  const [res, setRes] = useState(undefined)
  const d = (v) => dig(v ?? '', lang)

  useEffect(() => {
    setRes(undefined)
    supabase.rpc('public_verify', { p_code: code }).then(({ data, error }) => setRes(error ? null : data || null), () => setRes(null))
  }, [code])

  const r = res && res.result
  return (
    <>
      <PageHead title={t('verify.title')} />
      <section className="section">
        <div className="container stack" style={{ maxWidth: 760 }}>
          {res === undefined && <p className="muted">…</p>}
          {res === null && <div className="alert err"><b>{t('verify.bad')}</b><div>{t('verify.bad.sub')}</div></div>}
          {res && (
            <div className="card stack">
              <div className="alert ok" style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Icon name="check" size={22} cls="cur" /><b>{t('verify.ok')}</b></div>
              <div>
                <h3 style={{ margin: 0 }}>{pick(res.student, 'name', lang)}</h3>
                <div className="muted">{t('result.id')}: {d(res.student.student_no)} · {pick(res.class, 'name', lang)} · {pick(res.exam, 'name', lang)}{res.exam.year ? ` (${d(res.exam.year)})` : ''}</div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>{t('result.subject')}</th><th>{t('result.full')}</th><th>{t('result.marks')}</th></tr></thead>
                  <tbody>
                    {res.subjects.map((s, i) => {
                      const fail = !s.absent && s.marks !== null && Number(s.marks) < Number(s.pass)
                      return <tr key={i}><td>{pick(s, 'name', lang)}</td><td>{d(Number(s.full))}</td><td style={{ color: fail || s.absent ? '#c0262d' : undefined, fontWeight: fail ? 700 : 400 }}>{s.absent ? t('result.absent') : s.marks === null ? '—' : d(Number(s.marks))}</td></tr>
                    })}
                  </tbody>
                </table>
              </div>
              {r && (r.total || r.avg || r.division || r.merit) && (
                <div className="grid g2">
                  {[['total', 'result.total'], ['avg', 'result.avg'], ['division', 'result.division'], ['merit', 'result.merit']].filter(([k]) => r[k]).map(([k, l]) => (
                    <div className="card" key={k}><div className="muted">{t(l)}</div><b style={{ fontSize: '1.2rem' }}>{d(r[k])}</b></div>
                  ))}
                </div>
              )}
              <p className="muted" style={{ margin: 0 }}>{t('verify.note')}</p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
