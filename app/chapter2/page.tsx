import Chat from '../components/Chat'
import ChapterHeader from '../components/ChapterHeader'

export default function Chapter2() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-white to-purple-100 p-4">
      <div className="w-full max-w-6xl rounded-2xl bg-white p-6 shadow-2xl">
        <ChapterHeader chapterNumber={2} chapterTitle="Application Layer" />
        <Chat assistantId={process.env.ASSISTANT2_ID || ''} />
      </div>
    </main>
  )
} 