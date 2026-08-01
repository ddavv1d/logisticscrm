import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { useI18n } from '../lib/i18n.js'

export default function Login() {
  const { user, login } = useAuth()
  const { t, lang, setLang } = useI18n()
  const nav = useNavigate()
  const [email, setEmail] = useState('owner@demo.lc')
  const [password, setPassword] = useState('demo1234')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={user.can_see_money ? '/dashboard' : '/containers'} replace />

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const u = await login(email, password)
      nav(u.can_see_money ? '/dashboard' : '/containers')
    } catch {
      setErr(t('loginError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-2">
      {/* левая панель — бренд/маршрут коридора */}
      <div className="hidden lg:flex flex-col justify-between bg-graphite text-white p-10">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-sea font-bold">L</span>
          <span className="font-bold text-lg tracking-tight">LogisticsCRM</span>
        </div>
        <div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
            Контейнеры под контролем<br />от Грузии до Узбекистана
          </h1>
          <p className="mt-4 text-steel-light max-w-md">
            Учёт перевозок по Среднему коридору. Стадии, деньги по плечам, наглядно — на замену Excel.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-2 font-mono text-sm text-steel-light">
            <b className="text-white">Грузия</b><span className="text-sea">──🚆──›</span>
            <b className="text-white">Баку/Алят</b><span className="text-sea">──⛴──›</span>
            <b className="text-white">Туркменбаши</b><span className="text-sea">──🚆──›</span>
            <b className="text-white">Ташкент</b>
          </div>
        </div>
        <div className="text-xs text-steel">© 2026 · Средний коридор / TITR</div>
      </div>

      {/* правая — форма */}
      <div className="flex items-center justify-center p-6 bg-base">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="flex justify-end mb-4">
            <div className="flex rounded-chip border border-line overflow-hidden text-xs font-semibold">
              {['ru', 'en'].map((l) => (
                <button type="button" key={l} onClick={() => setLang(l)}
                  className={'px-2.5 py-1 ' + (lang === l ? 'bg-graphite text-white' : 'text-steel')}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">{t('login')}</h2>
          <p className="text-sm text-steel mb-6">demo@ · demo1234</p>

          <label className="field-label">{t('email')}</label>
          <input className="input mb-4" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <label className="field-label">{t('password')}</label>
          <input className="input mb-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

          {err && <div className="mb-3 rounded-chip bg-brick-soft border border-brick/30 px-3 py-2 text-sm text-brick">{err}</div>}

          <button className="btn-primary w-full mt-3" disabled={busy}>{busy ? '…' : t('signIn')}</button>

          <div className="mt-6 grid grid-cols-3 gap-2 text-[11px]">
            {[['owner@demo.lc', 'Владелец'], ['manager@demo.lc', 'Менеджер'], ['buh@demo.lc', 'Бухгалтер']].map(([e, r]) => (
              <button type="button" key={e} onClick={() => { setEmail(e); setPassword('demo1234') }}
                className="rounded-chip border border-line px-2 py-1.5 text-steel hover:bg-base-2">
                {r}
              </button>
            ))}
          </div>
        </form>
      </div>
    </div>
  )
}
