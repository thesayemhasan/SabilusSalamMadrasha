import { useRef, useState } from 'react'
import Crud from './Crud'
import { supabase, uploadImage } from '../../lib/supabase'
import { youtubeId } from '../../lib/util'
import Icon from '../../components/Icon'

const bn = (r, f) => r[`${f}_bn`] || r[`${f}_en`] || '(শিরোনামহীন)'
const none = '(শিরোনামহীন)'
const sub = (t) => <div className="muted" style={{ fontSize: '.85rem' }}>{t}</div>

export const NoticesAdmin = () => (
  <Crud
    table="notices"
    title="নোটিশ বোর্ড"
    hint="এখানকার নোটিশ নোটিশ পেইজে এবং হোম পেইজের জরুরি নোটিশ বোর্ডে দেখা যায়। পিন করা নোটিশ আগে আসে। চাইলে শুরু/শেষের সময় দিয়ে টাইমার চালু করা যায়: শুরুর আগে 'শুরু হতে বাকি', চলাকালে 'শেষ হতে বাকি' দেখাবে।"
    order="date"
    nameOf={(r) => bn(r, 'title')}
    blank={{ date: new Date().toISOString().slice(0, 10), published: true, pinned: false, show_start_timer: false, show_end_timer: false }}
    fields={[
      { name: 'title', label: 'শিরোনাম', i18n: true, required: true },
      { name: 'body', label: 'বিস্তারিত', type: 'textarea', i18n: true },
      { name: 'date', label: 'তারিখ', type: 'date' },
      { name: 'start_at', label: 'শুরুর সময় (ঐচ্ছিক, টাইমারের জন্য)', type: 'datetime' },
      { name: 'end_at', label: 'শেষের সময় (ঐচ্ছিক, টাইমারের জন্য)', type: 'datetime' },
      { name: 'show_start_timer', label: 'টাইমার: "শুরু হতে বাকি" দেখান', type: 'bool' },
      { name: 'show_end_timer', label: 'টাইমার: "শেষ হতে বাকি" দেখান', type: 'bool' },
      { name: 'pinned', label: 'গুরুত্বপূর্ণ (উপরে পিন করুন)', type: 'bool' },
      { name: 'published', label: 'প্রকাশিত', type: 'bool' },
    ]}
    summary={(r) => (<><b>{bn(r, 'title')}</b>{r.pinned && <span className="tag built">পিন</span>}{(r.show_start_timer || r.show_end_timer) && <span className="tag built">টাইমার</span>}{sub(r.date)}</>)}
  />
)

export const EventsAdmin = () => (
  <Crud
    table="events"
    title="ইভেন্ট ও টাইমার"
    hint="শুরু ও শেষের সময় দিয়ে টাইমার চালু করুন: শুরুর আগে 'শুরু হতে বাকি', চলাকালে 'শেষ হতে বাকি' দেখাবে।"
    order="event_date"
    nameOf={(r) => bn(r, 'title')}
    blank={{ event_date: new Date().toISOString().slice(0, 10), published: true, show_start_timer: false, show_end_timer: false }}
    beforeSave={(p) => ({ ...p, event_date: p.start_at ? new Date(p.start_at).toLocaleDateString('en-CA') : p.event_date })}
    fields={[
      { name: 'title', label: 'অনুষ্ঠানের নাম', i18n: true, required: true },
      { name: 'desc', label: 'বিবরণ', type: 'textarea', i18n: true },
      { name: 'event_date', label: 'তারিখ (শুরুর সময় দিলে নিজে থেকে বসে যাবে)', type: 'date' },
      { name: 'start_at', label: 'শুরুর সময়', type: 'datetime' },
      { name: 'end_at', label: 'শেষের সময়', type: 'datetime' },
      { name: 'show_start_timer', label: 'টাইমার: "শুরু হতে বাকি" দেখান', type: 'bool' },
      { name: 'show_end_timer', label: 'টাইমার: "শেষ হতে বাকি" দেখান', type: 'bool' },
      { name: 'published', label: 'প্রকাশিত', type: 'bool' },
    ]}
    summary={(r) => (<><b>{bn(r, 'title')}</b>{(r.show_start_timer || r.show_end_timer) && <span className="tag built">টাইমার</span>}{sub(r.start_at ? new Date(r.start_at).toLocaleString('bn-BD') : r.event_date)}</>)}
  />
)

