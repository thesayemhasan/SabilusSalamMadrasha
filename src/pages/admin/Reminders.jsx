import Crud from './Crud'
import { dateBn, todayStr } from './fin'

// রিমাইন্ডার: কাজ, নোট ও তারিখের স্মরণ। তারিখ পার হলে "দেরি" চিহ্ন দেখায়
export default function Reminders() {
  return (
    <Crud
      table="reminders"
      title="রিমাইন্ডার"
      hint="যে কাজ বা তারিখ মনে রাখতে চান তা যোগ করুন। কাজ শেষ হলে ডানের সুইচ চালু করে সম্পন্ন করুন। তারিখ পার হয়ে গেলে ও কাজ বাকি থাকলে লাল চিহ্ন দেখাবে।"
      order="due_date"
      asc
      toggle="done"
      toggleLabel="সম্পন্ন"
      nameOf={(r) => r.title}
      blank={{ done: false }}
      fields={[
        { name: 'title', label: 'কাজ / বিষয়', required: true },
        { name: 'due_date', label: 'তারিখ', type: 'date', required: false },
        { name: 'note', label: 'নোট', type: 'textarea' },
      ]}
      summary={(r) => (
        <>
          <b style={r.done ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>{r.title}</b>
          {!r.done && r.due_date && r.due_date < todayStr() && <span className="tag" style={{ background: '#c0392b', color: '#fff', marginInlineStart: 6 }}>দেরি</span>}
          <div className="muted" style={{ fontSize: '.85rem' }}>{r.due_date ? dateBn(r.due_date) : 'তারিখ নেই'}{r.note ? ` · ${r.note}` : ''}</div>
        </>
      )}
    />
  )
}
