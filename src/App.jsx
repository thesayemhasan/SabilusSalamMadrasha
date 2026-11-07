import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { initFx } from './lib/fx'
import { useSite } from './lib/store'
import PublicLayout from './components/PublicLayout'
import { About, Account, Admission, Contact, Departments, Donate, Events, Gallery, Home, Notices, Privacy, Teachers, Terms } from './pages/public/Public'
import Result from './pages/public/Result'
import Verify from './pages/public/Verify'
import AdminShell from './pages/admin/AdminShell'
import Dashboard from './pages/admin/Dashboard'
import TextsEditor from './pages/admin/TextsEditor'
import Settings from './pages/admin/Settings'
import { AdmissionFieldsAdmin, DepartmentsAdmin, EventsAdmin, GalleryAdmin, HeroSlidesAdmin, HomeBlocksAdmin, NoticesAdmin, TeachersAdmin } from './pages/admin/Sections'
import { Applications, Messages } from './pages/admin/Inbox'
import { Integrations, Modules } from './pages/admin/Controls'
import Users from './pages/admin/Users'
import Exams from './pages/admin/Exams'
import Hifz from './pages/admin/Hifz'
import ExcelImport from './pages/admin/ExcelImport'
import IdCards from './pages/admin/IdCards'
import Admit from './pages/admin/Admit'
import Readmit from './pages/admin/Readmit'
import Certificates from './pages/admin/Certificates'
import Boarding from './pages/admin/Boarding'
import SeatPlan from './pages/admin/SeatPlan'
import Savings from './pages/admin/Savings'
import Holidays from './pages/admin/Holidays'
import Reminders from './pages/admin/Reminders'
import Health from './pages/admin/Health'
import Library from './pages/admin/Library'
import BoardExam from './pages/admin/BoardExam'
import TeacherPortal from './pages/admin/TeacherPortal'
import TeacherSubjects from './pages/admin/TeacherSubjects'
import ReceiptSettings from './pages/admin/ReceiptSettings'
import ModulePage from './pages/admin/ModulePage'
import Enroll from './pages/admin/Enroll'
import Backup from './pages/admin/Backup'
import Sms from './pages/admin/Sms'
import { ClassesAdmin, ResidenceAdmin, SessionsAdmin, YearsAdmin, StaffAdmin, StudentsAdmin } from './pages/admin/People'
import Attendance, { Gate } from './pages/admin/Attendance'
import FeesPage, { Billing } from './pages/admin/Fees'
import { AccountSetup, FeeSetup } from './pages/admin/FinSetup'
import Ledger from './pages/admin/Ledger'
import Salary from './pages/admin/Salary'
import Reports from './pages/admin/Reports'
import Audit from './pages/admin/Audit'