function BulkUpload({ reload }) {
  const ref = useRef()
  const [state, setState] = useState('')
  async function go(e) {
    const files = [...(e.target.files || [])]
    if (!files.length) return
    let ok = 0
    for (let i = 0; i < files.length; i++) {
      setState(`আপলোড হচ্ছে ${i + 1}/${files.length}…`)
      try {
        const url = await uploadImage(files[i], 'gallery')
        await supabase.from('gallery').insert({ kind: 'image', image_url: url, published: true, sort: 0 })
        ok++
      } catch {}
    }
    setState(`${ok} টি ছবি যোগ হয়েছে`)
    e.target.value = ''
    reload()
  }
  return (
    <>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={go} />
      <button className="btn outline" type="button" onClick={() => ref.current.click()}><Icon name="upload" size={18} cls="cur" /> একসাথে অনেক ছবি</button>
      {state && <span className="muted">{state}</span>}
    </>
  )
}

export const GalleryAdmin = () => (
  <Crud
    table="gallery"
    title="ফটো ও ভিডিও গ্যালারি"
    hint="ছবি সরাসরি আপলোড করুন। ভিডিওর জন্য ইউটিউবের লিংক বসান, ওয়েবসাইটেই চালু হবে।"
    order="sort"
    asc
    nameOf={(r) => (r.caption_bn || r.caption_en || (r.kind === 'video' ? 'ভিডিও' : 'ছবি'))}
    extra={BulkUpload}
    blank={{ published: true, sort: 0, kind: 'image', image_url: '' }}
    fields={[
      { name: 'kind', label: 'ধরন', type: 'select', options: [['image', 'ছবি'], ['video', 'ভিডিও (ইউটিউব লিংক)']] },
      { name: 'image_url', label: 'ছবি', type: 'image', showIf: (v) => v.kind !== 'video' },
      { name: 'video_url', label: 'ইউটিউব ভিডিওর লিংক', placeholder: 'https://www.youtube.com/watch?v=…', showIf: (v) => v.kind === 'video', hint: 'watch, youtu.be বা shorts লিংক চলবে' },
      { name: 'caption', label: 'ক্যাপশন', i18n: true },
      { name: 'sort', label: 'ক্রম (ছোট সংখ্যা আগে)', type: 'number' },
      { name: 'published', label: 'প্রকাশিত', type: 'bool' },
    ]}
    beforeSave={(p) => (p.kind === 'video' ? { ...p, image_url: p.image_url || null } : { ...p, video_url: null })}
    summary={(r) => {
      const th = r.kind === 'video' ? `https://img.youtube.com/vi/${youtubeId(r.video_url)}/mqdefault.jpg` : r.image_url
      return (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <img src={th} alt="" style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 10 }} />
          <span>{r.kind === 'video' && <span className="tag built">ভিডিও</span>}{r.caption_bn || r.caption_en || (r.kind === 'video' ? r.video_url : 'ছবি')}</span>
        </div>
      )
    }}
  />
)

