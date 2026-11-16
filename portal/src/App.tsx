import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { apiRequest } from './api'
import { PortalLayout } from './components/PortalLayout'
import { CitizenDashboard } from './pages/CitizenDashboard'
import { CivilApplicationPage } from './pages/CivilApplicationPage'
import { ServiceHubPage } from './pages/ServiceHubPage'
import { PortalLoginPage } from './pages/PortalLoginPage'
import { CivicServicePage } from './pages/CivicServicePage'
import { PortalAdminPage } from './pages/PortalAdminPage'
import { NoticesPage } from './pages/NoticesPage'

export type Citizen = { username: string; displayName: string; department: string; trainingNote: string; role: string }
const SessionContext = createContext<{ user: Citizen | null; setUser: (user: Citizen | null) => void }>({ user: null, setUser: () => {} })
export const useCitizen = () => useContext(SessionContext)

export default function App() {
  const [user, setUser] = useState<Citizen | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  useEffect(() => { apiRequest<{ user: Citizen | null }>('/api/citizens/session').then((value) => setUser(value.user)).catch(() => {}).finally(() => setSessionReady(true)) }, [])
  if (!sessionReady) return <div className="site-shell" role="status">서비스 접속 정보를 확인하고 있습니다.</div>
  return (
    <SessionContext.Provider value={{ user, setUser }}>
    <Routes>
      <Route element={<PortalLayout />}>
        <Route index element={<CitizenDashboard />} />
        <Route path="login" element={<PortalLoginPage />} />
        <Route path="services" element={<ServiceHubPage />} />
        <Route path="notices" element={<NoticesPage />} />
        <Route path="notices/:id" element={<NoticesPage />} />
        <Route path="apply" element={<CivilApplicationPage />} />
        <Route path="account" element={<CivicServicePage section="account" />} />
        <Route path="admin" element={<PortalAdminPage />} />
        <Route path="complaints" element={<CivicServicePage section="complaints" />} />
        <Route path="board" element={<CivicServicePage section="board" />} />
        <Route path="documents" element={<CivicServicePage section="documents" />} />
        <Route path="attachments" element={<CivicServicePage section="attachments" />} />
        <Route path="certificates" element={<CivicServicePage section="certificates" />} />
        <Route path="settings" element={<CivicServicePage section="settings" />} />
        <Route path="identity" element={<CivicServicePage section="identity" />} />
        <Route path="status" element={<CivicServicePage section="status" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </SessionContext.Provider>
  )
}
