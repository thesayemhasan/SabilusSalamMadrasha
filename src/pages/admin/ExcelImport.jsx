import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { readXlsx, saveBlob, serialToIso, writeXlsx } from '../../lib/xlsx'
import { downloadCsv } from './Crud'
import { Select } from '../../components/Ui'
import { nm, todayStr } from './fin'

// ---------- ছোট সহায়ক ----------
const BND = '০১২৩৪৫৬৭৮৯'
const dig = (s) => String(s).replace(/[০-৯]/g, (d) => BND.indexOf(d))
const norm = (s) => String(s ?? '').replace(/\*/g, '').replace(/\s+/g, '').toLowerCase()
const nk = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
const idKey = (v) => dig(String(v ?? '')).replace(/\s+/g, '').toUpperCase()
const blank = (v) => v === null || v === undefined || String(v).trim() === ''

function parseDate(raw) {
  if (typeof raw === 'number') return raw > 20000 && raw < 80000 ? serialToIso(raw) : null
  const s = dig(raw).trim()
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s)
  let y; let mo; let d
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3] } else {
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s)
    if (!m) return null
    d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000
  }
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (y < 1900 || y > 2100 || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
function parsePhone(raw) {
  let s = dig(raw).replace(/[^\d+]/g, '')
  if (/^\+?88/.test(s) && s.replace(/\D/g, '').length >= 13) s = s.replace(/^\+?88/, '')
  if (/^1\d{9}$/.test(s)) s = `0${s}`
  return { v: s, ok: /^01[3-9]\d{8}$/.test(s) }
}

// ---------- পূর্বনির্ধারিত মান (বাংলা/ইংরেজি/কোড সব চলবে) ----------
const GENDER = { male: ['পুরুষ', 'ছেলে', 'ছাত্র', 'male', 'm', 'boy'], female: ['মহিলা', 'মেয়ে', 'ছাত্রী', 'নারী', 'female', 'f', 'girl'] }
const SSTATUS = { active: ['সক্রিয়', 'চলমান', 'active'], inactive: ['নিষ্ক্রিয়', 'inactive'], left: ['ছেড়ে গেছে', 'বাদ', 'left'], graduated: ['সমাপ্ত', 'উত্তীর্ণ', 'graduated'] }
const TSTATUS = { active: ['সক্রিয়', 'চলমান', 'active'], inactive: ['নিষ্ক্রিয়', 'inactive'], left: ['ছেড়ে গেছে', 'বাদ', 'left'] }
const SKIND = { teacher: ['শিক্ষক', 'teacher'], staff: ['কর্মচারী', 'staff'] }
const HKIND = { sabaq: ['সবক', 'sabaq'], sabaqi: ['সাত সবক', 'সাতসবক', 'সবকী', 'sabaqi'], manzil: ['আমুখতা', 'শবিনা', 'আমুখতা / শবিনা', 'মনজিল', 'manzil'] }
const QUAL = { excellent: ['অতি উত্তম', 'excellent'], good: ['ভালো', 'ভাল', 'good'], average: ['মোটামুটি', 'average'], weak: ['দুর্বল', 'weak'] }
const ABSENT = ['অনুপস্থিত', 'অনুপস্থিতি', 'absent', 'ab', 'অ', 'a']
const enumMap = (o) => { const m = {}; Object.entries(o).forEach(([k, a]) => { m[nk(k)] = k; a.forEach((x) => { m[nk(x)] = k }) }); return m }

// ---------- সারি-যাচাই সহায়ক ----------
function rowCtx(raw, cols, n) {
  const issues = []
  const lab = (k) => (cols.find((c) => c.k === k) || { l: k }).l
  const r = {
    n, issues, skip: null, soft: false,
    err: (k, msg) => issues.push({ n, col: lab(k), level: 'err', msg }),
    warn: (k, msg) => issues.push({ n, col: lab(k), level: 'warn', msg }),
    raw: (k) => raw[k],
    text: (k) => (blank(raw[k]) ? '' : String(raw[k]).trim()),
    id: (k) => (blank(raw[k]) ? '' : idKey(raw[k])),
    need(k) { if (blank(raw[k])) { r.err(k, 'এই ঘরটি ফাঁকা — বাধ্যতামূলক'); return false } return true },
    date(k) {
      if (blank(raw[k])) return null
      const d = parseDate(raw[k])
      if (!d) { r.err(k, `তারিখ বোঝা যায়নি ("${raw[k]}") — দিন/মাস/সাল লিখুন, যেমন ১৫/০৩/২০১৫`); return null }
      return d
    },
    num(k, { min, max, def = null, int } = {}) {
      if (blank(raw[k])) return def
      const x = Number(dig(String(raw[k])).replace(/,/g, '').trim())
      if (!Number.isFinite(x)) { r.err(k, `সংখ্যা হতে হবে ("${raw[k]}")`); return def }
      if (int && !Number.isInteger(x)) { r.err(k, 'পূর্ণসংখ্যা হতে হবে'); return def }
      if (min !== undefined && x < min) { r.err(k, `${min}-এর কম হতে পারে না`); return def }
      if (max !== undefined && x > max) { r.err(k, `${max}-এর বেশি হতে পারে না`); return def }
      return x
    },
    phone(k) {
      if (blank(raw[k])) return ''
      const p = parsePhone(raw[k])
      if (!p.ok) r.warn(k, `ফোন নম্বর সঠিক মনে হচ্ছে না ("${raw[k]}") — ১১ ডিজিট, 01 দিয়ে শুরু`)
      return p.v
    },
    en(k, map, { def } = {}) {
      if (blank(raw[k])) return def ?? ''
      const v = map[nk(raw[k])]
      if (!v) { r.err(k, `"${raw[k]}" গ্রহণযোগ্য নয় — তালিকা থেকে বাছুন`); return def ?? '' }
      return v
    },
  }
  return r
}

// ---------- রেফারেন্স ডেটা ----------
async function loadCtx() {
  const [dep, cls, res, exm, sub, stu, stf] = await Promise.all([
    supabase.from('departments').select('id,name_bn,name_en').order('sort'),
    supabase.from('classes').select('id,name_bn,name_en,department_id,sort').order('sort'),
    supabase.from('lookups').select('name_bn,name_en').eq('kind', 'residence').order('sort'),
    supabase.from('exams').select('id,name_bn,name_en,year').order('created_at', { ascending: false }),
    fetchAll((a, b) => supabase.from('exam_subjects').select('id,exam_id,class_id,name_bn,name_en,full_marks,sort').range(a, b)),
    fetchAll((a, b) => supabase.from('students').select('id,student_no,device_user_id,name_bn,guardian_phone,class_id').order('student_no').range(a, b)),
    fetchAll((a, b) => supabase.from('staff').select('id,staff_no,device_user_id,name_bn,phone').range(a, b)),
  ])
  const c = {
    deps: dep.data || [], classes: cls.data || [], residences: res.data || [], exams: exm.data || [], subjects: sub.data || [], students: stu.data || [], staff: stf.data || [],
  }
  c.depMap = {}
  c.deps.forEach((d) => { [d.name_bn, d.name_en].forEach((x) => { if (x) c.depMap[nk(x)] = d.id }) })
  c.resMap = {}
  c.residences.forEach((d) => { [d.name_bn, d.name_en].forEach((x) => { if (x) c.resMap[nk(x)] = d.name_bn || d.name_en }) })
  c.examMap = {}
  c.exams.forEach((e) => { [e.name_bn, e.name_en].forEach((x) => { if (x) (c.examMap[nk(x)] = c.examMap[nk(x)] || []).push(e) }) })
  c.stuNo = {}
  c.students.forEach((s) => { if (s.student_no) c.stuNo[idKey(s.student_no)] = s })
  c.stuDev = new Set(c.students.map((s) => s.device_user_id).filter(Boolean).map(idKey))
  c.stuSoft = new Set(c.students.map((s) => `${nk(s.name_bn)}|${parsePhone(s.guardian_phone || '').v}`))
  c.staffNo = new Set(c.staff.map((s) => s.staff_no).filter(Boolean).map(idKey))
  c.staffDev = new Set(c.staff.map((s) => s.device_user_id).filter(Boolean).map(idKey))
  c.staffSoft = new Set(c.staff.map((s) => `${nk(s.name_bn)}|${parsePhone(s.phone || '').v}`))
  c.subKey = {}
  c.subjects.forEach((s) => { const m = (c.subKey[`${s.exam_id}|${s.class_id}`] = c.subKey[`${s.exam_id}|${s.class_id}`] || {}); [s.name_bn, s.name_en].forEach((x) => { if (x) m[nk(x)] = s }) })
  c.classByName = {}
  c.classes.forEach((k) => { [k.name_bn, k.name_en].forEach((x) => { if (x) (c.classByName[nk(x)] = c.classByName[nk(x)] || []).push(k) }) })
  return c
}

function refDept(r, k, c) {
  if (blank(r.raw(k))) return null
  const id = c.depMap[nk(r.raw(k))]
  if (!id) { r.err(k, `বিভাগ "${r.raw(k)}" সাইটে নেই`); return null }
  return id
}
function refClass(r, k, c, deptId) {
  if (blank(r.raw(k))) return null
  let list = c.classByName[nk(r.raw(k))] || []
  if (!list.length) { r.err(k, `শ্রেণি "${r.raw(k)}" সাইটে নেই — আগে শ্রেণি যোগ করুন`); return null }
  if (list.length > 1 && deptId) list = list.filter((x) => x.department_id === deptId)
  if (list.length > 1) { r.err(k, `"${r.raw(k)}" নামে একাধিক শ্রেণি আছে — বিভাগ কলামে বিভাগের নাম দিন`); return null }
  if (!list.length) { r.err(k, `এই নামে শ্রেণি ঐ বিভাগে নেই`); return null }
  return list[0]
}
function refExam(r, k, c) {
  if (blank(r.raw(k))) return null
  const list = c.examMap[nk(r.raw(k))] || []
  if (!list.length) { r.err(k, `পরীক্ষা "${r.raw(k)}" সাইটে নেই — আগে পরীক্ষা যোগ করুন`); return null }
  if (list.length > 1) { r.err(k, `"${r.raw(k)}" নামে একাধিক পরীক্ষা আছে`); return null }
  return list[0]
}
function refStudent(r, k, c, nameKey) {
  if (blank(r.raw(k))) return null
  const s = c.stuNo[idKey(r.raw(k))]
  if (!s) { r.err(k, `ছাত্র আইডি "${r.raw(k)}" সাইটে পাওয়া যায়নি`); return null }
  if (nameKey && !blank(r.raw(nameKey)) && nk(r.raw(nameKey)) !== nk(s.name_bn)) r.warn(nameKey, `নাম মেলেনি — সাইটে "${s.name_bn}"; আইডি অনুযায়ী ধরা হয়েছে`)
  return s
}
const dupSkip = (r, msg, soft) => { if (!r.skip) { r.skip = msg; r.soft = !!soft } }

// ---------- ডেটাসেট সংজ্ঞা ----------
const C = (k, l, o = {}) => ({ k, l, ...o })
const DATASETS = [
  {
    id: 'students', title: 'ছাত্র-ছাত্রী', table: 'students', file: 'ছাত্র-ছাত্রী',
    cols: [
      C('name_bn', 'নাম (বাংলা)', { req: 1, ex: 'মুহাম্মাদ আব্দুল্লাহ', hint: 'পূর্ণ নাম' }),
      C('name_en', 'নাম (ইংরেজি)', { ex: 'Muhammad Abdullah' }),
      C('gender', 'লিঙ্গ', { req: 1, ex: 'পুরুষ', hint: 'পুরুষ / মহিলা', list: () => ['পুরুষ', 'মহিলা'] }),
      C('dob', 'জন্ম তারিখ', { ex: '15/03/2015', hint: 'দিন/মাস/সাল' }),
      C('father_name', 'পিতার নাম', { ex: 'মুহাম্মাদ আলী' }),
      C('mother_name', 'মাতার নাম', { ex: 'ফাতেমা বেগম' }),
      C('guardian_phone', 'অভিভাবকের ফোন', { req: 1, ex: '01712345678', hint: '১১ ডিজিট' }),
      C('phone2', 'বিকল্প ফোন', { ex: '01812345678' }),
      C('address', 'ঠিকানা', { ex: 'মিরপুর, ঢাকা' }),
      C('dept', 'বিভাগ', { ex: 'হিফজ বিভাগ', hint: 'সাইটে থাকা বিভাগের নাম (ফাঁকা রাখলে শ্রেণি থেকে ধরবে)', list: (c) => c.deps.map(nm) }),
      C('class', 'শ্রেণি / হালকা', { req: 1, ex: 'নাজেরা', hint: 'সাইটে থাকা শ্রেণির নাম', list: (c) => c.classes.map(nm) }),
      C('residence', 'আবাসিক / অনাবাসিক', { ex: 'আবাসিক', list: (c) => c.residences.map(nm) }),
      C('admission_date', 'ভর্তির তারিখ', { ex: '02/01/2026', hint: 'ফাঁকা হলে আজকের তারিখ' }),
      C('blood_group', 'রক্তের গ্রুপ', { ex: 'A+', list: () => ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] }),
      C('student_no', 'আইডি', { ex: '', hint: 'ফাঁকা রাখলে সাইট নিজে দেবে (বাছাই করা ভালো)' }),
      C('device_user_id', 'মেশিন আইডি', { ex: '', hint: 'হাজিরা মেশিনে যে নম্বরে আছে' }),
      C('status', 'অবস্থা', { ex: 'সক্রিয়', hint: 'ফাঁকা হলে সক্রিয়', list: () => ['সক্রিয়', 'নিষ্ক্রিয়', 'ছেড়ে গেছে', 'সমাপ্ত'] }),
      C('note', 'নোট'),
    ],
    maps: { gender: enumMap(GENDER), status: enumMap(SSTATUS) },
    check(r, c, st) {
      r.need('name_bn'); r.need('gender'); r.need('guardian_phone'); r.need('class')
      const gender = r.en('gender', this.maps.gender)
      const dob = r.date('dob'); const adm = r.date('admission_date')
      const phone = r.phone('guardian_phone'); const phone2 = r.phone('phone2')
      const deptId = refDept(r, 'dept', c)
      const cls = refClass(r, 'class', c, deptId)
      if (cls && deptId && cls.department_id && cls.department_id !== deptId) r.warn('dept', 'শ্রেণিটি অন্য বিভাগের — শ্রেণির বিভাগই ধরা হয়েছে')
      let residence = null
      if (!blank(r.raw('residence'))) { residence = c.resMap[nk(r.raw('residence'))]; if (!residence) r.err('residence', `"${r.raw('residence')}" নামে আবাসিক ধরন সাইটে নেই`) }
      const status = r.en('status', this.maps.status, { def: 'active' })
      if (!r.text('father_name')) r.warn('father_name', 'পিতার নাম নেই')
      const no = r.id('student_no'); const dev = r.id('device_user_id')
      if (no) {
        if (c.stuNo[no]) dupSkip(r, `আইডি ${no} সাইটে আগে থেকেই আছে — বাদ`)
        else if (st.no.has(no)) dupSkip(r, `আইডি ${no} ফাইলেই আগে একবার আছে — বাদ`)
        st.no.add(no)
      }
      if (dev) {
        if (c.stuDev.has(dev) || st.dev.has(dev)) r.err('device_user_id', `মেশিন আইডি ${dev} আগেই অন্য ছাত্রের আছে`)
        st.dev.add(dev)
      }
      const sk = `${nk(r.text('name_bn'))}|${phone}`
      if (r.text('name_bn') && phone && !no) {
        if (c.stuSoft.has(sk)) dupSkip(r, 'একই নাম ও ফোনের ছাত্র সাইটে আছে — সম্ভাব্য ডুপ্লিকেট', true)
        else if (st.soft.has(sk)) dupSkip(r, 'একই নাম ও ফোন ফাইলেই আগে আছে — সম্ভাব্য ডুপ্লিকেট', true)
        st.soft.add(sk)
      }
      return [{
        student_no: no || null, name_bn: r.text('name_bn'), name_en: r.text('name_en') || null, gender: gender || null, dob, father_name: r.text('father_name') || null,
        mother_name: r.text('mother_name') || null, guardian_phone: phone || null, phone2: phone2 || null, address: r.text('address') || null,
        department_id: deptId || (cls && cls.department_id) || null, class_id: cls ? cls.id : null, residence, admission_date: adm || todayStr(),
        blood_group: r.text('blood_group') || null, device_user_id: dev || null, status, note: r.text('note') || null,
      }]
    },
    newState: () => ({ no: new Set(), dev: new Set(), soft: new Set() }),
  },
  {
    id: 'staff', title: 'শিক্ষক ও কর্মচারী', table: 'staff', file: 'শিক্ষক-কর্মচারী',
    cols: [
      C('name_bn', 'নাম (বাংলা)', { req: 1, ex: 'মাওলানা আব্দুর রহমান' }),
      C('name_en', 'নাম (ইংরেজি)', { ex: 'Maulana Abdur Rahman' }),
      C('kind', 'ধরন', { ex: 'শিক্ষক', hint: 'শিক্ষক / কর্মচারী — ফাঁকা হলে শিক্ষক', list: () => ['শিক্ষক', 'কর্মচারী'] }),
      C('designation_bn', 'পদবি (বাংলা)', { ex: 'মুহাদ্দিস' }),
      C('designation_en', 'পদবি (ইংরেজি)', { ex: 'Muhaddis' }),
      C('phone', 'ফোন', { req: 1, ex: '01712345678' }),
      C('address', 'ঠিকানা'),
      C('nid', 'জাতীয় পরিচয়পত্র নম্বর'),
      C('join_date', 'যোগদানের তারিখ', { ex: '01/01/2020', hint: 'দিন/মাস/সাল' }),
      C('salary', 'মূল বেতন', { ex: '15000', hint: 'টাকার অঙ্ক' }),
      C('staff_no', 'আইডি', { hint: 'ফাঁকা রাখলে সাইট নিজে দেবে' }),
      C('device_user_id', 'মেশিন আইডি'),
      C('status', 'অবস্থা', { ex: 'সক্রিয়', hint: 'ফাঁকা হলে সক্রিয়', list: () => ['সক্রিয়', 'নিষ্ক্রিয়', 'ছেড়ে গেছে'] }),
      C('note', 'নোট'),
    ],
    maps: { kind: enumMap(SKIND), status: enumMap(TSTATUS) },
    check(r, c, st) {
      r.need('name_bn'); r.need('phone')
      const kind = r.en('kind', this.maps.kind, { def: 'teacher' })
      const phone = r.phone('phone'); const jd = r.date('join_date')
      const salary = r.num('salary', { min: 0, def: 0 })
      const status = r.en('status', this.maps.status, { def: 'active' })
      const no = r.id('staff_no'); const dev = r.id('device_user_id')
      if (no) { if (c.staffNo.has(no) || st.no.has(no)) dupSkip(r, `আইডি ${no} আগে থেকেই আছে — বাদ`); st.no.add(no) }
      if (dev) { if (c.staffDev.has(dev) || st.dev.has(dev)) r.err('device_user_id', `মেশিন আইডি ${dev} আগেই আছে`); st.dev.add(dev) }
      const sk = `${nk(r.text('name_bn'))}|${phone}`
      if (r.text('name_bn') && phone && !no) {
        if (c.staffSoft.has(sk) || st.soft.has(sk)) dupSkip(r, 'একই নাম ও ফোনের মানুষ আছে — সম্ভাব্য ডুপ্লিকেট', true)
        st.soft.add(sk)
      }
      return [{
        staff_no: no || null, name_bn: r.text('name_bn'), name_en: r.text('name_en') || null, kind, designation_bn: r.text('designation_bn') || null, designation_en: r.text('designation_en') || null,
        phone: phone || null, address: r.text('address') || null, nid: r.text('nid') || null, join_date: jd, salary, device_user_id: dev || null, status, note: r.text('note') || null,
      }]
    },
    newState: () => ({ no: new Set(), dev: new Set(), soft: new Set() }),
  },
  {
    id: 'classes', title: 'শ্রেণি / হালকা', table: 'classes', file: 'শ্রেণি',
    cols: [
      C('name_bn', 'শ্রেণির নাম (বাংলা)', { req: 1, ex: 'নাজেরা' }),
      C('name_en', 'শ্রেণির নাম (ইংরেজি)', { ex: 'Nazera' }),
      C('dept', 'বিভাগ', { ex: 'হিফজ বিভাগ', list: (c) => c.deps.map(nm) }),
      C('sort', 'ক্রম', { ex: '1', hint: 'ছোট সংখ্যা আগে দেখাবে' }),
    ],
    maps: {},
    check(r, c, st) {
      r.need('name_bn')
      const deptId = refDept(r, 'dept', c)
      const sort = r.num('sort', { int: true, def: st.i })
      st.i += 1
      const key = `${nk(r.text('name_bn'))}|${deptId || ''}`
      if (r.text('name_bn')) {
        const inDb = (c.classByName[nk(r.text('name_bn'))] || []).some((x) => (x.department_id || '') === (deptId || ''))
        if (inDb || st.seen.has(key)) dupSkip(r, 'এই নামের শ্রেণি আগে থেকেই আছে — বাদ')
        st.seen.add(key)
      }
      return [{ name_bn: r.text('name_bn'), name_en: r.text('name_en') || null, department_id: deptId, sort: sort ?? 0, published: true }]
    },
    newState: () => ({ seen: new Set(), i: 1 }),
  },
  {
    id: 'exams', title: 'পরীক্ষা', table: 'exams', file: 'পরীক্ষা',
    cols: [
      C('name_bn', 'পরীক্ষার নাম (বাংলা)', { req: 1, ex: 'প্রথম সাময়িক পরীক্ষা' }),
      C('name_en', 'পরীক্ষার নাম (ইংরেজি)', { ex: '1st Term Exam' }),
      C('year', 'শিক্ষাবর্ষ', { ex: '2026' }),
      C('date_from', 'শুরুর তারিখ', { ex: '10/04/2026' }),
      C('date_to', 'শেষ তারিখ', { ex: '20/04/2026' }),
    ],
    maps: {},
    check(r, c, st) {
      r.need('name_bn')
      const a = r.date('date_from'); const b = r.date('date_to')
      if (a && b && b < a) r.err('date_to', 'শেষ তারিখ শুরুর আগে হতে পারে না')
      const year = r.text('year') ? dig(r.text('year')) : null
      const key = `${nk(r.text('name_bn'))}|${year || ''}`
      if (r.text('name_bn')) {
        if (c.exams.some((e) => nk(e.name_bn) === nk(r.text('name_bn')) && (e.year || '') === (year || '')) || st.seen.has(key)) dupSkip(r, 'এই নামের পরীক্ষা আগে থেকেই আছে — বাদ')
        st.seen.add(key)
      }
      return [{ name_bn: r.text('name_bn'), name_en: r.text('name_en') || null, year, date_from: a, date_to: b, published: true }]
    },
    newState: () => ({ seen: new Set() }),
  },
  {
    id: 'subjects', title: 'পরীক্ষার বিষয়', table: 'exam_subjects', file: 'পরীক্ষার-বিষয়',
    cols: [
      C('exam', 'পরীক্ষা', { req: 1, ex: 'প্রথম সাময়িক পরীক্ষা', hint: 'সাইটে থাকা পরীক্ষার নাম', list: (c) => c.exams.map(nm) }),
      C('class', 'শ্রেণি', { req: 1, ex: 'নাজেরা', list: (c) => c.classes.map(nm) }),
      C('dept', 'বিভাগ', { hint: 'শুধু একই নামে একাধিক শ্রেণি থাকলে', list: (c) => c.deps.map(nm) }),
      C('name_bn', 'বিষয় (বাংলা)', { req: 1, ex: 'কুরআন তিলাওয়াত' }),
      C('name_en', 'বিষয় (ইংরেজি)', { ex: 'Quran Recitation' }),
      C('full', 'পূর্ণমান', { ex: '100', hint: 'ফাঁকা হলে ১০০' }),
      C('pass', 'পাশ নম্বর', { ex: '33', hint: 'ফাঁকা হলে ৩৩' }),
      C('exam_date', 'পরীক্ষার তারিখ', { ex: '12/04/2026' }),
      C('exam_time', 'সময়', { ex: 'সকাল ১০:০০' }),
    ],
    maps: {},
    check(r, c, st) {
      r.need('exam'); r.need('class'); r.need('name_bn')
      const ex = refExam(r, 'exam', c)
      const cls = refClass(r, 'class', c, refDept(r, 'dept', c))
      const full = r.num('full', { min: 0, def: 100 }); const pass = r.num('pass', { min: 0, def: 33 })
      if (full !== null && pass !== null && pass > full) r.err('pass', 'পাশ নম্বর পূর্ণমানের বেশি হতে পারে না')
      const d = r.date('exam_date')
      if (ex && cls && r.text('name_bn')) {
        const key = `${ex.id}|${cls.id}`
        const inDb = (c.subKey[key] || {})[nk(r.text('name_bn'))]
        const fk = `${key}|${nk(r.text('name_bn'))}`
        if (inDb || st.seen.has(fk)) dupSkip(r, 'এই পরীক্ষা-শ্রেণিতে এই বিষয় আগে থেকেই আছে — বাদ')
        st.seen.add(fk)
        st.sort[key] = (st.sort[key] ?? (Object.values(c.subKey[key] || {}).length)) + 1
        return [{ exam_id: ex.id, class_id: cls.id, name_bn: r.text('name_bn'), name_en: r.text('name_en') || null, full_marks: full, pass_marks: pass, exam_date: d, exam_time: r.text('exam_time') || null, sort: st.sort[key] }]
      }
      return []
    },
    newState: () => ({ seen: new Set(), sort: {} }),
  },
  {
    id: 'marks', title: 'ফলাফল / নম্বর', table: 'exam_marks', file: 'নম্বর', dynamic: true, conflict: 'subject_id,student_id',
    cols: [
      C('exam', 'পরীক্ষা', { req: 1 }), C('class', 'শ্রেণি', { req: 1 }), C('dept', 'বিভাগ'),
      C('student_no', 'ছাত্র আইডি', { req: 1 }), C('sname', 'নাম'),
    ],
    maps: {},
    check(r, c, st, dyn) {
      r.need('exam'); r.need('class'); r.need('student_no')
      const ex = refExam(r, 'exam', c)
      const cls = refClass(r, 'class', c, refDept(r, 'dept', c))
      const stu = refStudent(r, 'student_no', c, 'sname')
      if (stu && cls && stu.class_id !== cls.id) r.warn('student_no', 'ছাত্রটি সাইটে এই শ্রেণিতে নেই — তবু নম্বর যোগ হবে')
      if (!(ex && cls && stu)) return []
      const fk = `${ex.id}|${stu.id}`
      if (st.seen.has(fk)) { dupSkip(r, 'এই ছাত্রের এই পরীক্ষার সারি ফাইলে আগেও আছে — বাদ'); return [] }
      st.seen.add(fk)
      const subs = c.subKey[`${ex.id}|${cls.id}`] || {}
      if (!Object.keys(subs).length) { r.err('class', 'এই পরীক্ষা-শ্রেণির কোনো বিষয় সাইটে নেই — আগে "পরীক্ষার বিষয়" ইম্পোর্ট/যোগ করুন'); return [] }
      const out = []; let any = false
      dyn.forEach((d) => {
        const v = r.raw(d.k)
        if (blank(v)) return
        any = true
        const sub = subs[nk(d.l)]
        if (!sub) { r.warn(d.k, `"${d.l}" বিষয়টি এই পরীক্ষা-শ্রেণিতে নেই — ঘরটি বাদ`); return }
        if (ABSENT.includes(nk(v))) { out.push({ exam_id: ex.id, subject_id: sub.id, student_id: stu.id, marks: null, absent: true }); return }
        const x = Number(dig(String(v)).replace(/,/g, '').trim())
        if (!Number.isFinite(x)) { r.err(d.k, `নম্বর সংখ্যা হতে হবে ("${v}") — অনুপস্থিত হলে "অনুপস্থিত" লিখুন`); return }
        if (x < 0 || x > Number(sub.full_marks)) { r.err(d.k, `নম্বর ${x} — ০ থেকে ${sub.full_marks} এর মধ্যে হতে হবে`); return }
        out.push({ exam_id: ex.id, subject_id: sub.id, student_id: stu.id, marks: x, absent: false })
      })
      if (!any) r.warn('exam', 'এই সারিতে কোনো নম্বর দেওয়া নেই')
      return out
    },
    newState: () => ({ seen: new Set() }),
  },
  {
    id: 'hifz', title: 'হিফজ এন্ট্রি', table: 'hifz_logs', file: 'হিফজ',
    cols: [
      C('date', 'তারিখ', { ex: '15/10/2026', hint: 'ফাঁকা হলে আজকের তারিখ' }),
      C('student_no', 'ছাত্র আইডি', { req: 1, ex: '260001', hint: 'ছাত্র তালিকার পাতা দেখুন' }),
      C('sname', 'নাম (মিলিয়ে দেখার জন্য, ঐচ্ছিক)'),
      C('kind', 'ধরন', { req: 1, ex: 'সবক', list: () => ['সবক', 'সাত সবক', 'আমুখতা'] }),
      C('para', 'পারা (১–৩০)', { ex: '5' }),
      C('pages', 'পৃষ্ঠা / পরিমাণ', { ex: '2' }),
      C('detail', 'সূরা / রুকু / বিবরণ'),
      C('quality', 'মান', { ex: 'ভালো', list: () => ['অতি উত্তম', 'ভালো', 'মোটামুটি', 'দুর্বল'] }),
      C('note', 'নোট'),
    ],
    maps: { kind: enumMap(HKIND), quality: enumMap(QUAL) },
    check(r, c) {
      r.need('student_no'); r.need('kind')
      const stu = refStudent(r, 'student_no', c, 'sname')
      const kind = r.en('kind', this.maps.kind)
      let d = r.date('date')
      if (!d && blank(r.raw('date'))) { d = todayStr(); r.warn('date', 'তারিখ নেই — আজকের তারিখ ধরা হয়েছে') }
      const para = r.num('para', { int: true, min: 1, max: 30 })
      const pages = r.num('pages', { min: 0, def: 0 })
      const quality = r.en('quality', this.maps.quality)
      if (!stu || !kind) return []
      return [{ student_id: stu.id, log_date: d, kind, para, detail: r.text('detail') || null, pages, quality: quality || null, note: r.text('note') || null }]
    },
    newState: () => ({}),
  },
]