export default function App() {
  const { ready } = useSite()
  useEffect(() => initFx(), [])
  // সাইটের লেখা/সেটিং ডেটাবেজ থেকে আসার আগে কিছু দেখানো হয় না, যাতে পুরোনো/ডিফল্ট ভার্সন এক ঝলক না আসে
  if (!ready) return <div className="boot" aria-busy="true" />
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="departments" element={<Departments />} />
        <Route path="admission" element={<Admission />} />
        <Route path="notices" element={<Notices />} />
        <Route path="events" element={<Events />} />
        <Route path="gallery" element={<Gallery />} />
        <Route path="teachers" element={<Teachers />} />
        <Route path="donate" element={<Donate />} />
        <Route path="contact" element={<Contact />} />
        <Route path="result" element={<Result />} />
        <Route path="verify/:code" element={<Verify />} />
        <Route path="account" element={<Account />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="signup" element={<Account />} />
      </Route>

      <Route path="teacher" element={<TeacherPortal />} />
      <Route path="admin" element={<AdminShell />}>
        <Route index element={<Dashboard />} />
        <Route path="applications" element={<Applications />} />
        <Route path="messages" element={<Messages />} />
        <Route path="texts" element={<TextsEditor />} />
        <Route path="departments" element={<DepartmentsAdmin />} />
        <Route path="students" element={<Gate mod="students" name="শিক্ষার্থী ও ভর্তি"><StudentsAdmin /></Gate>} />
        <Route path="classes" element={<Gate mod="students" name="শিক্ষার্থী ও ভর্তি"><ClassesAdmin /></Gate>} />
        <Route path="staff" element={<Gate mod="teachers" name="শিক্ষক ব্যবস্থাপনা"><StaffAdmin /></Gate>} />
        <Route path="attendance" element={<Gate mod="attendance" name="হাজিরা"><Attendance /></Gate>} />
        <Route path="residence" element={<ResidenceAdmin />} />
        <Route path="sessions" element={<SessionsAdmin />} />
        <Route path="exams" element={<Gate mod="exams" name="পরীক্ষা ও রেজাল্ট"><Exams /></Gate>} />
        <Route path="import" element={<ExcelImport />} />
        <Route path="years" element={<YearsAdmin />} />
        <Route path="enroll" element={<Enroll />} />
        <Route path="backup" element={<Backup />} />
        <Route path="sms" element={<Gate mod="sms" name="এসএমএস"><Sms /></Gate>} />
        <Route path="hifz" element={<Gate mod="hifz" name="হিফজ ট্র্যাকিং"><Hifz /></Gate>} />
        <Route path="idcards" element={<Gate mod="id_print" name="আইডি কার্ড ও প্রিন্ট"><IdCards /></Gate>} />
        <Route path="admit" element={<Gate mod="admit_card" name="প্রবেশপত্র"><Admit /></Gate>} />
        <Route path="teacher-subjects" element={<Gate mod="subject_assign" name="শিক্ষক অনুযায়ী বিষয় নির্ধারণ"><TeacherSubjects /></Gate>} />
        <Route path="board-exam" element={<Gate mod="board_exam" name="বোর্ড পরীক্ষা"><BoardExam /></Gate>} />
        <Route path="library" element={<Gate mod="library" name="লাইব্রেরি"><Library /></Gate>} />
        <Route path="health" element={<Gate mod="health" name="স্বাস্থ্য ব্যবস্থাপনা"><Health /></Gate>} />
        <Route path="reminders" element={<Gate mod="reminders" name="রিমাইন্ডার"><Reminders /></Gate>} />
        <Route path="holidays" element={<Gate mod="leave" name="ছুটি ব্যবস্থাপনা"><Holidays /></Gate>} />
        <Route path="savings" element={<Gate mod="student_savings" name="শিক্ষার্থী সঞ্চয়"><Savings /></Gate>} />
        <Route path="seatplan" element={<Gate mod="seat_plan" name="পরীক্ষার সিট প্ল্যান"><SeatPlan /></Gate>} />
        <Route path="boarding" element={<Gate mod="boarding" name="বোর্ডিং ব্যবস্থাপনা"><Boarding /></Gate>} />
        <Route path="certificates" element={<Gate mod="tc_certificate" name="টিসি ও সনদপত্র"><Certificates /></Gate>} />
        <Route path="readmit" element={<Gate mod="readmission" name="পুনঃভর্তি ও ভর্তি ফরম"><Readmit /></Gate>} />
        <Route path="receipt-settings" element={<ReceiptSettings />} />
        <Route path="fees" element={<Gate mod="fees" name="বেতন ও চাঁদা"><FeesPage /></Gate>} />
        <Route path="billing" element={<Gate mod="fees" name="বেতন ও চাঁদা"><Billing /></Gate>} />
        <Route path="fee-setup" element={<Gate mod="fees" name="বেতন ও চাঁদা"><FeeSetup /></Gate>} />
        <Route path="income" element={<Gate mod="accounts_basic" name="আয়-ব্যয় হিসাব"><Ledger kind="income" /></Gate>} />
        <Route path="expense" element={<Gate mod="accounts_basic" name="আয়-ব্যয় হিসাব"><Ledger kind="expense" /></Gate>} />
        <Route path="account-setup" element={<Gate mod="accounts_basic" name="আয়-ব্যয় হিসাব"><AccountSetup /></Gate>} />
        <Route path="salary" element={<Gate mod="hr_payroll" name="এইচআর ও পে-রোল"><Salary /></Gate>} />
        <Route path="reports" element={<Gate mod="reports" name="রিপোর্ট"><Reports /></Gate>} />
        <Route path="audit" element={<Gate mod="activity_log" name="অ্যাক্টিভিটি লগ"><Audit /></Gate>} />
        <Route path="slides" element={<HeroSlidesAdmin />} />
        <Route path="notices" element={<NoticesAdmin />} />
        <Route path="events" element={<EventsAdmin />} />
        <Route path="gallery" element={<GalleryAdmin />} />
        <Route path="teachers" element={<TeachersAdmin />} />
        <Route path="home-blocks" element={<HomeBlocksAdmin />} />
        <Route path="admission-form" element={<AdmissionFieldsAdmin />} />
        <Route path="modules" element={<Modules />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="settings" element={<Settings />} />
        <Route path="users" element={<Users />} />
        <Route path="m/:key" element={<ModulePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
