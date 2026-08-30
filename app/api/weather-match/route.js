import { NextResponse } from 'next/server'

// Open-Meteo: 100% free, sem API key, sem limite prático
// https://open-meteo.com/en/docs
const METEO_BASE = 'https://api.open-meteo.com/v1/forecast'

// Coordenadas dos estádios / cidades dos times da Série C 2026
// Usado quando o Confiança joga fora — pega a cidade/estádio do adversário
const CITY_COORDS = {
  // CONFIANÇA — Aracaju, SE (Arena Batistão)
  confianca:      { lat: -10.9472, lon: -37.0731, city: 'Aracaju, SE' },
  // ADVERSÁRIOS
  maranhaoa:      { lat: -2.5297,  lon: -44.3028, city: 'São Luís, MA' },
  maranhaoac:     { lat: -2.5297,  lon: -44.3028, city: 'São Luís, MA' },
  voltaredonda:   { lat: -22.5230, lon: -44.1040, city: 'Volta Redonda, RJ' },
  aoitabaiana:    { lat: -10.6868, lon: -37.4286, city: 'Itabaiana, SE' },
  itabaiana:      { lat: -10.6868, lon: -37.4286, city: 'Itabaiana, SE' },
  ferroviaria:    { lat: -21.1775, lon: -47.8103, city: 'Araraquara, SP' },
  santacruz:      { lat: -8.0539,  lon: -34.8811, city: 'Recife, PE' },
  maringa:        { lat: -23.4205, lon: -51.9332, city: 'Maringá, PR' },
  maringafc:      { lat: -23.4205, lon: -51.9332, city: 'Maringá, PR' },
  ituano:         { lat: -23.2645, lon: -47.2908, city: 'Itu, SP' },
  barra:          { lat: -27.1000, lon: -48.9167, city: 'Florianópolis, SC' },
  barrafc:        { lat: -27.1000, lon: -48.9167, city: 'Florianópolis, SC' },
  amazonas:       { lat: -3.1190,  lon: -60.0217, city: 'Manaus, AM' },
  amazonasfc:     { lat: -3.1190,  lon: -60.0217, city: 'Manaus, AM' },
  caxias:         { lat: -29.1681, lon: -51.1797, city: 'Caxias do Sul, RS' },
  figueirense:    { lat: -27.5954, lon: -48.5480, city: 'Florianópolis, SC' },
  floresta:       { lat: -3.7172,  lon: -38.5433, city: 'Fortaleza, CE' },
  florestaec:     { lat: -3.7172,  lon: -38.5433, city: 'Fortaleza, CE' },
  paysandu:       { lat: -1.4558,  lon: -48.5039, city: 'Belém, PA' },
  paysandusc:     { lat: -1.4558,  lon: -48.5039, city: 'Belém, PA' },
  interdelimeira: { lat: -22.5569, lon: -47.4006, city: 'Limeira, SP' },
  anapolis:       { lat: -16.3281, lon: -48.9530, city: 'Anápolis, GO' },
  anapolisfc:     { lat: -16.3281, lon: -48.9530, city: 'Anápolis, GO' },
  ypiranga:       { lat: -28.2620, lon: -52.4095, city: 'Erechim, RS' },
  ypirangafc:     { lat: -28.2620, lon: -52.4095, city: 'Erechim, RS' },
  botafogopb:     { lat: -7.1195,  lon: -34.8450, city: 'João Pessoa, PB' },
  botafogojp:     { lat: -7.1195,  lon: -34.8450, city: 'João Pessoa, PB' },
  brusque:        { lat: -27.0986, lon: -48.9158, city: 'Brusque, SC' },
  brusquefc:      { lat: -27.0986, lon: -48.9158, city: 'Brusque, SC' },
}

