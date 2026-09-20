export function MentionDropdown({ candidates, activeIndex, onSelect }) {
  if (!candidates.length) return null;

  return (
    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto w-72">
      {candidates.map((c, i) => (
        <button
          key={c.pubkey}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(c);
          }}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left transition ${
            i === activeIndex ? "bg-blue-50" : "hover:bg-gray-50"
          }`}
        >
          {c.profile.picture ? (
            <img
              src={c.profile.picture}
              alt=""
              className="w-6 h-6 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {c.name || c.nip05}
            </p>
            {c.nip05 && c.name && (
              <p className="text-xs text-gray-500 truncate">{c.nip05}</p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}