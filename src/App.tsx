import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { Layout } from './components/Layout'
import { DataProvider } from './lib/store'
import { ToastProvider } from './components/Toast'
import ClientDetail from './pages/ClientDetail'
import ClientForm from './pages/ClientForm'
import ClientsPage from './pages/Clients'
import FollowupsPage from './pages/Followups'
import ImportPage from './pages/Import'
import ScorePage from './pages/Score'
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
        <ToastProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<TodayPage />} />
            <Route path="week" element={<WeekPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="clients/new" element={<ClientForm />} />
            <Route path="clients/import" element={<ImportPage />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="clients/:id/edit" element={<ClientForm key="edit" />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="find" element={<FindPage />} />
            <Route path="followups" element={<FollowupsPage />} />
            <Route path="goals" element={<GoalsPage />} />
            <Route path="score" element={<ScorePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </ToastProvider>
      </DataProvider>
    </AuthGate>
  )
}
