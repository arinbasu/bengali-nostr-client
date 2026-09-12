import { useState } from "react";
import { nip19 } from "nostr-tools";
import { fetchRecentNotes } from "../lib/nostr";
import { NoteCard } from "./NoteCard";
import { useProfile, getDisplayName } from "../contexts/useProfile";

export function SearchView() {
  const { profiles, ensureProfiles } = useProfile();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("idle");
  const [results, setResults] = useState([]);
  const [foundPubkey, setFoundPubkey] = useState(null);
  const [error, setError] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError("");
    setResults([]);
    setFoundPubkey(null);

    try {
      if (q.startsWith("npub1")) {
        const decoded = nip19.decode(q);
        if (decoded.type !== "npub") throw new Error("Not an npub");

        const pubkey = decoded.data;
        setFoundPubkey(pubkey);
        ensureProfiles([pubkey]);

        const notes = await fetchRecentNotes(50, [pubkey]);
        setResults(notes);
        setMode("profile");
        setLoading(false);
        return;
      }

      const notes = await fetchRecentNotes(150);
      const lower = q.toLowerCase();
      const filtered = notes.filter((n) =>
        (n.content || "").toLowerCase().includes(lower)
      );
      setResults(filtered);
      setMode("keyword");
      setLoading(false);
      ensureProfiles(filtered.map((n) => n.pubkey));
    } catch (err) {
      console.error(err);
      setError("অনুসন্ধান ব্যর্থ হয়েছে। npub বা শব্দ দিয়ে আবার চেষ্টা করুন।");
      setLoading(false);
    }
  };

  const foundProfile = foundPubkey ? profiles.get(foundPubkey) : null;
  const foundName = foundPubkey
    ? getDisplayName(foundProfile, foundPubkey.slice(0, 12) + "...")
    : "";

  return (
    <div>
      <form
        onSubmit={handleSearch}
        className="p-4 border-b border-gray-200 flex gap-2"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="npub1... বা শব্দ লিখুন"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "..." : "খুঁজুন"}
        </button>
      </form>

      {mode === "idle" && (
        <div className="p-8 text-center text-gray-400 text-sm">
          <p className="mb-3">
            একটি npub লিখলে সেই ব্যবহারকারীর পোস্ট দেখতে পাবেন।
          </p>
          <p className="text-xs">
            অথবা একটি শব্দ লিখে সাম্প্রতিক পোস্টে খুঁজুন।
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 text-red-600 text-sm text-center">{error}</div>
      )}

      {mode === "profile" && foundPubkey && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            {foundProfile?.picture ? (
              <img
                src={foundProfile.picture}
                alt=""
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500" />
            )}
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">{foundName}</p>
              <p className="text-xs text-gray-500 font-mono truncate">
                {foundPubkey.slice(0, 16)}...
              </p>
            </div>
          </div>
        </div>
      )}

      {mode === "keyword" && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
          "{query}" এর জন্য {results.length} টি ফলাফল
        </div>
      )}

      {!loading && mode !== "idle" && results.length === 0 && !error && (
        <div className="p-8 text-center text-gray-400 text-sm">
          কোনো ফলাফল পাওয়া যায়নি।
        </div>
      )}

      {results.map((event) => (
        <NoteCard key={event.id} event={event} />
      ))}
    </div>
  );
}