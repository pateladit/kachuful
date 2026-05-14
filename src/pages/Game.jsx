import { useParams } from 'react-router-dom'

export default function Game() {
  const { id } = useParams()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Game</h1>
      <p className="text-gray-500 mt-2">Game ID: {id}</p>
    </div>
  )
}
