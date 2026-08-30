import './globals.css'
import Providers from './providers'
import Script from 'next/script'
export const metadata={
 title:'Centro de Inteligência · Confiança',
 description:'Centro de Inteligência da Associação Desportiva Confiança',
 manifest:'/manifest.json',
}
export const viewport={themeColor:'#0a66b7',width:'device-width',initialScale:1}
export default function RootLayout({children}){return <html lang="pt-BR"><head><link rel="icon" href="/confianca.svg"/><link rel="apple-touch-icon" href="/confianca.png"/><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet"/></head><body><Providers>{children}</Providers><Script src="/register-sw.js" strategy="afterInteractive"/></body></html>}
