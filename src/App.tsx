import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { Layout } from './components/Layout'
import { DataProvider } from './lib/store'
import ClientsPage from './pages/Clients'
import FindPage from './pages/Find'
import GoalsPage from './pages/Goals'
import LeadsPage from './pages/Leads'
import SettingsPage from './pages/Settings'
import TodayPage from './pages/Today'
import WeekPage from './pages/Week'

export default function App() {
  return (
    <AuthGate>
      <DataProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<TodayPage />} />
            <Route path="week" element={<WeekPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="find" element={<FindPage />} />
            <Route path="goals" element={<GoalsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </DataProvider>
    </AuthGate>
  )
}
