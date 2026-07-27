/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Index from './pages/Index'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Reports from './pages/Reports'
import Vacancies from './pages/Vacancies'
import VacancyDetail from './pages/VacancyDetail'
import VacancyForm from './pages/VacancyForm'
import Candidates from './pages/Candidates'
import Users from './pages/Users'
import ReferenceData from './pages/ReferenceData'
import WordPressLogs from './pages/WordPressLogs'
import ChangePassword from './pages/ChangePassword'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/vagas" element={<Vacancies />} />
              <Route path="/vagas/nova" element={<VacancyForm />} />
              <Route path="/vagas/:id" element={<VacancyDetail />} />
              <Route path="/vagas/:id/editar" element={<VacancyForm />} />
              <Route path="/candidatos" element={<Candidates />} />
              <Route path="/usuarios" element={<Users />} />
              <Route path="/referencias" element={<ReferenceData />} />
              <Route path="/wordpress" element={<WordPressLogs />} />
              <Route path="/relatorios" element={<Reports />} />
              <Route path="/profile/senha" element={<ChangePassword />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </BrowserRouter>
  </AuthProvider>
)

export default App
