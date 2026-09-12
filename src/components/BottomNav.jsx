export function BottomNav({ current, onChange }) {
  const tabs = [
    { id: "home", icon: "🏠", label: "হোম" },
    { id: "explore", icon: "🌐", label: "ঘুরে দেখুন " },     // trending, suggestions
    { id: "search", icon: "🔍", label: "খোঁজ" },         // npub lookup, keyword search
    { id: "notifications", icon: "🔔", label: "বিজ্ঞপ্তি" },
    { id: "profile", icon: "👤", label: "নিজের ব্যাপার" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 md:max-w-xl md:mx-auto md:border-x">
      <div className="flex justify-around items-center h-16">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex flex-col items-center transition flex-1 ${
              current === tab.id
                ? "text-blue-600"
                : "text-gray-500 hover:text-blue-600"
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span className="text-[10px] mt-0.5 leading-tight">
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}