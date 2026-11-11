// ব্যাকআপ ও পুনরুদ্ধারের সব টেবিল: [নাম, বাংলা পরিচয়, প্রাইমারি কী]। ক্রম গুরুত্বপূর্ণ (আগে মূল তালিকা, পরে যা তার ওপর নির্ভর করে)
export const TABLES = [
  ['profiles', 'ব্যবহারকারী', 'id'], ['features', 'ফিচার তালিকা', 'key'], ['site_texts', 'সাইটের লেখা', 'key'], ['site_settings', 'সাইটের সেটিংস', 'key'], ['modules', 'মডিউল সুইচ', 'key'], ['integrations', 'মেশিন ও বাইরের সেবা', 'key'],
  ['notices', 'নোটিশ', 'id'], ['events', 'ইভেন্ট', 'id'], ['gallery', 'গ্যালারি', 'id'], ['public_teachers', 'শিক্ষকবৃন্দ (পাবলিক)', 'id'], ['departments', 'বিভাগ', 'id'], ['hero_slides', 'হোম স্লাইড', 'id'], ['home_blocks', 'হোম সেকশন', 'id'],
  ['admission_applications', 'ভর্তির আবেদন', 'id'], ['contact_messages', 'যোগাযোগের বার্তা', 'id'], ['admission_fields', 'ভর্তি ফরমের ঘর', 'id'], ['lookups', 'তালিকা (আবাসিক ধরন, সময় ইত্যাদি)', 'id'],
  ['photocard_templates', 'ফটোকার্ড ডিজাইন', 'id'], ['branches', 'শাখা', 'id'], ['academic_years', 'শিক্ষাবর্ষ', 'id'], ['classes', 'শ্রেণি/হালকা', 'id'], ['holidays', 'ছুটির তালিকা', 'id'], ['reminders', 'রিমাইন্ডার', 'id'], ['transport_routes', 'ট্রান্সপোর্ট রুট', 'id'], ['boarding_rooms', 'বোর্ডিং রুম', 'id'], ['students', 'ছাত্র-ছাত্রী', 'id'], ['enrollments', 'বর্ষে ভর্তি', 'id'], ['staff', 'শিক্ষক-কর্মচারী', 'id'],
  ['attendance', 'হাজিরা', 'id'], ['device_punches', 'মেশিনের পাঞ্চ', 'id'],
  ['fee_heads', 'ফি-র ধরন', 'id'], ['fee_rates', 'ফি-র হার', 'id'], ['student_fees', 'শিক্ষার্থীভিত্তিক ফি', 'id'], ['invoices', 'বিল', 'id'], ['payments', 'আদায় ও রসিদ', 'id'], ['payment_items', 'রসিদের আইটেম', 'id'],
  ['ledger_categories', 'আয়-ব্যয়ের খাত', 'id'], ['ledger', 'আয়-ব্যয়ের খাতা', 'id'], ['staff_advances', 'অগ্রিম', 'id'], ['salary_payments', 'বেতন', 'id'], ['audit_log', 'আর্থিক লগ', 'id'],
  ['exams', 'পরীক্ষা', 'id'], ['exam_halls', 'পরীক্ষার কক্ষ', 'id'], ['exam_seats', 'পরীক্ষার সিট', 'id'], ['exam_subjects', 'পরীক্ষার বিষয়', 'id'], ['exam_marks', 'নম্বর', 'id'], ['hifz_logs', 'হিফজ', 'id'],
  ['print_configs', 'প্রিন্ট ডিজাইন', 'key'], ['student_incidents', 'আচরণগত ঘটনা', 'id'], ['readmissions', 'পুনঃভর্তির সিদ্ধান্ত', 'id'],
  ['exam_results', 'শিটের ফলাফল', 'id'], ['result_verify', 'মার্কশিট যাচাইয়ের কোড', 'code'], ['certificates', 'টিসি ও সনদপত্র', 'id'], ['student_savings_tx', 'শিক্ষার্থী সঞ্চয়', 'id'], ['teacher_subjects', 'শিক্ষকের বিষয়', 'id'], ['daily_lessons', 'দৈনিক পাঠ মূল্যায়ন', 'id'], ['health_records', 'স্বাস্থ্য রেকর্ড', 'id'], ['board_registrations', 'বোর্ড নিবন্ধন', 'id'], ['library_books', 'লাইব্রেরির বই', 'id'], ['library_loans', 'বই প্রদান', 'id'],
]