// ---------- টেমপ্লেট বানানো ----------
function docRows(ds, extra = []) {
  const rows = [['কলাম', 'বাধ্যতামূলক', 'কীভাবে লিখবেন', 'উদাহরণ']]
  ds.cols.forEach((c) => rows.push([c.l, c.req ? 'হ্যাঁ' : 'না', c.hint || '', c.ex || '']))
  rows.push([], ['সাধারণ নিয়ম'])
  const rules = [
    '১. "তথ্য" পাতায় প্রথম সারির নিচ থেকে তথ্য লিখুন। প্রথম সারি (শিরোনাম) বদলাবেন না, কলামের ক্রম বদলালেও চলবে।',
    '২. সবুজ শিরোনাম = ঐচ্ছিক, লাল-কমলা শিরোনাম (*) = অবশ্যই পূরণ করতে হবে।',
    '৩. তারিখ লিখুন দিন/মাস/সাল (১৫/০৩/২০১৫) বা সাল-মাস-দিন (2015-03-15) ধরনে। বাংলা বা ইংরেজি অঙ্ক দুটোই চলবে।',
    '৪. যেসব কলামে তালিকা (ড্রপডাউন) আছে সেখান থেকে বাছুন — সাইটে যেভাবে আছে হুবহু সেভাবে।',
    '৫. ফাঁকা সারি নিজে থেকেই বাদ যাবে। কোনো ভুল/ফাঁকা থাকলে আপলোডের পর সাইট ওয়ার্নিং দেখাবে; ভুল সারি বাদ দিয়ে বাকিগুলো ইম্পোর্ট হবে।',
    ...extra,
  ]
  rules.forEach((t) => rows.push([t]))
  return rows
}
function listSheet(ds, ctx) {
  const lists = []
  ds.cols.forEach((c, i) => { if (c.list) { const v = [...new Set(c.list(ctx).filter(Boolean))]; if (v.length) lists.push({ col: i, vals: v }) } })
  const rows = []
  const max = Math.max(0, ...lists.map((l) => l.vals.length))
  for (let r = 0; r < max; r++) rows.push(lists.map((l) => l.vals[r] ?? ''))
  const refs = lists.map((l, k) => ({ col: l.col, range: `'তালিকা'!$${String.fromCharCode(65 + k)}$1:$${String.fromCharCode(65 + k)}$${l.vals.length}` }))
  return { rows, refs, has: lists.length > 0 }
}
async function buildTemplate(ds, ctx, opt = {}) {
  const sheets = []
  if (ds.id === 'marks') {
    const { exam, cls } = opt
    const classes = cls ? ctx.classes.filter((k) => k.id === cls) : ctx.classes
    const subjNames = []
    const rows = []
    classes.forEach((k) => {
      const subs = Object.values(ctx.subKey[`${exam.id}|${k.id}`] || {})
      const uniq = [...new Map(subs.map((s) => [s.id, s])).values()].sort((a, b) => a.sort - b.sort)
      uniq.forEach((s) => { if (!subjNames.includes(s.name_bn || s.name_en)) subjNames.push(s.name_bn || s.name_en) })
    })
    const head = ['পরীক্ষা *', 'শ্রেণি *', 'বিভাগ', 'ছাত্র আইডি *', 'নাম', ...subjNames]
    classes.forEach((k) => {
      const has = Object.keys(ctx.subKey[`${exam.id}|${k.id}`] || {}).length
      if (!has) return
      const dep = ctx.deps.find((d) => d.id === k.department_id)
      ctx.students.filter((s) => s.class_id === k.id).forEach((s) => rows.push([nm(exam), nm(k), dep ? nm(dep) : '', s.student_no, s.name_bn || '']))
    })
    if (!subjNames.length) throw new Error('এই পরীক্ষায় (নির্বাচিত শ্রেণিতে) কোনো বিষয় নেই — আগে "পরীক্ষার বিষয়" যোগ বা ইম্পোর্ট করুন')
    if (!rows.length) throw new Error('এই শ্রেণিতে কোনো ছাত্র নেই — আগে ছাত্র ইম্পোর্ট/যোগ করুন')
    sheets.push({ name: 'তথ্য', rows: [head, ...rows], headerRow: true, required: head.map((h) => h.includes('*')), widths: [22, 16, 14, 14, 22, ...subjNames.map(() => 14)], textCols: [0, 1, 2, 3, 4], maxRow: rows.length + 50 })
    const dr = docRows(ds, ['৬. নম্বর ঘরে সংখ্যা লিখুন; পরীক্ষায় অনুপস্থিত থাকলে "অনুপস্থিত" লিখুন; নম্বর না দিতে চাইলে ঘর ফাঁকা রাখুন।', '৭. বিষয়ের কলামগুলো সাইটের বিষয়ের নামে তৈরি — নাম বদলাবেন না। ছাত্র আইডি-র সারি মুছলেও সমস্যা নেই।'])
    sheets.push({ name: 'নির্দেশনা', rows: dr, kind: 'doc', widths: [26, 14, 60, 26], headerRow: true })
    return writeXlsx(sheets)
  }
  const head = ds.cols.map((c) => (c.req ? `${c.l} *` : c.l))
  const ls = listSheet(ds, ctx)
  sheets.push({ name: 'তথ্য', rows: [head], headerRow: true, required: ds.cols.map((c) => !!c.req), widths: ds.cols.map((c) => Math.max(14, c.l.length + 6)), textCols: ds.cols.map((_, i) => i), lists: ls.refs, maxRow: 3000 })
  sheets.push({ name: 'নির্দেশনা', rows: docRows(ds), kind: 'doc', widths: [26, 14, 60, 26], headerRow: true })
  if (ds.id === 'hifz') {
    sheets.push({ name: 'ছাত্র তালিকা', rows: [['আইডি', 'নাম', 'শ্রেণি'], ...ctx.students.map((s) => [s.student_no, s.name_bn || '', nm(ctx.classes.find((k) => k.id === s.class_id))])], kind: 'doc', widths: [14, 28, 18], headerRow: true, docStyle: { 0: 4 } })
  }
  if (ls.has) sheets.push({ name: 'তালিকা', rows: ls.rows, hidden: true })
  return writeXlsx(sheets)
}

