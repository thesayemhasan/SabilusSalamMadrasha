import Crud from './Crud'
import { dateBn } from './fin'

const days = (r) => Math.round((new Date(`${r.to_date}T00:00:00`) - new Date(`${r.from_date}T00:00:00`)) / 864e5) + 1

// ঘোষিত ছুটির তালিকা: হাজিরার পাতায় ছুটির দিনে সতর্কবার্তা ও মাসিক রিপোর্টে ছুটির দিনের সংখ্যা দেখায়
export default function Holidays() {
  return (
    <Crud
      table="holidays"
      title="ছুটির তালিকা"
      hint="ঈদ, বার্ষিক ছুটি বা যেকোনো ঘোষিত ছুটি তারিখসহ যোগ করুন। এক দিনের ছুটি হলে শুরু ও শেষের তারিখ একই দিন। ছুটির দিনে হাজিরা নিতে গেলে হাজিরার পাতায় বার্তা দেখাবে।"
      order="from_date"
      asc
      toggle={null}
      nameOf={(r) => r.title}
      blank={{}}
      fields={[
        { name: 'title', label: 'ছুটির নাম', required: true },
        { name: 'from_date', label: 'শুরুর তারিখ', type: 'date', required: true },
        { name: 'to_date', label: 'শেষের তারিখ', type: 'date', required: true },
        { name: 'note', label: 'নোট', type: 'textarea' },
      ]}
      summary={(r) => (<><b>{r.title}</b><div className="muted" style={{ fontSize: '.85rem' }}>{dateBn(r.from_date)}{r.to_date !== r.from_date ? ` — ${dateBn(r.to_date)}` : ''} · {days(r).toLocaleString('bn-BD')} দিন</div></>)}
    />
  )
}
