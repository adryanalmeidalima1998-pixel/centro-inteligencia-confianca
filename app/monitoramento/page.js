'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import AppShell from '../components/layout/AppShell'
import { PLAYER_FOOT_OPTIONS, matchesPlayerFoot } from '@/data/player-foot'

const GFC  = '#0a66b7'
const GFC2 = '#eaf4fd'
const RED  = '#c62828'
const AMB  = '#b45309'
const BLUE = '#1565c0'

const NIVEL_COLORS = {
  'Monitorando': { bg:'#eaf4fd', color:'#0a66b7', border:'#b2dfca', dot:'#0a66b7' },
  'Interesse':   { bg:'#e3f2fd', color:'#1565c0', border:'#90caf9', dot:'#1565c0' },
  'Proposta':    { bg:'#fff3e0', color:'#b45309', border:'#ffcc80', dot:'#b45309' },
  'Descartado':  { bg:'#fce4ec', color:'#c62828', border:'#f48fb1', dot:'#c62828' },
}

const PAIS_FLAG = {
  // América do Sul
  'Brasil':'🇧🇷','Argentina':'🇦🇷','Colômbia':'🇨🇴','Uruguai':'🇺🇾','Chile':'🇨🇱',
  'Paraguai':'🇵🇾','Bolívia':'🇧🇴','Peru':'🇵🇪','Equador':'🇪🇨','Venezuela':'🇻🇪',
  'Suriname':'🇸🇷','Guiana':'🇬🇾',
  // América do Norte e Central
  'México':'🇲🇽','EUA':'🇺🇸','Canadá':'🇨🇦','Costa Rica':'🇨🇷','Honduras':'🇭🇳',
  'Guatemala':'🇬🇹','El Salvador':'🇸🇻','Panamá':'🇵🇦','Haiti':'🇭🇹','Jamaica':'🇯🇲',
  'Cuba':'🇨🇺','Trinidad e Tobago':'🇹🇹','República Dominicana':'🇩🇴',
  // Europa Ocidental
  'Portugal':'🇵🇹','Espanha':'🇪🇸','Itália':'🇮🇹','Alemanha':'🇩🇪','França':'🇫🇷',
  'Inglaterra':'🇬🇧','Holanda':'🇳🇱','Bélgica':'🇧🇪','Suíça':'🇨🇭','Áustria':'🇦🇹',
  'Irlanda':'🇮🇪','País de Gales':'🇬🇧','Grécia':'🇬🇷','Turquia':'🇹🇷','Luxemburgo':'🇱🇺',
  // Europa do Norte
  'Dinamarca':'🇩🇰','Suécia':'🇸🇪','Noruega':'🇳🇴','Finlândia':'🇫🇮','Islândia':'🇮🇸',
  // Europa do Leste e Balcãs
  'Croácia':'🇭🇷','Sérvia':'🇷🇸','Romênia':'🇷🇴','Polônia':'🇵🇱','República Checa':'🇨🇿',
  'Hungria':'🇭🇺','Bulgária':'🇧🇬','Ucrânia':'🇺🇦','Rússia':'🇷🇺','Eslováquia':'🇸🇰',
  'Eslovênia':'🇸🇮','Bósnia e Herzegovina':'🇧🇦','Albânia':'🇦🇱','Kosovo':'🇽🇰',
  'Montenegro':'🇲🇪','Macedônia do Norte':'🇲🇰','Moldova':'🇲🇩','Belarus':'🇧🇾',
  'Geórgia':'🇬🇪','Armênia':'🇦🇲','Azerbaijão':'🇦🇿','Cazaquistão':'🇰🇿',
  'Estônia':'🇪🇪','Letônia':'🇱🇻','Lituânia':'🇱🇹',
  // Mediterrâneo e Oriente Médio
  'Israel':'🇮🇱','Chipre':'🇨🇾','Malta':'🇲🇹','Arábia Saudita':'🇸🇦',
  'Emirados Árabes':'🇦🇪','Catar':'🇶🇦','Kuwait':'🇰🇼','Bahrein':'🇧🇭',
  'Iraque':'🇮🇶','Irã':'🇮🇷','Jordânia':'🇯🇴','Omã':'🇴🇲','Síria':'🇸🇾',
  'Líbano':'🇱🇧','Palestina':'🇵🇸','Iêmen':'🇾🇪',
  // Ásia
  'Japão':'🇯🇵','Coreia do Sul':'🇰🇷','Coreia do Norte':'🇰🇵','China':'🇨🇳',
  'Indonésia':'🇮🇩','Tailândia':'🇹🇭','Malásia':'🇲🇾','Vietnam':'🇻🇳',
  'Filipinas':'🇵🇭','Singapura':'🇸🇬','Camboja':'🇰🇭','Myanmar':'🇲🇲',
  'Índia':'🇮🇳','Bangladesh':'🇧🇩','Paquistão':'🇵🇰','Sri Lanka':'🇱🇰',
  'Nepal':'🇳🇵','Uzbequistão':'🇺🇿','Quirguistão':'🇰🇬','Tajiquistão':'🇹🇯',
  'Turcomenistão':'🇹🇲','Afeganistão':'🇦🇫','Hong Kong':'🇭🇰','Macau':'🇲🇴',
  'Mongólia':'🇲🇳','Laos':'🇱🇦',
  // África
  'Egito':'🇪🇬','Marrocos':'🇲🇦','Argélia':'🇩🇿','Tunísia':'🇹🇳','Líbia':'🇱🇾',
  'Gana':'🇬🇭','Nigéria':'🇳🇬','Costa do Marfim':'🇨🇮','Senegal':'🇸🇳',
  'Camarões':'🇨🇲','África do Sul':'🇿🇦','Quênia':'🇰🇪','Etiópia':'🇪🇹',
  'Angola':'🇦🇴','Moçambique':'🇲🇿','Tanzânia':'🇹🇿','Uganda':'🇺🇬',
  'Zâmbia':'🇿🇲','Zimbabwe':'🇿🇼','Mali':'🇲🇱','Burkina Faso':'🇧🇫',
  'Guiné':'🇬🇳','Congo':'🇨🇬','RD Congo':'🇨🇩','Ruanda':'🇷🇼',
  'Sudão':'🇸🇩','Gabão':'🇬🇦','Serra Leoa':'🇸🇱','Libéria':'🇱🇷',
  // Oceania
  'Austrália':'🇦🇺','Nova Zelândia':'🇳🇿','Papua-Nova Guiné':'🇵🇬',
}
const getFlag = p => p ? (PAIS_FLAG[p] || '🌐') : ''

