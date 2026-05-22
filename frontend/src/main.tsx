import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ── Initialize translation store on startup ───────────────────
import { useTranslationStore } from '@/store/translationStore'
const { language, setLanguage } = useTranslationStore.getState()
setLanguage(language)

// ── Register the Vite PWA service worker ──────────────────────
// The virtual module 'virtual:pwa-register' is injected by vite-plugin-pwa
// at build time.  It registers the SW and handles auto-updates.
// In dev mode (devOptions.enabled = false) this is a no-op.
import { registerSW } from 'virtual:pwa-register'

registerSW({
  // Called when a new SW version is available and waiting.
  // We reload immediately (autoUpdate mode) — no manual prompt needed.
  onNeedRefresh() {
    // autoUpdate handles this automatically; nothing to do here.
  },
  onOfflineReady() {
    console.info('[PWA] App is ready to work offline.')
  },
  onRegistered(registration) {
    if (registration) {
      console.info('[PWA] Service worker registered.')
    }
  },
  onRegisterError(error) {
    console.warn('[PWA] Service worker registration failed:', error)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