// ---------- ফাইল পড়া ও যাচাই ----------
function mapHeaders(ds, rows) {
  const look = {}
  ds.cols.forEach((c) => { look[norm(c.l)] = c; look[norm(c.k)] = c })
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const r = rows[i] || []
    const colMap = {}; const dyn = []; let hit = 0
    r.forEach((h, ci) => {
      if (blank(h)) return
      const c = look[norm(h)]
      if (c) { if (colMap[ci] === undefined) { colMap[ci] = c.k; hit += 1 } } else dyn.push({ ci, l: String(h).replace(/\*/g, '').trim() })
    })
    if (hit >= Math.min(2, ds.cols.length)) return { at: i, colMap, extra: dyn }
  }
  return null
}

function analyze(ds, sheets, ctx) {
  const sheet = sheets.find((s) => s.name === 'তথ্য') || sheets.find((s) => mapHeaders(ds, s.rows)) || sheets[0]
  const hm = sheet && mapHeaders(ds, sheet.rows)
  if (!hm) return { fatal: `ফাইলে এই ডেটার শিরোনাম পাওয়া যায়নি। "${ds.title}" এর টেমপ্লেট ডাউনলোড করে সেটিই পূরণ করে আপলোড করুন।` }
  const present = new Set(Object.values(hm.colMap))
  const missingCols = ds.cols.filter((c) => c.req && !present.has(c.k)).map((c) => c.l)
  if (missingCols.length) return { fatal: `বাধ্যতামূলক কলাম ফাইলে নেই: ${missingCols.join('، ')}। টেমপ্লেটের শিরোনাম ঠিক রাখুন।` }
  const head = []
  let dyn = []
  if (ds.dynamic) dyn = hm.extra.map((d) => ({ k: `dyn${d.ci}`, l: d.l, ci: d.ci }))
  else if (hm.extra.length) head.push({ n: hm.at + 1, col: hm.extra.map((e) => e.l).join(', '), level: 'warn', msg: 'চেনা যায়নি এমন কলাম — এগুলো বাদ দেওয়া হয়েছে' })
  const cols = [...ds.cols, ...dyn]
  const st = ds.newState()
  const out = []
  for (let i = hm.at + 1; i < sheet.rows.length; i++) {
    const cells = sheet.rows[i] || []
    if (!cells.some((v) => !blank(v))) continue
    const raw = {}
    Object.entries(hm.colMap).forEach(([ci, k]) => { raw[k] = cells[ci] })
    dyn.forEach((d) => { raw[d.k] = cells[d.ci] })
    const r = rowCtx(raw, cols, i + 1)
    let recs = []
    try { recs = ds.check(r, ctx, st, dyn) || [] } catch (e) { r.err(cols[0].k, `সারিটি পড়তে সমস্যা: ${e.message}`) }
    const hasErr = r.issues.some((x) => x.level === 'err')
    let status = 'ok'
    if (hasErr) status = 'error'
    else if (r.skip) { status = 'skip'; r.issues.push({ n: r.n, col: '—', level: 'skip', msg: r.skip }) } else if (r.issues.length) status = 'warn'
    out.push({ n: r.n, status, soft: r.soft, issues: r.issues, recs: recs.map((x) => ({ ...x, _n: r.n })) })
  }
  return { rows: out, head, sheetName: sheet.name }
}

