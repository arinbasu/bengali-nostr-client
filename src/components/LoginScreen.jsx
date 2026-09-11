import { useState } from "react";
import { generateNewAccount, importFromNsec, importFromNpub } from "../lib/account";
import { useAccount } from "../contexts/useAccount";
import { CraneIcon } from "./CraneIcon";

export function LoginScreen() {
  const { login } = useAccount();
  const [tab, setTab] = useState("new"); // new | nsec | npub
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [newAccount, setNewAccount] = useState(null);

  const handleNewAccount = () => {
    const acc = generateNewAccount();
    setNewAccount(acc);
  };

  const handleConfirmBackup = () => {
    login(newAccount);
  };

  const handleImport = () => {
    setError("");
    try {
      if (tab === "nsec") {
        const acc = importFromNsec(input);
        login(acc);
      } else if (tab === "npub") {
        const acc = importFromNpub(input);
        login(acc);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Backup screen
  if (newAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
        <div className="bg-surface p-6 rounded-2xl shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold text-text mb-2">অ্যাকাউন্ট তৈরি হয়েছে!</h2>
          <p className="text-muted mb-4">
            আপনার গোপন চাবি (nsec) সংরক্ষণ করুন। এটি হারালে আপনার পরিচয় চিরতরে হারিয়ে যাবে।
          </p>
          <div className="bg-bg p-3 rounded-lg border border-border mb-4 break-all text-sm font-mono text-text">
            {newAccount.nsec}
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(newAccount.nsec)}
            className="w-full bg-primary text-primary-text py-2 rounded-full mb-4 font-medium"
          >
            কপি করুন
          </button>
          <label className="flex items-center gap-2 text-sm text-muted mb-4">
            <input type="checkbox" id="confirm" />
            আমি চাবিটি সংরক্ষণ করেছি
          </label>
          <button
            onClick={handleConfirmBackup}
            className="w-full bg-primary text-primary-text py-2 rounded-full font-medium"
          >
            শুরু করুন
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <div className="bg-surface p-6 rounded-2xl shadow-lg max-w-md w-full">
        <div className="flex items-center gap-2 mb-6">
          <CraneIcon className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold text-text">বলাকা</h1>
        </div>

        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab("new")} className={`flex-1 py-2 rounded-lg text-sm font-medium ${tab === "new" ? "bg-primary text-primary-text" : "bg-bg text-muted"}`}>নতুন</button>
          <button onClick={() => setTab("nsec")} className={`flex-1 py-2 rounded-lg text-sm font-medium ${tab === "nsec" ? "bg-primary text-primary-text" : "bg-bg text-muted"}`}>nsec দিয়ে</button>
          <button onClick={() => setTab("npub")} className={`flex-1 py-2 rounded-lg text-sm font-medium ${tab === "npub" ? "bg-primary text-primary-text" : "bg-bg text-muted"}`}>npub দিয়ে</button>
        </div>

        {tab === "new" && (
          <button onClick={handleNewAccount} className="w-full bg-primary text-primary-text py-3 rounded-full font-medium">
            নতুন অ্যাকাউন্ট তৈরি করুন
          </button>
        )}

        {tab !== "new" && (
          <div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tab === "nsec" ? "nsec1..." : "npub1..."}
              className="w-full p-3 bg-bg border border-border rounded-lg mb-4 text-text"
            />
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button onClick={handleImport} className="w-full bg-primary text-primary-text py-3 rounded-full font-medium">
              প্রবেশ করুন
            </button>
          </div>
        )}
      </div>
    </div>
  );
}