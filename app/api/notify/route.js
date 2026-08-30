/**
 * /api/notify — hub central de notificações do CIC
 * POST { tipo, dados }
 * tipos: 'lista_final' | 'contrato_expirando' | 'convergencia'
 *
 * WhatsApp via CallMeBot (gratuito, pessoal):
 * Ativar: adicionar +34 644 61 91 19 à agenda e enviar:
 *   "I allow callmebot to send me messages"
 * Receberá o API key por WhatsApp. Copiar para CALLMEBOT_API_KEY.
 */

const RESEND_EMAIL   = 'adryanalmeidalima1998@gmail.com'
const WHATSAPP_PHONE = '5562982070504'

async function sendEmail({ subject, html }) {
  const key = process.env.RESEND_API_KEY
  if (!key) return { skipped: true, reason: 'RESEND_API_KEY não configurada' }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Centro de Inteligência · Confiança <onboarding@resend.dev>',
      to: [RESEND_EMAIL],
      subject,
      html,
    }),
  })
  const d = await res.json()
  return { ok: res.ok, id: d.id, error: d.message }
}

async function sendWhatsApp(message) {
  const apiKey = process.env.CALLMEBOT_API_KEY
  if (!apiKey) return { skipped: true, reason: 'CALLMEBOT_API_KEY não configurada' }
  const url = `https://api.callmebot.com/whatsapp.php?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(message)}&apikey=${apiKey}`
  try {
    const res = await fetch(url)
    const text = await res.text()
    return { ok: res.ok, response: text.slice(0, 200) }
  } catch(e) {
    return { ok: false, error: e.message }
  }
}

