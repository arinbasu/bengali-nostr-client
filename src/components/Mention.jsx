import { useEffect } from "react";
import { nip19 } from "nostr-tools";
import { useProfile, getDisplayName } from "../contexts/useProfile";

export function Mention({ npubId }) {
  const { profiles, ensureProfiles } = useProfile();

  let pubkey = null;
  try {
    const decoded = nip19.decode(npubId);
    if (decoded.type === "npub") {
      pubkey = decoded.data;
    } else if (decoded.type === "nprofile") {
      pubkey = decoded.data.pubkey;
    }
  } catch {
    // Invalid encoding — render raw
  }

  useEffect(() => {
    if (pubkey && !profiles.has(pubkey)) {
      ensureProfiles([pubkey]);
    }
  }, [pubkey]);

  if (!pubkey) {
    return <span>nostr:{npubId}</span>;
  }

  const profile = profiles.get(pubkey);
  
  // ← CHANGED: fallback to shortened npub instead of "অজ্ঞাত ব্যবহারকারী"
  const shortNpub = `${npubId.slice(0, 12)}...${npubId.slice(-4)}`;
  const displayName = getDisplayName(profile, shortNpub);

  return (
    <a
      href={`https://njump.me/${npubId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`hover:underline font-medium ${
        profile ? "text-blue-600" : "text-gray-500"
      }`}
      title={npubId}
    >
      @{displayName}
    </a>
  );
}