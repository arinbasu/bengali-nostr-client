import { useState } from "react";
import { Header } from "./components/Header";
import { BottomNav } from "./components/BottomNav";
import { NoteComposer } from "./components/NoteComposer";
import { NoteList } from "./components/NoteList";
import { getNpub } from "./lib/nostr";

export default function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [newNotes, setNewNotes] = useState([]);

  // TEMPORARY: Check the browser console to see your npub.
  // Remove this line after you verify it works.
  // console.log("My npub is:", getNpub());

  const handlePublished = (newEvent) => {
    // Add the new note to the top of the list immediately
    setNewNotes((prev) => [newEvent, ...prev]);
    // Trigger a background refresh from relays
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-xl mx-auto border-x border-border min-h-screen pb-16">
        <NoteComposer onPublished={handlePublished} />
        <NoteList refreshTrigger={refreshTrigger} newNotes={newNotes} />
      </main>
      <BottomNav />
    </div>
  );
}