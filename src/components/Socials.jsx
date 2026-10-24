import Icon from './Icon'
import { socialHref } from '../lib/util'

// সোশ্যাল আইকনের সারি: items = [{type, url}]; cls: foot-soc | dev-soc
export default function Socials({ items = [], size = 18, cls = '' }) {
  const list = (items || []).filter((x) => x && x.url && socialHref(x.type, x.url))
  if (!list.length) return null
  return (
    <span className={`socials ${cls}`}>
      {list.map((x, i) => (
        <a key={i} href={socialHref(x.type, x.url)} target="_blank" rel="noreferrer noopener" aria-label={x.type} title={x.type}>
          <Icon name={x.type} size={size} cls="cur" />
        </a>
      ))}
    </span>
  )
}
