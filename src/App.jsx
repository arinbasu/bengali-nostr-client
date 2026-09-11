import { useState } from "react";
import { Header } from "./components/Header";
import { BottomNav } from "./components/BottomNav";
import { NoteComposer } from "./components/NoteComposer";
import { NoteList } from "./components/NoteList";
import { LoginScreen } from "./components/LoginScreen";
import { ProfileView } from "./components/ProfileView";
import { NotificationsView } from "./components/NotificationsView";
import { useAccount } from "./contexts/useAccount";

export default function App() {
  // All hooks at the top, before any returns
  const { account, loading, following } = useAccount();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [newNotes, setNewNotes] = useState([]);
  const [tab, setTab] = useState("home");
  const [feedMode, setFeedMode] = useState("global");

  const handlePublished = (newEvent) => {
    setNewNotes((prev) => [newEvent, ...prev]);
    setRefreshTrigger((prev) => prev + 1);
  };

  // Early returns AFTER all hooks
  if (loading) {
    return <div className="p-8 text-center bg-bg min-h-screen text-text">লোড হচ্ছে...</div>;
  }
  if (!account) return <LoginScreen />;

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-xl mx-auto border-x border-border min-h-screen pb-16">
        {tab === "home" && (
          <>
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setFeedMode("global")}
                className={`flex-1 py-2 text-sm font-medium ${
                  feedMode === "global"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500"
                }`}
              >
                গ্লোবাল
              </button>
              <button
                onClick={() => setFeedMode("following")}
                className={`flex-1 py-2 text-sm font-medium ${
                  feedMode === "following"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500"
                }`}
              >
                অনুসরণ
              </button>
            </div>
            <NoteComposer onPublished={handlePublished} />
            <NoteList
              refreshTrigger={refreshTrigger}
              newNotes={newNotes}
              feedMode={feedMode}
              following={following}
            />
          </>
        )}
        {tab === "explore" && (
          <div className="p-8 text-center text-muted">অন্বেষণ শীঘ্রই আসছে</div>
        )}
        {tab === "notifications" && <NotificationsView />}
        {tab === "profile" && <ProfileView />}
      </main>
      <BottomNav current={tab} onChange={setTab} />
    </div>
  );
}