import { useState } from 'react'
import Crud from './Crud'
import { nm, taka } from './fin'

const sub = (t) => <div className="muted" style={{ fontSize: '.85rem' }}>{t}</div>
const HEAD = { table: 'fee_heads', label: (r) => nm(r) }
const CLASS = { table: 'classes', label: (r) => nm(r) }
const DEPT = { table: 'departments', label: (r) => nm(r) }
const STUDENT = { table: 'students', order: 'created_at', label: (r) => `${nm(r)} (${r.student_no || ''})` }
const RESIDENCE = { table: 'lookups', eq: { kind: 'residence' }, value: (r) => r.name_bn || r.name_en, label: (r) => r.name_bn || r.name_en }
const KINDS = [['monthly', 'প্রতি মাসে'], ['one_time', 'এককালীন / প্রয়োজনমতো']]

const Heads = () => (
  <Crud
    table="fee_heads" title="ফি-র ধরন" order="sort" asc nameOf={(r) => nm(r)}
    hint="যেমন মাসিক বেতন, খাবার ও থাকা, ভর্তি ফি, পরীক্ষা ফি। 'সাধারণ পরিমাণ' সবার জন্য প্রযোজ্য; শ্রেণি/বিভাগ/আবাসিক অনুযায়ী আলাদা পরিমাণ পরের ট্যাবে দিন। খাবারের ফি শুধু আবাসিকদের জন্য হলে সাধারণ পরিমাণ ০ রেখে পরের ট্যাবে 'আবাসিক' ধরনের জন্য পরিমাণ দিন।"
    blank={{ published: true, sort: 0, kind: 'monthly', default_amount: 0 }}
    fields={[
      { name: 'name', label: 'নাম', i18n: true, required: true },
      { name: 'kind', label: 'কখন ধরা হবে', type: 'select', options: KINDS },
      { name: 'default_amount', label: 'সাধারণ পরিমাণ (টাকা)', type: 'number' },
      { name: 'sort', label: 'ক্রম', type: 'number' },
      { name: 'published', label: 'চালু', type: 'bool' },
    ]}
    toggleLabel="চালু"
    summary={(r) => (<><b>{nm(r)}</b><span className="tag">{r.kind === 'monthly' ? 'মাসিক' : 'এককালীন'}</span>{sub(`সাধারণ পরিমাণ: ${taka(r.default_amount)}`)}</>)}
  />
)

const Rates = () => (
  <Crud
    table="fee_rates" title="শ্রেণি / বিভাগ / আবাসিক অনুযায়ী পরিমাণ" order="created_at" toggle={null}
    hint="যে শর্ত দেবেন শুধু সেই ছাত্রদের জন্য এই পরিমাণ। ফাঁকা রাখলে 'সব'। একাধিক নিয়ম মিলে গেলে যেটা বেশি নির্দিষ্ট (শর্ত বেশি) সেটাই ধরা হবে। কোনো নিয়ম না মিললে ফি-র সাধারণ পরিমাণ ধরা হবে।"
    nameOf={() => 'এই নিয়মটি'}
    blank={{ amount: 0 }}
    fields={[
      { name: 'head_id', label: 'ফি-র ধরন', type: 'select', optionsFrom: HEAD },
      { name: 'class_id', label: 'শ্রেণি (ফাঁকা = সব)', type: 'select', optionsFrom: CLASS, blankLabel: 'সব শ্রেণি' },
      { name: 'department_id', label: 'বিভাগ (ফাঁকা = সব)', type: 'select', optionsFrom: DEPT, blankLabel: 'সব বিভাগ' },
      { name: 'residence', label: 'আবাসিক / অনাবাসিক (ফাঁকা = সব)', type: 'select', optionsFrom: RESIDENCE, blankLabel: 'সব' },
      { name: 'amount', label: 'পরিমাণ (টাকা)', type: 'number' },
    ]}
    beforeSave={(p) => ({ ...p, class_id: p.class_id || null, department_id: p.department_id || null, residence: p.residence || null })}
    summary={(r, m) => (<><b>{m.head_id?.[r.head_id] || '—'}: {taka(r.amount)}</b>{sub([r.class_id && m.class_id?.[r.class_id], r.department_id && m.department_id?.[r.department_id], r.residence].filter(Boolean).join(' · ') || 'সব ছাত্র')}</>)}
  />
)

