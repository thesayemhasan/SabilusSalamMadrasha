import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { initFx } from './lib/fx'
import PublicLayout from './components/PublicLayout'
import { About, Account, Admission, Contact, Departments, Donate, Events, Gallery, Home, Notices, Privacy, Teachers, Terms } from './pages/public/Public'
import AdminShell from './pages/admin/AdminShell'
import Dashboard from './pages/admin/Dashboard'
import TextsEditor from './pages/admin/TextsEditor'
import Settings from './pages/admin/Settings'
import { AdmissionFieldsAdmin, DepartmentsAdmin, EventsAdmin, GalleryAdmin, HeroSlidesAdmin, HomeBlocksAdmin, NoticesAdmin, TeachersAdmin } from './pages/admin/Sections'
import { Applications, Messages } from './pages/admin/Inbox'
import { Integrations, Modules } from './pages/admin/Controls'
import Users from './pages/admin/Users'
import ModulePage from './pages/admin/ModulePage'
import { ClassesAdmin, ResidenceAdmin, SessionsAdmin, StaffAdmin, StudentsAdmin } from './pages/admin/People'
import Attendance, { Gate } from './pages/admin/Attendance'

export default function App() {
  useEffect(() => initFx(), [])
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
        <Route path="account" element={<Account />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="signup" element={<Account />} />
      </Route>

      <Route path="admin" element={<AdminShell />}>
        <Route index element={<Dashboard />} />
        <Route path="applications" element={<Applications />} />
        <Route path="messages" element={<Messages />} />
        <Route path="texts" element={<TextsEditor />} />
        <Route path="departments" element={<DepartmentsAdmin />} />
        <Route path="students" element={<Gate mod="students" name="ছাত্র ও ভর্তি"><StudentsAdmin /></Gate>} />
        <Route path="classes" element={<Gate mod="students" name="ছাত্র ও ভর্তি"><ClassesAdmin /></Gate>} />
        <Route path="staff" element={<Gate mod="teachers" name="শিক্ষক ব্যবস্থাপনা"><StaffAdmin /></Gate>} />
        <Route path="attendance" element={<Gate mod="attendance" name="হাজিরা"><Attendance /></Gate>} />
        <Route path="residence" element={<ResidenceAdmin />} />
        <Route path="sessions" element={<SessionsAdmin />} />
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