// Mapeia nome PT do país para nome EN do COUNTRY_XY do WorldMap
const PAIS_TO_COUNTRY = {
  // América do Sul
  'Brasil':'Brazil','Argentina':'Argentina','Colômbia':'Colombia','Uruguai':'Uruguay',
  'Chile':'Chile','Paraguai':'Paraguay','Bolívia':'Bolivia','Peru':'Peru',
  'Equador':'Ecuador','Venezuela':'Venezuela','Suriname':'Suriname','Guiana':'Guyana',
  // América do Norte e Central
  'México':'Mexico','EUA':'USA','Canadá':'Canada','Costa Rica':'Costa Rica',
  'Honduras':'Honduras','Guatemala':'Guatemala','El Salvador':'El Salvador',
  'Panamá':'Panama','Haiti':'Haiti','Jamaica':'Jamaica','Cuba':'Cuba',
  'Trinidad e Tobago':'Trinidad and Tobago','República Dominicana':'Dominican Republic',
  // Europa Ocidental
  'Portugal':'Portugal','Espanha':'Spain','Itália':'Italy','Alemanha':'Germany',
  'França':'France','Inglaterra':'England','Holanda':'Netherlands','Bélgica':'Belgium',
  'Suíça':'Switzerland','Áustria':'Austria','Irlanda':'Ireland','País de Gales':'Wales',
  'Grécia':'Greece','Turquia':'Turkey','Luxemburgo':'Luxembourg',
  // Europa do Norte
  'Dinamarca':'Denmark','Suécia':'Sweden','Noruega':'Norway','Finlândia':'Finland','Islândia':'Iceland',
  // Europa do Leste e Balcãs
  'Croácia':'Croatia','Sérvia':'Serbia','Romênia':'Romania','Polônia':'Poland',
  'República Checa':'Czech Republic','Hungria':'Hungary','Bulgária':'Bulgaria',
  'Ucrânia':'Ukraine','Rússia':'Russia','Eslováquia':'Slovakia','Eslovênia':'Slovenia',
  'Bósnia e Herzegovina':'Bosnia and Herzegovina','Albânia':'Albania','Kosovo':'Kosovo',
  'Montenegro':'Montenegro','Macedônia do Norte':'North Macedonia','Moldova':'Moldova',
  'Belarus':'Belarus','Geórgia':'Georgia','Armênia':'Armenia','Azerbaijão':'Azerbaijan',
  'Cazaquistão':'Kazakhstan','Estônia':'Estonia','Letônia':'Latvia','Lituânia':'Lithuania',
  // Oriente Médio
  'Israel':'Israel','Chipre':'Cyprus','Malta':'Malta','Arábia Saudita':'Saudi Arabia',
  'Emirados Árabes':'United Arab Emirates','Catar':'Qatar','Kuwait':'Kuwait',
  'Bahrein':'Bahrain','Iraque':'Iraq','Irã':'Iran','Jordânia':'Jordan',
  'Omã':'Oman','Síria':'Syria','Líbano':'Lebanon','Palestina':'Palestine','Iêmen':'Yemen',
  // Ásia
  'Japão':'Japan','Coreia do Sul':'South Korea','Coreia do Norte':'North Korea',
  'China':'China','Indonésia':'Indonesia','Tailândia':'Thailand','Malásia':'Malaysia',
  'Vietnam':'Vietnam','Filipinas':'Philippines','Singapura':'Singapore',
  'Camboja':'Cambodia','Myanmar':'Myanmar','Índia':'India','Bangladesh':'Bangladesh',
  'Paquistão':'Pakistan','Sri Lanka':'Sri Lanka','Nepal':'Nepal',
  'Uzbequistão':'Uzbekistan','Quirguistão':'Kyrgyzstan','Tajiquistão':'Tajikistan',
  'Turcomenistão':'Turkmenistan','Afeganistão':'Afghanistan',
  'Hong Kong':'Hong Kong','Macau':'Macao','Mongólia':'Mongolia','Laos':'Laos',
  // África
  'Egito':'Egypt','Marrocos':'Morocco','Argélia':'Algeria','Tunísia':'Tunisia',
  'Líbia':'Libya','Gana':'Ghana','Nigéria':'Nigeria','Costa do Marfim':'Ivory Coast',
  'Senegal':'Senegal','Camarões':'Cameroon','África do Sul':'South Africa',
  'Quênia':'Kenya','Etiópia':'Ethiopia','Angola':'Angola','Moçambique':'Mozambique',
  'Tanzânia':'Tanzania','Uganda':'Uganda','Zâmbia':'Zambia','Zimbabwe':'Zimbabwe',
  'Mali':'Mali','Burkina Faso':'Burkina Faso','Guiné':'Guinea','Congo':'Congo',
  'RD Congo':'Democratic Republic of the Congo','Ruanda':'Rwanda','Sudão':'Sudan',
  'Gabão':'Gabon','Serra Leoa':'Sierra Leone','Libéria':'Liberia',
  // Oceania
  'Austrália':'Australia','Nova Zelândia':'New Zealand','Papua-Nova Guiné':'Papua New Guinea',
}

const SVG_W = 1009.67
const SVG_H = 665.96

const COUNTRY_XY = {
  // América do Sul
  'Argentina':[295,535],'Bolivia':[280,480],'Brazil':[320,470],'Chile':[275,540],
  'Colombia':[245,415],'Ecuador':[228,430],'Guyana':[292,415],'Paraguay':[295,500],
  'Peru':[250,455],'Suriname':[305,418],'Uruguay':[320,545],'Venezuela':[265,390],
  // América do Norte e Central
  'Canada':[130,220],'Cuba':[248,390],'Dominican Republic':[275,395],
  'El Salvador':[213,405],'Guatemala':[210,400],'Haiti':[263,393],
  'Honduras':[225,400],'Jamaica':[255,400],'Mexico':[185,370],
  'Panama':[233,420],'Trinidad and Tobago':[298,420],'USA':[160,290],
  // Europa Ocidental
  'Austria':[515,280],'Belgium':[490,268],'England':[470,270],'France':[483,300],
  'Germany':[505,270],'Greece':[545,332],'Ireland':[452,268],'Italy':[510,320],
  'Luxembourg':[497,275],'Malta':[518,340],'Netherlands':[493,260],
  'Portugal':[430,340],'Spain':[455,335],'Switzerland':[500,288],'Turkey':[580,310],
  'Wales':[463,270],
  // Europa do Norte
  'Denmark':[497,248],'Finland':[545,230],'Iceland':[418,215],
  'Norway':[503,225],'Sweden':[520,230],
  // Europa do Leste e Balcãs
  'Albania':[533,322],'Armenia':[607,313],'Azerbaijan':[620,308],
  'Belarus':[555,257],'Bosnia and Herzegovina':[522,310],'Bulgaria':[553,313],
  'Croatia':[522,295],'Czech Republic':[520,278],'Estonia':[550,237],
  'Georgia':[610,303],'Hungary':[532,285],'Kazakhstan':[668,285],
  'Kosovo':[537,315],'Latvia':[547,245],'Lithuania':[545,252],
  'Moldova':[558,290],'Montenegro':[528,315],'North Macedonia':[537,318],
  'Poland':[535,268],'Romania':[548,300],'Russia':[650,240],
  'Serbia':[535,310],'Slovakia':[530,280],'Slovenia':[515,288],
  'Ukraine':[560,273],
  // Oriente Médio
  'Bahrain':[622,385],'Cyprus':[568,325],'Iran':[638,340],'Iraq':[617,350],
  'Israel':[572,342],'Jordan':[578,348],'Kuwait':[617,366],'Lebanon':[572,335],
  'Oman':[643,400],'Palestine':[570,343],'Qatar':[625,388],
  'Saudi Arabia':[606,385],'Syria':[580,330],'United Arab Emirates':[633,389],
  'Yemen':[617,415],
  // Ásia
  'Afghanistan':[665,330],'Bangladesh':[742,382],'Cambodia':[775,420],
  'China':[780,320],'Hong Kong':[793,358],'India':[710,370],'Indonesia':[810,455],
  'Japan':[848,305],'Kyrgyzstan':[680,310],'Laos':[772,400],
  'Macao':[790,360],'Malaysia':[790,440],'Mongolia':[770,278],
  'Myanmar':[758,390],'Nepal':[722,360],'North Korea':[825,300],
  'Pakistan':[675,355],'Philippines':[830,405],'Singapore':[797,453],
  'South Korea':[828,318],'Sri Lanka':[715,420],'Tajikistan':[672,320],
  'Thailand':[770,405],'Turkmenistan':[650,315],'Uzbekistan':[660,308],
  'Vietnam':[793,395],
  // África
  'Algeria':[490,355],'Angola':[511,475],'Burkina Faso':[477,425],
  'Cameroon':[515,435],'Congo':[525,460],'Democratic Republic of the Congo':[540,465],
  'Egypt':[570,358],'Ethiopia':[580,430],'Gabon':[510,455],
  'Ghana':[472,435],'Guinea':[440,430],'Ivory Coast':[455,440],
  'Kenya':[582,455],'Liberia':[444,440],'Libya':[525,358],
  'Mali':[472,408],'Morocco':[455,355],'Mozambique':[570,500],
  'Nigeria':[498,430],'Rwanda':[568,462],'Senegal':[435,415],
  'Sierra Leone':[440,435],'South Africa':[540,535],
  'Sudan':[565,408],'Tanzania':[578,475],'Tunisia':[510,338],
  'Uganda':[570,455],'Zambia':[560,490],'Zimbabwe':[562,510],
  // Oceania
  'Australia':[845,510],'New Zealand':[920,545],'Papua New Guinea':[880,450],
}

