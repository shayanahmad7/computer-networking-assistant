import Chat from './components/Chat'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-white to-purple-100 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
        <h1 className="mb-6 text-center text-4xl font-bold text-gray-800">
          Computer Networking AI Tutor
        </h1>
        <p className="mb-8 text-center text-lg text-gray-600">
          Your personal assistant for learning computer networking concepts
        </p>
        <Chat />
      </div>
    </main>
  )
}

