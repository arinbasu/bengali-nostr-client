import { useEffect, useState } from "react";
import { fetchRecentNotes } from "../lib/nostr";
import { NoteCard } from "./NoteCard";

export function NoteList({ refreshTrigger, newNotes }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotes = async () => {
    setLoading(true);
    const events = await fetchRecentNotes(30);
    setNotes(events);
    setLoading(false);
  };

  useEffect(() => {
    loadNotes();
  }, [refreshTrigger]);

  // Merge optimistic notes with fetched notes, and remove duplicates
  const allNotes = [...newNotes, ...notes];
  const uniqueNotes = allNotes.filter(
    (note, index, self) => index === self.findIndex((n) => n.id === note.id)
  );

  if (loading && uniqueNotes.length === 0) {
    return <div className="p-8 text-center text-muted">লোড হচ্ছে...</div>;
  }

  if (uniqueNotes.length === 0) {
    return <div className="p-8 text-center text-muted">এখনো কোনো পোস্ট নেই। প্রথম পোস্টটি আপনিই করুন!</div>;
  }

  return (
    <div>
      {uniqueNotes.map((event) => (
        <NoteCard key={event.id} event={event} />
      ))}
    </div>
  );
}