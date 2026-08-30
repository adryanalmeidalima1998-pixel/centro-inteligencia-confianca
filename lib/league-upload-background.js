import { after } from 'next/server'
import { recordImportLog, runScoutingAutomation } from '@/lib/scouting-automation'
import { syncPlayerSourceBatch } from '@/app/lib/playerMaster'

/**
 * Executa o processamento pesado somente depois de a resposta do upload ter
 * sido enviada ao navegador. Assim a gravação da planilha não fica bloqueada
 * por ficha-mãe, logs e recálculo do dashboard.
 */
export function scheduleLeagueUploadProcessing({
  players = [],
  provider,
  leagueSlug,
  filename,
  sheetName,
  rowsEligible = 0,
  clubs = 0,
  recognizedHeaders = 0,
  warnings = [],
  validation = {},
}) {
  after(async () => {
    const [masterResult, logResult] = await Promise.allSettled([
      syncPlayerSourceBatch({ players, provider, leagueSlug }),
      recordImportLog({
        provider,
        sourceType: 'market',
        leagueSlug,
        filename,
        sheetName,
        rowsProcessed: players.length,
        rowsEligible,
        clubs,
        recognizedHeaders,
        warnings,
        validation,
      }),
    ])

    if (masterResult.status === 'rejected') {
      console.error(`[${provider}-post-upload][player-master]`, masterResult.reason)
    }
    if (logResult.status === 'rejected') {
      console.error(`[${provider}-post-upload][import-log]`, logResult.reason)
    }

    try {
      await runScoutingAutomation({ trigger: `upload-${provider}`, triggerRef: leagueSlug })
    } catch (error) {
      // O upload e a ficha-mãe continuam válidos. O cron diário recompõe o
      // dashboard caso o recálculo completo exceda o limite da função.
      console.error(`[${provider}-post-upload][automation]`, error)
    }
  })
}
