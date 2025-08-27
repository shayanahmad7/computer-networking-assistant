import Image from 'next/image';
import Link from 'next/link';

interface ChapterHeaderProps {
  chapterNumber: number;
  chapterTitle: string;
}

const ChapterHeader = ({ chapterNumber, chapterTitle }: ChapterHeaderProps) => {
  const getPrevChapter = () => chapterNumber > 1 ? chapterNumber - 1 : null;
  const getNextChapter = () => chapterNumber < 8 ? chapterNumber + 1 : null;

  return (
    <>
      {/* Compact Top Bar */}
      <div className="w-full flex items-center justify-between bg-[#a4150b] px-4 py-2">
        <div className="flex items-center">
          <Image src="/book_cover.png" alt="Book Cover" width={32} height={32} className="rounded-full mr-2" />
          <span className="text-white text-lg font-bold">Tutor for Computer Networking: A Top-Down Approach</span>
        </div>
        <Link href="/" className="text-white text-xl font-bold focus:outline-none hover:bg-red-800 px-2 py-1 rounded" aria-label="Home">
          🏠
        </Link>
      </div>
      
      {/* Navigation Bar */}
      <div className="w-full flex items-center justify-between bg-gray-100 px-4 py-2 border-b">
        <div className="flex items-center space-x-2">
          {getPrevChapter() && (
            <Link 
              href={`/chapter${getPrevChapter()}`}
              className="flex items-center px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              ← Chapter {getPrevChapter()}
            </Link>
          )}
        </div>
        
        <Link 
          href="/"
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
        >
          All Chapters
        </Link>
        
        <div className="flex items-center space-x-2">
          {getNextChapter() && (
            <Link 
              href={`/chapter${getNextChapter()}`}
              className="flex items-center px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              Chapter {getNextChapter()} →
            </Link>
          )}
        </div>
      </div>
      
      {/* Condensed Center Section */}
      <div className="flex flex-col items-center mt-4 mb-2">
        <Image src="/book_cover.png" alt="Book Cover" width={56} height={56} className="rounded-full mb-2" />
        <h2 className="text-xl md:text-2xl font-bold mb-1 text-center">Chapter {chapterNumber}: {chapterTitle}</h2>
        <p className="text-gray-500 text-center max-w-2xl text-sm">
          This chapter-aware networking tutor is powered by ChatGPT and tailored to Chapter {chapterNumber}.
        </p>
      </div>
    </>
  );
};

export default ChapterHeader; 