export const TeachersAdmin = () => (
  <Crud
    table="public_teachers"
    title="শিক্ষকবৃন্দ (পাবলিক পেইজ)"
    hint="কল আইকনে চাপলে পপআপে যে বার্তা দেখাবে তা এখানে প্রত্যেকের জন্য আলাদা লিখতে পারেন। ফাঁকা রাখলে 'সাইটের লেখা > শিক্ষকের কল পপআপ' এর সাধারণ বার্তা দেখাবে।"
    order="sort"
    asc
    nameOf={(r) => bn(r, 'name')}
    blank={{ published: true, sort: 0 }}
    fields={[
      { name: 'photo_url', label: 'ছবি', type: 'image' },
      { name: 'name', label: 'নাম', i18n: true, required: true },
      { name: 'designation', label: 'পদবি', i18n: true },
      { name: 'facebook', label: 'ফেসবুক প্রোফাইলের লিংক' },
      { name: 'whatsapp', label: 'হোয়াটসঅ্যাপ নম্বর', placeholder: '8801XXXXXXXXX' },
      { name: 'phone', label: 'কলের ফোন নম্বর (ফাঁকা হলে মাদরাসার নম্বর)' },
      { name: 'call_msg', label: 'কল পপআপের বার্তা (ঐচ্ছিক)', type: 'textarea', i18n: true },
      { name: 'sort', label: 'ক্রম (ছোট সংখ্যা আগে)', type: 'number' },
      { name: 'published', label: 'প্রকাশিত', type: 'bool' },
    ]}
    summary={(r) => (<><b>{bn(r, 'name')}</b>{sub(bn(r, 'designation') === none ? '' : bn(r, 'designation'))}</>)}
  />
)

export const HeroSlidesAdmin = () => (
  <Crud
    table="hero_slides"
    title="হোম স্লাইডের ছবি"
    hint="১২০০×৬০০ পিক্সেলের ছবি দিন। এই ছবিগুলো দেখাবে যখন 'সেটিংস > হোম' এ স্লাইডের উৎস 'নিজস্ব স্লাইড' থাকবে। 'গ্যালারির ছবি' বেছে নিলে গ্যালারি থেকে দেখাবে।"
    order="sort"
    asc
    nameOf={(r) => (r.title_bn || r.title_en || 'স্লাইড')}
    blank={{ published: true, sort: 0, image_url: '' }}
    fields={[
      { name: 'image_url', label: 'ছবি (১২০০×৬০০)', type: 'image', shape: 'wide' },
      { name: 'title', label: 'শিরোনাম (ঐচ্ছিক)', i18n: true },
      { name: 'sub', label: 'ছোট লেখা (ঐচ্ছিক)', i18n: true },
      { name: 'link', label: 'ক্লিক করলে যে লিংকে যাবে (ঐচ্ছিক)', placeholder: '/admission অথবা https://…' },
      { name: 'sort', label: 'ক্রম (ছোট সংখ্যা আগে)', type: 'number' },
      { name: 'published', label: 'প্রকাশিত', type: 'bool' },
    ]}
    summary={(r) => (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <img src={r.image_url} alt="" style={{ width: 112, height: 56, objectFit: 'cover', borderRadius: 10 }} />
        <span>{r.title_bn || r.title_en || 'স্লাইড'}</span>
      </div>
    )}
  />
)

