// API-клиент: credentials:'include' + CSRF-заголовок из cookie.
// На 401 → редирект на /login (opaque-сессия, silent-refresh не делаем — решение council).

function getCookie(name) {
  const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')
  return m ? m.pop() : ''
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  if (method !== 'GET') headers['X-CSRF-Token'] = getCookie('lc_csrf')
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) {
    if (!location.pathname.startsWith('/login')) location.href = '/login'
    throw new Error('unauthorized')
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      detail = (await res.json()).detail || detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : res
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  patch: (p, b) => request('PATCH', p, b),
  // экспорт: открываем в новой вкладке (браузер скачает)
  exportUrl: (params) => {
    const q = new URLSearchParams(params).toString()
    return `/api/export/containers.xlsx${q ? '?' + q : ''}`
  },
}
