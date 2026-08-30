'use client'

import { CalendarDays, Target, TrendingUp } from 'lucide-react'
import TeamCrest from '../../components/TeamCrest'
import { formatNumberBR } from '../../../lib/serieC'

function dateLabel(value) {
  if (!value) return 'Data a confirmar'
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function probability(value) {
  return `${Math.round(Number(value || 0) * 100)}%`
}

function confidenceTone(value) {
  if (value >= 0.55) return 'bg-emerald-50 text-emerald-700 border-emerald-100'
  if (value >= 0.42) return 'bg-amber-50 text-amber-700 border-amber-100'
  return 'bg-slate-50 text-slate-500 border-slate-100'
}

function ProjectionTeam({ row, index }) {
  return (
    <div className={`flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 last:border-b-0 ${String(row.team).toLocaleLowerCase('pt-BR').includes('confianca') ? 'bg-emerald-50/70' : 'bg-white'}`}>
      <span className="bc flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-sm font-black text-slate-500">{index + 1}º</span>
      <TeamCrest name={row.team} size={24} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-black text-slate-700">{row.team}</p>
        <p className="text-[8px] font-semibold text-slate-400">média {formatNumberBR(row.meanPoints, 1)} pts</p>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-black text-emerald-700">{probability(row.g8Probability)}</p>
        <p className="text-[7px] font-black uppercase tracking-wider text-slate-300">G8</p>
      </div>
    </div>
  )
}

export default function SerieCFixturesPanel({ upcomingFixtures = [], projection, loading = false }) {
  const fixtures = [...upcomingFixtures].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || (a.round || 0) - (b.round || 0)).slice(0, 8)
  const groups = projection?.projectedGroups || []
  const guarani = projection?.probabilities?.find(row => String(row.team).toLocaleLowerCase('pt-BR').includes('confianca'))

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><CalendarDays className="h-5 w-5" /></span>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-700">Agenda e prognóstico</p>
            <h2 className="bc mt-1 text-2xl font-black text-slate-900">Próximos jogos da Série C</h2>
            <p className="mt-1 text-[10px] text-slate-500">Probabilidades calculadas a partir da campanha atual, saldo de gols, mando de campo e jogos ainda pendentes. Não é cotação de aposta.</p>
          </div>
        </div>
        <div className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-right">
          <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Confiança · chance de G8</p>
          <p className="bc mt-1 text-2xl font-black text-emerald-700">{guarani ? probability(guarani.g8Probability) : '-'}</p>
          <p className="text-[8px] font-semibold text-slate-400">líder: {guarani ? probability(guarani.leaderProbability) : '-'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4"><div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Calendário confirmado</p><p className="mt-1 text-[10px] text-slate-400">{fixtures.length ? `${fixtures.length} próximos jogos exibidos` : 'Aguardando a agenda ao vivo'}</p></div><Target className="h-4 w-4 text-blue-600" /></div>
          <div className="divide-y divide-slate-100">
            {loading && !fixtures.length && <p className="px-4 py-8 text-center text-[10px] font-semibold text-slate-400">Consultando calendário…</p>}
            {!loading && !fixtures.length && <p className="px-4 py-8 text-center text-[10px] font-semibold text-slate-400">Nenhum próximo jogo foi retornado pelas fontes.</p>}
            {fixtures.map(fixture => (
              <div key={fixture.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-12 flex-none text-center"><p className="text-[10px] font-black text-slate-700">{dateLabel(fixture.date)}</p><p className="text-[8px] font-bold text-slate-300">R{fixture.round || '-'}</p></div>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><TeamCrest name={fixture.home} size={22} /><span className="truncate text-[10px] font-black text-slate-700">{fixture.home}</span><span className="text-[9px] font-black text-slate-300">×</span><span className="truncate text-[10px] font-black text-slate-700">{fixture.away}</span><TeamCrest name={fixture.away} size={22} /></div><p className="mt-1 text-[8px] font-semibold text-slate-400">{fixture.time || 'horário a confirmar'} · fonte {fixture.source}</p></div>
                <div className="hidden text-right sm:block"><p className="text-[9px] font-black text-slate-500">{fixture.prediction?.expectedScore || '-'}</p><p className="text-[8px] font-bold text-slate-400">{fixture.prediction?.pickLabel || 'sem prognóstico'}</p></div>
                <span className={`rounded-full border px-2 py-1 text-[8px] font-black ${confidenceTone(fixture.prediction?.confidence || 0)}`}>{fixture.prediction ? probability(fixture.prediction.confidence) : '-'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/60 px-4 py-4"><div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-700">Projeção da próxima fase</p><p className="mt-1 text-[10px] text-slate-400">Simulação reprodutível · {projection?.simulations || '-'} cenários</p></div><TrendingUp className="h-4 w-4 text-emerald-600" /></div>
          {!groups.length && <p className="px-4 py-8 text-center text-[10px] font-semibold text-slate-400">Aguardando classificação e calendário.</p>}
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {groups.map(group => <div key={group.key} className="overflow-hidden rounded-xl border border-slate-100"><div className="flex items-center justify-between bg-slate-50 px-3 py-2"><span className="bc text-xl font-black text-slate-700">Grupo {group.key}</span><span className="text-[8px] font-black uppercase text-slate-400">4 vagas</span></div>{group.teams.map((row, index) => <ProjectionTeam key={row.team} row={row} index={index} />)}</div>)}
          </div>
        </div>
      </div>
    </section>
  )
}
