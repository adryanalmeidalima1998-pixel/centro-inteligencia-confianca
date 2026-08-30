import { sql } from '@vercel/postgres'

export async function GET() {
  try {
    const rows = await sql`
      SELECT jogador, clube, posicao, idade, irc_final, irc_classificacao,
             recomendacao, historico_score, nivel_competicao, adequacao_modelo,
             perfil_tags, veredicto, uploaded_at
      FROM lista_final
      ORDER BY
        CASE recomendacao
          WHEN 'CONTRATAÇÃO' THEN 1 WHEN 'MONITORAR' THEN 2 ELSE 3
        END, irc_final DESC NULLS LAST
    `
    const players = rows.rows
    const now = new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})

    function recColor(r) {
      const s=(r||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      if(s==='CONTRATACAO') return '#0a66b7'
      if(s.includes('NAO')) return '#dc2626'
      return '#d97706'
    }
    function stars(n) { return Array.from({length:5},(_,i)=>i<parseInt(n||0)?'★':'☆').join('') }
    function countRec(match) { return players.filter(p=>{ const s=(p.recomendacao||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); return match(s) }).length }

    const html = `<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="utf-8"/><title>Lista Final CIC — Confiança</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,sans-serif;color:#0f172a;background:#fff;font-size:11px}
@media print{.no-print{display:none!important}.pb{page-break-before:always}body{font-size:10px}}
.cover{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#0a66b7;color:#fff;padding:48px;text-align:center}
.logo{font-size:80px;font-weight:900;letter-spacing:-3px;line-height:1}
.subtitle{font-size:18px;font-weight:600;opacity:.8;margin-top:8px}
.big{font-size:56px;font-weight:900;margin:24px 0 4px}
.date{font-size:13px;opacity:.6;margin-top:24px}
.summary{padding:32px 40px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
.summary h2{font-size:12px;font-weight:700;color:#0a66b7;margin-bottom:16px;text-transform:uppercase;letter-spacing:.06em}
.sgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.scard{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center}
.snum{font-size:40px;font-weight:900}.slbl{font-size:9px;color:#94a3b8;font-weight:600;text-transform:uppercase;margin-top:4px}
.g{color:#0a66b7}.a{color:#d97706}.r{color:#dc2626}
.players{padding:24px 40px}
.card{border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px;page-break-inside:avoid}
.ch{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
.cn{font-size:16px;font-weight:700}
.cs{font-size:11px;color:#64748b;margin-top:2px}
.rec{display:inline-block;padding:4px 12px;border-radius:6px;font-size:10px;font-weight:700;color:#fff;margin-top:6px}
.ircb{text-align:right}.ircn{font-size:32px;font-weight:900;line-height:1}.ircl{font-size:9px;color:#94a3b8;font-weight:600;text-transform:uppercase}
.sc{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
.si{background:#f8fafc;border-radius:8px;padding:8px;text-align:center}
.ss{font-size:14px;color:#f59e0b}.sl{font-size:9px;color:#94a3b8;font-weight:600;text-transform:uppercase;margin-top:2px}
.tags{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}
.tag{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:5px;padding:2px 7px;font-size:9px;font-weight:600;color:#0a66b7}
.verd{font-size:11px;color:#475569;line-height:1.5;margin-top:8px;border-top:1px solid #f1f5f9;padding-top:8px}
.footer{text-align:center;padding:24px;color:#94a3b8;font-size:10px;border-top:1px solid #e2e8f0}
.pbtn{position:fixed;bottom:24px;right:24px;background:#0a66b7;color:#fff;padding:12px 24px;border-radius:12px;border:none;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 4px 16px rgba(10,102,183,.3);z-index:99}
.pbtn:hover{background:#07579e}
</style></head><body>
<button class="pbtn no-print" onclick="window.print()">🖨 Imprimir / PDF</button>

<div class="cover">
  <div class="logo">CIC</div>
  <div class="subtitle">Central de Inteligência · Confiança</div>
  <div class="big">${players.length}</div>
  <div class="subtitle">Atleta${players.length!==1?'s':''} na Lista Final</div>
  <div class="date">Gerado em ${now}</div>
</div>

<div class="summary pb">
  <h2>Resumo Executivo</h2>
  <div class="sgrid">
    <div class="scard"><div class="snum g">${countRec(s=>s==='CONTRATACAO')}</div><div class="slbl">Contratação</div></div>
    <div class="scard"><div class="snum a">${countRec(s=>s.includes('MONITOR'))}</div><div class="slbl">Monitorar</div></div>
    <div class="scard"><div class="snum r">${countRec(s=>s.includes('NAO'))}</div><div class="slbl">Não contratação</div></div>
  </div>
</div>

<div class="players">
  ${players.map(p => {
    const irc = parseFloat(p.irc_final||0)
    const color = recColor(p.recomendacao)
    const verd = p.veredicto ? p.veredicto.slice(0,200)+(p.veredicto.length>200?'…':'') : ''
    return `<div class="card">
      <div class="ch">
        <div>
          <div class="cn">${p.jogador||'—'}</div>
          <div class="cs">${[p.clube,p.posicao,p.idade?`${p.idade} anos`:''].filter(Boolean).join(' · ')}</div>
          <span class="rec" style="background:${color}">${p.recomendacao||'—'}</span>
        </div>
        ${irc?`<div class="ircb"><div class="ircn" style="color:${color}">${irc.toFixed(1)}</div><div class="ircl">${p.irc_classificacao||'IRC'}</div></div>`:''}
      </div>
      <div class="sc">
        ${[['Histórico',p.historico_score],['Nível Comp.',p.nivel_competicao],['Adequação',p.adequacao_modelo]].map(([l,v])=>
          `<div class="si"><div class="ss">${stars(v)}</div><div class="sl">${l}</div></div>`).join('')}
      </div>
      ${(p.perfil_tags||[]).length?`<div class="tags">${p.perfil_tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>`:''}
      ${verd?`<div class="verd"><strong>Veredicto:</strong> ${verd}</div>`:''}
    </div>`
  }).join('')}
</div>
<div class="footer">CIC — Central de Inteligência do Confiança · ${now} · Confidencial</div>
</body></html>`

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