function MonitoramentoWorldMap({ atletas }) {
  const [hovered,    setHovered]    = useState(null)
  const [selected,   setSelected]   = useState(null)
  const [svgContent, setSvgContent] = useState(null)

  useEffect(() => {
    fetch('/world.svg').then(r=>r.text()).then(text => {
      const m = text.match(/<svg[^>]*>([\s\S]*)<\/svg>/)
      setSvgContent(m ? m[1] : '')
    }).catch(()=>setSvgContent(''))
  }, [])

  // Agrupar por país da liga (em EN para achar no XY)
  const byCountry = useMemo(() => {
    const map = {}
    atletas.filter(a => a.nivel_interesse !== 'Descartado' && a.pais_liga).forEach(a => {
      const countryEN = PAIS_TO_COUNTRY[a.pais_liga] || a.pais_liga
      if (!map[countryEN]) map[countryEN] = { pais_pt: a.pais_liga, atletas: [] }
      // Evitar duplicatas
      if (!map[countryEN].atletas.find(x => x.id === a.id)) {
        map[countryEN].atletas.push(a)
      }
    })
    return map
  }, [atletas])

  const maxCount = useMemo(() => Math.max(1, ...Object.values(byCountry).map(g => g.atletas.length)), [byCountry])

  const dots = useMemo(() =>
    Object.entries(byCountry).map(([country, g]) => {
      const xy = COUNTRY_XY[country]
      if (!xy) return null
      const r = 10 + (g.atletas.length / maxCount) * 20
      return { country, pais_pt: g.pais_pt, atletas: g.atletas, x:xy[0], y:xy[1], r }
    }).filter(Boolean),
  [byCountry, maxCount])

  const hovDot = hovered ? dots.find(d => d.country === hovered) : null
  const selGroup = selected ? byCountry[selected] : null

  const NIVEL_CLS = {
    'Monitorando': { dot:'#0a66b7', bg:'#eaf4fd', color:'#0a66b7', border:'#b2dfca' },
    'Interesse':   { dot:'#1565c0', bg:'#e3f2fd', color:'#1565c0', border:'#90caf9' },
    'Proposta':    { dot:'#b45309', bg:'#fff3e0', color:'#b45309', border:'#ffcc80' },
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Legenda de paises */}
      {dots.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, background:'#fff', borderRadius:16, border:'1px solid #e8f0eb' }}>
          <p style={{ fontSize:32, marginBottom:10 }}>🌍</p>
          <p style={{ fontSize:13, fontWeight:700, color:'#52677e', marginBottom:6 }}>Nenhum país cadastrado</p>
          <p style={{ fontSize:11, color:'#94a3b8' }}>Adicione o "País da Liga" nos atletas monitorados para visualizar o mapa.</p>
        </div>
      ) : (
        <>
          {/* Header strip: países monitorados acima do mapa */}
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e8f0eb', padding:'14px 18px', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <p style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1.5px' }}>Países monitorados</p>
                <span style={{ fontSize:9, fontWeight:700, background:'#eaf4fd', color:'#0a66b7', border:'1px solid #b2dfca', borderRadius:20, padding:'1px 8px' }}>
                  {atletas.filter(a=>a.nivel_interesse!=='Descartado').length} atleta{atletas.filter(a=>a.nivel_interesse!=='Descartado').length!==1?'s':''}
                </span>
              </div>
              <span style={{ fontSize:9, color:'#94a3b8' }}>{dots.length} país{dots.length!==1?'es':''}</span>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {dots.sort((a,b)=>b.atletas.length-a.atletas.length).map(dot => (
                <div key={dot.country}
                  onClick={()=>setSelected(dot.country===selected?null:dot.country)}
                  style={{
                    display:'flex', alignItems:'center', gap:8, cursor:'pointer',
                    background: selected===dot.country ? '#f0fdf4' : '#f7fcf9',
                    border: selected===dot.country ? '1px solid #0a66b7' : '1px solid #e5edf5',
                    borderRadius:10, padding:'8px 12px', transition:'all 0.15s',
                  }}
                  onMouseEnter={e=>{ if(selected!==dot.country) e.currentTarget.style.borderColor='#94a3b8' }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor=selected===dot.country?'#0a66b7':'#e5edf5' }}>
                  <span style={{ fontSize:20 }}>{getFlag(dot.pais_pt)}</span>
                  <div>
                    <p style={{ fontSize:11, fontWeight:700, color:'#10233b' }}>{dot.pais_pt}</p>
                    <p style={{ fontSize:9, color:'#94a3b8' }}>
                      {[...new Set(dot.atletas.map(a=>a.liga).filter(Boolean))].join(', ')}
                    </p>
                  </div>
                  <span style={{ fontSize:14, fontWeight:900, color:'#0a66b7', fontFamily:"'Barlow Condensed',sans-serif", marginLeft:4 }}>
                    {dot.atletas.length}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Mapa */}
          <div style={{ background:'#e8f5ee', borderRadius:16, border:'1px solid #bfd8ea', overflow:'hidden', position:'relative' }}>
            <svg viewBox={'0 0 '+SVG_W+' '+SVG_H} style={{ width:'100%', display:'block' }} preserveAspectRatio="xMidYMid meet">
              <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="#ddf0e8"/>
              {svgContent && <g dangerouslySetInnerHTML={{ __html:svgContent }} />}
              <style>{'svg g path { fill: #b8d8c4 !important; stroke: #ffffff !important; stroke-width: 0.5px !important; }'}</style>

              {dots.map(dot => {
                const isHov = hovered === dot.country
                const isSel = selected === dot.country
                return (
                  <g key={dot.country} style={{ cursor:'pointer' }}
                    onMouseEnter={()=>setHovered(dot.country)}
                    onMouseLeave={()=>setHovered(null)}
                    onClick={()=>setSelected(dot.country === selected ? null : dot.country)}>
                    <circle cx={dot.x} cy={dot.y} r={dot.r+6}
                      fill="#0a66b7" fillOpacity={isHov||isSel ? 0.2 : 0.07}/>
                    <circle cx={dot.x} cy={dot.y} r={dot.r}
                      fill={isSel?'#064b82':isHov?'#0878c8':'#0a66b7'}
                      stroke="#fff" strokeWidth="2" fillOpacity={isHov||isSel?1:0.9}/>
                    <text x={dot.x} y={dot.y+4} textAnchor="middle"
                      fontSize={Math.max(9,Math.min(14,dot.r*0.7))}
                      fontWeight="900" fill="white" style={{ pointerEvents:'none' }}>
                      {dot.atletas.length}
                    </text>
                  </g>
                )
              })}

              {hovDot && (() => {
                const tipW=150, tipH=42
                const tipX = Math.min(SVG_W-tipW-5, Math.max(5, hovDot.x-tipW/2))
                const tipY = hovDot.y < SVG_H/2 ? hovDot.y+hovDot.r+10 : hovDot.y-hovDot.r-tipH-10
                return (
                  <g style={{ pointerEvents:'none' }}>
                    <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="7" fill="white" stroke="#c8e0d0" strokeWidth="1" style={{ filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.15))' }}/>
                    <text x={tipX+tipW/2} y={tipY+15} textAnchor="middle" fontSize="11" fontWeight="700" fill="#10233b">
                      {getFlag(hovDot.pais_pt)} {hovDot.pais_pt}
                    </text>
                    <text x={tipX+tipW/2} y={tipY+30} textAnchor="middle" fontSize="10" fill="#0a66b7">
                      {hovDot.atletas.length} atleta{hovDot.atletas.length!==1?'s':''}
                    </text>
                  </g>
                )
              })()}
            </svg>
            {svgContent === null && (
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#e8f5ee' }}>
                <div style={{ width:32, height:32, border:'3px solid #c8e6d4', borderTopColor:'#0a66b7', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
              </div>
            )}
          </div>

          {/* Painel de atletas ao clicar no país */}
          {selected && selGroup && (
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #0a66b7', overflow:'hidden' }}>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid #f4f8fc', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f0fdf4' }}>
                  <div>
                    <p style={{ fontSize:11, fontWeight:900, color:'#10233b' }}>
                      {getFlag(selGroup.pais_pt)} {selGroup.pais_pt}
                    </p>
                    <p style={{ fontSize:9, color:'#94a3b8', marginTop:1 }}>{selGroup.atletas.length} atleta{selGroup.atletas.length!==1?'s':''} monitorados</p>
                  </div>
                  <button onClick={()=>setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:18, lineHeight:1 }}>x</button>
                </div>
                <div>
                  {selGroup.atletas.map(a => {
                    const nc = NIVEL_CLS[a.nivel_interesse] || NIVEL_CLS['Monitorando']
                    const idade = a.data_nascimento ? Math.floor((Date.now()-new Date(a.data_nascimento))/(1000*60*60*24*365.25)) : null
                    return (
                      <a key={a.id} href={'/monitoramento/'+a.id}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom:'1px solid #f7fcf9', textDecoration:'none', cursor:'pointer' }}
                        onMouseEnter={e=>e.currentTarget.style.background='#f0fdf4'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        {a.foto_url
                          ? <img src={a.foto_url} style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(10,102,183,0.2)', flexShrink:0 }}/>
                          : <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(10,102,183,0.08)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16 }}>👤</div>
                        }
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:12, fontWeight:800, color:'#10233b', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {a.apelido || a.nome}
                          </p>
                          <p style={{ fontSize:10, color:'#64748b', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {a.posicao && <span style={{ marginRight:4, background:'#f4f8fc', borderRadius:3, padding:'0 4px', fontSize:9, fontWeight:600, color:'#10233b' }}>{a.posicao}</span>}
                            {a.time_atual}
                          </p>
                          {a.liga && <p style={{ fontSize:9, color:'#94a3b8' }}>{a.liga}</p>}
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3, flexShrink:0 }}>
                          {idade && <p style={{ fontSize:11, fontWeight:700, color:'#10233b' }}>{idade}a</p>}
                          <span style={{ fontSize:8, fontWeight:700, color:nc.color, background:nc.bg, border:'1px solid '+nc.border, borderRadius:4, padding:'1px 5px' }}>
                            {(a.nivel_interesse||'').toUpperCase()}
                          </span>
                        </div>
                      </a>
                    )
                  })}
                </div>
              </div>
            )}
        </>
      )}
    </div>
  )
}

