/**
 * ChartSettings - Customizable chart configuration
 * Simpan preferensi ke localStorage (key per chart).
 *
 * Panel pakai dropdown biasa (bukan portal overlay) — supaya tidak
 * ganggu event flow Recharts (ResponsiveContainer) dan klik di card lain.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  X, BarChart2, LineChart, AreaChart, RotateCcw,
} from 'lucide-react'
import DashboardIcon from './DashboardIcon'

export const CHART_TYPES = [
  { value: 'bar',  label: 'Bar',  icon: BarChart2 },
  { value: 'line', label: 'Line', icon: LineChart },
  { value: 'area', label: 'Area', icon: AreaChart },
]

export const CHART_THEMES = {
  sage:   { name: 'Sage',   omset: '#f97316', modal: '#3b82f6', untung: '#22c55e' },
  ocean:  { name: 'Ocean',  omset: '#0ea5e9', modal: '#6366f1', untung: '#14b8a6' },
  sunset: { name: 'Sunset', omset: '#f97316', modal: '#f59e0b', untung: '#ec4899' },
  mono:   { name: 'Mono',   omset: '#374151', modal: '#9ca3af', untung: '#6b7280' },
}

const HEIGHTS = [
  { value: 180, label: 'Pendek' },
  { value: 220, label: 'Sedang' },
  { value: 280, label: 'Tinggi' },
  { value: 350, label: 'Sangat Tinggi' },
]

const DEFAULT_SETTINGS = {
  type: 'bar',
  series: { omset: true, untung: true },
  theme: 'sage',
  height: 220,
}

function getSettings(storageKey) {
  try {
    const saved = localStorage.getItem(`charts:${storageKey}`)
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved), series: { ...DEFAULT_SETTINGS.series, ...(JSON.parse(saved).series || {}) } } : { ...DEFAULT_SETTINGS, series: { ...DEFAULT_SETTINGS.series } }
  } catch {
    return { ...DEFAULT_SETTINGS, series: { ...DEFAULT_SETTINGS.series } }
  }
}

function saveSettings(storageKey, settings) {
  try {
    localStorage.setItem(`charts:${storageKey}`, JSON.stringify(settings))
  } catch (e) {
    console.warn('Failed to save chart settings:', e)
  }
}

export function useChartSettings(storageKey) {
  const [settings, setSettings] = useState(() => getSettings(storageKey))
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setSettings(getSettings(storageKey))
  }, [storageKey])

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value }
      saveSettings(storageKey, next)
      return next
    })
  }, [storageKey])

  const toggleSeries = useCallback((seriesKey) => {
    setSettings(prev => {
      const newSeries = { ...prev.series, [seriesKey]: !prev.series[seriesKey] }
      // Minimal satu series aktif
      if (!newSeries.omset && !newSeries.untung) return prev
      const next = { ...prev, series: newSeries }
      saveSettings(storageKey, next)
      return next
    })
  }, [storageKey])

  const reset = useCallback(() => {
    const fresh = { ...DEFAULT_SETTINGS, series: { ...DEFAULT_SETTINGS.series } }
    saveSettings(storageKey, fresh)
    setSettings(fresh)
  }, [storageKey])

  return { settings, setSettings, open, setOpen, updateSetting, toggleSeries, reset }
}

// ── Panel settings (dropdown biasa, render inline di card) ────────────────
export function ChartSettingsPanel({ bind }) {
  const { settings, open, setOpen, updateSetting, toggleSeries, reset } = bind
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        // Abaikan klik dari tombol toggle (kebanyakan ada di luar panel)
        if (e.target.closest('[data-chart-toggle]')) return
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open, setOpen])

  if (!open) return null

  const activeColors = CHART_THEMES[settings.theme] || CHART_THEMES.sage

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-8 z-50 w-64 bg-white rounded-xl border border-gray-200 shadow-xl p-4 animate-slide-up"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-800">Pengaturan Grafik</h3>
        <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
          <X size={16} />
        </button>
      </div>

      {/* Tipe Chart */}
      <div className="space-y-3 mb-4">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tipe Chart</label>
        <div className="flex gap-2">
          {CHART_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => updateSetting('type', t.value)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                settings.type === t.value
                  ? 'bg-sage-500 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Series */}
      <div className="space-y-3 mb-4">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Series</label>
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'omset', label: 'Omset', color: activeColors.omset },
            { key: 'untung', label: 'Laba Kas', color: activeColors.untung },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => toggleSeries(s.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                settings.series[s.key]
                  ? 'bg-sage-50 text-sage-600 border border-sage-200'
                  : 'bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className="space-y-3 mb-4">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tema Warna</label>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(CHART_THEMES).map(([id, t]) => (
            <button
              key={id}
              onClick={() => updateSetting('theme', id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                settings.theme === id ? 'ring-2 ring-offset-2 ring-sage-500' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex gap-1">
                <span className="w-3 h-3 rounded" style={{ background: t.omset }} />
                <span className="w-3 h-3 rounded" style={{ background: t.modal }} />
                <span className="w-3 h-3 rounded" style={{ background: t.untung }} />
              </div>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Height */}
      <div className="space-y-3 mb-4">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tinggi Chart</label>
        <div className="flex gap-2 flex-wrap">
          {HEIGHTS.map(h => (
            <button
              key={h.value}
              onClick={() => updateSetting('height', h.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                settings.height === h.value ? 'bg-sage-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={reset}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors border border-red-100"
      >
        <RotateCcw size={14} />
        Reset ke Default
      </button>
    </div>
  )
}

// ── Button toggle (gear) — di-render di pojok chart ─────────────────────
export function ChartToggleButton({ bind }) {
  return (
    <button
      data-chart-toggle
      onClick={() => bind.setOpen(o => !o)}
      className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-sage-600 transition-colors flex-shrink-0"
      title="Pengaturan grafik"
    >
      <DashboardIcon name="settings" size={25} />
    </button>
  )
}

export default CHART_THEMES
