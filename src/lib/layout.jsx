// লেআউট ইঞ্জিন: আইডি কার্ড, প্রবেশপত্র ও ভর্তি ফরমের নকশা (সামনে ও পেছনে), সব মাপ মিলিমিটারে।
// একটি নকশা = { size:{w,h}, print:'front|back|both', mirror:'none|cols|rows', sides:{ front:{bg_url, els:[]}, back:{...} } }
// উপাদান (el) = { id, kind:'field|text|image|box', key, text, src, x,y,w,h, size(pt), bold, align, color, prefix, underline, border, fill, multi }

import { RECEIPT_DEFAULTS } from './config'
import { qrMatrix } from './qr'

export const PT = 0.3528 // ১ pt = ০.৩৫২৮ মিমি

const INST = [['inst_name', 'প্রতিষ্ঠানের নাম'], ['inst_addr', 'প্রতিষ্ঠানের ঠিকানা'], ['inst_phone', 'প্রতিষ্ঠানের ফোন'], ['logo', 'লোগো', 'image']]
const STU = [['name_bn', 'নাম (বাংলা)'], ['name_en', 'নাম (ইংরেজি)'], ['student_no', 'আইডি নম্বর'], ['class', 'শ্রেণি'], ['father_name', 'পিতার নাম'], ['mother_name', 'মাতার নাম'], ['dob', 'জন্ম তারিখ'], ['gender', 'লিঙ্গ'], ['guardian_phone', 'অভিভাবকের ফোন'], ['phone2', 'বিকল্প ফোন'], ['address', 'ঠিকানা', 'multi'], ['blood_group', 'রক্তের গ্রুপ'], ['residence', 'আবাসিক/অনাবাসিক'], ['admission_date', 'ভর্তির তারিখ'], ['photo', 'শিক্ষার্থীর ছবি', 'image']]
const STAFF = [['name_bn', 'নাম (বাংলা)'], ['name_en', 'নাম (ইংরেজি)'], ['staff_no', 'আইডি নম্বর'], ['designation', 'পদবি'], ['phone', 'ফোন'], ['address', 'ঠিকানা', 'multi'], ['nid', 'জাতীয় পরিচয়পত্র নং'], ['join_date', 'যোগদানের তারিখ'], ['photo', 'ছবি', 'image']]
const ADMIT = [['doc_title', 'কার্ডের শিরোনাম'], ['exam_name', 'পরীক্ষার নাম'], ['year', 'সাল'], ['routine', 'পরীক্ষার রুটিন', 'multi'], ['instructions', 'নির্দেশনা', 'multi'], ['sign_left', 'বাঁ স্বাক্ষরের লেখা'], ['sign_right', 'ডান স্বাক্ষরের লেখা']]
const FORM = [['form_heading', 'ফরমের শিরোনাম (সালসহ)'], ['form_year', 'ভর্তির শিক্ষাবর্ষ'], ['prev_class', 'আগের শ্রেণি'], ['prev_result', 'আগের ফলাফল'], ['next_class', 'ভর্তির শ্রেণি (পরবর্তী)'], ['decision', 'পুনঃভর্তির যোগ্যতা'], ['reasons', 'যোগ্যতার কারণ/শর্ত'], ['policy_title', 'নীতিমালার শিরোনাম'], ['policy', 'নীতিমালা', 'multi'], ['declaration', 'অঙ্গীকার', 'multi'], ['sign_guardian', 'অভিভাবকের স্বাক্ষরের লেখা'], ['sign_authority', 'কর্তৃপক্ষের স্বাক্ষরের লেখা']]

// মার্কশিট: নম্বরের টেবিল ('table') একটি বিশেষ উপাদান; বাকিগুলো সাধারণ লেখা
const MARK = [['exam_name', 'পরীক্ষার নাম'], ['year', 'শিক্ষাবর্ষ / সাল'], ['exam_period', 'পরীক্ষার সময়কাল'], ['marks_table', 'নম্বরের টেবিল (বিষয়ভিত্তিক)', 'table'], ['total', 'মোট প্রাপ্ত নম্বর'], ['full_total', 'মোট পূর্ণমান'], ['avg', 'গড় নম্বর'], ['division', 'বিভাগ'], ['merit', 'মেধাস্থান'], ['issue_date', 'প্রদানের তারিখ'], ['verify_qr', 'যাচাই QR কোড', 'qr']]

