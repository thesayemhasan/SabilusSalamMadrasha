// মার্কশিটের তথ্য সাজানো: অ্যাডমিন প্রিন্ট ও অভিভাবকের PDF দুই জায়গায় একই
import { dig, fmtDate } from './util'

export const MS_LABELS = { bn: ['ক্র.', 'বিষয়', 'পূর্ণমান', 'প্রাপ্ত নম্বর', 'পাশ নম্বর', 'মোট'], en: ['No.', 'Subject', 'Full marks', 'Marks obtained', 'Pass marks', 'Total'] }
const S = (v) => (v === null || v === undefined ? '' : String(v))

// subjects: [{name_bn,name_en,full,pass,marks,absent}], result: {total,avg,division,merit} | null
export function marksheetData({ inst = {}, student = {}, className = '', exam = {}, subjects = [], result = null, lang = 'bn', absentText, verifyUrl = '' }) {
  const d = (v) => dig(S(v), lang)
  const L = MS_LABELS[lang] || MS_LABELS.bn
  const abs = absentText || (lang === 'bn' ? 'অনুপস্থিত' : 'Absent')
  const nameOf = (r) => (lang === 'en' ? r.name_en || r.name_bn : r.name_bn || r.name_en) || ''
  let fullSum = 0; let passSum = 0; let got = 0; let any = false
  const rows = subjects.map((s, i) => {
    const full = Number(s.full) || 0; const pass = Number(s.pass) || 0
    fullSum += full; passSum += pass
    const has = s.marks !== null && s.marks !== undefined && !s.absent
    if (has) { got += Number(s.marks); any = true }
    const red = !!s.absent || (has && Number(s.marks) < pass)
    return [d(i + 1), nameOf(s), d(full), s.absent ? abs : has ? d(Number(s.marks)) : '—', d(pass), red]
  })
  const total = result && result.total ? result.total : any ? String(Math.round(got * 100) / 100) : ''
  const period = exam.date_from ? `${fmtDate(exam.date_from, lang)}${exam.date_to && exam.date_to !== exam.date_from ? ` – ${fmtDate(exam.date_to, lang)}` : ''}` : ''
  return {
    ...inst,
    name_bn: lang === 'en' ? student.name_en || student.name_bn || '' : student.name_bn || '', name_en: student.name_en || '',
    student_no: d(student.student_no), class: className, father_name: student.father_name || '', mother_name: student.mother_name || '',
    dob: student.dob ? fmtDate(student.dob, lang) : '', photo: student.photo_url || '',
    exam_name: nameOf(exam), year: d(exam.year), exam_period: period,
    marks_table: { head: L.slice(0, 5), rows, foot: ['', L[5], d(fullSum), total ? d(total) : '', d(passSum)] },
    total: total ? d(total) : '', full_total: d(fullSum), avg: result && result.avg ? d(result.avg) : '', division: result && result.division ? result.division : '', merit: result && result.merit ? d(result.merit) : '',
    verify_url: verifyUrl,
    issue_date: fmtDate(new Date().toISOString().slice(0, 10), lang),
  }
}

// যাচাই-লিংক (QR-এ যা থাকে): বর্তমান সাইটের ঠিকানা + কোড
export const verifyLink = (code) => (code ? `${window.location.origin}${window.location.pathname}#/verify/${code}` : '')
