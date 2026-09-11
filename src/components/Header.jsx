import { CraneIcon } from "./CraneIcon";

export function Header() {
  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-xl mx-auto px-4 h-14 flex items-center gap-2">
        <CraneIcon className="w-7 h-7 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900">বলাকা</h1>
      </div>
    </header>
  );
}