import Crud from './Crud'

const CLASS = { table: 'classes', label: (r) => r.name_bn || r.name_en }
const STAFF = { table: 'staff', order: 'created_at', eq: { status: 'active' }, label: (r) => r.name_bn || r.name_en }

// শিক্ষক অনুযায়ী বিষয় নির্ধারণ: কোন শিক্ষক কোন শ্রেণিতে কোন বিষয় পড়ান
export default function TeacherSubjects() {
  return (
    <Crud
      table="teacher_subjects"
      title="শিক্ষকের বিষয় নির্ধারণ"
      hint="শিক্ষক, শ্রেণি ও বিষয়ের নাম বেছে যোগ করুন। একই শিক্ষকের একাধিক বিষয় বা একাধিক শ্রেণি থাকলে আলাদা আলাদা করে যোগ করুন। উপরের ফিল্টারে শিক্ষক বা শ্রেণি ধরে দেখা যায়।"
      order="created_at"
      toggle={null}
      nameOf={(r) => r.subject}
      blank={{}}
      filters={[
        { name: 'staff_id', label: 'সব শিক্ষক', optionsFrom: STAFF },
        { name: 'class_id', label: 'সব শ্রেণি', optionsFrom: CLASS },
      ]}
      searchFields={['subject']}
      fields={[
        { name: 'staff_id', label: 'শিক্ষক', type: 'select', optionsFrom: STAFF, required: true },
        { name: 'class_id', label: 'শ্রেণি', type: 'select', optionsFrom: CLASS },
        { name: 'subject', label: 'বিষয় / কিতাবের নাম', required: true },
        { name: 'periods_per_week', label: 'সপ্তাহে ক্লাস সংখ্যা', type: 'number', nullable: true },
        { name: 'note', label: 'নোট', type: 'textarea' },
      ]}
      csv={{
        file: 'শিক্ষকের-বিষয়.csv',
        cols: [['শিক্ষক', (r, m) => m.staff_id?.[r.staff_id]], ['শ্রেণি', (r, m) => m.class_id?.[r.class_id]], ['বিষয়', (r) => r.subject], ['সপ্তাহে ক্লাস', (r) => r.periods_per_week]],
      }}
      summary={(r, m) => (<><b>{r.subject}</b><div className="muted" style={{ fontSize: '.85rem' }}>{[m.staff_id?.[r.staff_id], m.class_id?.[r.class_id], r.periods_per_week ? `সপ্তাহে ${Number(r.periods_per_week).toLocaleString('bn-BD')}টি ক্লাস` : ''].filter(Boolean).join(' · ')}</div></>)}
    />
  )
}
