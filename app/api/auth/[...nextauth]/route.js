import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

const password = process.env.AUTH_PASSWORD || 'confianca2026'
const USERS = [
  {
    id:'admin-1', name:'Centro de Inteligência', email:process.env.AUTH_EMAIL || 'inteligencia@adconfianca.com.br',
    password, role:'admin', modules:['scouting','corpo-tecnico'], readOnly:false,
  },
  {
    id:'scouting-1', name:'Departamento de Mercado', email:'scouting@adconfianca.com.br',
    password:process.env.SCOUTING_PASSWORD || password, role:'scouting', modules:['scouting'], readOnly:false,
  },
  {
    id:'corpo-1', name:'Corpo Técnico', email:'corpotecnico@adconfianca.com.br',
    password:process.env.CORPO_TECNICO_PASSWORD || password, role:'corpo_tecnico', modules:['corpo-tecnico'], readOnly:false,
  },
  {
    id:'diretoria-1', name:'Diretoria', email:'diretoria@adconfianca.com.br',
    password:process.env.DIRETORIA_PASSWORD || password, role:'diretoria', modules:['scouting','corpo-tecnico'], readOnly:true,
  },
]

const handler = NextAuth({
  providers:[CredentialsProvider({
    name:'credentials',
    credentials:{ email:{ label:'E-mail', type:'email' }, password:{ label:'Senha', type:'password' } },
    async authorize(credentials) {
      const email=String(credentials?.email||'').trim().toLowerCase()
      const user=USERS.find(u=>u.email.toLowerCase()===email && u.password===credentials?.password)
      if(!user) return null
      return { id:user.id, name:user.name, email:user.email, role:user.role, modules:user.modules, readOnly:user.readOnly }
    },
  })],
  pages:{ signIn:'/login' },
  session:{ strategy:'jwt', maxAge:60*60*12 },
  secret:process.env.NEXTAUTH_SECRET || 'centro-inteligencia-confianca-2026-change-in-prod',
  callbacks:{
    async jwt({ token, user }) {
      if(user){ token.id=user.id; token.role=user.role; token.modules=user.modules; token.readOnly=user.readOnly }
      return token
    },
    async session({ session, token }) {
      if(token && session?.user){
        session.user.id=token.id
        session.user.role=token.role
        session.user.modules=token.modules || []
        session.user.readOnly=Boolean(token.readOnly)
      }
      return session
    },
  },
})
export { handler as GET, handler as POST }
