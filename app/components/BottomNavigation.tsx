import Link from 'next/link';

interface BottomNavigationProps {
  chapterNumber: number;
  isRAG?: boolean;
}

const BottomNavigation = ({ chapterNumber, isRAG = false }: BottomNavigationProps) => {
  const getPrevChapter = () => {
    if (isRAG) return null; // RAG chapter doesn't have previous
    return chapterNumber > 1 ? chapterNumber - 1 : null;
  };
  
  const getNextChapter = () => {
    if (isRAG) return 2; // RAG chapter goes to Chapter 2
    if (chapterNumber === 1) return 'rag'; // Chapter 1 goes to RAG
    return chapterNumber < 8 ? chapterNumber + 1 : null;
  };

  const getNextChapterLink = () => {
    const next = getNextChapter();
    if (next === 'rag') return '/rag-chapter1';
    if (next === 2 && isRAG) return '/chapter2';
    return next ? `/chapter${next}` : null;
  };

  const getNextChapterText = () => {
    const next = getNextChapter();
    if (next === 'rag') return 'RAG Tutor →';
    if (next === 2 && isRAG) return 'Chapter 2 →';
    return next ? `Chapter ${next} →` : null;
  };

  const getPrevChapterLink = () => {
    const prev = getPrevChapter();
    return prev ? `/chapter${prev}` : null;
  };

  return (
    <>
      {/* Bottom Left Navigation */}
      {getPrevChapter() && (
        <div className="fixed bottom-6 left-6 z-50">
          <Link 
            href={getPrevChapterLink()!}
            className="flex items-center px-4 py-3 bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600 transition-all duration-200 hover:scale-105"
          >
            <span className="mr-2">←</span>
            <div className="text-left">
              <div className="text-xs opacity-75">Previous</div>
              <div className="font-medium">Chapter {getPrevChapter()}</div>
            </div>
          </Link>
        </div>
      )}

      {/* Bottom Right Navigation */}
      {getNextChapterLink() && (
        <div className="fixed bottom-6 right-6 z-50">
          <Link 
            href={getNextChapterLink()!}
            className="flex items-center px-4 py-3 bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600 transition-all duration-200 hover:scale-105"
          >
            <div className="text-right">
              <div className="text-xs opacity-75">Next</div>
              <div className="font-medium">{getNextChapterText()?.replace(' →', '')}</div>
            </div>
            <span className="ml-2">→</span>
          </Link>
        </div>
      )}
    </>
  );
};

export default BottomNavigation;
