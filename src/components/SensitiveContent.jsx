import { useState } from "react";

export function SensitiveContent({ reason, children }) {
  const [isRevealed, setIsRevealed] = useState(false);

  if (isRevealed) {
    return <div>{children}</div>;
  }

  return (
    <div className="relative mt-3 rounded-xl overflow-hidden bg-gray-100">
      {/* Blurred placeholder — no actual media loaded */}
      <div className="h-40 flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-sm text-gray-600 mb-2">
            🔞 {reason || "সংবেদনশীল বিষয়বস্তু"}
          </p>
          <button
            onClick={() => setIsRevealed(true)}
            className="px-4 py-1.5 bg-gray-800 text-white text-xs rounded-full hover:bg-gray-700"
          >
            দেখুন
          </button>
        </div>
      </div>
    </div>
  );
}