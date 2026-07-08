import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Layout from './components/layout/Layout'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import WordsPage from './pages/words/WordsPage'
import TermsPage from './pages/terms/TermsPage'
import DomainsPage from './pages/domains/DomainsPage'
import SubjectAreasPage from './pages/subjectAreas/SubjectAreasPage'
import ServerRegisterPage from './pages/database/ServerRegisterPage'
import DatabaseReviewPage from './pages/database/DatabaseReviewPage'
import TableDefinitionReviewPage from './pages/database/TableDefinitionReviewPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/servers/register" element={<ServerRegisterPage />} />
            <Route path="/database/review" element={<DatabaseReviewPage />} />
            <Route path="/database/table-definition-review" element={<TableDefinitionReviewPage />} />
            <Route path="/subject-areas" element={<SubjectAreasPage />} />
            <Route path="/words" element={<WordsPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/domains" element={<DomainsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
