import { useSite } from '../../lib/store'
import Prose from '../../components/Prose'
import PageHead from '../../components/PageHead'

function Doc({ k }) {
  const { t } = useSite()
  return (
    <>
      <PageHead title={t(k + '.title')} />
      <section className="section">
        <div className="container" style={{ maxWidth: 860 }}><div className="card legal-card"><Prose text={t(k + '.body')} /></div></div>
      </section>
    </>
  )
}
export const Privacy = () => <Doc k="privacy" />
export const Terms = () => <Doc k="terms" />
