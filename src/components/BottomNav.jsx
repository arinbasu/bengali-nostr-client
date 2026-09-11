export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 md:max-w-xl md:mx-auto md:border-x">
      <div className="flex justify-around items-center h-16">
        <button className="flex flex-col items-center text-gray-500 hover:text-blue-600">
          <span className="text-xl">🏠</span>
          <span className="text-xs mt-0.5">হোম</span>
        </button>
        <button className="flex flex-col items-center text-gray-500 hover:text-blue-600">
          <span className="text-xl">🔍</span>
          <span className="text-xs mt-0.5">অন্বেষণ</span>
        </button>
        <button className="flex flex-col items-center text-gray-500 hover:text-blue-600">
          <span className="text-xl">🔔</span>
          <span className="text-xs mt-0.5">বিজ্ঞপ্তি</span>
        </button>
        <button className="flex flex-col items-center text-gray-500 hover:text-blue-600">
          <span className="text-xl">👤</span>
          <span className="text-xs mt-0.5">প্রোফাইল</span>
        </button>
      </div>
    </nav>
  );
}