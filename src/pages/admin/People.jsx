import Crud from './Crud'

const bn = (r, f) => r[`${f}_bn`] || r[`${f}_en`] || '(নামহীন)'
const sub = (t) => <div className="muted" style={{ fontSize: '.85rem' }}>{t}</div>
const today = () => new Date().toISOString().slice(0, 10)

export const STU_STATUS = [['active', 'সক্রিয়'], ['inactive', 'নিষ্ক্রিয়'], ['left', 'ছেড়ে গেছে'], ['graduated', 'পাশ / ফারেগ']]
const STATUS_L = Object.fromEntries(STU_STATUS)
const GENDER = [['male', 'ছেলে'], ['female', 'মেয়ে']]
const KIND = [['teacher', 'শিক্ষক'], ['staff', 'কর্মচারী']]

const DEPT = { table: 'departments', label: (r) => r.name_bn || r.name_en }
const CLASS = { table: 'classes', label: (r) => r.name_bn || r.name_en }
const STAFF_ACTIVE = { table: 'staff', order: 'created_at', eq: { status: 'active' }, label: (r) => bn(r, 'name') }
const RESIDENCE = { table: 'lookups', eq: { kind: 'residence' }, value: (r) => r.name_bn || r.name_en, label: (r) => r.name_bn || r.name_en }

const Thumb = ({ src, name }) => (
  <span className="avatar-sm">{src ? <img src={src} alt="" /> : (name || '?').trim().charAt(0)}</span>
)

/* ---------- শ্রেণি ---------- */
const EQ_CLASS = undefined
export const ClassesAdmin = () => (
  <Crud
    table="classes"
    title="শ্রেণি ও হালকা"
    hint="শ্রেণি, শাখা বা হিফজের হালকা (দল) এখানে তৈরি করুন। প্রতিটির বিভাগ ও দায়িত্বপ্রাপ্ত শিক্ষক বেছে দিতে পারবেন। ছাত্র যোগ করার সময় এখান থেকেই শ্রেণি বাছাই হবে।"
    order="sort"
    asc
    eq={EQ_CLASS}
    nameOf={(r) => bn(r, 'name')}
    blank={{ published: true, sort: 0 }}
    fields={[
      { name: 'name', label: 'শ্রেণি / হালকার নাম', i18n: true, required: true },
      { name: 'department_id', label: 'বিভাগ', type: 'select', optionsFrom: DEPT },
      { name: 'teacher_id', label: 'দায়িত্বপ্রাপ্ত শিক্ষক', type: 'select', optionsFrom: STAFF_ACTIVE },
      { name: 'sort', label: 'ক্রম (ছোট সংখ্যা আগে)', type: 'number' },
      { name: 'published', label: 'সক্রিয়', type: 'bool' },
    ]}
    toggleLabel="সক্রিয়"
    summary={(r, m) => (<><b>{bn(r, 'name')}</b>{sub([m.department_id?.[r.department_id], r.teacher_id && `শিক্ষক: ${m.teacher_id?.[r.teacher_id] || ''}`].filter(Boolean).join(' · '))}</>)}
  />
)