function emailWrap(conteudo) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f8fafc;padding:20px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#0a66b7;padding:18px 22px;display:flex;align-items:center;gap:10px">
      <div style="background:rgba(255,255,255,.15);width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#fff;flex-shrink:0">GFC</div>
      <div><p style="color:#fff;font-weight:700;font-size:15px;margin:0">CIC · Confiança</p><p style="color:#86efac;font-size:11px;margin:2px 0 0">Central de Inteligência Esportiva</p></div>
    </div>
    <div style="padding:20px 22px">${conteudo}</div>
    <div style="padding:12px 22px;background:#f8fafc;border-top:1px solid #f1f5f9;text-align:center">
      <p style="color:#94a3b8;font-size:11px;margin:0">CIC · Confiança · ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  </div></body></html>`
}

const BASE_URL = () => process.env.NEXTAUTH_URL || 'http://localhost:3000'

export async function POST(request) {
  try {
    const { tipo, dados } = await request.json()
    const results = {}

    if (tipo === 'lista_final') {
      const { jogador, clube, posicao, recomendacao, irc_final } = dados
      const recColor = (r) => {
        const s = (r||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        if (s.includes('CONTRAT')) return '#0a66b7'
        if (s.includes('NAO') || s.includes('NÃO')) return '#ef4444'
        return '#f59e0b'
      }
      const emailHtml = emailWrap(`
        <p style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 4px">📋 Novo relatório na Lista Final</p>
        <p style="font-size:12px;color:#64748b;margin:0 0 16px">Um relatório CIC foi importado e está disponível para revisão.</p>
        <div style="background:#f8fafc;border-radius:10px;padding:14px 16px;margin-bottom:16px;border:1px solid #e2e8f0">
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <tr><td style="color:#94a3b8;padding:3px 0;width:90px">Atleta</td><td style="font-weight:700;color:#0f172a">${jogador||'—'}</td></tr>
            <tr><td style="color:#94a3b8;padding:3px 0">Clube</td><td style="color:#334155">${clube||'—'}</td></tr>
            <tr><td style="color:#94a3b8;padding:3px 0">Posição</td><td style="color:#334155">${posicao||'—'}</td></tr>
            <tr><td style="color:#94a3b8;padding:3px 0">IRC</td><td style="font-weight:700;color:#0a66b7;font-size:15px">${irc_final != null ? parseFloat(irc_final).toFixed(1) : '—'}</td></tr>
            <tr><td style="color:#94a3b8;padding:3px 0">Recomendação</td>
              <td><span style="background:${recColor(recomendacao)};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px">${recomendacao||'—'}</span></td>
            </tr>
          </table>
        </div>
        <a href="${BASE_URL()}/lista-final" style="display:inline-block;background:#0a66b7;color:#fff;font-weight:700;font-size:12px;padding:9px 18px;border-radius:8px;text-decoration:none">Ver Lista Final →</a>`)
      const zap = `📋 *CIC · Lista Final*\n\nNovo relatório importado:\n\n*${jogador||'—'}*\nClube: ${clube||'—'}\nPosição: ${posicao||'—'}\nIRC: ${irc_final != null ? parseFloat(irc_final).toFixed(1) : '—'}\nRecomendação: *${recomendacao||'—'}*\n\n🔗 ${BASE_URL()}/lista-final`
      results.email    = await sendEmail({ subject: `📋 CIC · Novo relatório: ${jogador||'—'}`, html: emailHtml })
      results.whatsapp = await sendWhatsApp(zap)
    }

    else if (tipo === 'contrato_expirando') {
      const { atletas } = dados
      if (!atletas?.length) return Response.json({ skipped: true })
      const rows = atletas.slice(0,15).map(a =>
        `<tr><td style="padding:6px 9px;border-bottom:1px solid #f1f5f9;font-weight:600;font-size:11px">${a.jogador}</td><td style="padding:6px 9px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:11px">${a.clube}</td><td style="padding:6px 9px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:11px">${a.posicao}</td><td style="padding:6px 9px;border-bottom:1px solid #f1f5f9;color:#ef4444;font-weight:700;font-size:11px">${a.expira}</td></tr>`
      ).join('')
      const emailHtml = emailWrap(`
        <p style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 4px">⏰ Contratos expirando em 30 dias</p>
        <p style="font-size:12px;color:#64748b;margin:0 0 14px"><strong style="color:#ef4444">${atletas.length} atleta${atletas.length!==1?'s':''}</strong> com janela de oportunidade aberta.</p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f8fafc">
            <th style="padding:6px 9px;text-align:left;color:#94a3b8;font-size:9px;text-transform:uppercase">Atleta</th>
            <th style="padding:6px 9px;text-align:left;color:#94a3b8;font-size:9px;text-transform:uppercase">Clube</th>
            <th style="padding:6px 9px;text-align:left;color:#94a3b8;font-size:9px;text-transform:uppercase">Posição</th>
            <th style="padding:6px 9px;text-align:left;color:#94a3b8;font-size:9px;text-transform:uppercase">Expira</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${atletas.length > 15 ? `<p style="color:#94a3b8;font-size:11px;margin:8px 0 0">+${atletas.length-15} outros</p>` : ''}
        <div style="margin-top:14px"><a href="${BASE_URL()}/mercado?janela=6" style="display:inline-block;background:#0a66b7;color:#fff;font-weight:700;font-size:12px;padding:9px 18px;border-radius:8px;text-decoration:none">Ver no Mercado →</a></div>`)
      const zapList = atletas.slice(0,5).map(a => `• ${a.jogador} (${a.clube}) — ${a.expira}`).join('\n')
      const zap = `⏰ *CIC · Contratos Expirando*\n\n${atletas.length} atleta${atletas.length!==1?'s':''} com contrato em até 30 dias:\n\n${zapList}${atletas.length>5?`\n... e mais ${atletas.length-5}`:''}\n\n🔗 ${BASE_URL()}/mercado`
      results.email    = await sendEmail({ subject: `⏰ CIC · ${atletas.length} contrato${atletas.length!==1?'s':''} expirando`, html: emailHtml })
      results.whatsapp = await sendWhatsApp(zap)
    }

    else if (tipo === 'convergencia') {
      const { atletas } = dados
      if (!atletas?.length) return Response.json({ skipped: true })
      const emailHtml = emailWrap(`
        <p style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 4px">🎯 Convergência de Scouts</p>
        <p style="font-size:12px;color:#64748b;margin:0 0 14px">${atletas.length} atleta${atletas.length!==1?'s foram':'foi'} mencionado${atletas.length!==1?'s':''} por múltiplos scouts.</p>
        <div style="background:#f0fdf4;border-radius:10px;padding:14px 16px;border:1px solid #bbf7d0">
          ${atletas.map(a => `<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #dcfce7">
            <p style="font-size:12px;font-weight:700;color:#0f172a;margin:0">${a.nome}</p>
            <p style="font-size:11px;color:#166534;margin:2px 0 0">Scouts: ${a.scouts.join(' · ')} · ${a.count} menções</p>
          </div>`).join('')}
        </div>
        <div style="margin-top:14px"><a href="${BASE_URL()}/lista-preferencial" style="display:inline-block;background:#0a66b7;color:#fff;font-weight:700;font-size:12px;padding:9px 18px;border-radius:8px;text-decoration:none">Adicionar à Lista Preferencial →</a></div>`)
      const zapList = atletas.map(a => `• ${a.nome} (${a.scouts.join('+')} — ${a.count}x)`).join('\n')
      const zap = `🎯 *CIC · Convergência de Scouts*\n\n${atletas.length} atleta${atletas.length!==1?'s detectados':' detectado'}:\n\n${zapList}\n\n🔗 ${BASE_URL()}/lista-preferencial`
      results.email    = await sendEmail({ subject: `🎯 CIC · ${atletas.length} atleta${atletas.length!==1?'s com':'com'} convergência`, html: emailHtml })
      results.whatsapp = await sendWhatsApp(zap)
    }

    else if (tipo === 'jogo_monitoramento') {
      const { jogos } = dados
      if (!jogos?.length) return Response.json({ skipped: true })

      const rows = jogos.map(j => {
        const casa  = j.casa_fora === 'C' ? `<strong>${j.time}</strong> x ${j.adversario}` : `${j.adversario} x <strong>${j.time}</strong>`
        const local = j.casa_fora === 'C' ? '🏠 Casa' : '✈️ Fora'
        return `<tr>
          <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-weight:700;font-size:11px;color:#0f172a">${j.atleta}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#334155">${j.data_fmt}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#334155">${casa}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b">${local}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:10px;color:#94a3b8">${j.competicao||''}</td>
        </tr>`
      }).join('')

      const emailHtml = emailWrap(`
        <p style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 4px">👁 Jogos para Assistir esta Semana</p>
        <p style="font-size:12px;color:#64748b;margin:0 0 14px"><strong style="color:#0a66b7">${jogos.length} jogo${jogos.length!==1?'s':''}</strong> de atletas monitorados nos próximos 7 dias.</p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f8fafc">
            <th style="padding:6px 10px;text-align:left;color:#94a3b8;font-size:9px;text-transform:uppercase">Atleta</th>
            <th style="padding:6px 10px;text-align:left;color:#94a3b8;font-size:9px;text-transform:uppercase">Data</th>
            <th style="padding:6px 10px;text-align:left;color:#94a3b8;font-size:9px;text-transform:uppercase">Partida</th>
            <th style="padding:6px 10px;text-align:left;color:#94a3b8;font-size:9px;text-transform:uppercase">Local</th>
            <th style="padding:6px 10px;text-align:left;color:#94a3b8;font-size:9px;text-transform:uppercase">Competição</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:16px">
          <a href="${BASE_URL()}/monitoramento" style="display:inline-block;background:#0a66b7;color:#fff;font-weight:700;font-size:12px;padding:9px 18px;border-radius:8px;text-decoration:none">Ver Monitoramento →</a>
        </div>`)

      const zapLines = jogos.map(j => {
        const local = j.casa_fora === 'C' ? 'Casa' : 'Fora'
        return `• *${j.atleta}* — ${j.data_fmt} (${local})\n  ${j.time} x ${j.adversario}`
      }).join('\n')
      const zap = `👁 *CIC · Jogos para Assistir*\n\n${jogos.length} jogo${jogos.length!==1?'s':''} nos próximos 7 dias:\n\n${zapLines}\n\n🔗 ${BASE_URL()}/monitoramento`

      results.email    = await sendEmail({ subject: `👁 CIC · ${jogos.length} jogo${jogos.length!==1?'s':''} para monitorar esta semana`, html: emailHtml })
      results.whatsapp = await sendWhatsApp(zap)
    }

    return Response.json({ success: true, tipo, ...results })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
