import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// প্রিন্ট ডিজাইন/সেটিংস (রসিদ, প্রবেশপত্র, ভর্তি ফরম): print_configs টেবিলে key-value আকারে থাকে।
// ডিফল্ট মানের সাথে মিলিয়ে নেওয়া হয়, তাই নতুন অপশন যোগ হলেও পুরনো সেভ করা মান ঠিক থাকে।
const merge = (d, v) => {
  if (Array.isArray(d) || typeof d !== 'object' || d === null) return v === undefined || v === null ? d : v
  const out = { ...d }
  Object.keys(v || {}).forEach((k) => { out[k] = k in d ? merge(d[k], v[k]) : v[k] })
  return out
}

const cache = {}
export function useConfig(key, defaults) {
  const [cfg, setCfg] = useState(cache[key] || defaults)
  const [ready, setReady] = useState(Boolean(cache[key]))
  useEffect(() => {
    if (!supabase) return
    supabase.from('print_configs').select('*').eq('key', key).maybeSingle().then(({ data }) => {
      const v = merge(defaults, data?.value)
      cache[key] = v
      setCfg(v)
      setReady(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const save = useCallback(async (v) => {
    const { error } = await supabase.from('print_configs').upsert({ key, value: v, updated_at: new Date().toISOString() })
    if (!error) { cache[key] = v; setCfg(v) }
    return error
  }, [key])
  return { cfg, setCfg, save, ready }
}

export const RECEIPT_DEFAULTS = {
  margin_in: 0.7,
  font_pt: 11,
  titles: { fee: 'ফি ও বেতন আদায়ের রশিদ', donation: 'দান গ্রহণের রশিদ', income: 'আয় গ্রহণের রশিদ', salary: 'বেতন স্লিপ' },
  labels: { no: 'নং', date: 'তারিখ', desc: 'বিবরণ', amount: 'টাকা', total: 'মোট', receiver: 'গ্রহীতার স্বাক্ষর', authority: 'কর্তৃপক্ষের স্বাক্ষর', printed_by: 'Printed by' },
  note: '',
  show_printed_by: true,
  // প্যাড (আগে থেকে ছাপানো কাগজ) মোড: সব মাপ মিলিমিটারে, মার্জিনের ভেতরের কোণ থেকে
  pad: {
    dx: 0, dy: 0,
    blocks: {
      title: { show: true, x: 0, y: 0, w: 112 },
      no: { show: true, x: 0, y: 12, w: 50 },
      date: { show: true, x: 62, y: 12, w: 50 },
      meta: { show: true, x: 0, y: 22, w: 112 },
      items: { show: true, x: 0, y: 44, w: 112 },
      by: { show: true, x: 0, y: 150, w: 112 },
    },
  },
}

export const ADMIT_DEFAULTS = {
  school_title: '',
  doc_title: 'প্রবেশপত্র',
  exam_name: 'প্রথম সাময়িক পরীক্ষা',
  year: String(new Date().getFullYear()),
  instructions: 'পরীক্ষার হলে প্রবেশপত্র সাথে আনতে হবে।\nনির্ধারিত সময়ের ১৫ মিনিট আগে উপস্থিত হতে হবে।\nমোবাইল ফোন ও অপ্রয়োজনীয় বস্তু আনা নিষেধ।',
  sign_left: 'শ্রেণি শিক্ষক',
  sign_right: 'অধ্যক্ষ / মুহতামিম',
  bg_url: '',
  show_logo: true,
  show_photo: true,
  show_routine: true,
  rule: 'no_due', // none | no_due | head
  head_id: '',
  max_due: 0,
}

export const FORM_DEFAULTS = {
  year: String(new Date().getFullYear() + 1),
  title: 'ভর্তি ফরম',
  margin_in: 0.7,
  pages: 1,
  bg_url: '',
  show_header: true,
  show_photo_box: true,
  fields: { name: true, father: true, mother: true, dob: true, gender: true, address: true, phone: true, blood: true, prev_class: true, admit_class: true, residence: true, prev_result: true },
  show_policy: true,
  policy_title: 'ভর্তির নীতিমালা',
  policy: 'ভর্তি ফি ও মাসিক ফি নির্ধারিত সময়ে পরিশোধ করতে হবে।\nমাদরাসার নিয়ম-শৃঙ্খলা মেনে চলতে হবে।\nবিনা অনুমতিতে অনুপস্থিত থাকা যাবে না।\nতথ্য ভুল প্রমাণিত হলে ভর্তি বাতিল হতে পারে।',
  declaration: 'আমি উপরোক্ত তথ্যের সত্যতা স্বীকার করছি এবং মাদরাসার নীতিমালা মেনে চলতে অঙ্গীকার করছি।',
  sign_guardian: 'অভিভাবকের স্বাক্ষর',
  sign_authority: 'কর্তৃপক্ষের স্বাক্ষর',
  // পুনঃভর্তির যোগ্যতার শর্ত
  rules: { need_pass: true, max_due: 0, min_attendance: 60, max_incidents: 3 },
}