/* ---------- ছাত্র-ছাত্রী ---------- */
export const StudentsAdmin = () => (
  <Crud
    table="students"
    title="ছাত্র-ছাত্রী"
    addLabel="নতুন ছাত্র যোগ"
    hint="আইডি নম্বর নিজে থেকে তৈরি হবে। ভর্তির আবেদন থেকে সরাসরি ছাত্র বানাতে 'ভর্তির আবেদন' পেইজের বাটন ব্যবহার করুন।"
    order="created_at"
    toggle={null}
    nameOf={(r) => bn(r, 'name')}
    blank={{ status: 'active', admission_date: today() }}
    searchFields={['name_bn', 'name_en', 'student_no', 'father_name', 'guardian_phone', 'device_user_id']}
    filters={[
      { name: 'department_id', label: 'সব বিভাগ', optionsFrom: DEPT },
      { name: 'class_id', label: 'সব শ্রেণি', optionsFrom: CLASS },
      { name: 'residence', label: 'সব ধরন', optionsFrom: RESIDENCE },
      { name: 'blood_group', label: 'রক্তের গ্রুপ', options: ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'].map((b) => [b, b]) },
      { name: 'status', label: 'সব অবস্থা', options: STU_STATUS },
    ]}
    csv={{
      file: 'ছাত্র-তালিকা.csv',
      cols: [
        ['আইডি', (r) => r.student_no], ['নাম', (r) => bn(r, 'name')], ['পিতা', (r) => r.father_name], ['মাতা', (r) => r.mother_name],
        ['অভিভাবকের ফোন', (r) => r.guardian_phone], ['বিভাগ', (r, m) => m.department_id?.[r.department_id]], ['শ্রেণি', (r, m) => m.class_id?.[r.class_id]],
        ['ধরন', (r) => r.residence], ['রক্তের গ্রুপ', (r) => r.blood_group], ['ভর্তির তারিখ', (r) => r.admission_date], ['জন্মতারিখ', (r) => r.dob], ['ঠিকানা', (r) => r.address], ['অবস্থা', (r) => STATUS_L[r.status]],
      ],
    }}
    fields={[
      { name: 'photo_url', label: 'ছবি', type: 'image' },
      { name: 'name', label: 'ছাত্রের নাম', i18n: true, required: true },
      { name: 'gender', label: 'ছেলে / মেয়ে', type: 'select', options: [['', '— বাছাই করুন —'], ...GENDER] },
      { name: 'dob', label: 'জন্মতারিখ', type: 'date', required: false },
      { name: 'blood_group', label: 'রক্তের গ্রুপ', type: 'select', options: [['', '— জানা নেই —'], ...['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'].map((b) => [b, b])] },
      { name: 'father_name', label: 'পিতার নাম' },
      { name: 'mother_name', label: 'মাতার নাম' },
      { name: 'guardian_phone', label: 'অভিভাবকের মোবাইল (SMS ও হাজিরার বার্তা এই নম্বরে যাবে)' },
      { name: 'phone2', label: 'বিকল্প মোবাইল' },
      { name: 'address', label: 'ঠিকানা', type: 'textarea' },
      { name: 'department_id', label: 'বিভাগ', type: 'select', optionsFrom: DEPT },
      { name: 'class_id', label: 'শ্রেণি / হালকা', type: 'select', optionsFrom: CLASS },
      { name: 'residence', label: 'আবাসিক / অনাবাসিক', type: 'select', optionsFrom: RESIDENCE },
      { name: 'admission_date', label: 'ভর্তির তারিখ', type: 'date', required: false },
      { name: 'student_no', label: 'আইডি নম্বর (ফাঁকা রাখলে নিজে তৈরি হবে)' },
      { name: 'device_user_id', label: 'হাজিরা মেশিনের আইডি (মেশিন থাকলে)' },
      { name: 'status', label: 'অবস্থা', type: 'select', options: STU_STATUS },
      { name: 'note', label: 'নোট', type: 'textarea' },
    ]}
    summary={(r, m) => (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Thumb src={r.photo_url} name={bn(r, 'name')} />
        <div style={{ minWidth: 0 }}>
          <b>{bn(r, 'name')}</b> <span className="tag">{r.student_no}</span> {r.status !== 'active' && <span className="pill">{STATUS_L[r.status]}</span>}
          {sub([m.class_id?.[r.class_id], m.department_id?.[r.department_id], r.residence, r.guardian_phone].filter(Boolean).join(' · '))}
        </div>
      </div>
    )}
  />
)

/* ---------- শিক্ষক-কর্মচারী (ভেতরের তালিকা) ---------- */
export const StaffAdmin = () => (
  <Crud
    table="staff"
    title="শিক্ষক ও কর্মচারী"
    hint="এটি ভেতরের তালিকা, ওয়েবসাইটে দেখানো 'শিক্ষকবৃন্দ' পেইজ থেকে আলাদা। হাজিরা ও শ্রেণির দায়িত্ব এখান থেকে নেওয়া হয়।"
    order="created_at"
    toggle={null}
    nameOf={(r) => bn(r, 'name')}
    blank={{ status: 'active', kind: 'teacher', join_date: today() }}
    searchFields={['name_bn', 'name_en', 'staff_no', 'phone', 'designation_bn']}
    filters={[
      { name: 'kind', label: 'শিক্ষক ও কর্মচারী', options: KIND },
      { name: 'status', label: 'সব অবস্থা', options: [['active', 'সক্রিয়'], ['inactive', 'নিষ্ক্রিয়'], ['left', 'ছেড়ে গেছেন']] },
    ]}
    csv={{ file: 'শিক্ষক-কর্মচারী.csv', cols: [['আইডি', (r) => r.staff_no], ['নাম', (r) => bn(r, 'name')], ['ধরন', (r) => (r.kind === 'teacher' ? 'শিক্ষক' : 'কর্মচারী')], ['পদবি', (r) => r.designation_bn], ['ফোন', (r) => r.phone], ['যোগদান', (r) => r.join_date], ['ঠিকানা', (r) => r.address]] }}
    fields={[
      { name: 'photo_url', label: 'ছবি', type: 'image' },
      { name: 'name', label: 'নাম', i18n: true, required: true },
      { name: 'kind', label: 'ধরন', type: 'select', options: KIND },
      { name: 'designation', label: 'পদবি', i18n: true },
      { name: 'phone', label: 'মোবাইল' },
      { name: 'salary', label: 'মাসিক বেতন (টাকা)', type: 'number' },
      { name: 'nid', label: 'জাতীয় পরিচয়পত্র নম্বর' },
      { name: 'address', label: 'ঠিকানা', type: 'textarea' },
      { name: 'join_date', label: 'যোগদানের তারিখ', type: 'date', required: false },
      { name: 'staff_no', label: 'আইডি নম্বর (ফাঁকা রাখলে নিজে তৈরি হবে)' },
      { name: 'device_user_id', label: 'হাজিরা মেশিনের আইডি (মেশিন থাকলে)' },
      { name: 'status', label: 'অবস্থা', type: 'select', options: [['active', 'সক্রিয়'], ['inactive', 'নিষ্ক্রিয়'], ['left', 'ছেড়ে গেছেন']] },
      { name: 'note', label: 'নোট', type: 'textarea' },
    ]}
    summary={(r) => (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Thumb src={r.photo_url} name={bn(r, 'name')} />
        <div style={{ minWidth: 0 }}>
          <b>{bn(r, 'name')}</b> <span className="tag">{r.staff_no}</span> <span className="tag">{r.kind === 'teacher' ? 'শিক্ষক' : 'কর্মচারী'}</span>
          {sub([r.designation_bn, r.phone].filter(Boolean).join(' · '))}
        </div>
      </div>
    )}
  />
)

/* ---------- তালিকার ধরন ---------- */
const EQ_RES = { kind: 'residence' }
const EQ_SES = { kind: 'session' }
export const ResidenceAdmin = () => (
  <Crud
    table="lookups" eq={EQ_RES} title="আবাসিক / অনাবাসিক ধরন" order="sort" asc
    hint="ছাত্র যোগ করার সময় যে ধরনগুলো থেকে বাছাই করা যাবে। নতুন ধরন যোগ বা বাদ দিতে পারেন।"
    nameOf={(r) => bn(r, 'name')} blank={{ kind: 'residence', published: true, sort: 0 }}
    fields={[{ name: 'name', label: 'নাম', i18n: true, required: true }, { name: 'sort', label: 'ক্রম', type: 'number' }, { name: 'published', label: 'চালু', type: 'bool' }]}
    toggleLabel="চালু"
    summary={(r) => <b>{bn(r, 'name')}</b>}
  />
)
export const SessionsAdmin = () => (
  <Crud
    table="lookups" eq={EQ_SES} title="হাজিরার সময় / ওয়াক্ত" order="sort" asc
    hint="দিনে একবার হাজিরা নিলে শুধু 'দৈনিক' রাখুন। ফজর, আসর বা ক্লাসভিত্তিক হাজিরা নিতে চাইলে এখানে নতুন সময় যোগ করুন, হাজিরা পেইজে বাছাই করা যাবে। মেশিনের হাজিরা 'দৈনিক' এ বসে।"
    nameOf={(r) => bn(r, 'name')} blank={{ kind: 'session', published: true, sort: 0 }}
    fields={[{ name: 'name', label: 'সময়ের নাম', i18n: true, required: true }, { name: 'sort', label: 'ক্রম', type: 'number' }, { name: 'published', label: 'চালু', type: 'bool' }]}
    toggleLabel="চালু"
    summary={(r) => <><b>{bn(r, 'name')}</b>{r.code === 'day' && <span className="tag built">মেশিনের হাজিরা এখানে</span>}</>}
  />
)
