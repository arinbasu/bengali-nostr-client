import { useState } from "react";
import { Header } from "./components/Header";
import { BottomNav } from "./components/BottomNav";
import { NoteComposer } from "./components/NoteComposer";
import { NoteList } from "./components/NoteList";
import { LoginScreen } from "./components/LoginScreen";
import { ProfileView } from "./components/ProfileView";
import { useAccount } from "./contexts/useAccount";

export default function App() {
  const { account, loading } = useAccount();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [newNotes, setNewNotes] = useState([]);
  const [tab, setTab] = useState("home"); // home | explore | notifications | profile

  if (loading) {
    return <div className="p-8 text-center bg-bg min-h-screen text-text">লোড হচ্ছে...</div>;
  }
  if (!account) return <LoginScreen />;

  const handlePublished = (newEvent) => {
    setNewNotes((prev) => [newEvent, ...prev]);
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-xl mx-auto border-x border-border min-h-screen pb-16">
        {tab === "home" && (
          <>
            <NoteComposer onPublished={handlePublished} />
            <NoteList refreshTrigger={refreshTrigger} newNotes={newNotes} />
          </>
        )}
        {tab === "explore" && (
          <div className="p-8 text-center text-muted">অন্বেষণ শীঘ্রই আসছে</div>
        )}
        {tab === "notifications" && (
          <div className="p-8 text-center text-muted">বিজ্ঞপ্তি শীঘ্রই আসছে</div>
        )}
        {tab === "profile" && <ProfileView />}
      </main>
      <BottomNav current={tab} onChange={setTab} />
    </div>
  );
}