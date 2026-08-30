import { useSession } from 'next-auth/react'

/**
 * Perfis do Centro de Inteligência do Confiança:
 *  admin         → acesso e edição nos dois módulos
 *  scouting      → edição completa no Departamento de Mercado
 *  corpo_tecnico → edição completa no Corpo Técnico
 *  diretoria     → acesso aos dois módulos em modo de leitura
 *
 * Perfis legados scout/comissao são mantidos apenas por compatibilidade
 * com registros antigos do CIG.
 */
export function canEditPage(role, page = null) {
  if (role === 'admin') return true
  if (role === 'scouting') return true
  if (role === 'corpo_tecnico') return true
  if (role === 'scout') return page === 'observacao'
  if (role === 'comissao') return page === 'observacao'
  if (role === 'diretoria') return false
  return false
}

export function isViewOnly(role) {
  return role === 'diretoria' || role === 'comissao'
}

export function usePermissions(page = null) {
  const { data: session } = useSession()
  const role = session?.user?.role || null
  return {
    role,
    canEdit: canEditPage(role, page),
    isViewOnly: isViewOnly(role),
  }
}
