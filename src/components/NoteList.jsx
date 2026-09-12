import { useEffect, useState } from "react";
import { fetchRecentNotes } from "../lib/nostr";
import { NoteCard } from "./NoteCard";
import { useProfile } from "../contexts/useProfile";

// --- Junk detection helpers ---

function isHexDump(text) {
  if (text.length < 60) return false;
  if (/\s/.test(text)) return false;
  return /^[0-9a-fA-F]+$/.test(text);
}

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

function isRelayNoise(text) {
  return text.startsWith("channel:");
}

function isTooShort(text) {
  const words = text.trim().split(/\s+/);
  return words.length < 2 && text.length < 15;
}

// --- Script filtering ---

function countMatches(text, regex) {
  return (text.match(regex) || []).length;
}

function isAllowedScript(text) {
  // Allowed scripts
  const bengali = countMatches(text, /[\u0980-\u09FF]/g);
  const latin = countMatches(text, /[a-zA-Z\u00C0-\u024F]/g);

  // Disallowed scripts
  const cjk = countMatches(
    text,
    /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g
  );
  const hangul = countMatches(text, /[\uAC00-\uD7AF\u1100-\u11FF]/g);
  const cyrillic = countMatches(text, /[\u0400-\u04FF]/g);
  const arabic = countMatches(text, /[\u0600-\u06FF\u0750-\u077F]/g);
  const devanagari = countMatches(text, /[\u0900-\u097F]/g);
  const tamil = countMatches(text, /[\u0B80-\u0BFF]/g);
  const telugu = countMatches(text, /[\u0C00-\u0C7F]/g);
  const thai = countMatches(text, /[\u0E00-\u0E7F]/g);
  const hebrew = countMatches(text, /[\u0590-\u05FF]/g);
  const greek = countMatches(text, /[\u0370-\u03FF]/g);

  const allowed = bengali + latin;
  const disallowed =
    cjk + hangul + cyrillic + arabic + devanagari +
    tamil + telugu + thai + hebrew + greek;

  if (allowed === 0) return false;

  // Reject if disallowed scripts exceed 15% of the text
  const total = allowed + disallowed;
  return disallowed / total <= 0.15;
}

// --- Main component ---

export function NoteList({ refreshTrigger, newNotes, feedMode, following }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { ensureProfiles } = useProfile();

  const loadNotes = async () => {
    setLoading(true);
    const authors = feedMode === "following" ? [...following] : null;
    const events = await fetchRecentNotes(100, authors);

    const filtered = events.filter((event) => {
      const content = (event.content || "").trim();

      if (!content) return false;
      if (isTooShort(content)) return false;
      if (isHexDump(content)) return false;
      if (isRelayNoise(content)) return false;
      if (isSpam(content)) return false;
      if (content.startsWith("{") && content.endsWith("}")) return false;
      if (content.includes('"type":"presence"')) return false;

      // Script filter: only Bengali + Latin content
      return isAllowedScript(content);
    });

    // Take only the 30 most recent after filtering
    const finalNotes = filtered.slice(0, 30);

    setNotes(finalNotes);
    setLoading(false);
    ensureProfiles(finalNotes.map((e) => e.pubkey));
  };

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger, feedMode, following]);

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