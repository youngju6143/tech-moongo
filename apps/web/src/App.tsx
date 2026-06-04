import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom'

import { BookshelfScene } from '@/features/bookshelf/bookshelf-scene'
import { BookNormalMapPoc } from '@/features/bookshelf/poc/book-normal-map-poc'

const POC_MODE = import.meta.env.VITE_POC === 'true'

function SharedBookshelfRoute() {
  const { dbId } = useParams<{ dbId: string }>()
  return <BookshelfScene dbId={dbId} readOnly />
}

function App() {
  if (POC_MODE) return <BookNormalMapPoc />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BookshelfScene />} />
        <Route path="/share/:dbId" element={<SharedBookshelfRoute />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
