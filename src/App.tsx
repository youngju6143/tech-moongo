import { BookshelfScene } from '@/features/bookshelf/bookshelf-scene'
import { BookNormalMapPoc } from '@/features/bookshelf/poc/book-normal-map-poc'

const POC_MODE = import.meta.env.VITE_POC === 'true'

function App() {
  return POC_MODE ? <BookNormalMapPoc /> : <BookshelfScene />
}

export default App
