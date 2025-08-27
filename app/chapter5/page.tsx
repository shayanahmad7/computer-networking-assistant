import Chat from '../components/Chat'
import ChapterHeader from '../components/ChapterHeader'
import BottomNavigation from '../components/BottomNavigation'

export default function Chapter5() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-white to-purple-100 p-4">
      <div className="w-full max-w-6xl rounded-2xl bg-white p-6 shadow-2xl">
        <ChapterHeader chapterNumber={5} chapterTitle="The Network Layer: Control Plane" />
        <Chat assistantId={process.env.ASSISTANT5_ID || ''} />
      </div>
      <BottomNavigation chapterNumber={5} />
    </main>
  )
} 