// রসিদ-প্যাড: প্রেসের ছাপানো A5 কাগজে শুধু তথ্য ছাপার নকশা
const RPAD = [['title', 'রসিদের শিরোনাম'], ['no', 'রসিদ নং'], ['date', 'তারিখ'], ['meta', 'নাম/মাধ্যম ইত্যাদি (সব লাইন একসাথে)', 'multi'], ['meta_শিক্ষার্থী', 'শিক্ষার্থী (নাম ও আইডি)'], ['meta_নাম', 'নাম (শিক্ষক-কর্মচারী)'], ['meta_দাতা', 'দাতা'], ['meta_প্রদানকারী', 'প্রদানকারী'], ['meta_পদবি', 'পদবি'], ['meta_আইডি', 'আইডি'], ['meta_ফোন', 'ফোন'], ['meta_মাধ্যম', 'পেমেন্টের মাধ্যম'], ['meta_রেফারেন্স', 'রেফারেন্স / ট্রান্স. নং'], ['items_desc', 'বিবরণ (প্রতি লাইনে একটি)', 'multi'], ['items_amt', 'টাকার অঙ্ক (প্রতি লাইনে একটি)', 'multi'], ['total', 'মোট টাকা'], ['note', 'নিচের লেখা/নোট', 'multi'], ['printed_by', 'Printed by (কে ছাপাল)']]
export const FIELD_SETS = {
  receipt_pad: RPAD,
  idcard_student: [...STU, ...INST],
  idcard_staff: [...STAFF, ...INST],
  admit: [...STU, ...ADMIT, ...INST],
  form: [...STU, ...FORM, ...INST],
  marksheet: [...STU, ...MARK, ...INST],
}
export const TYPE_TITLE = { receipt_pad: 'রসিদ প্যাড', idcard_student: 'শিক্ষার্থী আইডি কার্ড', idcard_staff: 'শিক্ষক-কর্মচারী আইডি কার্ড', admit: 'প্রবেশপত্র', form: 'ভর্তি ফরম', marksheet: 'মার্কশিট' }
export const fieldLabel = (type, key) => (FIELD_SETS[type].find((f) => f[0] === key) || [key, key])[1]
export const fieldKind = (type, key) => (FIELD_SETS[type].find((f) => f[0] === key) || [])[2] || 'text'

let n = 0
const id = () => `e${Date.now().toString(36)}${(n++).toString(36)}`
const F = (key, x, y, w, h, o = {}) => ({ id: id(), kind: 'field', key, x, y, w, h, size: 9, bold: false, align: 'left', color: '#000000', prefix: '', underline: false, ...o })
const T = (text, x, y, w, h, o = {}) => ({ id: id(), kind: 'text', text, x, y, w, h, size: 9, bold: false, align: 'left', color: '#000000', ...o })
const IMG = (key, x, y, w, h, o = {}) => ({ id: id(), kind: 'field', key, x, y, w, h, border: true, ...o })
const B = (x, y, w, h, o = {}) => ({ id: id(), kind: 'box', x, y, w, h, border: 0, fill: '', color: '#000000', ...o })