function normKey(name) {
  return (name || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

function getLocation(opponent, mando) {
  if (mando === 'H') return CITY_COORDS.confianca
  return CITY_COORDS[normKey(opponent)] || CITY_COORDS.confianca
}

// WMO weather code → descrição PT + emoji
function wmoDescription(code) {
  const map = {
    0:  { desc: 'Céu limpo',       emoji: '☀️' },
    1:  { desc: 'Predominante bom', emoji: '🌤️' },
    2:  { desc: 'Parcialmente nublado', emoji: '⛅' },
    3:  { desc: 'Nublado',         emoji: '☁️' },
    45: { desc: 'Neblina',         emoji: '🌫️' },
    48: { desc: 'Neblina com gelo',emoji: '🌫️' },
    51: { desc: 'Garoa leve',      emoji: '🌦️' },
    53: { desc: 'Garoa moderada',  emoji: '🌦️' },
    55: { desc: 'Garoa intensa',   emoji: '🌧️' },
    61: { desc: 'Chuva leve',      emoji: '🌧️' },
    63: { desc: 'Chuva moderada',  emoji: '🌧️' },
    65: { desc: 'Chuva forte',     emoji: '🌧️' },
    71: { desc: 'Neve leve',       emoji: '🌨️' },
    73: { desc: 'Neve moderada',   emoji: '❄️' },
    75: { desc: 'Neve forte',      emoji: '❄️' },
    80: { desc: 'Pancadas leves',  emoji: '🌦️' },
    81: { desc: 'Pancadas moderadas', emoji: '🌧️' },
    82: { desc: 'Pancadas fortes', emoji: '⛈️' },
    95: { desc: 'Trovoada',        emoji: '⛈️' },
    96: { desc: 'Trovoada com granizo', emoji: '⛈️' },
    99: { desc: 'Trovoada severa', emoji: '🌩️' },
  }
  return map[code] || { desc: 'Variável', emoji: '🌡️' }
}

// GET /api/weather-match?date=2026-04-04&opponent=Maranhão AC&mando=A
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const date     = searchParams.get('date')     // YYYY-MM-DD
  const opponent = searchParams.get('opponent') || ''
  const mando    = searchParams.get('mando')    || 'H'

  if (!date) return NextResponse.json({ error: 'Parâmetro ?date= obrigatório (YYYY-MM-DD)' }, { status: 400 })

  // Não faz sentido buscar previsão para mais de 16 dias
  const matchDate = new Date(date + 'T12:00:00')
  const daysAhead = Math.floor((matchDate - new Date()) / (1000 * 60 * 60 * 24))
  if (daysAhead < -1)  return NextResponse.json({ error: 'Jogo já passou', past: true })
  if (daysAhead > 16)  return NextResponse.json({ error: 'Previsão só disponível para até 16 dias', tooFar: true })

  const loc = getLocation(opponent, mando)

  try {
    const url = `${METEO_BASE}?` + new URLSearchParams({
      latitude:   loc.lat,
      longitude:  loc.lon,
      daily:      [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'precipitation_probability_max',
        'windspeed_10m_max',
        'uv_index_max',
      ].join(','),
      hourly:     'temperature_2m,precipitation_probability,weathercode,windspeed_10m',
      timezone:   'America/Sao_Paulo',
      start_date: date,
      end_date:   date,
    })

    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
    const data = await res.json()

    const daily  = data.daily
    const hourly = data.hourly
    const idx    = 0  // só pedimos 1 dia

    // Encontrar hora do jogo (matchDate.getHours()) nos dados horários
    const matchHour  = matchDate.getHours() || 17
    const hourlyIdx  = hourly?.time?.findIndex(t => parseInt(t.slice(11,13)) === matchHour) ?? -1

    const wmoCode  = daily.weather_code?.[idx] ?? 0
    const wmo      = wmoDescription(wmoCode)

    const result = {
      date,
      location:  loc.city,
      opponent,
      mando,
      weather: {
        code:        wmoCode,
        description: wmo.desc,
        emoji:       wmo.emoji,
        tempMax:     daily.temperature_2m_max?.[idx] ?? null,
        tempMin:     daily.temperature_2m_min?.[idx] ?? null,
        rain:        daily.precipitation_sum?.[idx] ?? null,
        rainProb:    daily.precipitation_probability_max?.[idx] ?? null,
        wind:        daily.windspeed_10m_max?.[idx] ?? null,
        uv:          daily.uv_index_max?.[idx] ?? null,
        // Hora do jogo especificamente
        atMatchHour: hourlyIdx >= 0 ? {
          temp:     hourly.temperature_2m?.[hourlyIdx] ?? null,
          rainProb: hourly.precipitation_probability?.[hourlyIdx] ?? null,
          wind:     hourly.windspeed_10m?.[hourlyIdx] ?? null,
        } : null,
      },
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
