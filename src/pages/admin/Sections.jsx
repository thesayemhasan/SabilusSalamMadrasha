import Crud from './Crud'

const bn = (r, f) => r[`${f}_bn`] || r[`${f}_en`] || r[`${f}_ar`] || '(শিরোনামহীন)'

export const NoticesAdmin = () => (
  <Crud
    table="notices"
    title="নোটিশ বোর্ড"
    order="date"
    blank={{ date: new Date().toISOString().slice(0, 10), published: true, pinned: false }}
    fields={[
      { name: 'title', label: 'শিরোনাম', i18n: true, required: true },
      { name: 'body', label: 'বিস্তারিত', type: 'textarea', i18n: true },
      { name: 'date', label: 'তারিখ', type: 'date' },
      { name: 'pinned', label: 'গুরুত্বপূর্ণ (উপরে পিন করুন)', type: 'bool' },
      { name: 'published', label: 'প্রকাশিত', type: 'bool' },
    ]}
    summary={(r) => (<><b>{bn(r, 'title')}</b>{r.pinned && <span className="tag built">পিন</span>}<div className="muted" style={{ fontSize: '.85rem' }}>{r.date}</div></>)}
  />
)

export const EventsAdmin = () => (
  <Crud
    table="events"
    title="ইভেন্ট ক্যালেন্ডার"
    order="event_date"
    blank={{ event_date: new Date().toISOString().slice(0, 10), published: true }}
    fields={[
      { name: 'title', label: 'অনুষ্ঠানের নাম', i18n: true, required: true },
      { name: 'desc', label: 'বিবরণ', type: 'textarea', i18n: true },
      { name: 'event_date', label: 'তারিখ', type: 'date' },
      { name: 'published', label: 'প্রকাশিত', type: 'bool' },
    ]}
    summary={(r) => (<><b>{bn(r, 'title')}</b><div className="muted" style={{ fontSize: '.85rem' }}>{r.event_date}</div></>)}
  />
)

export const GalleryAdmin = () => (
  <Crud
    table="gallery"
    title="ফটো গ্যালারি"
    order="sort"
    asc
    blank={{ published: true, sort: 0, image_url: '' }}
    fields={[
      { name: 'image_url', label: 'ছবি', type: 'image' },
      { name: 'caption', label: 'ক্যাপশন', i18n: true },
      { name: 'sort', label: 'ক্রম (ছোট সংখ্যা আগে)', type: 'number' },
      { name: 'published', label: 'প্রকাশিত', type: 'bool' },
    ]}
    summary={(r) => (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <img src={r.image_url} alt="" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 8 }} />
        <span>{bn(r, 'caption') === '(শিরোনামহীন)' ? 'ছবি' : bn(r, 'caption')}</span>
      </div>
    )}
  />
)

export const TeachersAdmin = () => (
  <Crud
    table="public_teachers"
    title="শিক্ষকবৃন্দ (পাবলিক পেইজ)"
    order="sort"
    asc
    blank={{ published: true, sort: 0 }}
    fields={[
      { name: 'photo_url', label: 'ছবি', type: 'image' },
      { name: 'name', label: 'নাম', i18n: true, required: true },
      { name: 'designation', label: 'পদবি', i18n: true },
      { name: 'sort', label: 'ক্রম (ছোট সংখ্যা আগে)', type: 'number' },
      { name: 'published', label: 'প্রকাশিত', type: 'bool' },
    ]}
    summary={(r) => (<><b>{bn(r, 'name')}</b><div className="muted" style={{ fontSize: '.85rem' }}>{bn(r, 'designation') === '(শিরোনামহীন)' ? '' : bn(r, 'designation')}</div></>)}
  />
)
