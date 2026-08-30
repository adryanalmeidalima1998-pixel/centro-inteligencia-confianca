'use client'

function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 2) return parts.join(' ')
  return `${parts[0]} ${parts[parts.length - 1]}`
}

function PageHeader({ page, totalPages, subtitle }) {
  return <div className="flex items-end justify-between gap-4 border-b-2 border-emerald-600 pb-3">
    <div className="flex items-center gap-3">
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-emerald-100 bg-white p-2">
        <img src="/confianca.png" alt="Escudo do Confiança" className="max-h-full max-w-full object-contain" />
      </div>
      <div>
        <div className="text-[8px] font-black uppercase tracking-[0.22em] text-emerald-600">CIC · Relatório do elenco · Série C</div>
        <div className="bc text-2xl font-black leading-none text-gray-900">Confiança</div>
        <div className="mt-1 text-[9px] font-bold text-gray-400">{subtitle}</div>
      </div>
    </div>
    <div className="text-right text-[8px] font-bold text-gray-400">Página {page}/{totalPages}</div>
  </div>
}

function PlayerPhoto({ name, photoFor }) {
  const url = photoFor?.(name)
  return <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200">
    {url ? <img src={url} alt={name} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center bc text-[11px] font-black text-gray-300">{String(name || '').split(' ').slice(0,2).map(s => s[0]).join('')}</div>}
  </div>
}

function MetricCard({ item, photoFor }) {
  return <div className="metric-card break-inside-avoid rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_4px_18px_rgba(15,23,42,0.025)]">
    <div className="mb-2 flex items-start justify-between gap-2 border-b border-gray-100 pb-2">
      <div className="min-w-0">
        <div className="truncate text-[9px] font-black uppercase tracking-widest text-gray-700">{item.metric}</div>
        <div className="mt-0.5 text-[7px] font-bold text-gray-400">Ranking: {item.basis}{item.minAttempts ? ` · mín. ${item.minAttempts} ${item.sampleNoun}` : ''}{item.higher === false ? ' · menor = melhor' : ''}</div>
      </div>
      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[7px] font-black uppercase tracking-wide text-emerald-700">Top 3</span>
    </div>
    <div className="space-y-2">
      {item.top.map(row => <div key={`${item.key}_${row.player}`} className="grid grid-cols-[20px_36px_minmax(0,1fr)_auto] items-center gap-2">
        <span className={`grid h-5 w-5 place-items-center rounded-lg text-[9px] font-black ${row.rank===1 ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{row.rank}</span>
        <PlayerPhoto name={row.player} photoFor={photoFor} />
        <div className="min-w-0">
          <div className="truncate text-[9px] font-black text-gray-700" title={row.player}>{shortName(row.player)}</div>
          <div className="truncate text-[7px] font-semibold text-gray-400">{row.position ? `${row.position} · ` : ''}{row.secondary}</div>
        </div>
        <div className="bc whitespace-nowrap text-right text-base font-black text-emerald-700">{row.value}</div>
      </div>)}
    </div>
  </div>
}

function Section({ title, subtitle, items, photoFor, columns = 2 }) {
  if (!items?.length) return null
  return <div className="report-section mt-4">
    <div className="mb-2 flex items-end justify-between gap-3">
      <div>
        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-600">{title}</div>
        {subtitle ? <div className="mt-0.5 text-[8px] font-semibold text-gray-400">{subtitle}</div> : null}
      </div>
      <div className="text-[7px] font-black uppercase tracking-widest text-gray-300">Sem Índice</div>
    </div>
    <div className={`metric-grid grid gap-2.5 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {items.map(item => <MetricCard key={item.key} item={item} photoFor={photoFor} />)}
    </div>
  </div>
}

function Footer({ label }) {
  return <div className="report-footer mt-auto flex items-center justify-between border-t border-gray-100 pt-3 text-[7px] font-bold uppercase tracking-widest text-gray-300"><span>Confiança · Centro de Inteligência</span><span>{label}</span></div>
}

export default function RelatorioElenco({ report, photoFor }) {
  const line = report?.line || []
  const physical = report?.physical || []
  const minMinutes = report?.meta?.minMinutes || 300

  const attack = line.filter(item => item.family === 'Ataque')
  const construction = line.filter(item => item.family === 'Construção')
  const pressure = line.filter(item => item.family === 'Pressão')
  const defense = line.filter(item => item.family === 'Defesa')
  const general = line.filter(item => !['Ataque','Construção','Pressão','Defesa'].includes(item.family))
  const totalPages = 5

  // Distribuição deliberada para nunca cortar card entre páginas.
  // P1: ataque + início da construção | P2: restante construção + pressão
  const constructionP1 = construction.slice(0, 2)
  const constructionP2 = construction.slice(2)

  return <div className="elenco-report-document space-y-6">
    <section className="elenco-report-page mx-auto flex w-full max-w-[900px] flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <PageHeader page={1} totalPages={totalPages} subtitle="Top 3 do elenco · ataque e início da construção" />
      <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-[8px] font-semibold leading-relaxed text-emerald-800">
        O relatório <b>não usa Índice</b>. <b>Gols e assistências são totais</b>. Métricas de volume usam <b>/90</b>. Percentuais de eficiência só entram no ranking com <b>amostra mínima de tentativas</b>, além de <b>{minMinutes} minutos</b>, evitando líderes artificiais com 1/1, 2/2 ou 3/3 ações.
      </div>
      <Section title="Ataque e criação" subtitle="Produção ofensiva individual em base comparável." items={attack} photoFor={photoFor} columns={2} />
      <Section title="Construção" subtitle="Primeiro bloco de progressão e passe." items={constructionP1} photoFor={photoFor} columns={2} />
      <Footer label="Elenco · 1/5" />
    </section>

    <section className="elenco-report-page mx-auto flex w-full max-w-[900px] flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <PageHeader page={2} totalPages={totalPages} subtitle="Top 3 do elenco · construção e pressão" />
      <Section title="Construção" subtitle="Progressão, passe e chegada a zonas de criação." items={constructionP2} photoFor={photoFor} columns={2} />
      <Section title="Pressão" items={pressure} photoFor={photoFor} columns={2} />
      <Footer label="Elenco · 2/5" />
    </section>

    <section className="elenco-report-page mx-auto flex w-full max-w-[900px] flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <PageHeader page={3} totalPages={totalPages} subtitle="Top 3 do elenco · defesa" />
      <Section title="Defesa" subtitle="Volume defensivo e eficiência com amostra mínima." items={defense} photoFor={photoFor} columns={2} />
      <Footer label="Elenco · 3/5" />
    </section>

    <section className="elenco-report-page mx-auto flex w-full max-w-[900px] flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <PageHeader page={4} totalPages={totalPages} subtitle="Top 3 do elenco · controle e GPS" />
      <Section title="Geral / controle" items={general} photoFor={photoFor} columns={2} />
      <Section title="Físico · GPS" subtitle="Primeiro bloco · média por jogo dos relatórios Catapult vinculados." items={physical.slice(0,4)} photoFor={photoFor} columns={2} />
      <Footer label="Elenco · 4/5" />
    </section>

    <section className="elenco-report-page mx-auto flex w-full max-w-[900px] flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <PageHeader page={5} totalPages={totalPages} subtitle="Top 3 do elenco · GPS e fechamento" />
      <Section title="Físico · GPS" subtitle="Continuação · média por jogo dos relatórios Catapult vinculados." items={physical.slice(4)} photoFor={photoFor} columns={2} />
      <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-[8px] font-semibold leading-relaxed text-gray-500">
        O relatório de elenco não cria página exclusiva de goleiros. O goleiro continua com seu relatório individual próprio, onde as métricas específicas da posição permanecem disponíveis.
      </div>
      <Footer label="Elenco · 5/5" />
    </section>
  </div>
}