function idcard(staff) {
  return {
    size: { w: 85.6, h: 54 }, print: 'front', mirror: 'cols',
    sides: {
      front: { bg_url: '', els: [
        B(0, 0, 85.6, 11, { fill: '#16a34a' }), IMG('logo', 2, 1, 9, 9, { border: false }),
        F('inst_name', 12.5, 1.2, 70, 5.5, { size: 9, bold: true, color: '#ffffff' }), T(staff ? 'পরিচয়পত্র' : 'শিক্ষার্থী পরিচয়পত্র', 12.5, 6.4, 70, 4, { size: 7, color: '#ffffff' }),
        IMG('photo', 3, 13.5, 21, 26),
        F('name_bn', 27, 14, 56, 5.5, { size: 10.5, bold: true }),
        staff ? F('staff_no', 27, 20.5, 56, 4, { size: 8, prefix: 'আইডি: ' }) : F('student_no', 27, 20.5, 56, 4, { size: 8, prefix: 'আইডি: ' }),
        staff ? F('designation', 27, 25, 56, 4, { size: 8, prefix: 'পদ: ' }) : F('class', 27, 25, 56, 4, { size: 8, prefix: 'শ্রেণি: ' }),
        staff ? F('phone', 27, 29.5, 56, 4, { size: 8, prefix: 'ফোন: ' }) : F('father_name', 27, 29.5, 56, 4, { size: 8, prefix: 'পিতা: ' }),
        staff ? null : F('guardian_phone', 27, 34, 56, 4, { size: 8, prefix: 'যোগাযোগ: ' }),
        staff ? null : F('blood_group', 27, 38.5, 56, 4, { size: 8, prefix: 'রক্ত: ' }),
        B(0, 47.5, 85.6, 6.5, { fill: '#e8f5ec' }), F('inst_addr', 2, 48.6, 81.6, 4.5, { size: 6.5, align: 'center' }),
      ].filter(Boolean) },
      back: { bg_url: '', els: [
        F('inst_name', 5, 6, 75.6, 6, { size: 10, bold: true, align: 'center' }),
        T('এই কার্ড হারিয়ে গেলে অনুগ্রহ করে নিচের ঠিকানায় ফেরত দিন।', 5, 15, 75.6, 8, { size: 8, align: 'center' }),
        F('inst_addr', 5, 25, 75.6, 8, { size: 8, align: 'center' }), F('inst_phone', 5, 33, 75.6, 4.5, { size: 8, align: 'center', prefix: 'ফোন: ' }),
        B(48, 44, 32, 0.2, { fill: '#000000' }), T('কর্তৃপক্ষের স্বাক্ষর', 48, 44.8, 32, 4, { size: 7, align: 'center' }),
      ] },
    },
  }
}

// পুরোনো মিমি-অবস্থান থেকে প্যাডের ডিফল্ট নকশা (পাতার কোণ থেকে মাপা)
export function receiptPadDefault(cfg = RECEIPT_DEFAULTS) {
  const m = Math.round(cfg.margin_in * 25.4 * 10) / 10
  const B = cfg.pad.blocks
  const ox = m + (cfg.pad.dx || 0)
  const oy = m + (cfg.pad.dy || 0)
  const sz = cfg.font_pt || 11
  const els = []
  const add = (blk, e) => { if (B[blk].show) els.push(e) }
  add('title', F('title', ox + B.title.x, oy + B.title.y, B.title.w, 7, { size: Math.round(sz * 1.15 * 2) / 2, bold: true }))
  add('no', F('no', ox + B.no.x, oy + B.no.y, B.no.w, 6, { size: sz, prefix: 'নং: ' }))
  add('date', F('date', ox + B.date.x, oy + B.date.y, B.date.w, 6, { size: sz, prefix: 'তারিখ: ' }))
  add('meta', F('meta', ox + B.meta.x, oy + B.meta.y, B.meta.w, 20, { size: sz, multi: true }))
  const w = B.items.w
  add('items', F('items_desc', ox + B.items.x, oy + B.items.y, Math.round(w * 0.74 * 2) / 2, 64, { size: sz, multi: true }))
  add('items', F('items_amt', ox + B.items.x + Math.round(w * 0.74 * 2) / 2, oy + B.items.y, w - Math.round(w * 0.74 * 2) / 2, 64, { size: sz, multi: true, align: 'right' }))
  add('items', F('total', ox + B.items.x, oy + B.items.y + 66, w, 7, { size: sz, bold: true, align: 'right', prefix: 'মোট: ৳ ' }))
  add('items', F('note', ox + B.items.x, oy + B.items.y + 75, w, 12, { size: Math.round(sz * 0.85 * 2) / 2, multi: true }))
  if (cfg.show_printed_by) add('by', F('printed_by', ox + B.by.x, oy + B.by.y, B.by.w, 5, { size: Math.round(sz * 0.8 * 2) / 2 }))
  return { size: { w: 148, h: 210 }, print: 'front', mirror: 'none', bg_noprint: true, sides: { front: { bg_url: '', els }, back: { bg_url: '', els: [] } } }
}