// ---------- ইম্পোর্ট (ধাপে ধাপে) ----------
async function saveRecs(ds, recs, onProg) {
  const failed = []
  let done = 0
  const strip = (x) => { const y = { ...x }; delete y._n; return y }
  const run = (rows) => (ds.conflict ? supabase.from(ds.table).upsert(rows, { onConflict: ds.conflict }) : supabase.from(ds.table).insert(rows))
  for (let i = 0; i < recs.length; i += 200) {
    const chunk = recs.slice(i, i + 200)
    const { error } = await run(chunk.map(strip))
    if (!error) done += chunk.length
    else {
      for (const rec of chunk) {
        const { error: e2 } = await run([strip(rec)])
        if (e2) failed.push({ n: rec._n, msg: e2.message }); else done += 1
      }
    }
    onProg(Math.min(i + 200, recs.length), recs.length)
  }
  return { done, failed }
}

const LV = { err: 'ভুল', warn: 'ওয়ার্নিং', skip: 'বাদ' }

export default function ExcelImport() {
  const [ctx, setCtx] = useState(null)
  const [dsId, setDsId] = useState('students')
  const ds = DATASETS.find((d) => d.id === dsId)
  const [examId, setExamId] = useState('')
  const [clsId, setClsId] = useState('')
  const [msg, setMsg] = useState('')
  const [file, setFile] = useState(null)
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState('')
  const [strict, setStrict] = useState(false)
  const [allowDup, setAllowDup] = useState(false)
  const [filter, setFilter] = useState('all')
  const [prog, setProg] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const fileRef = useRef(null)

  async function reload() { setCtx(await loadCtx()) }
  useEffect(() => { reload() }, [])
  useEffect(() => { setRes(null); setFile(null); setOutcome(null); setMsg(''); if (fileRef.current) fileRef.current.value = '' }, [dsId])

  async function download() {
    setMsg('')
    try {
      setBusy('template')
      const fresh = await loadCtx()
      setCtx(fresh)
      const opt = {}
      if (ds.id === 'marks') {
        const exam = fresh.exams.find((e) => e.id === examId)
        if (!exam) throw new Error('আগে পরীক্ষা বাছুন')
        opt.exam = exam; opt.cls = clsId
      }
      const blob = await buildTemplate(ds, fresh, opt)
      saveBlob(blob, `${ds.file}-টেমপ্লেট.xlsx`)
    } catch (e) { setMsg(e.message) } finally { setBusy('') }
  }

  async function onFile(e) {
    const f = e.target.files && e.target.files[0]
    const inp = e.target
    setRes(null); setOutcome(null); setMsg('')
    if (!f) return
    setFile(f)
    setTimeout(() => { try { inp.value = '' } catch (x) { /* ignore */ } }, 0)
    if (!/\.xlsx$/i.test(f.name)) { setMsg('শুধু .xlsx ফাইল চলবে (এক্সেল/গুগল শিট থেকে "Download as .xlsx")। পুরোনো .xls হলে এক্সেলে খুলে "Save as .xlsx" করুন।'); return }
    try {
      setBusy('read')
      const fresh = await loadCtx()
      setCtx(fresh)
      const sheets = await readXlsx(await f.arrayBuffer())
      const a = analyze(ds, sheets, fresh)
      if (a.fatal) setMsg(a.fatal); else setRes(a)
    } catch (err) { setMsg(`ফাইল পড়া যায়নি: ${err.message}`) } finally { setBusy('') }
  }

  const stats = useMemo(() => {
    if (!res) return null
    const s = { total: res.rows.length, ok: 0, warn: 0, error: 0, skip: 0, soft: 0, recs: 0 }
    res.rows.forEach((r) => {
      s[r.status] += 1
      if (r.status === 'skip' && r.soft) s.soft += 1
      if (r.status === 'ok' || r.status === 'warn' || (allowDup && r.status === 'skip' && r.soft)) s.recs += r.recs.length
    })
    return s
  }, [res, allowDup])

  const issues = useMemo(() => {
    if (!res) return []
    const all = [...res.head, ...res.rows.flatMap((r) => r.issues)]
    return filter === 'all' ? all : all.filter((x) => x.level === filter)
  }, [res, filter])

  async function doImport() {
    if (!res || !stats) return
    const bad = res.rows.filter((r) => r.status === 'error').length
    if (strict && bad) { setMsg('"ভুল থাকলে কিছুই ইম্পোর্ট নয়" চালু আছে — আগে ভুলগুলো ঠিক করুন।'); return }
    const take = res.rows.filter((r) => r.status === 'ok' || r.status === 'warn' || (allowDup && r.status === 'skip' && r.soft))
    const recs = take.flatMap((r) => r.recs)
    if (!recs.length) { setMsg('ইম্পোর্ট করার মতো কোনো সঠিক সারি নেই।'); return }
    setBusy('import'); setMsg(''); setProg([0, recs.length])
    try {
      const out = await saveRecs(ds, recs, (a, b) => setProg([a, b]))
      setOutcome({ ...out, total: recs.length })
      setRes(null); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await reload()
    } catch (e) { setMsg(e.message) } finally { setBusy(''); setProg(null) }
  }

  function report() {
    const rows = []
    res.head.forEach((x) => rows.push([x.n, x.col, LV[x.level], x.msg]))
    res.rows.forEach((r) => r.issues.forEach((x) => rows.push([x.n, x.col, LV[x.level], x.msg])))
    downloadCsv(`${ds.file}-ইম্পোর্ট-রিপোর্ট.csv`, ['এক্সেল সারি', 'কলাম', 'ধরন', 'বিবরণ'], rows)
  }

  if (!ctx) return <><h2>এক্সেল থেকে ইম্পোর্ট</h2><p className="muted">লোড হচ্ছে…</p></>
  const examOpts = ctx.exams.map((e) => [e.id, nm(e)])
  const clsOpts = [['', 'সব শ্রেণি'], ...ctx.classes.map((k) => [k.id, nm(k)])]

  return (
    <>
      <h2>এক্সেল থেকে ইম্পোর্ট</h2>
      <p className="muted">সাইট থেকে তৈরি টেমপ্লেট নামান → এক্সেলে তথ্য পূরণ করুন → ফাইলটি এখানে আপলোড করুন। ভুল বা ফাঁকা থাকলে ওয়ার্নিং দেখাবে, সঠিক সারিগুলো একসাথে ইম্পোর্ট হয়ে যাবে।</p>

      <div className="ei-sec">
        <div className="ei-step"><b>১</b> কী ইম্পোর্ট করবেন?</div>
        <div className="tabs">
          {DATASETS.map((d) => <button key={d.id} className={dsId === d.id ? 'on' : ''} onClick={() => setDsId(d.id)}>{d.title}</button>)}
        </div>
        <div className="ei-order">
          {dsId === 'students' && 'আগে শ্রেণি (ও বিভাগ) সাইটে থাকতে হবে — না থাকলে প্রথমে "শ্রেণি / হালকা" ইম্পোর্ট করুন।'}
          {dsId === 'subjects' && 'আগে পরীক্ষা ও শ্রেণি সাইটে থাকতে হবে — না থাকলে প্রথমে "পরীক্ষা" ও "শ্রেণি" ইম্পোর্ট করুন।'}
          {dsId === 'marks' && 'আগে ছাত্র ও পরীক্ষার বিষয় সাইটে থাকতে হবে। টেমপ্লেটে ছাত্রদের আইডি-নাম ও বিষয়ের কলাম আগে থেকেই বসানো থাকবে, আপনি শুধু নম্বর লিখবেন। আগের নম্বর থাকলে নতুনটি দিয়ে বদলে যাবে।'}
          {dsId === 'hifz' && 'আগে ছাত্র সাইটে থাকতে হবে। টেমপ্লেটে "ছাত্র তালিকা" পাতায় সব আইডি-নাম দেওয়া থাকবে।'}
          {['classes', 'exams', 'staff'].includes(dsId) && 'একই নামের আগে থেকে থাকা সারি ডুপ্লিকেট ধরে বাদ যাবে।'}
        </div>
      </div>

      <div className="ei-sec">
        <div className="ei-step"><b>২</b> টেমপ্লেট ডাউনলোড</div>
        {ds.id === 'marks' && (
          <div className="grid g2" style={{ marginBottom: 10 }}>
            <div className="field"><label>পরীক্ষা</label><Select placeholder="পরীক্ষা বাছুন" value={examId} onChange={setExamId} options={examOpts} /></div>
            <div className="field"><label>শ্রেণি</label><Select value={clsId} onChange={setClsId} options={clsOpts} /></div>
          </div>
        )}
        <button className="btn" disabled={busy === 'template'} onClick={download}>{busy === 'template' ? 'তৈরি হচ্ছে…' : `${ds.title}-এর এক্সেল টেমপ্লেট নামান`}</button>
        <div className="ei-cols">
          {ds.cols.map((c) => <span key={c.k} className={`pill${c.req ? ' new' : ''}`}>{c.l}{c.req ? ' *' : ''}</span>)}
          {ds.dynamic && <span className="pill ok">+ বিষয়ের কলাম (নম্বর)</span>}
        </div>
      </div>

      <div className="ei-sec">
        <div className="ei-step"><b>৩</b> পূরণ করা ফাইল আপলোড</div>
        <input ref={fileRef} type="file" accept=".xlsx" onChange={onFile} className="ei-file" />
        {busy === 'read' && <p className="muted">ফাইল যাচাই হচ্ছে…</p>}
        {msg && <div className="ei-alert err">{msg}</div>}
      </div>

      {outcome && (
        <div className="ei-sec">
          <div className={`ei-alert ${outcome.failed.length ? 'warn' : 'ok'}`}>
            <b>ইম্পোর্ট শেষ।</b> {outcome.done} টি যুক্ত হয়েছে{outcome.failed.length ? `, ${outcome.failed.length} টি যুক্ত করা যায়নি।` : '।'}
          </div>
          {outcome.failed.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table><thead><tr><th>এক্সেল সারি</th><th>সমস্যা</th></tr></thead>
                <tbody>{outcome.failed.map((f, i) => <tr key={i}><td>{f.n}</td><td>{f.msg}</td></tr>)}</tbody></table>
            </div>
          )}
        </div>
      )}

      {res && stats && (
        <div className="ei-sec">
          <div className="ei-step"><b>৪</b> যাচাইয়ের ফল — {file && file.name}</div>
          <div className="ei-stats">
            <div><b>{stats.total}</b><span>মোট সারি</span></div>
            <div className="ok"><b>{stats.ok}</b><span>সম্পূর্ণ ঠিক</span></div>
            <div className="warn"><b>{stats.warn}</b><span>ওয়ার্নিংসহ (ইম্পোর্ট হবে)</span></div>
            <div className="skip"><b>{stats.skip}</b><span>ডুপ্লিকেট (বাদ)</span></div>
            <div className="err"><b>{stats.error}</b><span>ভুল (বাদ)</span></div>
          </div>
          <label className="ei-chk"><input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} /> কোনো একটি ভুল থাকলে কিছুই ইম্পোর্ট করবেন না</label>
          {stats.soft > 0 && <label className="ei-chk"><input type="checkbox" checked={allowDup} onChange={(e) => setAllowDup(e.target.checked)} /> "সম্ভাব্য ডুপ্লিকেট" ({stats.soft} টি) তবুও যোগ করুন</label>}
          {issues.length > 0 || res.rows.some((r) => r.issues.length) ? (
            <>
              <div className="tabs" style={{ marginTop: 10 }}>
                {[['all', 'সব'], ['err', 'ভুল'], ['warn', 'ওয়ার্নিং'], ['skip', 'ডুপ্লিকেট/বাদ']].map(([k, l]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}
              </div>
              <div className="table-wrap ei-issues">
                <table><thead><tr><th>সারি</th><th>কলাম</th><th>ধরন</th><th>বিবরণ</th></tr></thead>
                  <tbody>
                    {issues.slice(0, 400).map((x, i) => <tr key={i} className={`ei-${x.level}`}><td>{x.n}</td><td>{x.col}</td><td><span className={`ei-tag ${x.level}`}>{LV[x.level]}</span></td><td>{x.msg}</td></tr>)}
                    {!issues.length && <tr><td colSpan="4" className="muted">এই ধরনের কিছু নেই</td></tr>}
                  </tbody></table>
              </div>
              {issues.length > 400 && <p className="muted">প্রথম ৪০০টি দেখানো হচ্ছে — পুরো তালিকা CSV রিপোর্টে পাবেন।</p>}
            </>
          ) : <div className="ei-alert ok" style={{ marginTop: 10 }}>কোনো ভুল বা ওয়ার্নিং নেই। সবকিছু ঠিক আছে।</div>}
          <div className="ei-actions">
            <button className="btn" disabled={busy === 'import' || !stats.recs} onClick={doImport}>{busy === 'import' ? `ইম্পোর্ট হচ্ছে… ${prog ? `${prog[0]}/${prog[1]}` : ''}` : `${stats.recs} টি ${ds.id === 'marks' ? 'নম্বর' : 'সারি'} ইম্পোর্ট করুন`}</button>
            {(issues.length > 0 || res.rows.some((r) => r.issues.length)) && <button className="btn outline" onClick={report}>ভুলের রিপোর্ট (CSV)</button>}
          </div>
          {prog && <div className="ei-bar"><i style={{ width: `${(prog[0] / prog[1]) * 100}%` }} /></div>}
        </div>
      )}
    </>
  )
}
