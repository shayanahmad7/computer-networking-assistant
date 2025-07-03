import Image from 'next/image';

const ChapterHeader = () => (
  <>
    {/* Top Red Bar */}
    <div className="w-full flex items-center justify-between bg-[#a4150b] px-6 py-3">
      <div className="flex items-center">
        <Image src="/book_cover.png" alt="Book Cover" width={40} height={40} className="rounded-full mr-3" />
        <span className="text-white text-xl font-bold">Tutor for Computer Networking: A Top-Down Approach</span>
      </div>
      <button className="text-white text-2xl font-bold focus:outline-none" aria-label="Close">
        ×
      </button>
    </div>
    {/* Centered Section */}
    <div className="flex flex-col items-center mt-8 mb-6">
      <Image src="/book_cover.png" alt="Book Cover" width={80} height={80} className="rounded-full mb-4" />
      <h2 className="text-2xl font-bold mb-2 text-center">Tutor for Computer Networking: A Top-Down Approach</h2>
      <p className="text-gray-500 text-center max-w-2xl">
        This "networking tutor," driven by ChatGPT, has been customized with this chapter of Computer Networking: a Top Down Approach.<br/>
        Thus, your interactions with this tutor will be informed by this chapter material.
      </p>
    </div>
  </>
);

export default ChapterHeader; 