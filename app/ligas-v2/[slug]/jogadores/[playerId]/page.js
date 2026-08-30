import PlayerProfileClient from './PlayerProfileClient'

export default async function PlayerProfilePage({ params }) {
  const { slug, playerId } = await params
  return <PlayerProfileClient slug={slug} playerId={playerId} />
}