const PLACES = [['top', 'সবার উপরে (স্লাইডের আগে)'], ['after_slide', 'স্লাইড ও নোটিশ বোর্ডের পরে'], ['after_why', '"কেন সাবিলুস সালাম" এর পরে'], ['after_events', 'নোটিশ/ইভেন্টের পরে'], ['bottom', 'একদম নিচে']]
const KINDS = [['announce', 'ঘোষণা বার (বোতামসহ)'], ['text', 'লেখা'], ['cards', 'কার্ড সারি (নতুন শাখা/বৈশিষ্ট্য)'], ['image_text', 'ছবি + লেখা']]
export const HomeBlocksAdmin = () => (
  <Crud
    table="home_blocks"
    title="হোম পেইজের অতিরিক্ত রো"
    hint="নতুন শাখা বা বৈশিষ্ট্য চালু হলে এখান থেকে হোম পেইজে নতুন রো যোগ করুন। কোথায় দেখাবে তাও ঠিক করতে পারবেন।"
    order="sort"
    asc
    nameOf={(r) => (r.title_bn || r.title_en || 'রো')}
    blank={{ published: true, sort: 0, kind: 'cards', place: 'after_why', items: [] }}
    fields={[
      { name: 'kind', label: 'ধরন', type: 'select', options: KINDS },
      { name: 'place', label: 'কোথায় দেখাবে', type: 'select', options: PLACES },
      { name: 'title', label: 'শিরোনাম', i18n: true },
      { name: 'body', label: 'লেখা', type: 'textarea', i18n: true },
      { name: 'items', label: 'কার্ডসমূহ', type: 'items', showIf: (v) => v.kind === 'cards', itemFields: [{ name: 'icon', label: 'আইকন', type: 'icon' }, { name: 'title', label: 'কার্ডের শিরোনাম', i18n: true }, { name: 'text', label: 'কার্ডের লেখা', i18n: true, type: 'textarea' }] },
      { name: 'image_url', label: 'ছবি', type: 'image', showIf: (v) => v.kind === 'image_text' },
      { name: 'btn', label: 'বোতামের লেখা (ঐচ্ছিক)', i18n: true, showIf: (v) => v.kind !== 'cards' },
      { name: 'link', label: 'বোতামের লিংক', placeholder: '/admission অথবা https://…', showIf: (v) => v.kind !== 'cards' },
      { name: 'sort', label: 'ক্রম (ছোট সংখ্যা আগে)', type: 'number' },
      { name: 'published', label: 'প্রকাশিত', type: 'bool' },
    ]}
    summary={(r) => (<><b>{r.title_bn || r.title_en || '(শিরোনামহীন)'}</b><span className="tag">{(KINDS.find((k) => k[0] === r.kind) || [])[1]}</span>{sub((PLACES.find((k) => k[0] === r.place) || [])[1])}</>)}
  />
)

const FTYPES = [['text', 'ছোট লেখা'], ['textarea', 'বড় লেখা'], ['phone', 'মোবাইল নম্বর'], ['email', 'ইমেইল'], ['date', 'তারিখ'], ['number', 'সংখ্যা'], ['select', 'তালিকা থেকে বাছাই'], ['file', 'ফাইল/ছবি আপলোড (জন্মসনদ, ছবি ইত্যাদি)']]
const MAPS = [['', 'কোনোটিই নয় (শুধু আবেদনে সংরক্ষণ)'], ['student_name', 'শিক্ষার্থীর নাম'], ['father_name', 'পিতার নাম'], ['mother_name', 'মাতার নাম'], ['phone', 'মোবাইল নম্বর'], ['department', 'বিভাগ'], ['class_name', 'শ্রেণি'], ['address', 'ঠিকানা'], ['note', 'অতিরিক্ত তথ্য']]
const DEFAULT_FIELDS = [
  ['student_name', 'শিক্ষার্থীর নাম', 'Student name', 'text', true, 'student_name', ''],
  ['father_name', 'পিতার নাম', 'Father’s name', 'text', false, 'father_name', ''],
  ['mother_name', 'মাতার নাম', 'Mother’s name', 'text', false, 'mother_name', ''],
  ['phone', 'মোবাইল নম্বর', 'Mobile number', 'phone', true, 'phone', ''],
  ['department', 'বিভাগ', 'Department', 'select', false, 'department', 'হিফজ বিভাগ\nকওমি বিভাগ\nমহিলা মাদরাসা'],
  ['class_name', 'শ্রেণি', 'Class', 'text', false, 'class_name', ''],
  ['photo', 'শিক্ষার্থীর ছবি', 'Student photo', 'file', false, '', ''],
  ['birth_cert', 'জন্মনিবন্ধন সনদ', 'Birth certificate', 'file', false, '', ''],
  ['address', 'ঠিকানা', 'Address', 'text', false, 'address', ''],
  ['note', 'অতিরিক্ত তথ্য', 'Additional notes', 'textarea', false, 'note', ''],
]
function SeedFields({ reload }) {
  const [busy, setBusy] = useState(false)
  async function seed() {
    setBusy(true)
    await supabase.from('admission_fields').insert(DEFAULT_FIELDS.map(([k, lb, le, type, required, map, ob], i) => ({ field_key: k, label_bn: lb, label_en: le, type, required, map_to: map || null, options_bn: ob, options_en: '', sort: i + 1, published: true })))
    setBusy(false)
    reload()
  }
  return <button type="button" className="btn outline" disabled={busy} onClick={seed}>ডিফল্ট ঘরগুলো যোগ করুন</button>
}
export const AdmissionFieldsAdmin = () => (
  <Crud
    table="admission_fields"
    title="ভর্তি ফরমের ঘর"
    hint="এখানে কোনো ঘর যোগ না থাকলে ওয়েবসাইটে ডিফল্ট ফরম দেখায়। 'ডিফল্ট ঘরগুলো যোগ করুন' চেপে ছবি ও জন্মসনদসহ সব ঘর এনে নিজের মতো বদলান বা নতুন ঘর যোগ করুন।"
    order="sort"
    asc
    extra={SeedFields}
    toggleLabel="দেখান"
    nameOf={(r) => (r.label_bn || r.label_en || 'ঘর')}
    blank={{ published: true, sort: 99, type: 'text', required: false, field_key: '' }}
    beforeSave={(p) => ({ ...p, field_key: p.field_key || `f_${Math.random().toString(36).slice(2, 8)}`, map_to: p.map_to || null })}
    fields={[
      { name: 'label', label: 'ঘরের নাম', i18n: true, required: true },
      { name: 'type', label: 'ঘরের ধরন', type: 'select', options: FTYPES },
      { name: 'options', label: 'বাছাইয়ের তালিকা (প্রতি লাইনে একটি)', type: 'textarea', i18n: true, showIf: (v) => v.type === 'select' },
      { name: 'required', label: 'অবশ্যই পূরণীয়', type: 'bool' },
      { name: 'map_to', label: 'আবেদন তালিকার কোন কলামে বসবে', type: 'select', options: MAPS },
      { name: 'sort', label: 'ক্রম (ছোট সংখ্যা আগে)', type: 'number' },
      { name: 'published', label: 'ফরমে দেখান', type: 'bool' },
    ]}
    summary={(r) => (<><b>{r.label_bn || r.label_en}</b>{r.required && <span className="tag built">আবশ্যক</span>}<span className="tag">{(FTYPES.find((k) => k[0] === r.type) || [])[1]}</span></>)}
  />
)

