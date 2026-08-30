// app/components/serie-c/RelatorioAtletaCard.js
// Card A4 (retrato) do relatório individual do atleta — foto, identidade,
// faixa de destaques, perfil por família (com percentil na liga) e bloco físico.
// Visual alinhado à Série C | Estatísticas (verde/branco, Barlow Condensed).
// Pensado para impressão: 1 página, sem dependência externa.
'use client'

// cor da barra de percentil (vs. mesma posição na Série C)
function pctColor(p) {
  if (p === null || p === undefined) return { bar: 'bg-gray-200', text: 'text-gray-400' }
  if (p >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-700' }
  if (p >= 60) return { bar: 'bg-sky-400', text: 'text-sky-600' }
  if (p >= 40) return { bar: 'bg-amber-400', text: 'text-amber-600' }
  return { bar: 'bg-rose-400', text: 'text-rose-600' }
}

function RankScale({ leaguePct, leagueRank, leagueTotal, squadRank, squadTotal, sampleLow, contextOnly, sampleText }) {
  const c = pctColor(leaguePct)
  if (contextOnly) return <div className="w-[104px] shrink-0 text-right"><div className="rounded-md bg-gray-50 px-1.5 py-1 text-[7px] font-black uppercase tracking-tight text-gray-400">Contextual</div><div className="mt-0.5 truncate text-[6px] font-bold text-gray-300" title={sampleText}>{sampleText || 'Sem ranking'}</div></div>
  if (sampleLow) return <div className="w-[104px] shrink-0 text-right"><div className="rounded-md bg-amber-50 px-1.5 py-1 text-[7px] font-black uppercase tracking-tight text-amber-700">Amostra baixa</div><div className="mt-0.5 truncate text-[6px] font-bold text-amber-500" title={sampleText}>{sampleText || 'Sem ranking'}</div></div>
  if (leaguePct == null && !leagueRank && !squadRank) return <div className="w-[104px] shrink-0 text-right"><div className="rounded-md bg-gray-50 px-1.5 py-1 text-[7px] font-black uppercase tracking-tight text-gray-400">Sem ranking</div></div>
  return (
    <div className="w-[104px] shrink-0">
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
          <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${leaguePct ?? 0}%` }} />
        </div>
        <span className={`text-[8px] font-black tabular-nums w-6 text-right ${c.text}`}>
          {leaguePct == null ? '—' : `p${leaguePct}`}
        </span>
      </div>
      <div className="mt-0.5 flex justify-between gap-1 text-[7px] font-black uppercase tracking-tight text-gray-400 tabular-nums">
        <span>{leagueRank && leagueTotal ? `Liga ${leagueRank}º/${leagueTotal}` : 'Liga —'}</span>
        <span>{squadRank && squadTotal ? `Elenco ${squadRank}º/${squadTotal}` : 'Elenco —'}</span>
      </div>
      {sampleText ? <div className="mt-0.5 truncate text-right text-[6px] font-bold text-gray-300" title={sampleText}>{sampleText}</div> : null}
    </div>
  )
}

function DestaqueChip({ d }) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
      <div className="flex flex-wrap items-center gap-1 text-[7px] font-black uppercase tracking-wide leading-tight">
        {d.leaguePct !== null && d.leaguePct !== undefined ? <span title="Percentil na Série C" className="rounded-full bg-white/80 px-1.5 py-0.5 text-emerald-700">Liga p{d.leaguePct}</span> : null}
        {d.squadRank && d.squadTotal ? <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-emerald-800">{d.squadRank === 1 ? '★ ' : ''}Elenco {d.squadRank}º/{d.squadTotal}</span> : null}
      </div>
      <div className="text-[11px] font-bold text-gray-800 leading-tight mt-1">{d.metric}</div>
      <div className="text-lg font-black text-emerald-700 bc leading-none mt-0.5">
        {d.value}{d.per90 && <span className="text-[9px] font-bold text-gray-400 ml-1">/90</span>}
      </div>
      {d.secondary ? <div className="text-[8px] font-bold text-gray-400 mt-0.5">{d.secondary}</div> : null}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-[8px] font-black uppercase tracking-widest text-gray-400">{label}</div>
      <div className="text-base font-black text-gray-800 bc leading-none mt-0.5">{value ?? '—'}</div>
    </div>
  )
}

const FAMILY_ORDER = ['Ataque', 'Construção', 'Pressão', 'Defesa', 'Disciplina', 'Geral']

export default function RelatorioAtletaCard({ identity, photoUrl, report, physical, meta }) {
  const fams = FAMILY_ORDER.filter(f => report?.families?.[f]?.length)
  const phRow = physical?.row
  const leaders = physical?.leaders || {}
  const technicalMinutes = Number(identity?.minutos || 0)
  const sampleStage = technicalMinutes < 180 ? 'Amostra inicial' : technicalMinutes < 300 ? 'Amostra em formação' : 'Amostra consolidada'
  const minutesToRank = Math.max(0, 300 - technicalMinutes)

  return (
    <div className="relatorio-card mx-auto bg-white text-gray-900" style={{ width: '210mm', minHeight: '297mm', padding: '12mm' }}>
      {/* Cabeçalho */}
      <div className="flex items-center gap-4 border-b-2 border-emerald-600 pb-4">
        <div className="h-24 w-24 shrink-0 rounded-2xl bg-gray-100 overflow-hidden ring-1 ring-gray-200">
          {photoUrl
            ? <img src={photoUrl} alt={identity.nome} className="h-full w-full object-cover" />
            : <div className="h-full w-full grid place-items-center text-3xl font-black text-gray-300 bc">
                {identity.nome?.split(' ').slice(0, 2).map(s => s[0]).join('')}
              </div>}
        </div>
        <div className="h-16 w-16 shrink-0 rounded-2xl border border-emerald-100 bg-white grid place-items-center p-2">
          <img src="/confianca.png" alt="Escudo do Confiança" className="max-h-full max-w-full object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600">
            CIC · Relatório individual · Série C
          </div>
          <div className="text-3xl font-black text-gray-900 bc leading-none truncate">{identity.nome}</div>
          <div className="text-xs font-bold text-gray-500 mt-1">
            {identity.posicao}{identity.idade ? ` · ${identity.idade} anos` : ''}{identity.altura ? ` · ${identity.altura} cm` : ''}
          </div>
        </div>
        <div className="flex gap-4 pl-4 border-l border-gray-100">
          <Stat label="Jogos" value={identity.jogos} />
          <Stat label="Minutos" value={identity.minutos} />
          <Stat label="Índice" value={identity.index} />
        </div>
      </div>

      {technicalMinutes < 300 ? <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-[8px] font-semibold leading-relaxed text-amber-800">
        <b>{sampleStage.toUpperCase()} · {technicalMinutes} min.</b> Valores técnicos são exibidos normalmente, mas rankings/percentis ficam suspensos até 300 minutos{minutesToRank ? ` (${minutesToRank} min restantes)` : ''}. Percentuais ainda exigem também a amostra mínima específica da ação.
      </div> : null}

      {/* Destaques */}
      {report?.destaques?.length ? (
        <div className="mt-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Destaques do atleta</div>
          <div className="grid grid-cols-4 gap-2">
            {report.destaques.slice(0, 4).map((d, i) => <DestaqueChip key={i} d={d} />)}
          </div>
        </div>
      ) : null}

      {/* Perfil por família + Físico lado a lado */}
      <div className="mt-5 grid grid-cols-[1.35fr_1fr] gap-5">
        {/* Técnico por família */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
            Perfil técnico <span className="text-gray-300 normal-case tracking-normal font-bold">· /90 ou % com amostra mínima para eficiências</span>
          </div>
          <div className="space-y-3">
            {fams.map(fam => (
              <div key={fam}>
                <div className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1">{fam}</div>
                <div className="space-y-1">
                  {report.families[fam].map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0 flex items-baseline gap-2">
                        <span className="text-[11px] text-gray-600 truncate">{m.metric}</span>
                        <span className="text-[11px] font-black text-gray-800 bc ml-auto tabular-nums">{m.value}</span>
                      </div>
                      <RankScale leaguePct={m.leaguePct} leagueRank={m.leagueRank} leagueTotal={m.leagueTotal} squadRank={m.squadRank} squadTotal={m.squadTotal} sampleLow={m.sampleLow && !String(m.sampleText || '').toLowerCase().includes('minutos')} contextOnly={m.contextOnly} sampleText={String(m.sampleText || '').toLowerCase().includes('minutos') ? null : m.sampleText} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Físico (GPS) */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
            Físico · GPS <span className="text-gray-300 normal-case tracking-normal font-bold">· média por jogo</span>
          </div>
          {phRow ? (
            <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-3 space-y-2">
              {(physical.metricsFor ? physical.metricsFor(phRow) : (physical.metrics || [])).map(g => {
                const v = phRow[g.field]
                if (v === null || v === undefined) return null
                const isLeader = leaders[g.key]?.nome === phRow.nome
                const standing = physical.playerStanding?.(phRow.nome, g.field)
                const pct = standing?.percentile ?? physical.playerPct?.(phRow.nome, g.field)
                return (
                  <div key={g.key} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600 flex-1 leading-tight">{g.label}</span>
                    <span className="text-sm font-black text-gray-800 bc tabular-nums">
                      {(() => {
                        const num = Number(v)
                        if (!Number.isFinite(num)) return '—'
                        return g.key === 'vel_max' ? num.toFixed(1) : Math.round(num).toLocaleString('pt-BR')
                      })()}
                    </span>
                    <span className={`text-[8px] font-black tabular-nums whitespace-nowrap ${isLeader ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {standing ? `${standing.rank === 1 ? '★ ' : ''}${standing.rank}º/${standing.total}` : (pct != null ? `p${pct}` : '')}
                    </span>
                  </div>
                )
              })}
              <div className="pt-1 mt-1 border-t border-gray-200 text-[8px] text-gray-400">
                Baseado em {phRow.jogos} jogo(s) com GPS · ranking interno do elenco · ★ = líder
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-center text-[10px] text-gray-400">
              Sem sessões de GPS de jogo vinculadas a este atleta ainda.<br />
              Faça o upload dos relatórios do Catapult no módulo de Fisiologia.
            </div>
          )}
        </div>
      </div>

      {/* Rodapé */}
      <div className="mt-auto pt-4 flex items-center justify-between text-[8px] font-bold uppercase tracking-widest text-gray-400 border-t border-gray-100" style={{ marginTop: '10mm' }}>
        <span>Confiança · Centro de Inteligência</span>
        <span>{meta?.rodada ? `Rodada ${meta.rodada} · ` : ''}{meta?.geradoEm || ''}</span>
      </div>
    </div>
  )
}
