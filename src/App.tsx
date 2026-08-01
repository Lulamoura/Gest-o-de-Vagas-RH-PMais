/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import { SystemParametersProvider } from '@/hooks/use-system-parameters'
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
import EmailTemplates from './pages/EmailTemplates'
import CandidatePublicForm from './pages/CandidatePublicForm'
import CandidateDetail from './pages/CandidateDetail'
import GestaoIntegracao from './pages/GestaoIntegracao'
import CandidateIntegrationView from './pages/CandidateIntegrationView'
import Requisitions from './pages/Requisitions'
import RequisitionWizard from './pages/RequisitionWizard'
import RequisitionDetail from './pages/RequisitionDetail'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

const App = () => (
  <AuthProvider>
    <SystemParametersProvider>
      <BrowserRouter>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/candidato/:id/preencher" element={<CandidatePublicForm />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/vagas" element={<Vacancies />} />
                <Route path="/vagas/nova" element={<VacancyForm />} />
                <Route path="/vagas/:id" element={<VacancyDetail />} />
                <Route path="/vagas/:id/editar" element={<VacancyForm />} />
                <Route path="/candidatos" element={<Candidates />} />
                <Route path="/candidatos/:id" element={<CandidateDetail />} />
                <Route path="/requisicoes" element={<Requisitions />} />
                <Route path="/requisicoes/nova" element={<RequisitionWizard />} />
                <Route path="/requisicoes/:id" element={<RequisitionDetail />} />
                <Route path="/requisicoes/:id/editar" element={<RequisitionWizard />} />
                <Route path="/integracao" element={<GestaoIntegracao />} />
                <Route path="/integracao/:id" element={<CandidateIntegrationView />} />
                <Route path="/usuarios" element={<Users />} />
                <Route path="/referencias" element={<ReferenceData />} />
                <Route path="/modelos-email" element={<EmailTemplates />} />
                <Route path="/wordpress" element={<WordPressLogs />} />
                <Route path="/relatorios" element={<Reports />} />
                <Route path="/profile/senha" element={<ChangePassword />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </BrowserRouter>
    </SystemParametersProvider>
  </AuthProvider>
)

export default App
