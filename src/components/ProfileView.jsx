import { useEffect, useState } from "react";
import { nip19 } from "nostr-tools";
import { fetchRecentNotes, fetchProfiles } from "../lib/nostr";
import { useAccount } from "../contexts/useAccount";
import { NoteCard } from "./NoteCard";

export function ProfileView() {
  const { account, logout } = useAccount();
  const [profile, setProfile] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!account?.publicKey) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [profiles, notes] = await Promise.all([
        fetchProfiles([account.publicKey]),
        fetchRecentNotes(50, [account.publicKey]),
      ]);
      if (cancelled) return;
      setProfile(profiles.get(account.publicKey) || null);
      setNotes(notes);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [account?.publicKey]);

  const handleCopyNpub = () => {
    navigator.clipboard.writeText(account.npub);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500" />
          )}
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

        <div className="flex gap-2">
          <button
            onClick={handleCopyNpub}
            className="flex-1 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            {copied ? "কপি হয়েছে ✅" : "npub কপি করুন"}
          </button>
          <button
            onClick={logout}
            className="flex-1 py-2 text-sm rounded-lg bg-red-500 text-white font-medium hover:bg-red-600"
          >
            লগ আউট
          </button>
        </div>

        <p className="mt-3 text-xs text-gray-400 break-all">
          সম্পূর্ণ ঠিকানা: {account.npub}
        </p>
      </div>

      {/* Notes */}
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
    </div>
  );
}