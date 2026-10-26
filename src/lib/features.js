// ফিচার তালিকা: কোন ফিচার কোন পেজ খোলে (ডাটাবেজের features টেবিলের সাথে মেলানো)
export const FEATURES = [
  ['applications', 'inbox', 'ইনবক্স', 'ভর্তির আবেদন', '/admin/applications'],
  ['messages', 'inbox', 'ইনবক্স', 'যোগাযোগের বার্তা', '/admin/messages'],
  ['students', 'people', 'ছাত্র ও হাজিরা', 'ছাত্র-ছাত্রী', '/admin/students'],
  ['classes', 'people', 'ছাত্র ও হাজিরা', 'শ্রেণি ও হালকা', '/admin/classes'],
  ['staff', 'people', 'ছাত্র ও হাজিরা', 'শিক্ষক ও কর্মচারী', '/admin/staff'],
  ['attendance', 'people', 'ছাত্র ও হাজিরা', 'হাজিরা', '/admin/attendance'],
  ['att_setup', 'people', 'ছাত্র ও হাজিরা', 'আবাসিক ধরন ও হাজিরার সময়', '/admin/residence', '/admin/sessions'],
  ['exams', 'people', 'পরীক্ষা ও হিফজ', 'পরীক্ষা ও ফলাফল', '/admin/exams'],
  ['hifz', 'people', 'পরীক্ষা ও হিফজ', 'হিফজ ট্র্যাকিং', '/admin/hifz'],
  ['idcards', 'people', 'পরীক্ষা ও হিফজ', 'আইডি কার্ড', '/admin/idcards'],
  ['admit', 'people', 'পরীক্ষা ও হিফজ', 'প্রবেশপত্র', '/admin/admit'],
  ['readmit', 'people', 'পরীক্ষা ও হিফজ', 'পুনঃভর্তি ও ভর্তি ফরম', '/admin/readmit'],
  ['fees', 'finance', 'ফি ও হিসাব', 'ফি আদায় ও রসিদ', '/admin/fees'],
  ['billing', 'finance', 'ফি ও হিসাব', 'বিল তৈরি', '/admin/billing'],
  ['fee_setup', 'finance', 'ফি ও হিসাব', 'ফি-র ধরন ও পরিমাণ', '/admin/fee-setup'],
  ['income', 'finance', 'ফি ও হিসাব', 'দান ও অন্যান্য আয়', '/admin/income'],
  ['expense', 'finance', 'ফি ও হিসাব', 'ব্যয়', '/admin/expense'],
  ['salary', 'finance', 'ফি ও হিসাব', 'শিক্ষক-কর্মচারীর বেতন', '/admin/salary'],
  ['reports', 'finance', 'ফি ও হিসাব', 'হিসাব ও রিপোর্ট', '/admin/reports'],
  ['account_setup', 'finance', 'ফি ও হিসাব', 'খাত ও পেমেন্ট মাধ্যম', '/admin/account-setup'],
  ['audit', 'finance', 'ফি ও হিসাব', 'আর্থিক লগ', '/admin/audit'],
  ['receipt_cfg', 'finance', 'ফি ও হিসাব', 'রসিদের লেখা ও ডিজাইন', '/admin/receipt-settings'],
  ['texts', 'cms', 'ওয়েবসাইট', 'সাইটের লেখা', '/admin/texts'],
  ['slides', 'cms', 'ওয়েবসাইট', 'হোম স্লাইড', '/admin/slides'],
  ['departments', 'cms', 'ওয়েবসাইট', 'বিভাগসমূহ', '/admin/departments'],
  ['home_blocks', 'cms', 'ওয়েবসাইট', 'হোম সেকশন', '/admin/home-blocks'],
  ['notices', 'cms', 'ওয়েবসাইট', 'নোটিশ', '/admin/notices'],
  ['events', 'cms', 'ওয়েবসাইট', 'ইভেন্ট ও টাইমার', '/admin/events'],
  ['gallery', 'cms', 'ওয়েবসাইট', 'গ্যালারি', '/admin/gallery'],
  ['teachers', 'cms', 'ওয়েবসাইট', 'শিক্ষকবৃন্দ (পাবলিক)', '/admin/teachers'],
  ['admission_form', 'cms', 'ওয়েবসাইট', 'ভর্তি ফরম', '/admin/admission-form'],
  ['modules', 'system', 'সিস্টেম', 'মডিউল সুইচ', '/admin/modules', '/admin/m'],
  ['integrations', 'system', 'সিস্টেম', 'মেশিন ও বাইরের সেবা', '/admin/integrations'],
  ['settings', 'system', 'সিস্টেম', 'সাইটের সেটিংস', '/admin/settings'],
].map(([key, area, grp, name, ...paths]) => ({ key, area, grp, name, paths }))

export const FEATURE_BY_KEY = Object.fromEntries(FEATURES.map((f) => [f.key, f]))
export const PATH_FEATURE = {}
FEATURES.forEach((f) => f.paths.forEach((p) => { PATH_FEATURE[p] = f.key }))
export const AREA_KEYS = (area) => FEATURES.filter((f) => f.area === area).map((f) => f.key)

export const STAFF_ROLES = ['super_admin', 'admin', 'accountant', 'staff']

// ভূমিকা-ভিত্তিক শুরুর অনুমতি (নতুন ব্যবহারকারী বানানোর সময় বসে; পরে সুপার অ্যাডমিন বদলাতে পারে)
export const TEMPLATES = {
  admin: { name: 'সাধারণ অ্যাডমিন', keys: FEATURES.filter((f) => f.area !== 'system').map((f) => f.key) },
  accountant: { name: 'হিসাবরক্ষক', keys: AREA_KEYS('finance').filter((k) => k !== 'account_setup' && k !== 'audit') },
  collector: { name: 'বেতন আদায়কারী', keys: ['fees', 'billing'] },
  editor: { name: 'ওয়েবসাইট সম্পাদক', keys: AREA_KEYS('cms').concat(['applications', 'messages']) },
  teacher_desk: { name: 'হাজিরা/ছাত্র দেখভাল', keys: ['students', 'classes', 'attendance', 'exams', 'hifz'] },
}
export const ROLE_LABEL = {
  none: 'সাবস্ক্রাইবার', super_admin: 'সুপার অ্যাডমিন', admin: 'অ্যাডমিন', accountant: 'হিসাবরক্ষক', staff: 'কর্মী (কাস্টম)', teacher: 'শিক্ষক', parent: 'অভিভাবক',
}
