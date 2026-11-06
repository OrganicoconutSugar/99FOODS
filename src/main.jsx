import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global error handlers — tampilkan error di halaman agar tidak blank
window.addEventListener('error', (e) => {
  console.error('[window.error]', e.error || e.message)
  const root = document.getElementById('root')
  if (root && !root.dataset.errored) {
    root.dataset.errored = '1'
    const msg = e.error?.message || e.message || 'Unknown error'
    const stack = e.error?.stack || ''
    root.innerHTML = `<div style="min-height:100vh;background:#fafaf9;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui">
      <div style="max-width:600px;width:100%;text-align:center">
        <div style="width:64px;height:64px;border-radius:50%;background:#fee2e2;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#ef4444" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        </div>
        <h2 style="font-size:18px;font-weight:600;color:#1f2937;margin-bottom:8px">Terjadi Kesalahan</h2>
        <pre id="error-details" style="text-align:left;background:#111827;color:#86efac;padding:16px;border-radius:8px;font-size:11px;overflow:auto;max-height:240px;font-family:monospace;white-space:pre-wrap"></pre>
        <button onclick="window.location.reload()" style="margin-top:16px;padding:8px 16px;background:#5c835c;color:white;border-radius:8px;font-size:14px;font-weight:500;border:none;cursor:pointer">Coba Lagi</button>
      </div>
    </div>`
    root.querySelector("#error-details").textContent = [msg, stack].filter(Boolean).join("\n\n")
  }
})

window.addEventListener('unhandledrejection', (e) => {
  console.error('[unhandledrejection]', e.reason)
  window.dispatchEvent(new ErrorEvent('error', { error: e.reason, message: e.reason?.message || 'Unhandled promise rejection' }))
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
