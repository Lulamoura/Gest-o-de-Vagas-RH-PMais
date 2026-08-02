import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from '@/components/ui/sheet'
import {
  LayoutDashboard,
  Briefcase,
  Users,
  UserCheck,
  BarChart3,
  LogOut,
  Menu,
  Bell,
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

export function Layout() {
  const { user, isAdmin, isSuperAdmin, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

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

  const handleLogout = () => {
    signOut()
    navigate('/login')
  }

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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-slate-100 border-r border-slate-800 fixed inset-y-0 z-30 print:hidden">
        <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white text-xl shadow-md">
            P+
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-white">PMais RH</h1>
            <p className="text-xs text-slate-400">Gestão de Vagas & KPIs</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path))

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                )}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    className={cn(
                      'h-4 w-4',
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-white',
                    )}
                  />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="h-4 w-4 text-indigo-200" />}
              </Link>
            )
          })}
        </nav>

        {/* User profile bottom bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0">
              <Avatar className="h-9 w-9 bg-indigo-700 text-white font-bold border border-indigo-500">
                <AvatarFallback>{getUserInitials(user?.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">
                  {user?.name || 'Usuário RH'}
                </p>
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-slate-400 capitalize">
                    {user?.profile || 'operador'}
                  </span>
                  {isAdmin && <ShieldCheck className="h-3 w-3 text-indigo-400" />}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-1">
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
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0 print:ml-0">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 h-16 px-4 lg:px-8 flex items-center justify-between shadow-2xs print:hidden">
          <div className="flex items-center space-x-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden text-slate-700">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="p-0 bg-slate-900 text-white w-72 border-r border-slate-800"
              >
                <SheetHeader className="p-5 border-b border-slate-800 text-left">
                  <div className="flex items-center space-x-3">
                    <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center font-extrabold text-white text-lg">
                      P+
                    </div>
                    <div>
                      <SheetTitle className="text-white text-base font-bold">PMais RH</SheetTitle>
                      <p className="text-xs text-slate-400">Módulo de Gestão</p>
                    </div>
                  </div>
                </SheetHeader>

                <nav className="p-4 space-y-1.5">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive =
                      location.pathname === item.path ||
                      (item.path !== '/dashboard' && location.pathname.startsWith(item.path))

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                </nav>

                <div className="absolute bottom-0 inset-x-0 p-4 border-t border-slate-800 bg-slate-950">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-8 w-8 bg-indigo-600 text-white font-semibold">
                        <AvatarFallback>{getUserInitials(user?.name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate max-w-[120px]">
                        {user?.name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigate('/profile/senha')
                          setMobileOpen(false)
                        }}
                        className="text-slate-400 hover:bg-slate-800"
                      >
                        <KeyRound className="h-4 w-4 mr-1" /> Senha
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLogout}
                        className="text-rose-400 hover:bg-slate-800"
                      >
                        <LogOut className="h-4 w-4 mr-1" /> Sair
                      </Button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

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
      </div>
    </div>
  )
}

export default Layout
