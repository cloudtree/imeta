import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import Layout from './components/layout/Layout'
import WordsPage from './pages/words/WordsPage'
import TermsPage from './pages/terms/TermsPage'
import DomainsPage from './pages/domains/DomainsPage'
import SubjectAreasPage from './pages/subjectAreas/SubjectAreasPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/subject-areas" replace />} />
          <Route path="/subject-areas" element={<SubjectAreasPage />} />
          <Route path="/words" element={<WordsPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/domains" element={<DomainsPage />} />
          <Route path="*" element={<Navigate to="/subject-areas" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
