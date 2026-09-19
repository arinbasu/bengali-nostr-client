import { useState, useEffect } from "react";
import { nip19 } from "nostr-tools";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import {
  LocalSigner,
  Nip07Signer,
  connectBunker,
} from "../lib/signers";
import { useAccount } from "../contexts/useAccount";
import { CraneIcon } from "./CraneIcon";

export function LoginScreen() {
  const { login } = useAccount();
  const [tab, setTab] = useState("new"); // new | nsec | npub | bunker
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [newAccount, setNewAccount] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [extensionAvailable, setExtensionAvailable] = useState(false);
  const [extensionConnecting, setExtensionConnecting] = useState(false);
  const [bunkerConnecting, setBunkerConnecting] = useState(false);

  // Poll for window.nostr for 2 seconds (extensions inject at different times)
  useEffect(() => {
    let attempts = 0;
    const check = () => {
      if (typeof window !== "undefined" && window.nostr) {
        setExtensionAvailable(true);
        return;
      }
      attempts++;
      if (attempts < 20) setTimeout(check, 100);
    };
    check();
  }, []);

  // --- New account ---
  const handleNewAccount = () => {
    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    const nsec = nip19.nsecEncode(secretKey);
    const npub = nip19.npubEncode(pubkey);
    const signer = new LocalSigner(secretKey);
    setNewAccount({ signer, nsec, npub, publicKey: pubkey });
  };

  const handleConfirmBackup = () => {
    localStorage.setItem("balaka_needs_profile_setup", "true");
    login({
      signer: newAccount.signer,
      publicKey: newAccount.publicKey,
      npub: newAccount.npub,
      loginType: "local",
      nsec: newAccount.nsec,
    });
  };

  // --- nsec / npub import ---
  const handleImport = () => {
    setError("");
    try {
      if (tab === "nsec") {
        const { type, data } = nip19.decode(input.trim());
        if (type !== "nsec") throw new Error("Not an nsec");
        const signer = new LocalSigner(data);
        const npub = nip19.npubEncode(signer.publicKey);
        login({
          signer,
          publicKey: signer.publicKey,
          npub,
          loginType: "local",
          nsec: input.trim(),
        });
      } else if (tab === "npub") {
        const { type, data } = nip19.decode(input.trim());
        if (type !== "npub") throw new Error("Not an npub");
        // View-only login — no signer, no secretKey
        login({
          signer: null,
          publicKey: data,
          npub: input.trim(),
          loginType: "viewonly",
        });
      }
    } catch (err) {
      setError(err.message || "অবৈধ কী");
    }
  };

  // --- NIP-07 extension ---
  const handleExtensionLogin = async () => {
    setError("");
    setExtensionConnecting(true);
    try {
      const signer = new Nip07Signer();
      const pubkey = await signer.getPublicKey();
      const npub = nip19.npubEncode(pubkey);
      login({ signer, publicKey: pubkey, npub, loginType: "nip07" });
    } catch (err) {
      console.error(err);
      setError("এক্সটেনশনে অনুমোদন দেওয়া হয়নি বা এক্সটেনশন পাওয়া যায়নি");
    } finally {
      setExtensionConnecting(false);
    }
  };

  // --- NIP-46 bunker ---
  const handleBunkerLogin = async (uri) => {
    setError("");
    if (!uri.trim()) return;
    setBunkerConnecting(true);
    try {
      const signer = await connectBunker(uri.trim(), (url) => {
        window.open(url, "_blank");
      });
      const pubkey = await signer.getPublicKey();
      const npub = nip19.npubEncode(pubkey);
      login({ signer, publicKey: pubkey, npub, loginType: "nip46" });
    } catch (err) {
      console.error(err);
      setError("বাঙ্কারে সংযুক্ত করা যায়নি: " + (err?.message || ""));
    } finally {
      setBunkerConnecting(false);
    }
  };

  const handleCopy = (field, value) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  // ========================= BACKUP SCREEN =========================
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

          <label className="flex items-start gap-2 text-sm text-muted mb-4">
            <input type="checkbox" id="confirm" className="mt-1" />
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

  // ========================= MAIN LOGIN =========================
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

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1 mb-6">
          <button
            onClick={() => setTab("new")}
            className={`py-2 rounded-lg text-xs font-medium ${
              tab === "new" ? "bg-primary text-primary-text" : "bg-bg text-muted"
            }`}
          >
            নতুন
          </button>
          <button
            onClick={() => setTab("nsec")}
            className={`py-2 rounded-lg text-xs font-medium ${
              tab === "nsec" ? "bg-primary text-primary-text" : "bg-bg text-muted"
            }`}
          >
            nsec
          </button>
          <button
            onClick={() => setTab("npub")}
            className={`py-2 rounded-lg text-xs font-medium ${
              tab === "npub" ? "bg-primary text-primary-text" : "bg-bg text-muted"
            }`}
          >
            npub
          </button>
          <button
            onClick={() => setTab("bunker")}
            className={`py-2 rounded-lg text-xs font-medium ${
              tab === "bunker" ? "bg-primary text-primary-text" : "bg-bg text-muted"
            }`}
          >
            Bunker
          </button>
        </div>

        {/* New account */}
        {tab === "new" && (
          <button
            onClick={handleNewAccount}
            className="w-full bg-primary text-primary-text py-3 rounded-full font-medium hover:opacity-90"
          >
            নতুন অ্যাকাউন্ট তৈরি করুন
          </button>
        )}

        {/* nsec / npub */}
        {(tab === "nsec" || tab === "npub") && (
          <div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tab === "nsec" ? "nsec1..." : "npub1..."}
              className="w-full p-3 bg-bg border border-border rounded-lg mb-4 text-text"
            />
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
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

        {/* Bunker */}
        {tab === "bunker" && (
          <div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="bunker://..."
              className="w-full p-3 bg-bg border border-border rounded-lg mb-4 text-text text-sm"
            />
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button
              onClick={() => handleBunkerLogin(input)}
              disabled={bunkerConnecting}
              className="w-full bg-primary text-primary-text py-3 rounded-full font-medium hover:opacity-90 disabled:opacity-50"
            >
              {bunkerConnecting ? "সংযুক্ত হচ্ছে..." : "সংযুক্ত করুন"}
            </button>
            <p className="text-xs text-muted mt-3 text-center leading-relaxed">
              Amber, nsec.app, বা যেকোনো NIP-46 সাপোর্টেড সাইনার থেকে
              bunker:// লিঙ্ক পান।
            </p>
          </div>
        )}

        {/* NIP-07 extension — only when an extension is detected */}
        {extensionAvailable && (
          <div className="mt-6 pt-6 border-t border-border">
            <button
              onClick={handleExtensionLogin}
              disabled={extensionConnecting}
              className="w-full py-3 rounded-full border border-blue-500 text-blue-600 font-medium hover:bg-blue-50 disabled:opacity-50"
            >
              {extensionConnecting
                ? "এক্সটেনশনে অনুমোদনের জন্য অপেক্ষা করছি..."
                : "ব্রাউজার এক্সটেনশন দিয়ে প্রবেশ করুন"}
            </button>
            <p className="text-xs text-muted mt-2 text-center">
              Alby, nos2x, বা অন্য NIP-07 এক্সটেনশন পাওয়া গেছে
            </p>
          </div>
        )}
      </div>
    </div>
  );
}