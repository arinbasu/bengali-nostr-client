import { useEffect, useState } from "react";
import { nip19 } from "nostr-tools";
import { fetchEventById } from "../lib/nostr";
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

export function EmbeddedNote({ neventId }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { profiles, ensureProfiles } = useProfile();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Decode the nevent to get event id + relay hints
        const decoded = nip19.decode(neventId);
        if (decoded.type !== "nevent") {
          setError(true);
          setLoading(false);
          return;
        }

        const { id, relays } = decoded.data;
        const ev = await fetchEventById(id, relays || []);

        if (cancelled) return;
        if (ev) {
          setEvent(ev);
          ensureProfiles([ev.pubkey]);
        } else {
          setError(true);
        }
      } catch (err) {
        console.warn("Failed to load embedded note:", err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [neventId]);

  // Loading placeholder
  if (loading) {
    return (
      <div className="mt-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
        <p className="text-xs text-gray-400">উদ্ধৃত পোস্ট লোড হচ্ছে...</p>
      </div>
    );
  }

  // Error / not found
  if (error || !event) {
    return (
      <div className="mt-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
        <p className="text-xs text-gray-400">উদ্ধৃত পোস্টটি পাওয়া যায়নি</p>
      </div>
    );
  }

  // Render the quoted note
  const profile = profiles.get(event.pubkey);
  const displayName = getDisplayName(profile, "অজ্ঞাত ব্যবহারকারী");

  const imetaTag = event.tags.find((t) => t[0] === "imeta");
  const imageUrl = imetaTag
    ? imetaTag.find((t) => t.startsWith("url "))?.replace("url ", "")
    : null;

  return (
    <a
      href={`https://njump.me/${neventId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
    >
      {/* Author row */}
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
        {profile?.picture ? (
          <img
            src={profile.picture}
            alt=""
            className="w-5 h-5 rounded-full object-cover"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500" />
        )}
        <span className="font-medium text-gray-700">{displayName}</span>
        <span>·</span>
        <span>{timeAgo(event.created_at)}</span>
      </div>

      {/* Content — plain text, no nested embeds to avoid infinite recursion */}
      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words line-clamp-4">
        {event.content}
      </p>

      {/* Image if present */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="mt-2 rounded-lg max-h-60 object-cover"
        />
      )}
    </a>
  );
}