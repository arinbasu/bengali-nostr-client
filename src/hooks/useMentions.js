import { useState, useEffect, useMemo } from "react";
import { nip19 } from "nostr-tools";

// Detects "@query" at the cursor and returns candidates from
// the accounts you follow. Returns null when not in a mention.
export function useMentions({ text, cursorPos, following, profiles }) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Find the "@word" fragment ending at the cursor
  const mentionQuery = useMemo(() => {
    if (cursorPos == null || !text) return null;

    // Look backwards from cursor to find "@"
    const before = text.slice(0, cursorPos);
    const atIndex = before.lastIndexOf("@");
    if (atIndex === -1) return null;

    // "@" must be at start or preceded by whitespace
    const charBefore = atIndex > 0 ? before[atIndex - 1] : "";
    if (charBefore && !/\s/.test(charBefore)) return null;

    const query = before.slice(atIndex + 1);
    // Stop if there's whitespace inside the query (mention is finished)
    if (/\s/.test(query)) return null;

    return {
      atIndex,
      query: query.toLowerCase(),
      length: query.length + 1, // includes "@"
    };
  }, [text, cursorPos]);

  // Build candidate list: followed accounts whose name matches
  const candidates = useMemo(() => {
    if (!mentionQuery || !following) return [];

    const list = [];
    for (const pubkey of following) {
      const profile = profiles.get(pubkey);
      if (!profile) continue;

      const name = profile.display_name || profile.name || "";
      const nip05 = profile.nip05 || "";

      if (!name && !nip05) continue;

      const query = mentionQuery.query;
      const matchesName = name.toLowerCase().includes(query);
      const matchesNip05 = nip05.toLowerCase().includes(query);

      if (!query || matchesName || matchesNip05) {
        list.push({ pubkey, name, nip05, profile });
      }
    }

    // Sort: exact prefix matches first, then alphabetical
    list.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(mentionQuery.query);
      const bStarts = b.name.toLowerCase().startsWith(mentionQuery.query);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return list.slice(0, 8);
  }, [mentionQuery, following, profiles]);

  // Reset index when the query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [mentionQuery?.query]);

  const isActive = mentionQuery !== null && candidates.length > 0;

  // Replace "@query" with "nostr:npub1..." at the cursor
  const insertMention = (candidate, setText) => {
    if (!mentionQuery) return;

    const npub = nip19.npubEncode(candidate.pubkey);
    const mentionText = `nostr:${npub} `;

    const before = text.slice(0, mentionQuery.atIndex);
    const after = text.slice(cursorPos);
    const next = before + mentionText + after;

    setText(next);
    return before.length + mentionText.length; // new cursor position
  };

  // Keyboard handling — return true if the event was consumed
  const handleKeyDown = (e, setText) => {
    if (!isActive) return false;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, candidates.length - 1));
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return true;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(candidates[activeIndex], setText);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      return true;
    }

    return false;
  };

  return {
    isActive,
    candidates,
    activeIndex,
    setActiveIndex,
    insertMention,
    handleKeyDown,
    mentionQuery,
  };
}