/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}'],
  safelist: [
    // Dynamic color classes used in treinadores, lista-preferencial, elenco etc.
    { pattern: /bg-(red|amber|green|blue|purple|indigo|pink|cyan|slate|orange)-(50|100|200)/ },
    { pattern: /border-(red|amber|green|blue|purple|indigo|pink|cyan|slate|orange)-(200|300)/ },
    { pattern: /text-(red|amber|green|blue|purple|indigo|pink|cyan|slate|orange)-(500|600|700)/ },
  ],
  theme: { extend: {} },
  plugins: [],
}