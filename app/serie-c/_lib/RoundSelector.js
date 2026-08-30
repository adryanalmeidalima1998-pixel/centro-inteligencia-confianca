'use client'
export default function RoundSelector({ uploads, currentRound, onChange }) {
  if (!uploads || uploads.length === 0) return null
  return (
    <select
      value={currentRound ?? ''}
      onChange={e => onChange(Number(e.target.value))}
      className="text-[10px] font-bold text-gray-600 bg-white border border-gray-200 rounded-lg px-2 py-1.5"
    >
      {uploads.map(u => (
        <option key={u.id} value={u.round}>
          Rodada {u.round} · {u.season}
        </option>
      ))}
    </select>
  )
}
