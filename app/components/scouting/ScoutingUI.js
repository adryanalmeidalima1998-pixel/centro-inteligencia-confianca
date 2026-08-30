'use client'

import AppShell from '@/app/components/layout/AppShell'

export const C = {
  green: '#0a66b7', green2: '#eaf4fd', green3: '#cfe6f8',
  ink: '#10233b', muted: '#64748b', line: '#dbe7f2', bg: '#f4f8fc',
  blue: '#2563eb', amber: '#c47b09', red: '#c53a32', purple: '#7c3aed',
}

export const cardStyle = {
  background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16,
  boxShadow: '0 8px 28px rgba(16,65,38,.055)',
}

export function ScoutingPage({ children, maxWidth = 1440 }) {
  return (
    <AppShell>
      <style jsx global>{`
        .scout-page * { box-sizing: border-box; }
        .scout-page button, .scout-page input, .scout-page select, .scout-page textarea { font-family: inherit; }
        .scout-scroll::-webkit-scrollbar { height: 7px; width: 7px; }
        .scout-scroll::-webkit-scrollbar-thumb { background: #cbddeb; border-radius: 20px; }
        .scout-hover { transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; }
        .scout-hover:hover { transform: translateY(-1px); box-shadow: 0 12px 30px rgba(10,102,183,.10); border-color: #b8d7ef !important; }
        @media (max-width: 820px) {
          .scout-page { padding: 18px 14px !important; }
          .scout-hide-mobile { display:none !important; }
          .scout-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div className="scout-page" style={{ padding: '28px 30px 44px', maxWidth, margin: '0 auto' }}>{children}</div>
    </AppShell>
  )
}

export function PageHeader({ eyebrow = 'CIC · SCOUTING & DATA', title, subtitle, actions, status }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
      <div style={{ minWidth: 260, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ width: 22, height: 3, background: C.green, borderRadius: 10 }} />
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '1.6px', color: C.green }}>{eyebrow}</span>
          {status}
        </div>
        <h1 style={{ fontSize: 31, lineHeight: 1.08, color: C.ink, fontWeight: 950, letterSpacing: '-.7px' }}>{title}</h1>
        {subtitle && <p style={{ marginTop: 7, color: C.muted, fontSize: 13, maxWidth: 820, lineHeight: 1.55 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div>}
    </div>
  )
}

export function Button({ children, onClick, variant = 'primary', disabled, type = 'button', style, title }) {
  const styles = {
    primary: { background: C.green, color: '#fff', border: `1px solid ${C.green}` },
    secondary: { background: '#fff', color: C.green, border: `1px solid #bdd8ee` },
    soft: { background: C.green2, color: C.green, border: `1px solid ${C.green3}` },
    danger: { background: '#fff4f2', color: C.red, border: '1px solid #f2c8c3' },
    dark: { background: C.ink, color: '#fff', border: `1px solid ${C.ink}` },
  }
  return <button type={type} title={title} disabled={disabled} onClick={onClick} style={{ borderRadius: 10, padding: '9px 14px', fontSize: 11.5, fontWeight: 850, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .55 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, ...styles[variant], ...style }}>{children}</button>
}

export function StatusDot({ color = C.green, children }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 99, padding: '5px 9px', background: `${color}12`, color, border: `1px solid ${color}28`, fontSize: 9.5, fontWeight: 850 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />{children}</span>
}

export function Panel({ title, subtitle, action, children, style, bodyStyle, accent }) {
  return (
    <section style={{ ...cardStyle, overflow: 'hidden', ...style }}>
      {(title || action) && <div style={{ padding: '15px 18px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: accent ? `linear-gradient(90deg, ${accent}0b, #fff 38%)` : '#fff' }}>
        <div>
          {title && <h2 style={{ fontSize: 13, fontWeight: 900, color: C.ink }}>{title}</h2>}
          {subtitle && <p style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{subtitle}</p>}
        </div>
        {action}
      </div>}
      <div style={{ padding: 18, ...bodyStyle }}>{children}</div>
    </section>
  )
}

export function Kpi({ label, value, sub, icon, tone = C.green, trend, style }) {
  return (
    <div className="scout-hover" style={{ ...cardStyle, padding: 17, minWidth: 0, borderTop: `3px solid ${tone}`, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 9.5, letterSpacing: '.7px', fontWeight: 900, textTransform: 'uppercase', color: C.muted }}>{label}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
        <strong style={{ fontSize: 27, color: C.ink, lineHeight: 1, letterSpacing: '-.6px' }}>{value}</strong>
        {trend != null && <span style={{ fontSize: 10, fontWeight: 850, color: trend >= 0 ? C.green : C.red }}>{trend > 0 ? '+' : ''}{trend}</span>}
      </div>
      {sub && <p style={{ marginTop: 6, fontSize: 10.5, color: C.muted, lineHeight: 1.35 }}>{sub}</p>}
    </div>
  )
}

export function Tabs({ items, active, onChange }) {
  return (
    <div className="scout-scroll" style={{ display: 'flex', gap: 5, overflowX: 'auto', padding: 5, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 13 }}>
      {items.map(item => {
        const on = item.id === active
        return <button key={item.id} onClick={() => onChange(item.id)} style={{ flex: item.flex ? 1 : undefined, whiteSpace: 'nowrap', padding: '9px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', background: on ? C.green : 'transparent', color: on ? '#fff' : C.muted, fontSize: 11, fontWeight: 850 }}>{item.icon && <span style={{ marginRight: 6 }}>{item.icon}</span>}{item.label}</button>
      })}
    </div>
  )
}

export function Field({ label, children, style }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }}><span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '.6px', color: C.muted, textTransform: 'uppercase' }}>{label}</span>{children}</label>
}

