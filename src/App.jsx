import React, { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Brush,
  AreaChart,
  Area,
} from 'recharts'
import { Droplets, Fuel, CalendarDays, ArrowDownCircle } from 'lucide-react'
import data from './data.json'

const policyDate = '2026-04-01'
const benchmarkStart = '2026-03-12'

const fuelConfig = {
  e10: {
    label: 'Benzin / Super E10',
    atKey: 'at_e10',
    deKey: 'de_e10',
    atIndexKey: 'at_e10_index',
    deIndexKey: 'de_e10_index',
    spreadKey: 'spread_e10',
    avgBefore: -0.24065,
    avgAfter: -0.3246666667,
    icon: Fuel,
  },
  diesel: {
    label: 'Diesel',
    atKey: 'at_diesel',
    deKey: 'de_diesel',
    atIndexKey: 'at_diesel_index',
    deIndexKey: 'de_diesel_index',
    spreadKey: 'spread_diesel',
    avgBefore: -0.159,
    avgAfter: -0.1788888889,
    icon: Droplets,
  },
}

function euro(value, digits = 3) {
  if (value == null || Number.isNaN(value)) return '–'
  return `${value.toFixed(digits)} €`
}

function fmtDate(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function diffLabel(value) {
  if (value == null) return 'Kein DE-Vergleich verfügbar'
  const cents = Math.abs(value) * 100
  return `${value < 0 ? 'AT unter DE' : 'AT über DE'} um ${cents.toFixed(1)} ct/L`
}

function classNames(...values) {
  return values.filter(Boolean).join(' ')
}

function StatCard({ title, value, subtitle, icon: Icon }) {
  return (
    <div className="card stat-card">
      <div>
        <div className="eyebrow">{title}</div>
        <div className="stat-value">{value}</div>
        <div className="stat-subtitle">{subtitle}</div>
      </div>
      <div className="icon-wrap">
        <Icon size={20} />
      </div>
    </div>
  )
}

function TooltipBox({ active, payload, label, fuel, mode }) {
  if (!active || !payload?.length) return null
  const cfg = fuelConfig[fuel]
  const row = payload[0].payload

  return (
    <div className="tooltip-box">
      <div className="tooltip-date">{fmtDate(label)}</div>
      {mode === 'absolute' && (
        <>
          <div>Österreich: <strong>{euro(row[cfg.atKey])}</strong></div>
          <div>Deutschland: <strong>{euro(row[cfg.deKey])}</strong></div>
        </>
      )}
      {mode === 'index' && (
        <>
          <div>Österreich (31.03. = 100): <strong>{row[cfg.atIndexKey]?.toFixed(1) ?? '–'}</strong></div>
          <div>Deutschland (31.03. = 100): <strong>{row[cfg.deIndexKey]?.toFixed(1) ?? '–'}</strong></div>
        </>
      )}
      {mode === 'spread' && (
        <>
          <div>Spread (AT − DE): <strong>{euro(row[cfg.spreadKey])}</strong></div>
          <div className="muted">{diffLabel(row[cfg.spreadKey])}</div>
        </>
      )}
    </div>
  )
}

function FuelChart({ fuel, mode }) {
  const cfg = fuelConfig[fuel]
  const chartData = useMemo(() => {
    return data.filter((row) => {
      if (mode === 'absolute') return row[cfg.atKey] != null || row[cfg.deKey] != null
      if (mode === 'index') return row[cfg.atIndexKey] != null || row[cfg.deIndexKey] != null
      return row[cfg.spreadKey] != null
    })
  }, [cfg, mode])

  const latestAT = [...data].reverse().find((row) => row[cfg.atKey] != null)
  const afterPolicy = data.filter((row) => row.date >= policyDate && row[cfg.spreadKey] != null)
  const minSpread = afterPolicy.length ? Math.min(...afterPolicy.map((row) => row[cfg.spreadKey])) : null
  const shift = cfg.avgAfter - cfg.avgBefore
  const Icon = cfg.icon

  return (
    <section className="fuel-section">
      <div className="stats-grid">
        <StatCard
          title="Ø Spread vor 1.4."
          value={euro(cfg.avgBefore)}
          subtitle={cfg.avgBefore < 0 ? 'Österreich günstiger als Deutschland' : 'Österreich teurer als Deutschland'}
          icon={CalendarDays}
        />
        <StatCard
          title="Ø Spread ab 1.4."
          value={euro(cfg.avgAfter)}
          subtitle={cfg.avgAfter < 0 ? 'Österreich günstiger als Deutschland' : 'Österreich teurer als Deutschland'}
          icon={ArrowDownCircle}
        />
        <StatCard
          title="Verschiebung im Benchmark"
          value={`${shift < 0 ? '-' : '+'}${Math.abs(shift * 100).toFixed(1)} ct/L`}
          subtitle="Nach 1.4. relativ zu Deutschland"
          icon={Icon}
        />
      </div>

      <div className="card chart-card">
        <div className="chart-head">
          <h2>{cfg.label}</h2>
          <p>
            {mode === 'absolute' && 'Tagespreise in Österreich und Deutschland.'}
            {mode === 'index' && 'Beide Reihen auf 31.03.2026 = 100 normiert, um den Bruch rund um den Eingriff sichtbar zu machen.'}
            {mode === 'spread' && 'Spread = Österreich minus Deutschland. Eine fallende Linie bedeutet: Österreich wird relativ günstiger.'}
          </p>
        </div>

        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            {mode === 'spread' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} minTickGap={28} />
                <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)} ct`} />
                <Tooltip content={<TooltipBox fuel={fuel} mode={mode} />} />
                <ReferenceLine y={0} stroke="#666" />
                <ReferenceLine x={policyDate} stroke="#111827" strokeDasharray="6 6" label={{ value: '1.4.', position: 'insideTopRight', fontSize: 12 }} />
                <Area type="monotone" dataKey={cfg.spreadKey} name="Spread (AT − DE)" stroke="#2563eb" fill="#93c5fd" fillOpacity={0.35} strokeWidth={3} />
                <Brush dataKey="date" height={22} travellerWidth={10} />
              </AreaChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} minTickGap={28} />
                <YAxis tickFormatter={(v) => mode === 'absolute' ? v.toFixed(2) : v.toFixed(0)} />
                <Tooltip content={<TooltipBox fuel={fuel} mode={mode} />} />
                <Legend />
                <ReferenceLine x={policyDate} stroke="#111827" strokeDasharray="6 6" label={{ value: 'Spritpreisbremse 1.4.', position: 'insideTopRight', fontSize: 12 }} />
                <ReferenceLine x={benchmarkStart} stroke="#6b7280" strokeDasharray="3 5" label={{ value: 'DE Benchmark startet', position: 'insideBottomLeft', fontSize: 12 }} />
                <Line type="monotone" dataKey={mode === 'absolute' ? cfg.atKey : cfg.atIndexKey} name="Österreich" stroke="#2563eb" strokeWidth={3} dot={false} connectNulls={false} />
                <Line type="monotone" dataKey={mode === 'absolute' ? cfg.deKey : cfg.deIndexKey} name="Deutschland" stroke="#3f3f46" strokeWidth={2.5} dot={false} connectNulls={false} strokeOpacity={0.95} />
                <Brush dataKey="date" height={22} travellerWidth={10} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="notes-grid">
          <div className="note-box">
            <h3>Lesart</h3>
            <p>Der österreichische Eingriff ist eine Margenbegrenzung, kein starrer Preisdeckel. Deshalb ist der Benchmark gegen Deutschland oft aussagekräftiger als das absolute Preisniveau allein.</p>
          </div>
          <div className="note-box">
            <h3>Direkte Beobachtung</h3>
            <p>Beim {fuel === 'e10' ? 'Benzin' : 'Diesel'} wird der AT-DE-Spread nach dem 1.4. im Schnitt {shift < 0 ? 'negativer' : 'weniger negativ'}.</p>
          </div>
          <div className="note-box">
            <h3>Nach dem Eingriff</h3>
            <p>Tiefster beobachteter Spread nach dem 1.4.: {euro(minSpread)}. Zuletzt in AT: {euro(latestAT?.[cfg.atKey])}.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function App() {
  const [fuel, setFuel] = useState('e10')
  const [mode, setMode] = useState('index')

  return (
    <div className="app-shell">
      <div className="container">
        <div className="badge-row">
          <span className="badge">Österreich vs. Deutschland</span>
          <span className="badge badge-light">Policy marker: 01.04.2026</span>
          <span className="badge badge-light">31.03.2026 = 100</span>
        </div>

        <header className="hero-grid">
          <div>
            <h1>Wirkt die Spritpreisbremse?</h1>
            <p className="lead">Interaktive Gegenüberstellung von Benzin- und Dieselpreisen für Österreich und Deutschland. Der Fokus liegt darauf, ob sich Österreich nach dem Eingriff relativ zum deutschen Benchmark anders bewegt.</p>
          </div>
          <div className="card aside-card">
            <h3>Was hier hilft</h3>
            <p>Drei Blickwinkel sind verfügbar: absolute Preise, ein auf den 31. März normierter Index und der Spread AT − DE. Für eine schnelle Einordnung ist der Spread meist am aussagekräftigsten.</p>
          </div>
        </header>

        <div className="card controls-card">
          <div className="toggle-group">
            <button className={classNames('toggle', fuel === 'e10' && 'active')} onClick={() => setFuel('e10')}>Benzin</button>
            <button className={classNames('toggle', fuel === 'diesel' && 'active')} onClick={() => setFuel('diesel')}>Diesel</button>
          </div>
          <div className="toggle-group mode-group">
            <button className={classNames('toggle', mode === 'absolute' && 'active')} onClick={() => setMode('absolute')}>Absolute Preise</button>
            <button className={classNames('toggle', mode === 'index' && 'active')} onClick={() => setMode('index')}>Indexiert</button>
            <button className={classNames('toggle', mode === 'spread' && 'active')} onClick={() => setMode('spread')}>Spread AT − DE</button>
          </div>
        </div>

        <FuelChart fuel={fuel} mode={mode} />

        <footer className="card sources-card">
          <h3>Datenquellen</h3>
          <p>Österreich: E-Control — <a href="https://www.e-control.at" target="_blank" rel="noreferrer">www.e-control.at</a></p>
          <p>Deutschland: <a href="https://derspritfuchs.de/preise/preisentwicklung" target="_blank" rel="noreferrer">derspritfuchs.de/preise/preisentwicklung</a></p>
        </footer>
      </div>
    </div>
  )
}
