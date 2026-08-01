import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth.jsx'
import { useI18n } from './lib/i18n.js'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Containers from './pages/Containers.jsx'
import ContainerDetail from './pages/ContainerDetail.jsx'
import Receivables from './pages/Receivables.jsx'

function TopNav() {
  const { user, logout } = useAuth()
  const { t, lang, setLang } = useI18n()
  const nav = useNavigate()
  const canMoney = user?.can_see_money
  const link = ({ isActive }) =>
    'px-3 py-1.5 rounded-chip text-sm font-medium transition-colors ' +
    (isActive ? 'bg-graphite text-white' : 'text-steel hover:bg-base-2 hover:text-graphite')

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-base/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-5">
        <div className="mr-3 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-sea text-white font-bold text-sm">L</span>
          <span className="font-bold tracking-tight">{t('app')}</span>
        </div>
        {canMoney && <NavLink to="/dashboard" className={link}>{t('dashboard')}</NavLink>}
        <NavLink to="/containers" className={link}>{t('containers')}</NavLink>
        {canMoney && <NavLink to="/receivables" className={link}>{t('receivables')}</NavLink>}
        <div className="ml-auto flex items-center gap-3">
          <div className="flex rounded-chip border border-line overflow-hidden text-xs font-semibold">
            {['ru', 'en'].map((l) => (
              <button key={l} onClick={() => setLang(l)}
                className={'px-2.5 py-1 ' + (lang === l ? 'bg-graphite text-white' : 'text-steel')}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <span className="hidden sm:block text-sm text-steel">{user?.full_name}</span>
          <button onClick={() => logout().then(() => nav('/login'))} className="text-sm text-steel hover:text-brick">
            {t('logout')}
          </button>
        </div>
      </div>
    </header>
  )
}

function Protected({ children }) {
  const { user } = useAuth()
  if (user === undefined) return <div className="p-10 text-steel">…</div>
  if (user === null) return <Navigate to="/login" replace />
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-[1400px] px-5 py-6">{children}</main>
    </>
  )
}

function Shell() {
  const { user, reference } = useAuth()
  const home = user?.can_see_money ? '/dashboard' : '/containers'
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/containers" element={<Protected><Containers /></Protected>} />
      <Route path="/containers/:id" element={<Protected><ContainerDetail /></Protected>} />
      <Route path="/receivables" element={<Protected><Receivables /></Protected>} />
      <Route path="*" element={<Navigate to={home} replace />} />
      {reference /* touch to keep provider warm */ && null}
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
