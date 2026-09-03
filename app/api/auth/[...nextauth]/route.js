import crypto from 'node:crypto'
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getAuthUsers } from '@/lib/auth-config'

function safeEqual(value, expected) {
  const left = Buffer.from(String(value || ''), 'utf8')
  const right = Buffer.from(String(expected || ''), 'utf8')
  if (!left.length || left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

const handler = NextAuth({
  providers: [CredentialsProvider({
    name: 'credentials',
    credentials: {
      email: { label: 'E-mail', type: 'email' },
      password: { label: 'Senha', type: 'password' },
    },
    async authorize(credentials) {
      const email = String(credentials?.email || '').trim().toLowerCase()
      const candidate = getAuthUsers().find(user => user.email === email)
      if (!candidate?.password || !safeEqual(credentials?.password, candidate.password)) return null

      return {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        role: candidate.role,
        modules: candidate.modules,
        readOnly: candidate.readOnly,
      }
    },
  })],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.modules = user.modules
        token.readOnly = user.readOnly
      }
      return token
    },
    async session({ session, token }) {
      if (token && session?.user) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.modules = token.modules || []
        session.user.readOnly = Boolean(token.readOnly)
      }
      return session
    },
  },
})

export { handler as GET, handler as POST }
