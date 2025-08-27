import RAGChat from '../components/RAGChat'
import ChapterHeader from '../components/ChapterHeader'
import BottomNavigation from '../components/BottomNavigation'

export default function RAGChapter1() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-white to-purple-100 p-4">
      <div className="w-full max-w-6xl rounded-2xl bg-white p-6 shadow-2xl">
        <ChapterHeader chapterNumber={1} chapterTitle="Computer Networks and the Internet" isRAG={true} />
        <RAGChat />
      </div>
      <BottomNavigation chapterNumber={1} isRAG={true} />
    </main>
  )
}