function calcIdade(d) {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d)) / (1000*60*60*24*365.25))
}

function fmtContrato(s) {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d)) return s
  return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear()
}

function diasParaVencer(s) {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d)) return null
  return Math.round((d - Date.now()) / (1000*60*60*24))
}

function contratoColor(dias) {
  if (dias === null) return '#94a3b8'
  if (dias < 0)    return '#c62828'
  if (dias <= 90)  return '#c62828'
  if (dias <= 180) return '#b45309'
  return '#10233b'
}

/* ── Modal importar planilha manual (sem Wyscout) ─────────────── */
function ImportExcelModal({ onClose, onSaved }) {
  const [file,     setFile]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [erro,     setErro]     = useState(null)
  const [preview,  setPreview]  = useState(null)
  const inputRef = useRef(null)

  const handleFile = e => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setErro(null)
    setPreview(null)

    const reader = new FileReader()
    reader.onload = ev => {
      // Quick preview: just show filename and size
      setPreview({ nome: f.name, tamanho: (f.size / 1024).toFixed(1) + ' KB' })
    }
    reader.readAsDataURL(f)
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setErro(null)
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = ev => res(ev.target.result.split(',')[1])
        r.onerror = () => rej(new Error('Falha ao ler arquivo'))
        r.readAsDataURL(file)
      })

      const resp = await fetch('/api/import-excel-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: b64 }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Erro ao importar')
      onSaved(data)
    } catch (e) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  const box = {
    background: '#fff', borderRadius: 16, padding: 28, width: 480,
    boxShadow: '0 20px 60px rgba(10,102,183,0.2)',
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={box}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, paddingBottom:16, borderBottom:'1px solid #f4f8fc' }}>
          <div>
            <p style={{ fontSize:14, fontWeight:900, color:'#10233b' }}>Importar via Planilha</p>
            <p style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>Para atletas sem perfil no Wyscout</p>
          </div>
          <button onClick={onClose} style={{ background:'#f7fcf9', border:'1px solid #e5edf5', cursor:'pointer', fontSize:14, color:'#64748b', borderRadius:8, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        {/* Instrução */}
        <div style={{ background:'#f0fdf4', border:'1px solid #b2dfca', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:10, color:'#10233b', lineHeight:1.6 }}>
          <strong>Formato esperado da planilha:</strong><br />
          Coluna A: Nome Completo · B: Data de Nascimento · D: Nacionalidade · F: Posição · G: Pé Preferencial · H: Temporada · I: Clube · J: Competição · K–N: Jogos/Minutos/Gols/Assists · O–R: Dados por jogo
        </div>

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            border: '2px dashed ' + (file ? '#0a66b7' : '#bfd8ea'),
            borderRadius: 12, padding: '28px 20px', textAlign: 'center',
            cursor: 'pointer', background: file ? '#f0fdf4' : '#f7fcf9',
            transition: 'all 0.15s', marginBottom: 16,
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#0a66b7'}
          onMouseLeave={e => e.currentTarget.style.borderColor = file ? '#0a66b7' : '#bfd8ea'}
        >
          <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display:'none' }} />
          {preview ? (
            <div>
              <p style={{ fontSize:20, marginBottom:6 }}>📊</p>
              <p style={{ fontSize:12, fontWeight:700, color:'#10233b' }}>{preview.nome}</p>
              <p style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{preview.tamanho}</p>
              <p style={{ fontSize:9, color:'#0a66b7', marginTop:6, fontWeight:600 }}>Clique para trocar o arquivo</p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize:28, marginBottom:8 }}>📤</p>
              <p style={{ fontSize:11, fontWeight:700, color:'#10233b' }}>Clique para selecionar a planilha</p>
              <p style={{ fontSize:9, color:'#94a3b8', marginTop:4 }}>.xlsx ou .xls</p>
            </div>
          )}
        </div>

        {erro && (
          <div style={{ background:'#fce4ec', border:'1px solid #f48fb1', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:10, color:'#c62828' }}>
            ⚠ {erro}
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={!file || loading}
          style={{
            width:'100%', background: (!file || loading) ? '#bfd8ea' : '#0a66b7',
            color:'#fff', border:'none', borderRadius:10, padding:'12px',
            fontSize:12, fontWeight:700, cursor: (!file || loading) ? 'not-allowed' : 'pointer',
            fontFamily:'inherit', transition:'all 0.15s',
          }}
        >
          {loading ? 'Importando...' : '↑ Importar e Cadastrar Atleta'}
        </button>
      </div>
    </div>
  )
}

