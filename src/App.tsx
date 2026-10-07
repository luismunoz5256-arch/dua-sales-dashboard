import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'
import { DataProvider } from './lib/store'
import ClientDetail from './pages/ClientDetail'
import ClientsPage from './pages/Clients'
import FollowupsPage from './pages/Followups'
import TodayPage from './pages/Today'

// Everyday screens load with the app; the rest load the first time you open them.
const ClientForm = lazy(() => import('./pages/ClientForm'))
const FindPage = lazy(() => import('./pages/Find'))
const GoalsPage = lazy(() => import('./pages/Goals'))
const ImportPage = lazy(() => import('./pages/Import'))
const LeadsPage = lazy(() => import('./pages/Leads'))
const ScorePage = lazy(() => import('./pages/Score'))
const SettingsPage = lazy(() => import('./pages/Settings'))
const WeekPage = lazy(() => import('./pages/Week'))

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
