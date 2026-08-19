import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  LayoutDashboard,
  Briefcase,
  Users,
  UserCheck,
  BarChart3,
  LogOut,
  ShieldCheck,
  ChevronRight,
  Database,
  KeyRound,
  Mail,
  ClipboardCheck,
  ClipboardList,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationCenter } from '@/components/NotificationCenter'
import logoImage from '@/assets/logo-fundo-branco-c5f7d.png'

function SidebarUserFooter() {
  const { user, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  const getUserInitials = (name?: string) => {
    if (!name) return 'RH'
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
  }

  const handleLogout = () => {
    signOut()
    navigate('/login')
  }

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-2 p-2 border-t border-slate-800 bg-slate-950/50">
        <Avatar className="h-8 w-8 bg-indigo-700 text-white font-bold border border-indigo-500">
          <AvatarFallback className="text-xs">{getUserInitials(user?.name)}</AvatarFallback>
        </Avatar>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/profile/senha')}
          className="text-slate-400 hover:text-indigo-400 hover:bg-slate-800 h-8 w-8 shrink-0"
          title="Alterar Senha"
        >
          <KeyRound className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="text-slate-400 hover:text-rose-400 hover:bg-slate-800 h-8 w-8 shrink-0"
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="p-3 border-t border-slate-800 bg-slate-950/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0">
          <Avatar className="h-9 w-9 bg-indigo-700 text-white font-bold border border-indigo-500 shrink-0">
            <AvatarFallback>{getUserInitials(user?.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">
              {user?.name || 'Usuário RH'}
            </p>
            <div className="flex items-center space-x-1">
              <span className="text-xs text-slate-400 capitalize truncate">
                {user?.profile || 'operador'}
              </span>
              {isAdmin && <ShieldCheck className="h-3 w-3 text-indigo-400 shrink-0" />}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/profile/senha')}
            className="text-slate-400 hover:text-indigo-400 hover:bg-slate-800 h-8 w-8 shrink-0"
            title="Alterar Senha"
          >
            <KeyRound className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-slate-400 hover:text-rose-400 hover:bg-slate-800 h-8 w-8 shrink-0"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function SidebarHeaderLogo() {
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  if (isCollapsed) {
    return (
      <div className="flex items-center justify-center p-2">
        <img
          src={logoImage}
          alt="PMais Logo"
          className="h-9 w-9 object-contain rounded-lg bg-white p-0.5 shadow-md"
        />
      </div>
    )
  }

  return (
    <div className="p-3.5 border-b border-slate-800 flex items-center space-x-3 overflow-hidden">
      <img
        src={logoImage}
        alt="PMais Logo"
        className="h-10 w-10 object-contain rounded-xl bg-white p-1 shadow-md shrink-0"
      />
      <div className="min-w-0 flex-1">
        <h1 className="font-bold text-lg tracking-tight text-white truncate">PMais RH</h1>
        <p className="text-xs text-slate-400 truncate">Gestão de Vagas & KPIs</p>
      </div>
    </div>
  )
}

export function Layout() {
  const { user, isAdmin, isSuperAdmin } = useAuth()
  const location = useLocation()

  const navItems = [
    { label: 'Painel', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Vagas', path: '/vagas', icon: Briefcase },
    { label: 'Candidatos', path: '/candidatos', icon: Users },
    { label: 'Requisições', path: '/requisicoes', icon: ClipboardList },
    { label: 'Indicadores', path: '/requisicoes/indicadores', icon: TrendingUp },
    { label: 'Integração', path: '/integracao', icon: ClipboardCheck },
    ...(isAdmin || isSuperAdmin ? [{ label: 'Usuários', path: '/usuarios', icon: UserCheck }] : []),
    ...(isAdmin || isSuperAdmin
      ? [{ label: 'Referências', path: '/referencias', icon: Database }]
      : []),
    ...(isAdmin || isSuperAdmin
      ? [{ label: 'Modelos de E-mail', path: '/modelos-email', icon: Mail }]
      : []),
    { label: 'Relatórios', path: '/relatorios', icon: BarChart3 },
  ]

  const getPageTitle = (pathname: string) => {
    if (pathname === '/' || pathname === '/dashboard') return 'Painel de Indicadores'
    if (pathname.startsWith('/vagas/nova')) return 'Nova Vaga'
    if (pathname.includes('/editar')) return 'Editar Vaga'
    if (pathname.startsWith('/vagas/')) return 'Detalhes da Vaga'
    if (pathname.startsWith('/vagas')) return 'Gestão de Vagas'
    if (pathname.startsWith('/requisicoes')) return 'Requisições de Vagas'
    if (pathname.startsWith('/integracao')) return 'Gestão de Integração'
    if (pathname.startsWith('/candidatos')) return 'Gestão de Candidatos'
    if (pathname.startsWith('/usuarios')) return 'Gestão de Usuários'
    if (pathname.startsWith('/modelos-email')) return 'Modelos de E-mail'
    if (pathname.startsWith('/relatorios')) return 'Relatórios de RH'
    return 'PMais RH'
  }

  const getUserInitials = (name?: string) => {
    if (!name) return 'RH'
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-slate-50 flex w-full">
        {/* Collapsible Sidebar */}
        <Sidebar
          collapsible="icon"
          className="bg-slate-900 text-slate-100 border-r border-slate-800 print:hidden"
        >
          <SidebarHeader className="p-0 border-b border-slate-800">
            <SidebarHeaderLogo />
          </SidebarHeader>

          <SidebarContent className="p-2">
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== '/dashboard' && location.pathname.startsWith(item.path))

                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className={cn(
                        'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-slate-300 hover:bg-slate-800 hover:text-white',
                        isActive &&
                          'bg-indigo-600 text-white font-semibold shadow-sm hover:bg-indigo-600 hover:text-white',
                      )}
                    >
                      <Link to={item.path}>
                        <div className="flex items-center space-x-3">
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0',
                              isActive
                                ? 'text-white'
                                : 'text-slate-400 group-hover/menu-button:text-white',
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {isActive && (
                          <ChevronRight className="h-4 w-4 text-indigo-200 shrink-0 group-data-[collapsible=icon]:hidden" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-0">
            <SidebarUserFooter />
          </SidebarFooter>
        </Sidebar>

        {/* Main Content Area using SidebarInset */}
        <SidebarInset className="flex-1 flex flex-col min-w-0 bg-slate-50">
          {/* Header */}
          <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 h-16 px-4 lg:px-8 flex items-center justify-between shadow-2xs print:hidden">
            <div className="flex items-center space-x-3">
              <SidebarTrigger className="text-slate-700 hover:bg-slate-100 h-9 w-9" />
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {getPageTitle(location.pathname)}
              </h1>
            </div>

            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex items-center px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-xs font-semibold text-indigo-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                PMais RH Ativo
              </div>

              <NotificationCenter />

              <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />

              <div className="hidden sm:flex items-center space-x-2">
                <Avatar className="h-8 w-8 bg-indigo-700 text-white font-bold text-xs">
                  <AvatarFallback>{getUserInitials(user?.name)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-slate-800 max-w-[130px] truncate">
                  {user?.name || 'Usuário'}
                </span>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto animate-fade-in print:max-w-none print:p-0">
            <Outlet />
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 print:hidden">
            <span>PMais RH v1.0 — Módulo de Gestão de Vagas e Indicadores</span>
            <span className="text-slate-400">Suporte Técnico: suporte@pmaisservicos.com.br</span>
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

export default Layout
