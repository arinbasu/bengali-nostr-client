import { useState } from "react";
import {
  generateNewAccount,
  importFromNsec,
  importFromNpub,
} from "../lib/account";
import { useAccount } from "../contexts/useAccount";
import { CraneIcon } from "./CraneIcon";

export function LoginScreen() {
  const { login } = useAccount();
  const [tab, setTab] = useState("new"); // new | nsec | npub
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [newAccount, setNewAccount] = useState(null);
  const [copiedField, setCopiedField] = useState(null); // "nsec" | "npub" | null

  const handleNewAccount = () => {
    const acc = generateNewAccount();
    setNewAccount(acc);
  };

  const handleConfirmBackup = () => {
    // Flag that this user is brand new and should be prompted to set a profile
    localStorage.setItem("balaka_needs_profile_setup", "true");
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

  const handleCopy = (field, value) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  // --- Backup screen ---
  if (newAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
        <div className="bg-surface p-6 rounded-2xl shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold text-text mb-2">
            অ্যাকাউন্ট তৈরি হয়েছে!
          </h2>
          <p className="text-muted mb-6 text-sm leading-relaxed">
            আপনার দুটি চাবি তৈরি হয়েছে। একটি প্রকাশ্য, একটি গোপন। দুটির
            পার্থক্য বুঝে নিন — এটি গুরুত্বপূর্ণ।
          </p>

          {/* Public key (npub) */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4">
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs font-medium text-gray-600">
                প্রকাশ্য ঠিকানা (npub)
              </p>
              <button
                onClick={() => handleCopy("npub", newAccount.npub)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {copiedField === "npub" ? "কপি হয়েছে ✅" : "কপি করুন"}
              </button>
            </div>
            <p className="text-sm font-mono break-all text-gray-900">
              {newAccount.npub}
            </p>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              এটি নিরাপদে শেয়ার করতে পারেন। বন্ধুরা এই ঠিকানা দিয়েই আপনাকে
              খুঁজে পাবে এবং অনুসরণ করতে পারবে।
            </p>
          </div>

          {/* Private key (nsec) */}
          <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mb-4">
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs font-medium text-yellow-800">
                গোপন চাবি (nsec) — কাউকে দেখাবেন না
              </p>
              <button
                onClick={() => handleCopy("nsec", newAccount.nsec)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {copiedField === "nsec" ? "কপি হয়েছে ✅" : "কপি করুন"}
              </button>
            </div>
            <p className="text-sm font-mono break-all text-gray-900">
              {newAccount.nsec}
            </p>
            <p className="text-xs text-yellow-800 mt-2 leading-relaxed">
              এটি আপনার পরিচয়ের প্রমাণ। কোনো সার্ভারে যায় না, শুধু আপনার
              কাছেই থাকে। <strong>এটি হারালে পরিচয় চিরতরে হারিয়ে যাবে।</strong>{" "}
              কারও সাথে শেয়ার করবেন না।
            </p>
          </div>

          {/* Confirmation */}
          <label className="flex items-start gap-2 text-sm text-muted mb-4">
            <input
              type="checkbox"
              id="confirm"
              className="mt-1"
            />
            <span>
              আমি আমার গোপন চাবি (nsec) সংরক্ষণ করেছি এবং এর গুরুত্ব বুঝেছি
            </span>
          </label>

          <button
            onClick={handleConfirmBackup}
            className="w-full bg-primary text-primary-text py-3 rounded-full font-medium hover:opacity-90"
          >
            শুরু করুন
          </button>
        </div>
      </div>
    );
  }

  // --- Main login screen ---
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <div className="bg-surface p-6 rounded-2xl shadow-lg max-w-md w-full">
        <div className="flex items-center gap-2 mb-4">
          <CraneIcon className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-text">বলাকা</h1>
        </div>

        <p className="text-sm text-muted mb-6 leading-relaxed">
          শুরু করতে একটি অ্যাকাউন্ট তৈরি করুন, অথবা আপনার আগের নস্ট্র
          পরিচয় দিয়ে প্রবেশ করুন।
        </p>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("new")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              tab === "new"
                ? "bg-primary text-primary-text"
                : "bg-bg text-muted"
            }`}
          >
            নতুন
          </button>
          <button
            onClick={() => setTab("nsec")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              tab === "nsec"
                ? "bg-primary text-primary-text"
                : "bg-bg text-muted"
            }`}
          >
            nsec দিয়ে
          </button>
          <button
            onClick={() => setTab("npub")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              tab === "npub"
                ? "bg-primary text-primary-text"
                : "bg-bg text-muted"
            }`}
          >
            npub দিয়ে
          </button>
        </div>

        {tab === "new" && (
          <button
            onClick={handleNewAccount}
            className="w-full bg-primary text-primary-text py-3 rounded-full font-medium hover:opacity-90"
          >
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
            {error && (
              <p className="text-red-500 text-sm mb-4">{error}</p>
            )}
            <button
              onClick={handleImport}
              className="w-full bg-primary text-primary-text py-3 rounded-full font-medium hover:opacity-90"
            >
              প্রবেশ করুন
            </button>

            {tab === "npub" && (
              <p className="text-xs text-muted mt-3 text-center leading-relaxed">
                npub দিয়ে প্রবেশ করলে আপনি দেখতে পাবেন, কিন্তু পোস্ট
                করতে পারবেন না।
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}