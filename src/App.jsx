import { useState } from "react";
import { Header } from "./components/Header";
import { BottomNav } from "./components/BottomNav";
import { NoteComposer } from "./components/NoteComposer";
import { NoteList } from "./components/NoteList";
import { LoginScreen } from "./components/LoginScreen";
import { ProfileView } from "./components/ProfileView";
import { NotificationsView } from "./components/NotificationsView";
import { SearchView } from "./components/SearchView";
import { ExploreView } from "./components/ExploreView";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { useAccount } from "./contexts/useAccount";

export default function App() {
  const { account, loading, following } = useAccount();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [newNotes, setNewNotes] = useState([]);
  const [tab, setTab] = useState("home");
  const [feedMode, setFeedMode] = useState("global");
  const [onboarded, setOnboarded] = useState(
    () => localStorage.getItem("balaka_onboarded") === "true"
  );
  const [langFilter, setLangFilter] = useState(
    () => localStorage.getItem("balaka_lang_filter") || "both"
  );

  const handlePublished = (newEvent) => {
    setNewNotes((prev) => [newEvent, ...prev]);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem("balaka_onboarded", "true");
    setOnboarded(true);
  };

  const toggleLangFilter = () => {
    setLangFilter((prev) => {
      const next = prev === "both" ? "bengali" : "both";
      localStorage.setItem("balaka_lang_filter", next);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-8 text-center bg-bg min-h-screen text-text">
        লোড হচ্ছে...
      </div>
    );
  }

  if (!onboarded) {
    return <WelcomeScreen onComplete={handleOnboardingComplete} />;
  }

  if (!account) return <LoginScreen />;

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-xl mx-auto border-x border-border min-h-screen pb-16">
        {tab === "home" && (
          <>
            <div className="flex items-center border-b border-gray-200">
              <button
                onClick={() => setFeedMode("global")}
                className={`px-4 py-2 text-sm font-medium ${
                  feedMode === "global"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500"
                }`}
              >
                গ্লোবাল
              </button>
              <button
                onClick={() => setFeedMode("following")}
                className={`px-4 py-2 text-sm font-medium ${
                  feedMode === "following"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500"
                }`}
              >
                অনুসরণ
              </button>

              {/* Language filter toggle — right aligned */}
              <button
                onClick={toggleLangFilter}
                title={
                  langFilter === "bengali"
                    ? "এখন শুধুই বাংলা দেখছেন, সিলেক্ট করে সব ভাষা দেখুন"
                    : "এখন বাংলা ও ইংরেজি পোস্ট দেখছেন, সিলেক্ট করে শুধু বাংলা দেখুন"
                }
                className={`ml-auto mr-3 text-xs px-2 py-1 rounded-full border transition ${
                  langFilter === "bengali"
                    ? "border-blue-500 text-blue-600 bg-blue-50"
                    : "border-gray-300 text-gray-500 bg-white"
                }`}
              >
                {langFilter === "bengali" ? "অ" : "অ EN"}
              </button>
            </div>
            <NoteComposer onPublished={handlePublished} />
            <NoteList
              refreshTrigger={refreshTrigger}
              newNotes={newNotes}
              feedMode={feedMode}
              following={following}
              langFilter={langFilter}
            />
          </>
        )}
        {tab === "explore" && <ExploreView />}
        {tab === "search" && <SearchView />}
        {tab === "notifications" && <NotificationsView />}
        {tab === "profile" && <ProfileView />}
      </main>
      <BottomNav current={tab} onChange={setTab} />
    </div>
  );
}