export const inputStyle = { width: '100%', padding: '9px 10px', borderRadius: 9, border: `1px solid ${C.line}`, background: '#fff', color: C.ink, fontSize: 11.5, outline: 'none' }

export function ScoreBadge({ value, label, color }) {
  const v = Number(value) || 0
  const tone = color || (v >= 80 ? '#15803d' : v >= 65 ? '#0f766e' : v >= 50 ? '#c47b09' : '#c53a32')
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 8, background: `${tone}12`, border: `1px solid ${tone}25`, color: tone, fontSize: 10, fontWeight: 900 }}>{label && <span style={{ fontWeight: 750 }}>{label}</span>}{v}</span>
}

export function ConfidenceBadge({ confidence }) {
  const c = confidence || { label: '—', color: C.muted }
  return <span style={{ fontSize: 9.5, fontWeight: 850, color: c.color, background: `${c.color}12`, borderRadius: 99, padding: '4px 7px' }}>{c.label}</span>
}

export function PercentileBar({ label, value, raw, color = C.green, suffix = '' }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  return <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) minmax(120px,1.6fr) 42px', gap: 9, alignItems: 'center' }}>
    <div style={{ minWidth: 0 }}><p title={label} style={{ fontSize: 10.5, fontWeight: 750, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</p>{raw != null && <p style={{ fontSize: 9, color: C.muted }}>{raw}{suffix}</p>}</div>
    <div style={{ height: 7, background: '#edf3ef', borderRadius: 20, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 20 }} /></div>
    <strong style={{ fontSize: 10.5, color }}>P{Math.round(pct)}</strong>
  </div>
}

export function EmptyState({ icon = '📊', title, text, action }) {
  return <div style={{ padding: '42px 20px', textAlign: 'center' }}><div style={{ fontSize: 34 }}>{icon}</div><h3 style={{ marginTop: 9, color: C.ink, fontSize: 14, fontWeight: 900 }}>{title}</h3>{text && <p style={{ color: C.muted, fontSize: 11, maxWidth: 430, margin: '7px auto 15px', lineHeight: 1.5 }}>{text}</p>}{action}</div>
}

export function LoadingState({ text = 'Carregando inteligência...' }) {
  return <div style={{ padding: 50, textAlign: 'center', color: C.muted, fontSize: 12 }}><span style={{ display: 'inline-block', width: 18, height: 18, border: `2px solid ${C.green3}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .8s linear infinite', marginRight: 9, verticalAlign: 'middle' }} /><style jsx>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>{text}</div>
}

export function MiniSignal({ label, value, tone = C.green, sub }) {
  return <div style={{ padding: '10px 11px', borderRadius: 10, background: `${tone}09`, border: `1px solid ${tone}1c` }}><p style={{ fontSize: 9, fontWeight: 850, color: C.muted }}>{label}</p><p style={{ fontSize: 15, fontWeight: 950, color: tone, marginTop: 3 }}>{value}</p>{sub && <p style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{sub}</p>}</div>
}

export function DividerLabel({ children }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '4px 0 12px' }}><span style={{ width: 4, height: 17, background: C.green, borderRadius: 9 }} /><span style={{ fontSize: 10, color: C.green, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.8px' }}>{children}</span></div>
}
