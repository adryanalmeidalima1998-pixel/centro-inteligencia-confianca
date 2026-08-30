'use client'
import { useMemo, useState, useEffect, useRef } from 'react'

// SVG viewport: 1009.6727 x 665.96301 (from world.svg)
const SVG_W = 1009.67
const SVG_H = 665.96

const COUNTRY_XY = {
  'Afghanistan': [685.08, 350.84],
  'Aland Islands': [531.0, 250.11],
  'Albania': [531.2, 331.46],
  'Algeria': [490, 360],
  'American Samoa': [1006.09, 503.36],
  'Andorra': [479.68, 331.63],
  'Angola': [511.58, 475.86],
  'Anguilla': [298.08, 411.23],
  'Antigua and Barbuda': [301.69, 414.7],
  'Argentina': [295, 535],
  'Armenia': [605.37, 344.9],
  'Aruba': [278.72, 427.93],
  'Australia': [845, 500],
  'Austria': [515, 280],
  'Azerbaijan': [611.21, 334.11],
  'Bahamas': [258.16, 388.08],
  'Bahrain': [616.92, 388.15],
  'Bangladesh': [734.71, 400.07],
  'Barbados': [307.93, 426.13],
  'Belarus': [553.89, 272.54],
  'Belgium': [490, 268],
  'Belize': [227.09, 410.5],
  'Benin': [484.99, 430.08],
  'Bermuda': [293.23, 367.65],
  'Bhutan': [732.06, 382.28],
  'Bolivia': [280, 480],
  'Bonaire,  Saint Eustachius and Saba': [283.48, 428.81],
  'Bosnia and Herzegovina': [522.38, 320.86],
  'Botswana': [545.78, 513.35],
  'Bouvet Island': [484.61, 644.96],
  'Brazil': [320, 470],
  'British Indian Ocean Territory': [678.34, 483.55],
  'British Virgin Islands': [294.47, 409.71],
  'Brunei Darussalam': [797.72, 449.25],
  'Bulgaria': [555.12, 326.88],
  'Burkina Faso': [475.51, 420.87],
  'Burundi': [560.64, 469.61],
  'Cambodia': [767.97, 433.74],
  'Cameroon': [515, 435],
  'Canada': [130, 230],
  'Cape Verde': [404.26, 414.97],
  'Cayman Islands': [250.87, 406.84],
  'Central African Republic': [539.05, 432.29],
  'Chad': [542.2, 407.48],
  'Chile': [275, 540],
  'China': [780, 340],
  'Christmas Island': [771.61, 492.34],
  'Cocos  (Keeling)  Islands': [746.68, 497.14],
  'Colombia': [245, 415],
  'Comoros': [596.88, 496.34],
  'Cook Islands': [26.59, 523.58],
  'Costa Rica': [180, 400],
  'Croatia': [525, 290],
  'Cuba': [195, 355],
  'Curaçao': [281.95, 429.05],
  'Cyprus': [571.62, 356.53],
  'Czech Republic': [516.46, 297.46],
  'Côte d\'Ivoire': [459.39, 433.69],
  'DR Congo': [535, 455],
  'Democratic Republic of Congo': [551.8, 448.66],
  'Denmark': [500, 240],
  'Djibouti': [596.26, 430.64],
  'Dominica': [302.91, 419.89],
  'Dominican Republic': [273.48, 411.77],
  'Ecuador': [228, 430],
  'Egypt': [545, 355],
  'El Salvador': [224.1, 422.3],
  'England': [470, 270],
  'Equatorial Guinea': [499.41, 452.44],
  'Eritrea': [595.9, 427.2],
  'Estonia': [553.51, 254.96],
  'Ethiopia': [582.75, 422.26],
  'Falkland Islands': [309.73, 630.22],
  'Faroe Islands': [456.92, 238.97],
  'Federated States of Micronesia': [862.59, 436.31],
  'Fiji': [971.98, 498.07],
  'Finland': [556.19, 192.72],
  'France': [483, 295],
  'French Guiana': [329.93, 451.59],
  'French Polynesia': [81.78, 487.86],
  'French Southern and Antarctic Lands': [620.37, 609.65],
  'Gabon': [512.2, 456.89],
  'Gambia': [427.85, 426.18],
  'Georgia': [605.2, 333.94],
  'Germany': [500, 275],
  'Ghana': [470, 435],
  'Gibraltar': [459.92, 354.57],
  'Glorioso Islands': [607.65, 495.41],
  'Greece': [540, 315],
  'Greenland': [390.83, 1.12],
  'Grenada': [301.69, 429.18],
  'Guadeloupe': [302.78, 417.05],
  'Guam': [881.11, 425.62],
  'Guatemala': [224.66, 412.43],
  'Guernsey': [467.84, 303.42],
  'Guinea': [442.93, 428.06],
  'Guinea-Bissau': [436.36, 427.3],
  'Guyana': [314.38, 447.43],
  'Haiti': [270.96, 405.87],
  'Heard Island and McDonald Islands': [681.75, 638.75],
  'Honduras': [170, 385],
  'Hong Kong': [795.58, 398.38],
  'Hungary': [537.01, 308.06],
  'Iceland': [431.27, 213.32],
  'India': [738.4, 443.83],
  'Indonesia': [820, 445],
  'Iran': [635, 330],
  'Iraq': [600.53, 351.16],
  'Ireland': [452, 265],
  'Isle of Man': [462.51, 282.14],
  'Israel': [575.33, 366.19],
  'Italy': [510, 320],
  'Ivory Coast': [460, 430],
  'Jamaica': [258.06, 410.54],
  'Japan': [875, 310],
  'Jarvis Island': [25.8, 464.03],
  'Jersey': [469.23, 304.55],
  'Jordan': [584.76, 368.21],
  'Juan De Nova Island': [594.89, 511.25],
  'Kazakhstan': [719.97, 305.17],
  'Kenya': [592.44, 451.82],
  'Kiribati': [1003.36, 470.64],
  'Kosovo': [535.41, 332.6],
  'Kuwait': [609.55, 375.19],
  'Kyrgyzstan': [700.0, 332.81],
  'Lao People\'s Democratic Republic': [761.51, 398.86],
  'Latvia': [551.66, 265.45],
  'Lebanon': [575.56, 363.86],
  'Lesotho': [555.54, 551.04],
  'Liberia': [451.08, 441.79],
  'Libya': [545.48, 369.75],
  'Liechtenstein': [501.78, 313.67],
  'Lithuania': [549.53, 274.92],
  'Luxembourg': [492.06, 300.7],
  'Macau': [793.37, 399.42],
  'Macedonia': [537.6, 332.34],
  'Madagascar': [613.92, 497.86],
  'Malawi': [573.01, 495.42],
  'Malaysia': [803.65, 442.89],
  'Maldives': [681.21, 451.3],
  'Mali': [486.76, 408.52],
  'Malta': [515.07, 355.04],
  'Marshall Islands': [943.27, 431.63],
  'Martinique': [304.19, 422.07],
  'Mauritania': [461.36, 390.89],
  'Mauritius': [636.69, 521.3],
  'Mayotte': [601.69, 499.41],
  'Mexico': [115, 350],
  'Moldova': [554.07, 320.17],
  'Monaco': [495.77, 326.85],
  'Mongolia': [802.37, 302.0],
  'Montenegro': [528.76, 327.69],
  'Montserrat': [300.48, 415.57],
  'Morocco': [455, 355],
  'Mozambique': [567.19, 540.71],
  'Myanmar': [758.74, 401.31],
  'Namibia': [540.51, 512.9],
  'Nauru': [943.46, 464.36],
  'Nepal': [722.17, 381.93],
  'Netherlands': [490, 265],
  'New Caledonia': [923.8, 517.82],
  'New Zealand': [990.79, 598.96],
  'Nicaragua': [241.51, 420.63],
  'Niger': [516.93, 397.0],
  'Nigeria': [510, 420],
  'Niue': [1008.68, 517.14],
  'Norfolk Island': [946.22, 547.56],
  'North Korea': [841.22, 331.51],
  'Northern Mariana Islands': [883.82, 409.64],
  'Norway': [490, 195],
  'Oman': [632.89, 388.87],
  'Pakistan': [684.94, 351.73],
  'Palau': [852.63, 442.29],
  'Palestinian Territories': [571.29, 370.94],
  'Panama': [257.75, 438.69],
  'Papua New Guinea': [905.79, 495.13],
  'Paraguay': [310, 510],
  'Peru': [240, 460],
  'Philippines': [850, 400],
  'Pitcairn Islands': [114.85, 533.12],
  'Poland': [530, 260],
  'Portugal': [430, 340],
  'Puerto Rico': [289.3, 410.58],
  'Qatar': [618.78, 392.08],
  'Republic of Congo': [527.12, 453.22],
  'Reunion': [631.49, 523.85],
  'Romania': [545, 275],
  'Russia': [680, 220],
  'Rwanda': [560.52, 465.9],
  'Saint Barthelemy': [298.56, 412.25],
  'Saint Helena': [434.58, 485.23],
  'Saint Kitts and Nevis': [299.12, 414.11],
  'Saint Lucia': [303.99, 424.01],
  'Saint Martin': [297.74, 411.68],
  'Saint Pierre and Miquelon': [316.98, 314.57],
  'Saint Vincent and the Grenadines': [303.21, 425.91],
  'Samoa': [1001.58, 500.81],
  'San Marino': [509.93, 326.26],
  'Sao Tome and Principe': [495.73, 458.55],
  'Saudi Arabia': [600, 365],
  'Scotland': [460, 255],
  'Senegal': [430, 400],
  'Serbia': [535, 285],
  'Seychelles': [630.77, 476.02],
  'Sierra Leone': [446.04, 439.18],
  'Singapore': [766.68, 459.21],
  'Slovakia': [538.15, 305.23],
  'Slovenia': [521.25, 315.95],
  'Solomon Islands': [916.88, 483.41],
  'Somalia': [591.46, 467.65],
  'South Africa': [545, 540],
  'South Georgia and South Sandwich Islands': [370.76, 643.13],
  'South Korea': [850, 320],
  'South Sudan': [570.2, 435.34],
  'Spain': [455, 335],
  'Sri Lanka': [699.36, 435.43],
  'Sudan': [563.21, 399.75],
  'Suriname': [322.91, 447.96],
  'Svalbard and Jan Mayen': [449.77, 177.86],
  'Swaziland': [564.56, 537.93],
  'Sweden': [510, 200],
  'Switzerland': [495, 280],
  'Syria': [593.78, 351.28],
  'Taiwan': [814.51, 398.14],
  'Tajikistan': [674.04, 340.07],
  'Tanzania': [586.34, 485.23],
  'Thailand': [755.89, 405.04],
  'Timor-Leste': [827.52, 485.69],
  'Togo': [477.42, 432.08],
  'Tokelau': [1001.17, 486.93],
  'Tonga': [997.03, 515.84],
  'Trinidad and Tobago': [304.38, 431.56],
  'Tunisia': [507.18, 364.7],
  'Turkey': [580, 310],
  'Turkmenistan': [661.59, 350.43],
  'Turks and Caicos Islands': [273.16, 400.49],
  'Tuvalu': [972.47, 480.0],
  'US Virgin Islands': [292.91, 410.92],
  'USA': [160, 290],
  'Uganda': [570.04, 465.72],
  'Ukraine': [560, 270],
  'United Arab Emirates': [632.89, 388.87],
  'United Kingdom': [471.9, 298.2],
  'Uruguay': [320, 545],
  'Uzbekistan': [674.01, 332.59],
  'Vanuatu': [944.95, 502.08],
  'Vatican City': [509.81, 333.91],
  'Venezuela': [265, 390],
  'Vietnam': [777.92, 401.49],
  'Wallis and Futuna': [990.84, 500.43],
  'Western Sahara': [450.53, 383.77],
  'Yemen': [623.88, 415.83],
  'Zambia': [567.28, 489.27],
  'Zimbabwe': [562.7, 527.05],
}

