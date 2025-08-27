import Link from 'next/link'
import Image from 'next/image'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-white to-purple-100 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-8 shadow-2xl">
        <div className="flex items-center justify-center mb-6">
          <Image src="/book_cover.png" alt="Book Cover" width={56} height={56} className="rounded-full mr-3" />
          <h1 className="text-2xl md:text-3xl font-bold text-center">Tutor for Computer Networking: A Top-Down Approach</h1>
        </div>
        <p className="text-gray-600 text-center mb-6">
          Choose a chapter tutor below. Each page is tailored to that chapter. You can also try the custom RAG tutor for Chapter 1.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/chapter1" className="block rounded-xl border border-gray-200 p-4 hover:shadow-md transition bg-gray-50">
            <h2 className="text-lg font-semibold">Chapter 1: Computer Networks and the Internet</h2>
            <p className="text-sm text-gray-600">Core concepts and problems for Chapter 1.</p>
          </Link>
          <Link href="/chapter2" className="block rounded-xl border border-gray-200 p-4 hover:shadow-md transition bg-gray-50">
            <h2 className="text-lg font-semibold">Chapter 2: Application Layer</h2>
            <p className="text-sm text-gray-600">Use the standard chapter tutor.</p>
          </Link>
          <Link href="/chapter3" className="block rounded-xl border border-gray-200 p-4 hover:shadow-md transition bg-gray-50">
            <h2 className="text-lg font-semibold">Chapter 3: Transport Layer</h2>
            <p className="text-sm text-gray-600">Use the standard chapter tutor.</p>
          </Link>
          <Link href="/chapter4" className="block rounded-xl border border-gray-200 p-4 hover:shadow-md transition bg-gray-50">
            <h2 className="text-lg font-semibold">Chapter 4: The Network Layer: Data Plane</h2>
            <p className="text-sm text-gray-600">Use the standard chapter tutor.</p>
          </Link>
          <Link href="/chapter5" className="block rounded-xl border border-gray-200 p-4 hover:shadow-md transition bg-gray-50">
            <h2 className="text-lg font-semibold">Chapter 5: The Network Layer: Control Plane</h2>
            <p className="text-sm text-gray-600">Use the standard chapter tutor.</p>
          </Link>
          <Link href="/chapter6" className="block rounded-xl border border-gray-200 p-4 hover:shadow-md transition bg-gray-50">
            <h2 className="text-lg font-semibold">Chapter 6: The Link Layer and LANs</h2>
            <p className="text-sm text-gray-600">Use the standard chapter tutor.</p>
          </Link>
          <Link href="/chapter7" className="block rounded-xl border border-gray-200 p-4 hover:shadow-md transition bg-gray-50">
            <h2 className="text-lg font-semibold">Chapter 7: Wireless and Mobile Networks</h2>
            <p className="text-sm text-gray-600">Use the standard chapter tutor.</p>
          </Link>
          <Link href="/chapter8" className="block rounded-xl border border-gray-200 p-4 hover:shadow-md transition bg-gray-50">
            <h2 className="text-lg font-semibold">Chapter 8: Security in Computer Networks</h2>
            <p className="text-sm text-gray-600">Use the standard chapter tutor.</p>
          </Link>
        </div>

        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-lg font-semibold">Custom RAG Tutor (Chapter 1)</h3>
          <p className="text-sm text-gray-700 mb-3">Our Retrieval-Augmented Generation tutor built for Chapter 1 with MongoDB Atlas Vector Search.</p>
          <Link href="/rag-chapter1" className="inline-block rounded-full bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 transition">Open RAG Tutor</Link>
        </div>


      </div>
    </main>
  )
}

