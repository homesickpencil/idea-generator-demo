import { Routes, Route } from 'react-router-dom'
import IdeasList from './pages/IdeasList.jsx'
import IdeaGraph from './pages/IdeaGraph.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<IdeasList />} />
      <Route path="/idea/:id" element={<IdeaGraph />} />
    </Routes>
  )
}