export default function WorldMap({ players, posFilter, ageFilter }) {
  const [hovered, setHovered]   = useState(null)
  const [selected, setSelected] = useState(null)
  const [svgContent, setSvgContent] = useState(null)
  const containerRef = useRef(null)

  // Load SVG once
  useEffect(() => {
    fetch('/world.svg')
      .then(r => r.text())
      .then(text => {
        // Extract just the paths from the SVG
        const match = text.match(/<svg[^>]*>([\s\S]*)<\/svg>/)
        if (match) setSvgContent(match[1])
      })
      .catch(() => setSvgContent(''))
  }, [])

  const filteredForMap = useMemo(() => {
    let list = players
    if (posFilter && posFilter !== 'Todas') {
      list = list.filter(p => (p['_posicao_label']||'') === posFilter)
    }
    if (ageFilter && ageFilter !== 'Todas') {
      list = list.filter(p => {
        const age = parseInt(p['Idade']||0)
        if (ageFilter === 'Até 23') return age > 0 && age <= 23
        if (ageFilter === '24–30')  return age >= 24 && age <= 30
        if (ageFilter === '31+')    return age >= 31
        return true
      })
    }
    return list
  }, [players, posFilter, ageFilter])

  const byCountry = useMemo(() => {
    const map = {}
    for (const p of filteredForMap) {
      const nac = (p['Nacionalidade']||'').split(',')[0].trim()
      if (!nac || nac === '-') continue
      if (!map[nac]) map[nac] = []
      map[nac].push(p)
    }
    return map
  }, [filteredForMap])

  const maxCount = useMemo(() =>
    Math.max(1, ...Object.values(byCountry).map(a => a.length)),
  [byCountry])

  const dots = useMemo(() =>
    Object.entries(byCountry).map(([country, plist]) => {
      const xy = COUNTRY_XY[country]
      if (!xy) return null
      const [x, y] = xy
      const r = 8 + (plist.length / maxCount) * 28
      return { country, count: plist.length, x, y, r }
    }).filter(Boolean).sort((a,b) => a.count - b.count),
  [byCountry, maxCount])

  const selectedPlayers = selected ? (byCountry[selected]||[]) : []
  const topCountries = useMemo(() =>
    Object.entries(byCountry).sort((a,b) => b[1].length - a[1].length).slice(0,10),
  [byCountry])

  const hovDot = hovered ? dots.find(d => d.country === hovered) : null

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* MAP CONTAINER */}
      <div style={{
        background:'#e8f5ee',
        borderRadius:16,
        border:'1px solid #bfd8ea',
        overflow:'hidden',
        position:'relative',
      }}>
        <svg
          ref={containerRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ width:'100%', display:'block' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Ocean */}
          <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="#ddf0e8"/>

          {/* Country land paths from world.svg */}
          {svgContent && (
            <g dangerouslySetInnerHTML={{ __html: svgContent }}
              style={{ '--fill':'#b8d8c4', '--stroke':'#fff' }}
            />
          )}
          {/* Fallback style injected via a style tag */}
          <style>{`
            svg g path { fill: #b8d8c4 !important; stroke: #ffffff !important; stroke-width: 0.5px !important; }
          `}</style>

          {/* Dots per country */}
          {dots.map(dot => {
            const isHov = hovered === dot.country
            const isSel = selected === dot.country
            return (
              <g key={dot.country} style={{ cursor:'pointer' }}
                onMouseEnter={() => setHovered(dot.country)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(dot.country === selected ? null : dot.country)}
              >
                <circle cx={dot.x} cy={dot.y} r={dot.r + 5}
                  fill="#0a66b7" fillOpacity={isHov || isSel ? 0.18 : 0.06}/>
                <circle cx={dot.x} cy={dot.y} r={dot.r}
                  fill={isSel ? '#064b82' : isHov ? '#0878c8' : '#0a66b7'}
                  stroke="#fff" strokeWidth="1.5"
                  fillOpacity={isHov || isSel ? 1 : 0.85}/>
                {dot.count >= 3 && (
                  <text x={dot.x} y={dot.y + dot.r * 0.38} textAnchor="middle"
                    fontSize={Math.max(8, Math.min(14, dot.r * 0.75))}
                    fontWeight="800" fill="white" style={{ pointerEvents:'none' }}>
                    {dot.count >= 1000 ? `${(dot.count/1000).toFixed(1)}k` : dot.count}
                  </text>
                )}
              </g>
            )
          })}

          {/* Tooltip */}
          {hovDot && (() => {
            const tipW = 130, tipH = 38
            const tipX = Math.min(SVG_W - tipW - 5, Math.max(5, hovDot.x - tipW/2))
            const tipY = hovDot.y < SVG_H/2 ? hovDot.y + hovDot.r + 8 : hovDot.y - hovDot.r - tipH - 8
            return (
              <g style={{ pointerEvents:'none' }}>
                <rect x={tipX} y={tipY} width={tipW} height={tipH}
                  rx="6" fill="white" stroke="#c8e0d0" strokeWidth="1"
                  style={{ filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.15))' }}/>
                <text x={tipX + tipW/2} y={tipY + 14} textAnchor="middle"
                  fontSize="11" fontWeight="700" fill="#10233b">{hovered}</text>
                <text x={tipX + tipW/2} y={tipY + 28} textAnchor="middle"
                  fontSize="10" fill="#0a66b7">
                  {hovDot.count} atleta{hovDot.count !== 1 ? 's' : ''}
                </text>
              </g>
            )
          })()}
        </svg>

        {/* Loading overlay */}
        {svgContent === null && (
          <div style={{
            position:'absolute', inset:0, display:'flex',
            alignItems:'center', justifyContent:'center',
            background:'#e8f5ee',
          }}>
            <span style={{
              width:32, height:32, border:'3px solid #c8e6d4',
              borderTopColor:'#0a66b7', borderRadius:'50%',
              animation:'spin 0.8s linear infinite', display:'inline-block',
            }}/>
          </div>
        )}
      </div>

      {/* BOTTOM PANEL */}
      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap:12 }}>

        {/* Top países */}
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5edf5', padding:'16px 20px' }}>
          <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'2px', color:'#94a3b8', marginBottom:14 }}>
            Top países
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {topCountries.map(([country, plist]) => (
              <div key={country}
                style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}
                onClick={() => setSelected(country === selected ? null : country)}>
                <span style={{
                  fontSize:11, fontWeight:600,
                  color: selected === country ? '#0a66b7' : '#52677e',
                  width:130, flexShrink:0,
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                }}>
                  {country}
                </span>
                <div style={{ flex:1, height:6, background:'#e8f4ec', borderRadius:999, overflow:'hidden' }}>
                  <div style={{
                    height:'100%', background: selected===country ? '#064b82' : '#0a66b7',
                    borderRadius:999, width:`${(plist.length/maxCount)*100}%`,
                    transition:'width 0.3s',
                  }}/>
                </div>
                <span style={{ fontSize:11, fontWeight:800, color:'#0a66b7', width:45, textAlign:'right', flexShrink:0 }}>
                  {plist.length.toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* País selecionado */}
        {selected && (
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5edf5', overflow:'hidden' }}>
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'12px 20px', borderBottom:'1px solid #f4f8fc',
            }}>
              <div>
                <p style={{ fontSize:13, fontWeight:800, color:'#10233b' }}>{selected}</p>
                <p style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>
                  {selectedPlayers.length} atleta{selectedPlayers.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={() => setSelected(null)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:20, lineHeight:1 }}>
                ×
              </button>
            </div>
            <div style={{ maxHeight:240, overflowY:'auto' }}>
              {selectedPlayers
                .sort((a,b) => parseFloat(b['Index']||0) - parseFloat(a['Index']||0))
                .slice(0,15)
                .map((p,i) => (
                  <a key={i} href={`/jogadores/${encodeURIComponent(p['Jogador'])}`}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 20px', borderBottom:'1px solid #f8fbf9', textDecoration:'none' }}
                    onMouseEnter={e => e.currentTarget.style.background='#f0fdf4'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <div style={{
                      width:28, height:28, borderRadius:'50%',
                      background:'linear-gradient(135deg,#0a66b7,#1597d4)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:11, fontWeight:900, color:'#fff', flexShrink:0,
                    }}>
                      {(p['Jogador']||'?')[0]}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:12, fontWeight:700, color:'#10233b', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {p['Jogador']}
                      </p>
                      <p style={{ fontSize:10, color:'#94a3b8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {p['Time']} · {p['_posicao_label']}
                      </p>
                    </div>
                    <span style={{ fontSize:12, fontWeight:900, color:'#0a66b7', flexShrink:0 }}>
                      {parseFloat(p['Index']||0).toFixed(0)}
                    </span>
                  </a>
                ))}
              {selectedPlayers.length > 15 && (
                <p style={{ textAlign:'center', fontSize:10, color:'#94a3b8', padding:'8px 0' }}>
                  +{selectedPlayers.length - 15} atletas
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
