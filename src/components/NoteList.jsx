import { useEffect, useState } from "react";
import { fetchRecentNotes } from "../lib/nostr";
import { NoteCard } from "./NoteCard";
import { useProfile } from "../contexts/useProfile";
import detectScriptFamily from "hardcoded-language-detector";

// --- Junk detection helpers ---

// Hex dumps: long, no spaces, mostly a-f and 0-9
function isHexDump(text) {
  if (text.length < 60) return false;
  if (/\s/.test(text)) return false;
  return /^[0-9a-fA-F]+$/.test(text);
}

// Known spam phrases and domains
const SPAM_PHRASES = [
  "airdrop",
  "claim your",
  "free crypto",
  "click here",
  "shorturl.at",
  "bit.ly",
  "t.me/",
  "giveaway",
  "whitelist",
];

function isSpam(text) {
  const lower = text.toLowerCase();
  return SPAM_PHRASES.some((p) => lower.includes(p));
}

// Relay protocol noise
function isRelayNoise(text) {
  return text.startsWith("channel:");
}

// Too short to be meaningful
function isTooShort(text) {
  const words = text.trim().split(/\s+/);
  return words.length < 2 && text.length < 15;
}

// --- Main component ---

export function NoteList({ refreshTrigger, newNotes, feedMode, following }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { ensureProfiles } = useProfile();

  const loadNotes = async () => {
    setLoading(true);
    const authors = feedMode === "following" ? [...following] : null;
    const events = await fetchRecentNotes(30, authors);

    const filtered = events.filter((event) => {
      const content = (event.content || "").trim();

      // Empty
      if (!content) return false;

      // Too short
      if (isTooShort(content)) return false;

      // Hex dumps (raw keys, signatures, event IDs)
      if (isHexDump(content)) return false;

      // Relay protocol noise
      if (isRelayNoise(content)) return false;

      // Spam / phishing
      if (isSpam(content)) return false;

      // JSON-looking content (presence events, etc.)
      if (content.startsWith("{") && content.endsWith("}")) return false;
      if (content.includes('"type":"presence"')) return false;

      // Language filter: only Brahmic (Bengali) and Latin (English/European)
      const result = detectScriptFamily(content);
      return result.top === "br" || result.top === "la";
    });

    setNotes(filtered);
    setLoading(false);

    // Fetch profiles for everyone in the filtered feed
    ensureProfiles(filtered.map((e) => e.pubkey));
  };

  useEffect(() => {
    loadNotes();
  }, [refreshTrigger, feedMode]);

  // Merge optimistic notes with fetched notes, deduplicate
  const allNotes = [...newNotes, ...notes];
  const uniqueNotes = allNotes.filter(
    (note, index, self) => index === self.findIndex((n) => n.id === note.id)
  );

  if (loading && uniqueNotes.length === 0) {
    return <div className="p-8 text-center text-muted">লোড হচ্ছে...</div>;
  }

  if (uniqueNotes.length === 0) {
    return (
      <div className="p-8 text-center text-muted">
        {feedMode === "following"
          ? "আপনি এখনো কাউকে অনুসরণ করেননি, অথবা অনুসরণ করা কারও পোস্ট নেই।"
          : "এখনো কোনো বাংলা বা ইংরেজি পোস্ট পাওয়া যায়নি।"}
      </div>
    );
  }

  return (
    <div>
      {uniqueNotes.map((event) => (
        <NoteCard key={event.id} event={event} />
      ))}
    </div>
  );
}