export function defaultLayout(type) {
  if (type === 'receipt_pad') return receiptPadDefault(RECEIPT_DEFAULTS)
  if (type === 'idcard_student') return idcard(false)
  if (type === 'idcard_staff') return idcard(true)
  if (type === 'marksheet') {
    const G = '#16603a'
    const box = (x, label, key) => [B(x, 238, 43, 15, { border: 0.3, color: G }), T(label, x, 239, 43, 5, { size: 8.5, align: 'center', color: '#444444' }), F(key, x, 244.5, 43, 7, { size: 13, bold: true, align: 'center' })]
    return {
      size: { w: 210, h: 297 }, print: 'front', mirror: 'none',
      sides: {
        front: { bg_url: '', els: [
          B(5, 5, 200, 287, { border: 0.8, color: G }), B(7, 7, 196, 283, { border: 0.25, color: G }),
          IMG('logo', 13, 12, 24, 24, { border: false }),
          { id: id(), kind: 'field', key: 'verify_qr', x: 174, y: 12, w: 22, h: 22 }, T('স্ক্যান করে যাচাই করুন', 168, 34.3, 34, 3, { size: 6, align: 'center', color: '#555555' }),
          F('inst_name', 40, 12, 130, 9, { size: 17, bold: true, align: 'center', color: G }),
          F('inst_addr', 40, 22, 130, 5, { size: 8.5, align: 'center' }), F('inst_phone', 40, 27.5, 130, 5, { size: 8.5, align: 'center', prefix: 'ফোন: ' }),
          B(12, 38, 186, 0.5, { fill: G }),
          B(55, 42, 100, 9, { fill: G }), T('একাডেমিক মার্কশিট', 55, 42.9, 100, 8, { size: 15, bold: true, align: 'center', color: '#ffffff' }),
          F('exam_name', 12, 54, 186, 7, { size: 13, bold: true, align: 'center' }),
          F('year', 12, 61.5, 186, 5.5, { size: 10.5, align: 'center', prefix: 'শিক্ষাবর্ষ: ' }),
          F('exam_period', 12, 67, 186, 5, { size: 9, align: 'center', prefix: 'পরীক্ষার সময়কাল: ', color: '#444444' }),
          F('name_bn', 14, 77, 142, 7, { size: 11.5, bold: true, prefix: 'শিক্ষার্থীর নাম: ' }),
          F('father_name', 14, 84.5, 142, 6.5, { size: 10.5, prefix: 'পিতার নাম: ' }),
          F('mother_name', 14, 91.5, 142, 6.5, { size: 10.5, prefix: 'মাতার নাম: ' }),
          F('student_no', 14, 98.5, 65, 6.5, { size: 10.5, prefix: 'আইডি নম্বর: ' }), F('class', 80, 98.5, 76, 6.5, { size: 10.5, prefix: 'শ্রেণি: ' }),
          F('dob', 14, 105.5, 142, 6.5, { size: 10.5, prefix: 'জন্ম তারিখ: ' }),
          IMG('photo', 164, 77, 32, 38),
          { id: id(), kind: 'field', key: 'marks_table', x: 14, y: 122, w: 182, h: 110, size: 10.5, fill: '#e8f5ec', color: '#000000', passcol: false },
          ...box(14, 'মোট প্রাপ্ত নম্বর', 'total'), ...box(59, 'গড় নম্বর', 'avg'), ...box(104, 'বিভাগ', 'division'), ...box(149, 'মেধাস্থান', 'merit'),
          T('মন্তব্য:', 14, 257, 20, 5, { size: 9.5 }), B(30, 262, 166, 0.2, { fill: '#555555' }),
          B(14, 277, 48, 0.25, { fill: '#000000' }), T('শ্রেণি শিক্ষক', 14, 277.8, 48, 4, { size: 8.5, align: 'center' }),
          B(81, 277, 48, 0.25, { fill: '#000000' }), T('পরীক্ষা নিয়ন্ত্রক', 81, 277.8, 48, 4, { size: 8.5, align: 'center' }),
          B(148, 277, 48, 0.25, { fill: '#000000' }), T('অধ্যক্ষ / মুহতামিম', 148, 277.8, 48, 4, { size: 8.5, align: 'center' }),
          F('issue_date', 14, 284, 100, 4.5, { size: 8.5, prefix: 'প্রদানের তারিখ: ', color: '#444444' }),
        ] },
        back: { bg_url: '', els: [] },
      },
    }
  }
  if (type === 'admit') {
    return {
      size: { w: 140, h: 95 }, print: 'front', mirror: 'rows',
      sides: {
        front: { bg_url: '', els: [
          IMG('logo', 3, 3, 12, 12, { border: false }), F('inst_name', 17, 3, 100, 6, { size: 12, bold: true }),
          F('doc_title', 17, 9.5, 100, 5, { size: 10, bold: true }), F('exam_name', 17, 14.5, 70, 4.5, { size: 9 }), F('year', 80, 14.5, 25, 4.5, { size: 9 }),
          B(3, 20, 134, 0.3, { fill: '#000000' }),
          F('name_bn', 4, 22, 100, 5, { size: 10.5, bold: true, prefix: 'নাম: ' }), F('student_no', 4, 28, 50, 4.5, { size: 9.5, prefix: 'আইডি: ' }), F('class', 56, 28, 50, 4.5, { size: 9.5, prefix: 'শ্রেণি: ' }), F('father_name', 4, 33.5, 100, 4.5, { size: 9.5, prefix: 'পিতা: ' }),
          IMG('photo', 113, 22, 24, 29),
          F('routine', 4, 42, 105, 28, { size: 8, multi: true }),
          F('instructions', 4, 70, 132, 14, { size: 7.5, multi: true }),
          B(6, 88, 38, 0.2, { fill: '#000000' }), F('sign_left', 6, 88.6, 38, 4, { size: 7.5, align: 'center' }),
          B(96, 88, 38, 0.2, { fill: '#000000' }), F('sign_right', 96, 88.6, 38, 4, { size: 7.5, align: 'center' }),
        ] },
        back: { bg_url: '', els: [F('doc_title', 5, 6, 130, 7, { size: 13, bold: true, align: 'center' }), F('instructions', 8, 18, 124, 60, { size: 10, multi: true })] },
      },
    }
  }
  const rows = [['name_bn', 'নাম'], ['father_name', 'পিতার নাম'], ['mother_name', 'মাতার নাম'], ['dob', 'জন্ম তারিখ'], ['gender', 'লিঙ্গ']]
  const wide = [['address', 'ঠিকানা'], ['guardian_phone', 'অভিভাবকের ফোন'], ['blood_group', 'রক্তের গ্রুপ'], ['residence', 'আবাসিক / অনাবাসিক'], ['prev_class', 'আগের শ্রেণি'], ['prev_result', 'আগের ফলাফল'], ['next_class', 'ভর্তির শ্রেণি']]
  return {
    size: { w: 210, h: 297 }, print: 'both', mirror: 'none',
    sides: {
      front: { bg_url: '', els: [
        IMG('logo', 14, 12, 18, 18, { border: false }), F('inst_name', 36, 13, 160, 9, { size: 16, bold: true }), F('inst_addr', 36, 22.5, 160, 6, { size: 9.5 }),
        B(14, 32, 182, 0.5, { fill: '#000000' }), F('form_heading', 14, 35, 182, 8, { size: 13, bold: true, align: 'center' }),
        IMG('photo', 164, 47, 32, 38),
        ...rows.map(([k, l], i) => F(k, 14, 48 + i * 9.5, 146, 7, { size: 11, prefix: `${l}: `, underline: true })),
        ...wide.map(([k, l], i) => F(k, 14, 97 + i * 9.5, 182, 7, { size: 11, prefix: `${l}: `, underline: true })),
        B(14, 168, 182, 22, { border: 0.3 }),
        F('decision', 17, 170, 176, 6, { size: 10.5, bold: true, prefix: 'অফিস ব্যবহারের জন্য — পুনঃভর্তির যোগ্যতা: ' }), F('reasons', 17, 177, 176, 11, { size: 10, prefix: 'কারণ/শর্ত: ', multi: true }),
        B(14, 270, 50, 0.3, { fill: '#000000' }), F('sign_guardian', 14, 271, 50, 5, { size: 10, align: 'center' }),
        B(146, 270, 50, 0.3, { fill: '#000000' }), F('sign_authority', 146, 271, 50, 5, { size: 10, align: 'center' }),
      ] },
      back: { bg_url: '', els: [
        F('policy_title', 14, 18, 182, 8, { size: 14, bold: true, align: 'center' }), F('policy', 18, 32, 174, 90, { size: 11.5, multi: true }),
        F('declaration', 18, 130, 174, 20, { size: 11, multi: true }),
        B(14, 270, 50, 0.3, { fill: '#000000' }), F('sign_guardian', 14, 271, 50, 5, { size: 10, align: 'center' }),
        B(146, 270, 50, 0.3, { fill: '#000000' }), F('sign_authority', 146, 271, 50, 5, { size: 10, align: 'center' }),
      ] },
    },
  }
}


