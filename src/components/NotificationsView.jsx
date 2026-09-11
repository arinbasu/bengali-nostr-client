import { useEffect, useState } from "react";
import { nip19 } from "nostr-tools";
import { fetchNotifications } from "../lib/nostr";
import { useAccount } from "../contexts/useAccount";
import { useProfile, getDisplayName } from "../contexts/useProfile";

function timeAgo(timestamp) {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return "এখনই";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} মিনিট আগে`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ঘণ্টা আগে`;
  return `${Math.floor(hours / 24)} দিন আগে`;
}

const KIND_LABEL = {
  1: "উত্তর দিয়েছেন",
  6: "রিপোস্ট করেছেন",
  7: "লাইক দিয়েছেন",
};

export function NotificationsView() {
  const { account } = useAccount();
  const { profiles, ensureProfiles } = useProfile();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account?.publicKey) return;

    let cancelled = false;
    setLoading(true);

    fetchNotifications(account.publicKey).then((events) => {
      if (cancelled) return;
      setNotifications(events);
      ensureProfiles(events.map((e) => e.pubkey));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [account?.publicKey]);

  if (loading) {
    return (
      <div className="p-8 text-center text-muted">বিজ্ঞপ্তি লোড হচ্ছে...</div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center text-muted">এখনো কোনো বিজ্ঞপ্তি নেই।</div>
    );
  }

  return (
    <div>
      {notifications.map((event) => {
        const npub = nip19.npubEncode(event.pubkey);
        const shortNpub = `${npub.slice(0, 10)}...${npub.slice(-4)}`;
        const profile = profiles.get(event.pubkey);
        const displayName = getDisplayName(profile, shortNpub);

        return (
          <div
            key={event.id}
            className="px-4 py-3 border-b border-gray-100 flex gap-3"
          >
            {profile?.picture ? (
              <img
                src={profile.picture}
                alt=""
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700">
                <span className="font-medium text-gray-900">
                  {displayName}
                </span>{" "}
                <span className="text-gray-500">
                  {KIND_LABEL[event.kind] || "মিথস্ক্রিয়া"}
                </span>
              </p>
              {event.kind === 1 && event.content && (
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                  {event.content}
                </p>
              )}
              <p className="mt-0.5 text-xs text-gray-400">
                {timeAgo(event.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}