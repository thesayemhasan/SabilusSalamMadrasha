// সাধারণ লেখাকে সুন্দর পেইজে রূপ দেয়: "# " "## " শিরোনাম, "- " তালিকা, **মোটা**, ফাঁকা লাইনে অনুচ্ছেদ
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p))
}
export default function Prose({ text = '' }) {
  const lines = String(text).replace(/\r/g, '').split('\n')
  const out = []
  let list = []
  let para = []
  const flushList = () => { if (list.length) { out.push(<ul key={out.length}>{list.map((x, i) => <li key={i}>{inline(x)}</li>)}</ul>); list = [] } }
  const flushPara = () => { if (para.length) { out.push(<p key={out.length}>{inline(para.join(' '))}</p>); para = [] } }
  for (const raw of lines) {
    const l = raw.trim()
    if (!l) { flushList(); flushPara(); continue }
    if (l.startsWith('## ')) { flushList(); flushPara(); out.push(<h3 key={out.length}>{l.slice(3)}</h3>) }
    else if (l.startsWith('# ')) { flushList(); flushPara(); out.push(<h2 key={out.length}>{l.slice(2)}</h2>) }
    else if (/^[-•] /.test(l)) { flushPara(); list.push(l.slice(2)) }
    else { flushList(); para.push(l) }
  }
  flushList(); flushPara()
  return <div className="prose">{out}</div>
}