// নম্বরের টেবিলের মাপ (মিমি): DOM ও ক্যানভাস দুই জায়গায় একই
export const tableGeom = (el, withPass) => {
  const rowH = Math.round(((el.size || 10) * PT * 1.55 + 2.2) * 100) / 100
  const fr = withPass ? [0.08, 0.44, 0.16, 0.16, 0.16] : [0.09, 0.51, 0.19, 0.21]
  return { rowH, fr }
}
export const tableCols = (t, withPass) => (withPass
  ? { head: [t.head[0], t.head[1], t.head[2], t.head[4], t.head[3]], rows: t.rows.map((r) => [r[0], r[1], r[2], r[4], r[3], r[5]]), foot: t.foot && [t.foot[0], t.foot[1], t.foot[2], t.foot[4], t.foot[3]] }
  : { head: [t.head[0], t.head[1], t.head[2], t.head[3]], rows: t.rows.map((r) => [r[0], r[1], r[2], r[3], r[5]]), foot: t.foot && [t.foot[0], t.foot[1], t.foot[2], t.foot[3]] })

// ডিজাইন দেখানো। px = প্রতি মিমিতে পিক্সেল (এডিটরে); না দিলে মিমি ইউনিটে (প্রিন্টে)।
export function Design({ layout, side = 'front', data = {}, px, select, onElDown, shift }) {
  const sx = (shift && shift.dx) || 0
  const sy = (shift && shift.dy) || 0
  const S = layout.sides[side] || { els: [] }
  const L = (v) => (px ? v * px : `${v}mm`)
  const fs = (pt) => (px ? pt * PT * px : `${pt}pt`)
  return (
    <div className="ld-card" style={{ position: 'relative', width: L(layout.size.w), height: L(layout.size.h), overflow: 'hidden', background: '#fff', backgroundImage: S.bg_url && (px || !layout.bg_noprint) ? `url(${S.bg_url})` : undefined, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', color: '#000' }}>
      {(S.els || []).map((el) => {
        const base = { position: 'absolute', left: L(el.x + sx), top: L(el.y + sy), width: L(el.w), height: L(el.h), boxSizing: 'border-box' }
        const sel = select === el.id
        const wrap = (child, extra = {}) => (
          <div key={el.id} data-el={el.id} onPointerDown={onElDown ? (e) => onElDown(e, el, 'move') : undefined} style={{ ...base, ...extra, outline: sel ? '1.5px solid #2563eb' : onElDown ? '1px dashed rgba(37,99,235,.35)' : undefined, cursor: onElDown ? 'move' : undefined, touchAction: onElDown ? 'none' : undefined }}>
            {child}
            {sel && onElDown && <span onPointerDown={(e) => { e.stopPropagation(); onElDown(e, el, 'resize') }} style={{ position: 'absolute', right: -5, bottom: -5, width: 10, height: 10, background: '#2563eb', cursor: 'nwse-resize', borderRadius: 2 }} />}
          </div>
        )
        if (el.kind === 'box') return wrap(null, { background: el.fill || 'transparent', border: el.border ? `${L(el.border)} solid ${el.color || '#000'}` : undefined })
        if (el.kind === 'image' || (el.kind === 'field' && (el.key === 'photo' || el.key === 'logo'))) {
          const src = el.kind === 'image' ? el.src : data[el.key]
          return wrap(src ? <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: el.key === 'logo' || el.kind === 'image' ? 'contain' : 'cover', pointerEvents: 'none' }} /> : (px ? <span style={{ fontSize: 11, color: '#888', display: 'grid', placeItems: 'center', height: '100%' }}>ছবি</span> : null), { border: el.border ? `${L(0.3)} solid #000` : undefined, overflow: 'hidden' })
        }
        if (el.kind === 'field' && el.key === 'verify_qr') {
          let m = null
          try { m = data.verify_url ? qrMatrix(data.verify_url) : null } catch (e) { m = null }
          if (!m) return wrap(px ? <span style={{ fontSize: 11, color: '#888', display: 'grid', placeItems: 'center', height: '100%' }}>QR</span> : null)
          const n = m.length + 4
          let d = ''
          m.forEach((row, y) => row.forEach((v, x) => { if (v) d += `M${x + 2} ${y + 2}h1v1h-1z` }))
          return wrap(<svg viewBox={`0 0 ${n} ${n}`} style={{ width: '100%', height: '100%', display: 'block', background: '#fff' }} shapeRendering="crispEdges"><path d={d} fill="#000" /></svg>)
        }
        if (el.kind === 'field' && el.key === 'marks_table') {
          const tb = data.marks_table
          if (!tb) return wrap(px ? <span style={{ fontSize: 11, color: '#888' }}>নম্বরের টেবিল</span> : null)
          const wp = !!el.passcol
          const { rowH, fr } = tableGeom(el, wp)
          const c = tableCols(tb, wp)
          const cell = (v, i, o = {}) => <td key={i} style={{ width: `${fr[i] * 100}%`, height: L(rowH), padding: `0 ${L(1.2)}`, border: `${L(0.2)} solid #8a949b`, textAlign: i === 1 ? 'left' : 'center', fontSize: fs(el.size || 10), fontWeight: o.bold ? 700 : 400, color: o.color || '#000', background: o.bg, whiteSpace: 'nowrap', overflow: 'hidden', boxSizing: 'border-box' }}>{v}</td>
          return wrap(
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', background: 'transparent' }}>
              <tbody>
                <tr>{c.head.map((v, i) => cell(v, i, { bold: true, bg: el.fill || '#e8f5ec' }))}</tr>
                {c.rows.map((r, ri) => <tr key={ri}>{r.slice(0, -1).map((v, i) => cell(v, i, i === r.length - 2 && r[r.length - 1] ? { color: '#c0262d', bold: true } : {}))}</tr>)}
                {c.foot && <tr>{c.foot.map((v, i) => cell(v, i, { bold: true, bg: '#f4f6f7' }))}</tr>}
              </tbody>
            </table>, { height: 'auto', overflow: 'visible' })
        }
        const val = el.kind === 'text' ? el.text : data[el.key]
        const has = el.kind === 'text' || (val !== undefined && val !== null && String(val) !== '')
        const text = el.kind === 'text' ? el.text : `${has ? el.prefix || '' : el.underline ? el.prefix || '' : ''}${has ? val : ''}`
        return wrap(<span style={{ display: 'block', width: '100%', height: '100%', fontSize: fs(el.size || 9), fontWeight: el.bold ? 700 : 400, textAlign: el.align || 'left', color: el.color || '#000', lineHeight: el.lh ? (px ? `${el.lh * px}px` : `${el.lh}mm`) : 1.3, whiteSpace: el.multi || el.kind === 'text' ? 'pre-wrap' : 'nowrap', overflow: 'hidden', textOverflow: 'clip', borderBottom: el.underline ? `${L(0.25)} dotted #000` : undefined }}>{text}</span>)
      })}
    </div>
  )
}

