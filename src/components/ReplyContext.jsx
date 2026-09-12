import { useEffect, useState } from "react";
import { nip19 } from "nostr-tools";
import { fetchParentEvent } from "../lib/nostr";
import { useProfile, getDisplayName } from "../contexts/useProfile";

export function ReplyContext({ event }) {
  const { profiles, ensureProfiles } = useProfile();
  const [parentEvent, setParentEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Find the parent event ID
  const eTags = event.tags.filter((t) => t[0] === "e");
  const replyMarker = eTags.find((t) => t[3] === "reply");
  const parentId = replyMarker
    ? replyMarker[1]
    : eTags.length > 0
    ? eTags[eTags.length - 1][1]
    : null;

  // Relay hints from the e tag
  const parentRelayHints = replyMarker?.[2] ? [replyMarker[2]] : [];

  useEffect(() => {
    if (!parentId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const ev = await fetchParentEvent(parentId, parentRelayHints);
      if (cancelled) return;
      if (ev) {
        setParentEvent(ev);
        ensureProfiles([ev.pubkey]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [parentId]);

  // Don't render anything if this isn't a reply
  if (!parentId) return null;

  if (loading) {
    return (
      <div className="mt-1 text-xs text-gray-400">↩︎ উত্তর লোড হচ্ছে...</div>
    );
  }

  // If we couldn't fetch the parent, still show a minimal indicator
  if (!parentEvent) {
    return (
      <a
        href={`https://njump.me/${nip19.neventEncode({ id: parentId })}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-1 text-xs text-gray-500 hover:text-blue-600"
      >
        ↩︎ একটি পোস্টে উত্তর
      </a>
    );
  }

  const parentNpub = nip19.npubEncode(parentEvent.pubkey);
  const parentProfile = profiles.get(parentEvent.pubkey);
  const shortNpub = `${parentNpub.slice(0, 10)}...${parentNpub.slice(-4)}`;
  const parentName = getDisplayName(parentProfile, shortNpub);

  const parentPreview =
    parentEvent.content.length > 80
      ? parentEvent.content.slice(0, 80).trim() + "…"
      : parentEvent.content;

  return (
    <a
      href={`https://njump.me/${nip19.neventEncode({ id: parentEvent.id })}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-1 mb-1 text-xs text-gray-500 hover:text-blue-600 group"
    >
      <span>
        ↩︎ <span className="font-medium">@{parentName}</span>-কে উত্তর
      </span>
      {parentPreview && (
        <span className="block text-gray-400 truncate mt-0.5 group-hover:text-blue-500">
          {parentPreview}
        </span>
      )}
    </a>
  );
}