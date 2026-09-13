import { useEffect, useState } from "react";
import { fetchRecentNotes } from "../lib/nostr";
import { NoteCard } from "./NoteCard";
import { useProfile } from "../contexts/useProfile";
import { useAccount } from "../contexts/useAccount";

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

function isAllowedScript(text, langFilter) {
  const bengali = countMatches(text, /[\u0980-\u09FF]/g);
  const latin = countMatches(text, /[a-zA-Z\u00C0-\u024F]/g);

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

  const disallowed =
    cjk + hangul + cyrillic + arabic + devanagari +
    tamil + telugu + thai + hebrew + greek;

  if (langFilter === "bengali") {
    if (bengali < 3) return false;
    const allowed = bengali + latin;
    return bengali / allowed >= 0.2;
  }

  const allowed = bengali + latin;
  if (allowed === 0) return false;
  const total = allowed + disallowed;
  return disallowed / total <= 0.15;
}

// Common junk filter — applies to network notes only
function isJunkNote(event) {
  const content = (event.content || "").trim();
  if (!content) return true;
  if (isTooShort(content)) return true;
  if (isHexDump(content)) return true;
  if (isRelayNoise(content)) return true;
  if (isSpam(content)) return true;
  if (content.startsWith("{") && content.endsWith("}")) return true;
  if (content.includes('"type":"presence"')) return true;
  return false;
}

// --- Main component ---

export function NoteList({
  refreshTrigger,
  newNotes,
  feedMode,
  following,
  langFilter = "both",
}) {
  const [networkNotes, setNetworkNotes] = useState([]);
  const [ownNotes, setOwnNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { ensureProfiles } = useProfile();
  const { account } = useAccount();

  const loadNotes = async () => {
    setLoading(true);

    try {
      if (feedMode === "following") {
        // Following feed: just fetch network notes from followed accounts
        // (own posts only appear if you follow yourself, matching X/Bluesky behavior)
        const authors = [...following];
        const fetched = await fetchRecentNotes(100, authors.length ? authors : null);
        const filtered = fetched.filter(
          (e) => !isJunkNote(e) && isAllowedScript(e.content, langFilter)
        );
        setNetworkNotes(filtered.slice(0, 30));
        setOwnNotes([]);
      } else {
        // Global feed: fetch network notes AND own notes separately
        const [fetched, own] = await Promise.all([
          fetchRecentNotes(100),
          account?.publicKey
            ? fetchRecentNotes(30, [account.publicKey])
            : Promise.resolve([]),
        ]);

        // Filter network notes
        const filtered = fetched.filter(
          (e) => !isJunkNote(e) && isAllowedScript(e.content, langFilter)
        );

        // Own notes are NEVER filtered — always show what you wrote
        const cleanOwn = own.filter((e) => !isJunkNote(e));

        setNetworkNotes(filtered.slice(0, 30));
        setOwnNotes(cleanOwn);
      }

      const allPubkeys = [
        ...ownNotes.map((e) => e.pubkey),
        ...networkNotes.map((e) => e.pubkey),
      ];
      if (allPubkeys.length > 0) ensureProfiles(allPubkeys);
    } catch (err) {
      console.error("Failed to load notes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger, feedMode, following, langFilter, account?.publicKey]);

  // Merge: optimistic new notes → own notes → network notes
  // Dedupe by ID, preserving order (newest first within each group)
  const seen = new Set();
  const merged = [];
  for (const n of [...newNotes, ...ownNotes, ...networkNotes]) {
    if (!seen.has(n.id)) {
      seen.add(n.id);
      merged.push(n);
    }
  }

  if (loading && merged.length === 0) {
    return <div className="p-8 text-center text-muted">লোড হচ্ছে...</div>;
  }

  if (merged.length === 0) {
    return (
      <div className="p-8 text-center text-muted">
        {feedMode === "following"
          ? "আপনি এখনো কাউকে অনুসরণ করেননি, অথবা অনুসরণ করা কারও পোস্ট নেই।"
          : langFilter === "bengali"
          ? "এখনো কোনো বাংলা পোস্ট পাওয়া যায়নি।"
          : "এখনো কোনো বাংলা বা ইংরেজি পোস্ট পাওয়া যায়নি।"}
      </div>
    );
  }

  return (
    <div>
      {merged.map((event) => (
        <NoteCard key={event.id} event={event} />
      ))}
    </div>
  );
}