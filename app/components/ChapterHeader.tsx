import Image from 'next/image';

const ChapterHeader = () => (
  <>
    {/* Compact Top Bar */}
    <div className="w-full flex items-center justify-between bg-[#a4150b] px-4 py-2">
      <div className="flex items-center">
        <Image src="/book_cover.png" alt="Book Cover" width={32} height={32} className="rounded-full mr-2" />
        <span className="text-white text-lg font-bold">Tutor for Computer Networking: A Top-Down Approach</span>
      </div>
      <button className="text-white text-xl font-bold focus:outline-none" aria-label="Close">
        ×
      </button>
    </div>
    {/* Condensed Center Section */}
    <div className="flex flex-col items-center mt-4 mb-2">
      <Image src="/book_cover.png" alt="Book Cover" width={56} height={56} className="rounded-full mb-2" />
      <h2 className="text-xl md:text-2xl font-bold mb-1 text-center">Tutor for Computer Networking: A Top-Down Approach</h2>
      <p className="text-gray-500 text-center max-w-2xl text-sm">
        This chapter-aware networking tutor is powered by ChatGPT and tailored to the selected chapter.
      </p>
    </div>
  </>
);

export default ChapterHeader; 