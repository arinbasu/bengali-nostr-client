import { useState } from "react";
import { CraneIcon } from "./CraneIcon";
import { AboutModal } from "./AboutModal";

export function Header() {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CraneIcon className="w-7 h-7 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">বলাকা</h1>
          </div>
          <button
            onClick={() => setAboutOpen(true)}
            className="w-8 h-8 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm font-bold"
            title="বলাকা সম্পর্কে"
          >
            ? সাহায্য
          </button>
        </div>
      </header>
      <AboutModal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}