/* ── Modal OGol ────────────────────────────────────────────────── */
function OgolModal({ onClose, onSaved }) {
  const [texto,   setTexto]   = useState('')
  const [url,     setUrl]     = useState('')
  const [loading, setLoading] = useState(false)
  const [erro,    setErro]    = useState(null)
  const [atleta,  setAtleta]  = useState(null)
  const [nivel,   setNivel]   = useState('Monitorando')
  const [saving,  setSaving]  = useState(false)

  const processar = async () => {
    if (!texto.trim()) return
    setLoading(true)
    setErro(null)
    setAtleta(null)
    try {
      const res  = await fetch('/api/scrape-ogol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: texto.trim(), url: url.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao processar dados')
      setAtleta(data.atleta)
    } catch (e) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  const salvar = async () => {
    if (!atleta) return
    setSaving(true)
    setErro(null)
    try {
      const r = await fetch('/api/monitoramento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...atleta, nivel_interesse: nivel }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Erro ao salvar')
      onSaved(data)
    } catch (e) {
      setErro(e.message)
    } finally {
      setSaving(false)
    }
  }

  const idade = atleta?.data_nascimento
    ? Math.floor((Date.now() - new Date(atleta.data_nascimento)) / (1000 * 60 * 60 * 24 * 365.25))
    : null

  const lbl = { fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:4 }
  const inp = { width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid #e5edf5', fontSize:11, fontFamily:'inherit', background:'#fff', boxSizing:'border-box' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:18, width:'100%', maxWidth:560, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(10,102,183,0.2)' }}>

        {/* Header */}
        <div style={{ background:GFC, padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', borderRadius:'18px 18px 0 0' }}>
          <div>
            <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:3, color:'rgba(255,255,255,0.65)', marginBottom:2 }}>Cadastro via OGol</p>
            <h3 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:900, color:'#fff', textTransform:'uppercase' }}>Colar Dados do OGol</h3>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, color:'#fff', fontSize:18, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        <div style={{ padding:'22px 24px', display:'flex', flexDirection:'column', gap:14 }}>

          {/* Instruções */}
          <div style={{ background:'#f0fdf4', border:'1px solid #b2dfca', borderRadius:10, padding:'12px 14px' }}>
            <p style={{ fontSize:11, fontWeight:700, color:'#10233b', marginBottom:6 }}>Como usar:</p>
            <ol style={{ margin:0, paddingLeft:16, display:'flex', flexDirection:'column', gap:4 }}>
              {['Acesse a página do jogador no OGol',
                'Pressione Ctrl+A para selecionar tudo',
                'Pressione Ctrl+C para copiar',
                'Clique no campo abaixo e pressione Ctrl+V',
                'Clique em "Processar" — o sistema preenche os dados.'
              ].map((t, i) => (
                <li key={i} style={{ fontSize:10, color:'#52677e' }}>{t}</li>
              ))}
            </ol>
          </div>

          {/* Textarea para colar o texto */}
          <div>
            <label style={lbl}>Texto copiado da página do OGol (Ctrl+A → Ctrl+C → Ctrl+V)</label>
            <textarea
              value={texto}
              onChange={e => { setTexto(e.target.value); setAtleta(null); setErro(null) }}
              placeholder="Cole aqui o texto da página do OGol..."
              rows={6}
              style={{ ...inp, resize:'vertical', lineHeight:1.5 }}
            />
            {texto.trim().length > 0 && (
              <p style={{ fontSize:9, color:'#94a3b8', marginTop:3 }}>{texto.trim().length} caracteres copiados ✓</p>
            )}
          </div>

          {/* URL opcional */}
          <div>
            <label style={lbl}>Link do OGol (opcional — para salvar no perfil)</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.ogol.com.br/jogador/nome/id"
              style={inp}
            />
          </div>

          {/* Botão processar */}
          {!atleta && (
            <button
              onClick={processar}
              disabled={loading || texto.trim().length < 50}
              style={{ padding:'10px', borderRadius:9, border:'none', background: loading || texto.trim().length < 50 ? '#bfd8ea' : GFC, color:'#fff', fontSize:12, fontWeight:700, cursor: loading || texto.trim().length < 50 ? 'not-allowed' : 'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
            >
              {loading
                ? <><span style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }} /> Processando...</>
                : '✨ Processar dados'}
            </button>
          )}

          {/* Erro */}
          {erro && (
            <div style={{ background:'#fce4ec', border:'1px solid #f48fb1', borderRadius:8, padding:'10px 14px', fontSize:11, color:'#c62828' }}>
              ⚠ {erro}
            </div>
          )}

          {/* Preview do atleta */}
          {atleta && !loading && (
            <div style={{ border:'1.5px solid #b2dfca', borderRadius:14, overflow:'hidden' }}>

              {/* Card */}
              <div style={{ background:'#f0fdf4', padding:'16px 18px', display:'flex', gap:14, alignItems:'center' }}>
                <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(10,102,183,0.08)', border:'2px dashed rgba(10,102,183,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>👤</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:16, fontWeight:900, color:'#10233b', fontFamily:"'Barlow Condensed',sans-serif" }}>{atleta.apelido || atleta.nome}</p>
                  {atleta.apelido && atleta.nome !== atleta.apelido && <p style={{ fontSize:10, color:'#64748b' }}>{atleta.nome}</p>}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:6 }}>
                    {atleta.posicao      && <span style={{ fontSize:9, fontWeight:700, background:'#eaf4fd', color:GFC, border:'1px solid #b2dfca', borderRadius:5, padding:'2px 7px' }}>{atleta.posicao}</span>}
                    {atleta.posicao_secundaria && <span style={{ fontSize:9, fontWeight:700, background:'#f4f8fc', color:'#52677e', border:'1px solid #d6e5f0', borderRadius:5, padding:'2px 7px' }}>{atleta.posicao_secundaria}</span>}
                    {idade               && <span style={{ fontSize:9, fontWeight:700, background:'#f7fcf9', color:'#10233b', border:'1px solid #e5edf5', borderRadius:5, padding:'2px 7px' }}>{idade} anos</span>}
                    {atleta.pe_preferido && <span style={{ fontSize:9, fontWeight:700, background:'#f7fcf9', color:'#10233b', border:'1px solid #e5edf5', borderRadius:5, padding:'2px 7px' }}>🦶 {atleta.pe_preferido}</span>}
                    {atleta.altura       && <span style={{ fontSize:9, fontWeight:700, background:'#f7fcf9', color:'#10233b', border:'1px solid #e5edf5', borderRadius:5, padding:'2px 7px' }}>{atleta.altura}m</span>}
                  </div>
                </div>
              </div>

              {/* Dados do clube */}
              <div style={{ padding:'12px 18px', borderTop:'1px solid #d0ede0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, background:'#fff' }}>
                {[
                  ['Clube',         atleta.time_atual],
                  ['Liga',          atleta.liga],
                  ['País da Liga',  atleta.pais_liga     ? getFlag(atleta.pais_liga)     + ' ' + atleta.pais_liga     : null],
                  ['Nacionalidade', atleta.nacionalidade ? getFlag(atleta.nacionalidade) + ' ' + atleta.nacionalidade : null],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label}>
                    <p style={{ fontSize:8, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:2 }}>{label}</p>
                    <p style={{ fontSize:11, fontWeight:700, color:'#10233b' }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Nível de interesse */}
              <div style={{ padding:'12px 18px', borderTop:'1px solid #d0ede0', background:'#fff' }}>
                <label style={lbl}>Nível de interesse</label>
                <div style={{ display:'flex', gap:6 }}>
                  {Object.keys(NIVEL_COLORS).map(n => {
                    const c      = NIVEL_COLORS[n]
                    const active = nivel === n
                    return (
                      <button key={n} onClick={() => setNivel(n)} style={{ flex:1, padding:'7px 4px', borderRadius:8, border: active ? '1.5px solid ' + c.border : '1px solid #e5edf5', background: active ? c.bg : '#fff', color: active ? c.color : '#94a3b8', fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                        {n}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tentar de novo */}
              <div style={{ padding:'10px 18px', borderTop:'1px solid #d0ede0', background:'#f7fcf9' }}>
                <button onClick={() => { setAtleta(null); setErro(null) }} style={{ fontSize:9, color:'#94a3b8', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>
                  ← Tentar com outro texto
                </button>
              </div>
            </div>
          )}

          {/* Botões */}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button onClick={onClose} style={{ padding:'9px 18px', borderRadius:8, border:'1.5px solid #d6e5f0', background:'#fff', color:'#64748b', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              Cancelar
            </button>
            {atleta && (
              <button onClick={salvar} disabled={saving} style={{ padding:'9px 20px', borderRadius:8, border:'none', background: saving ? '#bfd8ea' : GFC, color:'#fff', fontSize:11, fontWeight:700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                {saving ? 'Salvando...' : '✓ Cadastrar Atleta'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Modal cadastro ────────────────────────────────────────────── */
function CadastroModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    nome:'', apelido:'', posicao:'', posicao_secundaria:'', nacionalidade:'',
    time_atual:'', liga:'', pais_liga:'', data_nascimento:'', data_contrato_fim:'',
    valor_mercado:'', nivel_interesse:'Monitorando', status:'Ativo'
  })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  const save = async () => {
    if (!form.nome.trim()) return alert('Informe o nome do atleta')
    setSaving(true)
    const r = await fetch('/api/monitoramento', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'create', ...form })
    })
    const data = await r.json()
    setSaving(false)
    onSaved(data)
  }

  const POSICOES = ['Goleiro','Lateral Direito','Lateral Esquerdo','Zagueiro','Volante','Meia','Meia Atacante','Ponta Direita','Ponta Esquerda','Atacante','Centroavante']
  const inp = { width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid #e5edf5', fontSize:11, fontFamily:'inherit', background:'#fff', boxSizing:'border-box' }
  const lbl = { fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:4 }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:28, width:540, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(10,102,183,0.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, paddingBottom:16, borderBottom:'1px solid #f4f8fc' }}>
          <div>
            <p style={{ fontSize:14, fontWeight:900, color:'#10233b' }}>Cadastrar Atleta</p>
            <p style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>Novo atleta em monitoramento</p>
          </div>
          <button onClick={onClose} style={{ background:'#f7fcf9', border:'1px solid #e5edf5', cursor:'pointer', fontSize:14, color:'#64748b', borderRadius:8, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center' }}>x</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {[
            ['Nome completo','nome','text'],['Como chamar','apelido','text'],
            ['Posicao principal','posicao','select'],['Posicao secundaria','posicao_secundaria','select'],
            ['Clube atual','time_atual','text'],['Liga','liga','text'],
            ['Pais da Liga','pais_liga','pais'],['Nacionalidade','nacionalidade','text'],
            ['Data de nascimento','data_nascimento','date'],['Termino contrato','data_contrato_fim','text'],
            ['Valor de mercado','valor_mercado','text'],['Nivel de interesse','nivel_interesse','ninteresse'],
            ['Status','status','status'],
          ].map(([label, key, type]) => (
            <div key={key} style={{ gridColumn: key==='nome' ? 'span 2' : 'span 1' }}>
              <label style={lbl}>{label}</label>
              {type==='select'     ? <select value={form[key]} onChange={e=>set(key,e.target.value)} style={inp}><option value="">Selecione</option>{POSICOES.map(p=><option key={p}>{p}</option>)}</select>
              : type==='pais'      ? <select value={form[key]} onChange={e=>set(key,e.target.value)} style={inp}><option value="">Selecione</option>{Object.keys(PAIS_FLAG).map(p=><option key={p} value={p}>{PAIS_FLAG[p]} {p}</option>)}</select>
              : type==='ninteresse'? <select value={form[key]} onChange={e=>set(key,e.target.value)} style={inp}>{Object.keys(NIVEL_COLORS).map(n=><option key={n}>{n}</option>)}</select>
              : type==='status'    ? <select value={form[key]} onChange={e=>set(key,e.target.value)} style={inp}><option>Ativo</option><option>Cedido</option><option>Inativo</option></select>
              : <input type={type} value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={label} style={inp} />}
            </div>
          ))}
        </div>
        <button onClick={save} disabled={saving} style={{ marginTop:20, width:'100%', background:'#0a66b7', color:'#fff', border:'none', borderRadius:10, padding:'12px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          {saving ? 'Salvando...' : '+ Cadastrar Atleta'}
        </button>
      </div>
    </div>
  )
}

/* ── Athlete card ─────────────────────────────────────────────── */
function AtletaCard({ atleta, onClick, onDelete, canEdit }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting,      setDeleting]      = useState(false)
  const idade  = calcIdade(atleta.data_nascimento)
  const nivel  = NIVEL_COLORS[atleta.nivel_interesse] || NIVEL_COLORS['Monitorando']
  const dias   = diasParaVencer(atleta.data_contrato_fim)
  const cColor = contratoColor(dias)
  const contratoLabel   = fmtContrato(atleta.data_contrato_fim)
  const contratoUrgente = dias !== null && dias <= 180

  return (
    <div onClick={onClick}
      style={{ background:'#fff', borderRadius:14, border:'1px solid #e8f0eb', padding:'0', cursor:'pointer', transition:'all 0.15s', overflow:'hidden', display:'flex' }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor='#0a66b7'; e.currentTarget.style.boxShadow='0 4px 20px rgba(10,102,183,0.10)' }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor='#e8f0eb'; e.currentTarget.style.boxShadow='none' }}>

      <div style={{ width:4, background:nivel.dot, flexShrink:0 }} />

      <div style={{ flex:1, padding:'14px 18px', display:'flex', alignItems:'center', gap:16 }}>

        {/* Foto */}
        <div style={{ flexShrink:0, position:'relative' }}>
          {atleta.foto_url
            ? <img src={atleta.foto_url} style={{ width:52, height:52, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(10,102,183,0.2)' }} />
            : <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(10,102,183,0.07)', border:'2px dashed rgba(10,102,183,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>👤</div>
          }
          <span style={{ position:'absolute', bottom:-2, right:-2, background:nivel.bg, border:'1px solid ' + nivel.border, borderRadius:'50%', width:14, height:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:nivel.dot, display:'block' }} />
          </span>
        </div>

        {/* Info */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
            <p style={{ fontSize:14, fontWeight:900, color:'#10233b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:"'Barlow Condensed',sans-serif" }}>
              {atleta.apelido || atleta.nome}
            </p>
            <span style={{ background:nivel.bg, color:nivel.color, border:'1px solid '+nivel.border, borderRadius:5, padding:'1px 6px', fontSize:8, fontWeight:700, flexShrink:0, letterSpacing:'0.5px' }}>
              {(atleta.nivel_interesse||'').toUpperCase()}
            </span>
          </div>
          <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:4 }}>
            {atleta.posicao && <span style={{ fontSize:10, fontWeight:600, color:'#10233b', background:'#f4f8fc', borderRadius:4, padding:'1px 6px' }}>{atleta.posicao}</span>}
            {atleta.time_atual && <span style={{ fontSize:10, color:'#64748b' }}>{atleta.time_atual}</span>}
            {atleta.liga && <><span style={{ fontSize:10, color:'#c0d8c4' }}>·</span><span style={{ fontSize:10, color:'#94a3b8' }}>{getFlag(atleta.pais_liga)} {atleta.liga}</span></>}
          </div>
        </div>

        {/* Metricas */}
        <div style={{ display:'flex', gap:20, flexShrink:0, alignItems:'center' }}>
          {idade && (
            <div style={{ textAlign:'center', minWidth:32 }}>
              <p style={{ fontSize:20, fontWeight:900, color:'#10233b', fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>{idade}</p>
              <p style={{ fontSize:8, color:'#94a3b8', textTransform:'uppercase' }}>anos</p>
            </div>
          )}
          {atleta.nacionalidade && (
            <div style={{ textAlign:'center', minWidth:50 }}>
              <p style={{ fontSize:11, fontWeight:700, color:'#10233b' }}>{atleta.nacionalidade}</p>
              <p style={{ fontSize:8, color:'#94a3b8', textTransform:'uppercase' }}>nação</p>
            </div>
          )}
          {contratoLabel && (
            <div style={{ textAlign:'center', minWidth:64, background: contratoUrgente ? cColor+'18' : 'transparent', borderRadius:8, padding: contratoUrgente ? '4px 8px' : '0', border: contratoUrgente ? '1px solid '+cColor+'40' : 'none' }}>
              <p style={{ fontSize:11, fontWeight:700, color:cColor }}>{contratoLabel}</p>
              <p style={{ fontSize:8, color: contratoUrgente ? cColor : '#94a3b8', textTransform:'uppercase' }}>
                {dias !== null && dias < 0 ? 'VENCIDO' : dias !== null && dias <= 90 ? dias+'d' : 'contrato'}
              </p>
            </div>
          )}
          {atleta.valor_mercado && atleta.valor_mercado !== '-' && (
            <div style={{ textAlign:'center', minWidth:48 }}>
              <p style={{ fontSize:11, fontWeight:700, color:'#0a66b7' }}>{atleta.valor_mercado}</p>
              <p style={{ fontSize:8, color:'#94a3b8', textTransform:'uppercase' }}>valor</p>
            </div>
          )}
          {/* External links icons */}
          <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'center', flexShrink:0 }} onClick={e => e.stopPropagation()}>
            {atleta.link_externo && (
              <a href={atleta.link_externo} target="_blank" rel="noopener noreferrer"
                title="Perfil (Transfermarkt / Ogol)"
                style={{ width:26, height:26, borderRadius:6, background:'#f4f8fc', border:'1px solid #c6e0cc', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none', flexShrink:0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a66b7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </a>
            )}
            {atleta.link_video && (
              <a href={atleta.link_video} target="_blank" rel="noopener noreferrer"
                title="Material de vídeo"
                style={{ width:26, height:26, borderRadius:6, background:'#fee2e2', border:'1px solid #fca5a5', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none', flexShrink:0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#dc2626">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                </svg>
              </a>
            )}
          </div>
          {/* Botão excluir */}
          {canEdit && (
            <div onClick={e => e.stopPropagation()} style={{ flexShrink:0 }}>
              {confirmDelete ? (
                <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'center' }}>
                  <span style={{ fontSize:9, fontWeight:700, color:'#c62828', whiteSpace:'nowrap' }}>Confirmar?</span>
                  <div style={{ display:'flex', gap:4 }}>
                    <button
                      onClick={async () => {
                        setDeleting(true)
                        await fetch('/api/monitoramento', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'delete', id: atleta.id }),
                        })
                        onDelete && onDelete(atleta.id)
                      }}
                      disabled={deleting}
                      style={{ fontSize:9, fontWeight:700, background:'#c62828', color:'#fff', border:'none', borderRadius:5, padding:'3px 8px', cursor:'pointer', fontFamily:'inherit' }}
                    >
                      {deleting ? '...' : 'Sim'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      style={{ fontSize:9, fontWeight:700, background:'#f4f8fc', color:'#64748b', border:'1px solid #e5edf5', borderRadius:5, padding:'3px 8px', cursor:'pointer', fontFamily:'inherit' }}
                    >
                      Não
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  title="Excluir atleta"
                  style={{ width:28, height:28, borderRadius:7, border:'1px solid #fecaca', background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              )}
            </div>
          )}
          <span style={{ fontSize:18, color:'#d6e5f0' }}>›</span>
        </div>
      </div>
    </div>
  )
}

/* ── Ligas panel ──────────────────────────────────────────────── */
function LigasPanel({ atletas }) {
  const ligas = useMemo(() => {
    const map = {}
    atletas.filter(a => a.nivel_interesse !== 'Descartado').forEach(a => {
      if (!a.liga) return
      if (!map[a.liga]) map[a.liga] = { liga:a.liga, pais:a.pais_liga, count:0 }
      map[a.liga].count++
    })
    return Object.values(map).sort((a,b) => b.count - a.count)
  }, [atletas])

  if (!ligas.length) return null

  return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e8f0eb', padding:'14px 18px', marginBottom:14 }}>
      <p style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:10 }}>Ligas monitoradas</p>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {ligas.map(l => (
          <div key={l.liga} style={{ display:'flex', alignItems:'center', gap:6, background:'#f7fcf9', border:'1px solid #e5edf5', borderRadius:8, padding:'6px 10px' }}>
            <span style={{ fontSize:14 }}>{getFlag(l.pais)}</span>
            <div>
              <p style={{ fontSize:10, fontWeight:700, color:'#10233b' }}>{l.liga}</p>
              <p style={{ fontSize:8, color:'#94a3b8' }}>{l.count} atleta{l.count>1?'s':''}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main ─────────────────────────────────────────────────────── */
export default function MonitoramentoPage() {
  const { data: session } = useSession()
  const canEdit = !['diretoria', 'comissao'].includes(session?.user?.role)

  const [atletas, setAtletas]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal,   setModal]       = useState(false)
  const [importModal, setImportModal] = useState(false)
  const [ogolModal,   setOgolModal]   = useState(false)
  const [search,  setSearch]      = useState('')
  const [filterNivel, setFilterNivel] = useState('all')
  const [filterPos,   setFilterPos]   = useState('Todas')
  const [filterPe,    setFilterPe]    = useState('')
  const [activeTab, setActiveTab] = useState('lista')

  useEffect(() => { loadAtletas() }, [])

  const loadAtletas = async () => {
    setLoading(true)
    const r = await fetch('/api/monitoramento')
    const d = await r.json()
    setAtletas(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  const handleDelete = (id) => {
    setAtletas(prev => prev.filter(a => a.id !== id))
  }

  const posicoes = useMemo(() =>
    ['Todas', ...new Set(atletas.map(a => a.posicao).filter(Boolean).sort())]
  , [atletas])

  const filtered = useMemo(() => atletas.filter(a => {
    const q = search.toLowerCase()
    const ok = !search || [a.nome,a.apelido,a.time_atual,a.liga,a.posicao].some(v=>(v||'').toLowerCase().includes(q))
    const nivelOk = filterNivel === 'all' || a.nivel_interesse === filterNivel
    const posOk   = filterPos === 'Todas' || (a.posicao||'') === filterPos
    const peOk    = !filterPe || matchesPlayerFoot(a, filterPe)
    return ok && nivelOk && posOk && peOk
  }), [atletas, search, filterNivel, filterPos, filterPe])

  const stats = useMemo(() => {
    const ativos = atletas.filter(a => a.nivel_interesse !== 'Descartado')
    const contratosUrgentes = ativos.filter(a => { const d = diasParaVencer(a.data_contrato_fim); return d !== null && d <= 180 }).length
    const idades = ativos.map(a=>calcIdade(a.data_nascimento)).filter(Boolean)
    const idadeMedia = idades.length ? Math.round(idades.reduce((s,v)=>s+v,0)/idades.length) : null
    return { total:atletas.length, ativos:ativos.length, contratosUrgentes, idadeMedia }
  }, [atletas])

  const NIVEIS = ['all', ...Object.keys(NIVEL_COLORS)]

  return (
    <AppShell>
      <div style={{ padding:'32px 40px', maxWidth:1160, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:22 }}>
          <div>
            <p style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'2px', marginBottom:6 }}>CIC · CONFIANÇA</p>
            <h1 style={{ fontSize:38, fontWeight:900, color:'#0a66b7', fontFamily:"'Barlow Condensed',sans-serif", textTransform:'uppercase', lineHeight:1 }}>
              Monitoramento
            </h1>
            <p style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>
              Série C 2026 · {loading ? '...' : stats.ativos + ' ativo' + (stats.ativos!==1?'s':'') + ' de ' + stats.total + ' cadastrado' + (stats.total!==1?'s':'')}
            </p>
          </div>
          {canEdit && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
              <button onClick={() => setModal(true)} style={{ background:'#0a66b7', color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                + Cadastrar Atleta
              </button>
              <button onClick={() => setImportModal(true)} style={{ background:'#fff', color:'#0a66b7', border:'1px solid #b2dfca', borderRadius:10, padding:'7px 16px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:13 }}>📤</span> Importar via Planilha
              </button>
              <button onClick={() => setOgolModal(true)} style={{ background:'#fff', color:'#0a66b7', border:'1px solid #b2dfca', borderRadius:10, padding:'7px 16px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:13 }}>⚽</span> Buscar por Link OGol
              </button>
              <button onClick={async () => {
                const jspdfMod = await import('jspdf')
                const jsPDF = jspdfMod.jsPDF ?? jspdfMod.default
                const autoTable = (await import('jspdf-autotable')).default
                const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' })
                const W=297, M=12
                const lista = filtered.filter(a => a.nivel_interesse !== 'Descartado')
                const hoje = new Date().toLocaleDateString('pt-BR')
                const filtroLabel = [
                  filterNivel !== 'all' ? filterNivel : null,
                  filterPos !== 'Todas' ? filterPos : null,
                  filterPe ? `Pé ${filterPe}` : null,
                ].filter(Boolean).join(' · ') || 'Todos'

                // Header
                doc.setFillColor(10,102,183); doc.rect(0,0,W,12,'F')
                doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold')
                doc.text('CIC · CONFIANÇA', M, 8)
                doc.text('MONITORAMENTO DE ATLETAS · SÉRIE C 2026', W-M, 8, {align:'right'})

                // Título
                doc.setTextColor(10,102,183); doc.setFontSize(18); doc.setFont('helvetica','bold')
                doc.text('MONITORAMENTO', M, 22)
                doc.setTextColor(100,116,139); doc.setFontSize(8); doc.setFont('helvetica','normal')
                doc.text(`${lista.length} atleta${lista.length!==1?'s':''} · Filtro: ${filtroLabel} · Gerado em ${hoje}`, M, 28)

                // Tabela
                autoTable(doc, {
                  startY: 34,
                  margin: { left: M, right: M },
                  head: [['Atleta', 'Posição', 'Clube', 'Liga / País', 'Idade', 'Altura', 'Nível', 'Contrato']],
                  body: lista.map(a => {
                    const idade = a.data_nascimento
                      ? Math.floor((Date.now()-new Date(a.data_nascimento))/(1000*60*60*24*365.25))
                      : (a.idade || '—')
                    return [
                      a.apelido || a.nome || '—',
                      a.posicao || '—',
                      a.time_atual || '—',
                      [a.liga, a.pais_liga].filter(Boolean).join(' · ') || '—',
                      idade,
                      a.altura ? `${a.altura}m` : '—',
                      a.nivel_interesse || '—',
                      a.data_contrato_fim || '—',
                    ]
                  }),
                  styles: { fontSize:8, cellPadding:3, font:'helvetica' },
                  headStyles: { fillColor:[10,102,183], textColor:[255,255,255], fontStyle:'bold', fontSize:8 },
                  alternateRowStyles: { fillColor:[240,253,244] },
                  columnStyles: {
                    0: { fontStyle:'bold', textColor:[10,102,183] },
                    6: { fontStyle:'bold' },
                  },
                })

                // Footer
                const total = doc.getNumberOfPages()
                for (let i=1; i<=total; i++) {
                  doc.setPage(i)
                  doc.setFillColor(10,102,183); doc.rect(0,200,W,10,'F')
                  doc.setTextColor(255,255,255); doc.setFontSize(7); doc.setFont('helvetica','normal')
                  doc.text('CIC · Confiança · Central de Inteligência Esportiva', M, 206)
                  doc.text(`Página ${i} / ${total}`, W-M, 206, {align:'right'})
                }

                doc.save(`CIC_Monitoramento_${hoje.replace(/\//g,'-')}.pdf`)
              }} style={{ background:'#fff', color:'#475569', border:'1px solid #e5edf5', borderRadius:10, padding:'7px 16px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width:13, height:13 }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                Exportar PDF
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:22, background:'#f4f8fc', borderRadius:12, padding:4, width:'fit-content' }}>
          {[
            { id:'lista', label:'Lista', icon:'👁' },
            { id:'mapa',  label:'Mapa Mundial', icon:'🌍' },
          ].map(tab => (
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
              padding:'7px 18px', fontSize:11, fontWeight:700, borderRadius:9, fontFamily:'inherit', cursor:'pointer', border:'none',
              background: activeTab===tab.id ? '#fff' : 'transparent',
              color: activeTab===tab.id ? '#0a66b7' : '#64748b',
              boxShadow: activeTab===tab.id ? '0 1px 6px rgba(10,102,183,0.12)' : 'none',
              transition:'all 0.15s', display:'flex', alignItems:'center', gap:6,
            }}>
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'mapa' ? (
          loading
            ? <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Carregando...</div>
            : <MonitoramentoWorldMap atletas={atletas} />
        ) : null}

        {activeTab === 'lista' && (
          <div>
        {!loading && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:14 }}>
            {[
              { label:'Monitorando',   value: atletas.filter(a=>a.nivel_interesse==='Monitorando').length, color:'#0a66b7' },
              { label:'Interesse',     value: atletas.filter(a=>a.nivel_interesse==='Interesse').length,   color:'#1565c0' },
              { label:'Proposta',      value: atletas.filter(a=>a.nivel_interesse==='Proposta').length,    color:'#b45309' },
              { label:'Contratos ≤ 6m', value: stats.contratosUrgentes, color: stats.contratosUrgentes > 0 ? '#c62828' : '#94a3b8' },
              { label:'Idade média',   value: stats.idadeMedia ? stats.idadeMedia+'a' : '--', color:'#10233b' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background:'#fff', borderRadius:12, border:'1px solid #e8f0eb', padding:'12px 16px' }}>
                <p style={{ fontSize:8, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:4 }}>{label}</p>
                <p style={{ fontSize:26, fontWeight:900, color, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Ligas */}
        {!loading && <LigasPanel atletas={atletas} />}

        {/* Filtros */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ flex:1, position:'relative', minWidth:220 }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'#94a3b8' }}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar atleta, clube, posicao..."
                style={{ width:'100%', padding:'9px 12px 9px 34px', borderRadius:10, border:'1px solid #e5edf5', fontSize:11, fontFamily:'inherit', outline:'none', boxSizing:'border-box', background:'#fff' }} />
            </div>
            <select value={filterPe} onChange={e=>setFilterPe(e.target.value)} style={{ padding:'8px 10px', borderRadius:9, border:'1px solid #e5edf5', background:'#fff', color:'#52677e', fontSize:10, fontWeight:700 }}>
              {PLAYER_FOOT_OPTIONS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {NIVEIS.map(n => {
                const active = filterNivel === n
                const c = n !== 'all' ? NIVEL_COLORS[n] : null
                return (
                  <button key={n} onClick={() => setFilterNivel(n)} style={{
                    padding:'7px 12px', fontSize:9, fontWeight:700, borderRadius:8, fontFamily:'inherit', cursor:'pointer',
                    border: active ? '1px solid '+(n==='all'?'#0a66b7':c.border) : '1px solid #e5edf5',
                    background: active ? (n==='all'?'#0a66b7':c.bg) : '#fff',
                    color: active ? (n==='all'?'#fff':c.color) : '#64748b',
                  }}>
                    {n === 'all' ? 'Todos' : n}
                    {n !== 'all' && <span style={{ marginLeft:4, fontSize:8, opacity:0.75 }}>({atletas.filter(a=>a.nivel_interesse===n).length})</span>}
                  </button>
                )
              })}
            </div>
          </div>
          {/* Filtro de posição */}
          {posicoes.length > 1 && (
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.5px', marginRight:2, flexShrink:0 }}>Posição</span>
              {posicoes.map(pos => (
                <button key={pos} onClick={() => setFilterPos(pos)} style={{
                  padding:'5px 10px', fontSize:9, fontWeight:700, borderRadius:7, fontFamily:'inherit', cursor:'pointer',
                  border: filterPos===pos ? '1px solid #0a66b7' : '1px solid #e5edf5',
                  background: filterPos===pos ? '#0a66b7' : '#fff',
                  color: filterPos===pos ? '#fff' : '#64748b',
                }}>
                  {pos}
                  {pos !== 'Todas' && (
                    <span style={{ marginLeft:4, fontSize:8, opacity:0.75 }}>
                      ({atletas.filter(a=>(a.posicao||'')===pos).length})
                    </span>
                  )}
                </button>
              ))}
              {filterPos !== 'Todas' && (
                <button onClick={() => setFilterPos('Todas')} style={{ padding:'5px 8px', fontSize:9, borderRadius:7, border:'1px solid #fca5a5', background:'#fef2f2', color:'#dc2626', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>
                  × limpar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign:'center', padding:60, color:'#94a3b8', fontSize:12 }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, background:'#fff', borderRadius:16, border:'1px solid #e8f0eb' }}>
            <p style={{ fontSize:36, marginBottom:12 }}>👁</p>
            <p style={{ fontSize:14, fontWeight:700, color:'#52677e', marginBottom:6 }}>{search ? 'Nenhum atleta encontrado' : 'Nenhum atleta cadastrado'}</p>
            <p style={{ fontSize:11, color:'#94a3b8' }}>{search ? 'Sem resultados para "'+search+'"' : 'Cadastre atletas para monitorar ao longo da temporada.'}</p>
          </div>
        ) : filterNivel !== 'all' ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filtered.map(a => <AtletaCard key={a.id} atleta={a} onClick={() => window.location.href='/monitoramento/'+a.id} onDelete={handleDelete} canEdit={canEdit} />)}
          </div>
        ) : (() => {
          const urgentes = filtered.filter(a => { const d = diasParaVencer(a.data_contrato_fim); return d !== null && d <= 90 && a.nivel_interesse !== 'Descartado' })
          const resto    = filtered.filter(a => { const d = diasParaVencer(a.data_contrato_fim); return !(d !== null && d <= 90 && a.nivel_interesse !== 'Descartado') })
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {urgentes.length > 0 && (
                <div style={{ background:'#fff5f5', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:8 }}>
                  <span>🚨</span>
                  <p style={{ fontSize:10, fontWeight:700, color:'#c62828' }}>
                    {urgentes.length} atleta{urgentes.length>1?'s':''} com contrato expirando em menos de 90 dias
                  </p>
                </div>
              )}
              {urgentes.map(a => <AtletaCard key={a.id} atleta={a} onClick={() => window.location.href='/monitoramento/'+a.id} onDelete={handleDelete} canEdit={canEdit} />)}
              {urgentes.length > 0 && resto.length > 0 && <div style={{ borderTop:'1px dashed #e5edf5', margin:'4px 0' }} />}
              {resto.map(a => <AtletaCard key={a.id} atleta={a} onClick={() => window.location.href='/monitoramento/'+a.id} onDelete={handleDelete} canEdit={canEdit} />)}
            </div>
          )
        })()}
          </div>
        )}

      {modal && <CadastroModal onClose={()=>setModal(false)} onSaved={a=>{setModal(false);window.location.href='/monitoramento/'+a.id}} />}
      {importModal && <ImportExcelModal onClose={()=>setImportModal(false)} onSaved={a=>{setImportModal(false);window.location.href='/monitoramento/'+a.id}} />}
      {ogolModal   && <OgolModal   onClose={()=>setOgolModal(false)}   onSaved={a=>{setOgolModal(false);window.location.href='/monitoramento/'+a.id}} />}
      </div>
    </AppShell>
  )
}
