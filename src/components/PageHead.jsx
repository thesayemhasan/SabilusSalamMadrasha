export default function PageHead({ title, sub }) {
  return (
    <div className="page-head">
      <div className="container">
        <h1>{title}</h1>
        {sub && <p className="muted" style={{ margin: 0 }}>{sub}</p>}
      </div>
    </div>
  )
}