const Special = () => (
  <Crud
    table="student_fees" title="ছাত্রভিত্তিক আলাদা পরিমাণ / ছাড় / অব্যাহতি" order="created_at" toggle={null}
    hint="কোনো ছাত্রের জন্য আলাদা পরিমাণ (যেমন ইয়াতিম, গরিব বা ভাই-বোন ছাড়) এখানে দিন। 'পরিমাণ' ফাঁকা রাখলে সাধারণ পরিমাণ থেকে 'ছাড়' বাদ যাবে। 'প্রযোজ্য নয়' দিলে ওই ফি ওই ছাত্রের বিলে আসবে না।"
    nameOf={() => 'এই ছাত্রের ব্যবস্থাটি'}
    blank={{ discount: 0, exempt: false }}
    fields={[
      { name: 'student_id', label: 'ছাত্র', type: 'select', optionsFrom: STUDENT },
      { name: 'head_id', label: 'ফি-র ধরন', type: 'select', optionsFrom: HEAD },
      { name: 'amount', label: 'আলাদা পরিমাণ (ফাঁকা = সাধারণ)', type: 'number', nullable: true },
      { name: 'discount', label: 'ছাড় (টাকা)', type: 'number' },
      { name: 'exempt', label: 'এই ফি এই ছাত্রের জন্য প্রযোজ্য নয়', type: 'bool' },
      { name: 'note', label: 'কারণ / নোট', type: 'textarea' },
    ]}
    summary={(r, m) => (<><b>{m.student_id?.[r.student_id] || '—'}</b><span className="tag">{m.head_id?.[r.head_id]}</span>{sub(r.exempt ? 'প্রযোজ্য নয়' : [r.amount != null && `পরিমাণ ${taka(r.amount)}`, num0(r.discount) > 0 && `ছাড় ${taka(r.discount)}`].filter(Boolean).join(' · '))}</>)}
  />
)
const num0 = (x) => Number(x || 0)

export function FeeSetup() {
  const [tab, setTab] = useState('heads')
  return (
    <>
      <div className="tabs" style={{ marginBottom: 14 }}>
        {[['heads', 'ফি-র ধরন'], ['rates', 'পরিমাণ (শ্রেণি/বিভাগ অনুযায়ী)'], ['special', 'ছাত্রভিত্তিক ছাড়']].map(([k, l]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'heads' && <Heads />}
      {tab === 'rates' && <Rates />}
      {tab === 'special' && <Special />}
    </>
  )
}

const EQ_METHOD = { kind: 'method' }
const Methods = () => (
  <Crud
    table="lookups" eq={EQ_METHOD} title="পেমেন্ট মাধ্যম ও শুরুর জমা" order="sort" asc nameOf={(r) => nm(r)}
    hint="টাকা কোন কোন মাধ্যমে আসে/যায়। 'শুরুর জমা' হলো হিসাব চালু করার দিনে ওই মাধ্যমে যত টাকা ছিল; ক্যাশবইয়ের ব্যালেন্স এর সাথে যোগ হবে।"
    blank={{ kind: 'method', published: true, sort: 0, opening: 0 }}
    beforeSave={(p) => ({ ...p, code: p.code || `m${Date.now().toString(36)}` })}
    fields={[
      { name: 'name', label: 'নাম', i18n: true, required: true },
      { name: 'opening', label: 'শুরুর জমা (টাকা)', type: 'number' },
      { name: 'sort', label: 'ক্রম', type: 'number' },
      { name: 'published', label: 'চালু', type: 'bool' },
    ]}
    toggleLabel="চালু"
    summary={(r) => (<><b>{nm(r)}</b>{sub(`শুরুর জমা: ${taka(r.opening)}`)}</>)}
  />
)
const Cats = () => (
  <Crud
    table="ledger_categories" title="আয় ও ব্যয়ের খাত" order="sort" asc nameOf={(r) => nm(r)}
    hint="দান, যাকাত, চাঁদা, খাবার, ভাড়া, বিদ্যুৎ ইত্যাদি খাত। নতুন খাত যোগ বা বাদ দিতে পারেন (পুরোনো এন্ট্রির খাতের নাম অপরিবর্তিত থাকে)।"
    blank={{ kind: 'income', published: true, sort: 0 }}
    fields={[
      { name: 'kind', label: 'ধরন', type: 'select', options: [['income', 'আয়'], ['expense', 'ব্যয়']] },
      { name: 'name', label: 'খাতের নাম', i18n: true, required: true },
      { name: 'sort', label: 'ক্রম', type: 'number' },
      { name: 'published', label: 'চালু', type: 'bool' },
    ]}
    filters={[{ name: 'kind', label: 'আয় ও ব্যয়', options: [['income', 'আয়'], ['expense', 'ব্যয়']] }]}
    toggleLabel="চালু"
    summary={(r) => (<><b>{nm(r)}</b><span className={`tag ${r.kind === 'income' ? 'free' : 'built'}`}>{r.kind === 'income' ? 'আয়' : 'ব্যয়'}</span></>)}
  />
)
export function AccountSetup() {
  const [tab, setTab] = useState('cats')
  return (
    <>
      <div className="tabs" style={{ marginBottom: 14 }}>
        {[['cats', 'আয়-ব্যয়ের খাত'], ['methods', 'পেমেন্ট মাধ্যম ও শুরুর জমা']].map(([k, l]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'cats' ? <Cats /> : <Methods />}
    </>
  )
}
