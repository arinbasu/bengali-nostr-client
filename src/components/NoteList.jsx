import { useEffect, useState } from "react";
import { fetchRecentNotes } from "../lib/nostr";
import { NoteCard } from "./NoteCard";
import { useProfile } from "../contexts/useProfile";

export function NoteList({ refreshTrigger, newNotes, feedMode, following }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { ensureProfiles } = useProfile();

  const loadNotes = async () => {
  setLoading(true);
  const authors = feedMode === "following" ? [...following] : null;
  const events = await fetchRecentNotes(30, authors);

  // Filter out obvious non-notes
  const filtered = events.filter((event) => {
    const content = (event.content || "").trim();
    if (!content) return false;

    // Skip JSON-looking content (presence events, etc.)
    if (content.startsWith("{") && content.endsWith("}")) return false;

    // Skip known protocol-noise patterns
    if (content.includes('"type":"presence"')) return false;

    return true;
  });

  setNotes(filtered);
  setLoading(false);

  // Fetch profiles for everyone in the feed
  const pubkeys = filtered.map((e) => e.pubkey);
  ensureProfiles(pubkeys);
};

  useEffect(() => {
    loadNotes();
  }, [refreshTrigger, feedMode]);

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
          ? "আপনি এখনো কাউকে অনুসরণ করেননি।"
          : "এখনো কোনো পোস্ট নেই।"}
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