// কার্ড-জাতীয় (ছোট) নকশা A4 শিটে সাজানো: pad = প্রতি কার্ডের চারপাশে কাটার ফাঁক (মিমি)
export function gridOf(page, size, margin = 6, pad = 1) {
  const cw = size.w + 2 * pad
  const ch = size.h + 2 * pad
  const cols = Math.max(1, Math.floor((page.w - 2 * margin) / cw))
  const rows = Math.max(1, Math.floor((page.h - 2 * margin) / ch))
  return { cols, rows, cw, ch, per: cols * rows }
}

function mirrorChunk(chunk, cols, rows, mode) {
  const slots = Array.from({ length: cols * rows }, (_, i) => chunk[i] || null)
  if (mode === 'none') return slots
  const out = Array(cols * rows).fill(null)
  slots.forEach((v, i) => {
    const r = Math.floor(i / cols)
    const c = i % cols
    const rr = mode === 'rows' ? rows - 1 - r : r
    const cc = mode === 'cols' ? cols - 1 - c : c
    out[rr * cols + cc] = v
  })
  return out
}

export function CardSheets({ layout, items, mode, page, margin = 6, pad = 1, landscape }) {
  const g = gridOf(page, layout.size, margin, pad)
  const sheets = []
  for (let i = 0; i < items.length; i += g.per) {
    const chunk = items.slice(i, i + g.per)
    if (mode === 'front' || mode === 'both') sheets.push({ side: 'front', slots: mirrorChunk(chunk, g.cols, g.rows, 'none') })
    if (mode === 'back' || mode === 'both') sheets.push({ side: 'back', slots: mirrorChunk(chunk, g.cols, g.rows, mode === 'back' ? 'none' : layout.mirror || 'none') })
  }
  return (
    <div className="ld-doc">
      {sheets.map((sh, i) => (
        <div key={i} className="ld-sheet" style={{ width: `${page.w}mm`, height: `${page.h - 0.6}mm`, padding: `${margin}mm`, boxSizing: 'border-box', display: 'grid', gridTemplateColumns: `repeat(${g.cols}, ${g.cw}mm)`, gridAutoRows: `${g.ch}mm`, alignContent: 'start' }}>
          {sh.slots.map((d, j) => (
            <div key={j} style={d ? { width: `${g.cw}mm`, height: `${g.ch}mm`, padding: `${pad}mm`, boxSizing: 'border-box', border: '.2mm dashed #999' } : undefined}>
              {d && <Design layout={layout} side={sh.side} data={d} />}
            </div>
          ))}
        </div>
      ))}
      {landscape ? null : null}
    </div>
  )
}

// পূর্ণ পাতার ফরম: প্রতিটি আইটেমের জন্য সামনে/পেছনের পাতা পরপর
export function PageSheets({ layout, items, mode }) {
  const pages = []
  items.forEach((d) => {
    if (mode === 'front' || mode === 'both') pages.push({ side: 'front', d })
    if (mode === 'back' || mode === 'both') pages.push({ side: 'back', d })
  })
  return (
    <div className="ld-doc">
      {pages.map((p, i) => (
        <div key={i} className="ld-sheet" style={{ width: `${layout.size.w}mm`, height: `${layout.size.h - 0.6}mm` }}>
          <Design layout={layout} side={p.side} data={p.d} />
        </div>
      ))}
    </div>
  )
}