const DEPT_ICONS = [['book', 'বই'], ['books', 'বই (একাধিক)'], ['lotus', 'পদ্ম'], ['moon', 'চাঁদ'], ['star', 'তারা'], ['teacher', 'শিক্ষক'], ['users', 'ছাত্র-ছাত্রী'], ['building', 'ভবন'], ['shield', 'ঢাল'], ['globe', 'গ্লোব'], ['chat', 'আলোচনা'], ['home', 'ঘর']]

export const DepartmentsAdmin = () => (
  <Crud
    table="departments"
    title="মাদরাসার বিভাগ"
    hint="এখানে যোগ, সম্পাদনা বা মুছে দিলে হোম পেইজ ও 'বিভাগসমূহ' পেইজে সঙ্গে সঙ্গে বদলে যাবে। হোম পেইজের বিভাগ সংখ্যাও নিজে থেকে হিসাব হবে।"
    order="sort"
    asc
    nameOf={(r) => bn(r, 'name')}
    blank={{ published: true, sort: 0, icon: 'book' }}
    fields={[
      { name: 'name', label: 'বিভাগের নাম', i18n: true, required: true },
      { name: 'text', label: 'সংক্ষিপ্ত বিবরণ', type: 'textarea', i18n: true },
      { name: 'icon', label: 'আইকন', type: 'select', options: DEPT_ICONS },
      { name: 'sort', label: 'ক্রম (ছোট সংখ্যা আগে)', type: 'number' },
      { name: 'published', label: 'প্রকাশিত', type: 'bool' },
    ]}
    summary={(r) => (<><b>{bn(r, 'name')}</b>{sub(r.text_bn || r.text_en || '')}</>)}
  />
)
