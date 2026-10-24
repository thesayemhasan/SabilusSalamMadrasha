// সেকশনের শিরোনাম: নিচে হাতে-আঁকা অলংকার রেখা (স্ক্রলে আঁকা হয়)
const star = (() => {
  const pts = []
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 3.1 : 6.6
    const a = (Math.PI / 8) * i - Math.PI / 2
    pts.push(`${(80 + r * Math.cos(a)).toFixed(2)} ${(7 + r * Math.sin(a)).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
})()

export default function SecTitle({ children, left }) {
  return (
    <div className={`sec-title ${left ? 'left' : ''}`}>
      <h2>{children}</h2>
      <svg className="orn" viewBox="0 0 160 14" aria-hidden="true">
        <path className="ln l1" d="M6 7h58" />
        <path className="ln l2" d="M154 7h-58" />
        <path className="st" d={star} />
      </svg>
    </div>
  )
}
