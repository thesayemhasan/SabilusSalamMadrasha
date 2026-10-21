import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { initFx } from './lib/fx'
import PublicLayout from './components/PublicLayout'
import { About, Admission, Contact, Departments, Donate, Events, Gallery, Home, Notices, Teachers } from './pages/public/Public'
import AdminShell from './pages/admin/AdminShell'
import Dashboard from './pages/admin/Dashboard'
import TextsEditor from './pages/admin/TextsEditor'
import Settings from './pages/admin/Settings'
import { EventsAdmin, GalleryAdmin, NoticesAdmin, TeachersAdmin } from './pages/admin/Sections'
import { Applications, Messages } from './pages/admin/Inbox'
import { Integrations, Modules } from './pages/admin/Controls'
import Users from './pages/admin/Users'
import ModulePage from './pages/admin/ModulePage'

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
      </Route>

      <Route path="admin" element={<AdminShell />}>
        <Route index element={<Dashboard />} />
        <Route path="applications" element={<Applications />} />
        <Route path="messages" element={<Messages />} />
        <Route path="texts" element={<TextsEditor />} />
        <Route path="notices" element={<NoticesAdmin />} />
        <Route path="events" element={<EventsAdmin />} />
        <Route path="gallery" element={<GalleryAdmin />} />
        <Route path="teachers" element={<TeachersAdmin />} />
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
