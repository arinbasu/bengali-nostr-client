import { useEffect, useState } from "react";
import { nip19 } from "nostr-tools";
import { fetchRecentNotes } from "../lib/nostr";
import { useAccount } from "../contexts/useAccount";
import { useProfile } from "../contexts/useProfile";
import { NoteCard } from "./NoteCard";
import { EditProfileModal } from "./EditProfileModal";

const NOTES_CACHE_KEY = "balaka_my_notes";
const MAX_CACHED_NOTES = 30;

export function ProfileView() {
  const { account, logout } = useAccount();
  const { profiles, forceRefreshProfile } = useProfile();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const profile = account?.publicKey ? profiles.get(account.publicKey) : null;

  useEffect(() => {
    if (!account?.publicKey) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      // ---- 1. Read cache ----
      let cached = [];
      try {
        const raw = localStorage.getItem(NOTES_CACHE_KEY);
        console.log("Cache raw:", raw ? raw.length + " chars" : "null");
        cached = JSON.parse(raw || "[]");
        cached = cached.filter((n) => n.pubkey === account.publicKey);
        console.log("Cache loaded:", cached.length, "notes");
      } catch (err) {
        console.error("Failed to load cache:", err);
      }

      // Show cached notes immediately
      if (!cancelled && cached.length > 0) {
        setNotes(cached);
        setLoading(false);
      }

      // ---- 2. Fetch fresh profile + notes in parallel ----
      const [, fetched] = await Promise.all([
        forceRefreshProfile(account.publicKey),
        fetchRecentNotes(50, [account.publicKey]),
      ]);

      if (cancelled) return;

      // ---- 3. Merge, dedupe, sort ----
      const seen = new Set();
      const merged = [];
      for (const n of [...fetched, ...cached]) {
        if (!seen.has(n.id)) {
          seen.add(n.id);
          merged.push(n);
        }
      }
      merged.sort((a, b) => b.created_at - a.created_at);

      setNotes(merged);
      setLoading(false);

      // ---- 4. Save a slim version to cache ----
      if (merged.length > 0) {
        try {
          const slim = merged.slice(0, MAX_CACHED_NOTES).map((n) => ({
            id: n.id,
            pubkey: n.pubkey,
            created_at: n.created_at,
            kind: n.kind,
            content: n.content,
            tags: (n.tags || []).slice(0, 10),
          }));
          localStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(slim));
          console.log("Saved", slim.length, "notes to cache");
        } catch (err) {
          console.error("Failed to cache notes:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [account?.publicKey, forceRefreshProfile]);

  const handleCopyNpub = () => {
    if (!account?.npub) return;
    navigator.clipboard.writeText(account.npub);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!account) return null;

  const shortNpub = `${account.npub.slice(0, 12)}...${account.npub.slice(-6)}`;
  const displayName = profile?.display_name || profile?.name || shortNpub;

  return (
    <div>
      {/* Header card */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-4 mb-4">
          {profile?.picture ? (
            <img
              src={profile.picture}
              alt=""
              className="w-16 h-16 rounded-full object-cover"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 items-center justify-center"
            style={{ display: profile?.picture ? "none" : "flex" }}
          />

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">
              {displayName}
            </h2>
            <p className="text-xs text-gray-500 font-mono truncate">
              {shortNpub}
            </p>
          </div>
        </div>

        {profile?.about && (
          <p className="text-sm text-gray-700 mb-3">{profile.about}</p>
        )}

        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            onClick={() => setEditOpen(true)}
            className="py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            প্রোফাইল সম্পাদনা
          </button>
          <button
            onClick={handleCopyNpub}
            className="py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            {copied ? "কপি হয়েছে ✅" : "npub কপি করুন"}
          </button>
        </div>

        <button
          onClick={logout}
          className="w-full py-2 text-sm rounded-lg bg-red-500 text-white font-medium hover:bg-red-600"
        >
          লগ আউট
        </button>

        <p className="mt-3 text-xs text-gray-400 break-all">
          সম্পূর্ণ ঠিকানা: {account.npub}
        </p>
      </div>

      {/* Own posts */}
      <div>
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
          আপনার পোস্ট
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">লোড হচ্ছে...</div>
        ) : notes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            এখনো কোনো পোস্ট করেননি।
          </div>
        ) : (
          notes.map((event) => <NoteCard key={event.id} event={event} />)
        )}
      </div>

      {/* Edit modal */}
      <EditProfileModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}