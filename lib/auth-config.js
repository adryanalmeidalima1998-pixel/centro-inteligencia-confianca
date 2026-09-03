/**
 * Configuração central dos perfis de acesso.
 *
 * Senhas nunca possuem fallback embutido no código. Em desenvolvimento, copie
 * .env.local.example para .env.local e configure credenciais locais.
 */

const DEFAULT_EMAILS = {
  admin: 'inteligencia@adconfianca.com.br',
  scouting: 'scouting@adconfianca.com.br',
  corpoTecnico: 'corpotecnico@adconfianca.com.br',
  diretoria: 'diretoria@adconfianca.com.br',
}

export function getAuthUsers() {
  const sharedPassword = String(process.env.AUTH_PASSWORD || '')
  return [
    {
      id: 'admin-1',
      name: 'Centro de Inteligência',
      email: String(process.env.AUTH_EMAIL || DEFAULT_EMAILS.admin).trim().toLowerCase(),
      password: sharedPassword,
      role: 'admin',
      modules: ['scouting', 'corpo-tecnico'],
      readOnly: false,
    },
    {
      id: 'scouting-1',
      name: 'Departamento de Mercado',
      email: String(process.env.SCOUTING_EMAIL || DEFAULT_EMAILS.scouting).trim().toLowerCase(),
      password: String(process.env.SCOUTING_PASSWORD || sharedPassword),
      role: 'scouting',
      modules: ['scouting'],
      readOnly: false,
    },
    {
      id: 'corpo-1',
      name: 'Corpo Técnico',
      email: String(process.env.CORPO_TECNICO_EMAIL || DEFAULT_EMAILS.corpoTecnico).trim().toLowerCase(),
      password: String(process.env.CORPO_TECNICO_PASSWORD || sharedPassword),
      role: 'corpo_tecnico',
      modules: ['corpo-tecnico'],
      readOnly: false,
    },
    {
      id: 'diretoria-1',
      name: 'Diretoria',
      email: String(process.env.DIRETORIA_EMAIL || DEFAULT_EMAILS.diretoria).trim().toLowerCase(),
      password: String(process.env.DIRETORIA_PASSWORD || sharedPassword),
      role: 'diretoria',
      modules: ['scouting', 'corpo-tecnico'],
      readOnly: true,
    },
  ]
}

export function missingAuthVariables() {
  const missing = []
  if (!process.env.NEXTAUTH_SECRET) missing.push('NEXTAUTH_SECRET')
  const users = getAuthUsers()
  if (!users.some(user => user.password)) missing.push('AUTH_PASSWORD ou senhas por perfil')
  return missing
}
