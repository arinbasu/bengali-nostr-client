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

  // "default" | "nsec" | "npub" | "bunker"
  const [mode, setMode] = useState("default");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [newAccount, setNewAccount] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [extensionAvailable, setExtensionAvailable] = useState(false);
  const [extensionConnecting, setExtensionConnecting] = useState(false);
  const [bunkerConnecting, setBunkerConnecting] = useState(false);

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

  // ---------- New account ----------
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

  // ---------- nsec / npub import ----------
  const handleImport = () => {
    setError("");
    try {
      if (mode === "nsec") {
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
      } else if (mode === "npub") {
        const { type, data } = nip19.decode(input.trim());
        if (type !== "npub") throw new Error("Not an npub");
        login({
          signer: null,
          publicKey: data,
          npub: input.trim(),
          loginType: "viewonly",
        });
      }
    } catch (err) {
      setError("অবৈধ কী");
    }
  };

  // ---------- NIP-07 extension ----------
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
      setError("এক্সটেনশনে অনুমোদন দেওয়া হয়নি");
    } finally {
      setExtensionConnecting(false);
    }
  };

  // ---------- NIP-46 bunker ----------
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
      setError("বাঙ্কারে সংযুক্ত করা যায়নি");
    } finally {
      setBunkerConnecting(false);
    }
  };

  const handleCopy = (field, value) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const resetToDefault = () => {
    setMode("default");
    setInput("");
    setError("");
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
              খুঁজে পাবে।
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
              এটি আপনার পরিচয়ের প্রমাণ।{" "}
              <strong>এটি হারালে পরিচয় চিরতরে হারিয়ে যাবে।</strong> কারও
              সাথে শেয়ার করবেন না।
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
            className="w-full bg-blue-600 text-white py-3 rounded-full font-medium hover:bg-blue-700"
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

        {/* ============ DEFAULT VIEW: two choices ============ */}
        {mode === "default" && (
          <>
            <p className="text-sm text-muted mb-6 leading-relaxed">
              বলাকা বাংলায় লেখার একটি জায়গা। শুরু করতে একটি অ্যাকাউন্ট
              তৈরি করুন।
            </p>

            <button
              onClick={handleNewAccount}
              className="w-full bg-blue-600 text-white py-4 rounded-full font-medium hover:bg-blue-700 mb-3 text-base"
            >
              নতুন অ্যাকাউন্ট তৈরি করুন
            </button>

            <button
              onClick={() => setMode("nsec")}
              className="w-full py-3 rounded-full border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              আমার আগের nsec আছে
            </button>

            {extensionAvailable && (
              <div className="mt-5 pt-5 border-t border-gray-200">
                <button
                  onClick={handleExtensionLogin}
                  disabled={extensionConnecting}
                  className="w-full py-3 rounded-full border border-blue-500 text-blue-600 font-medium hover:bg-blue-50 disabled:opacity-50"
                >
                  {extensionConnecting
                    ? "এক্সটেনশনে অনুমোদনের জন্য অপেক্ষা..."
                    : "ব্রাউজার এক্সটেনশন দিয়ে প্রবেশ"}
                </button>
                <p className="text-xs text-muted mt-2 text-center">
                  Alby, nos2x, বা অন্য NIP-07 এক্সটেনশন পাওয়া গেছে
                </p>
              </div>
            )}

            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full mt-4 text-xs text-gray-500 hover:text-gray-700"
            >
              {showAdvanced ? "আরও অপশন লুকান ▴" : "আরও অপশন ▾"}
            </button>

            {showAdvanced && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                <button
                  onClick={() => setMode("npub")}
                  className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 text-left px-3"
                >
                  npub দিয়ে শুধু পড়তে চাই
                </button>
                <button
                  onClick={() => setMode("bunker")}
                  className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 text-left px-3"
                >
                  Bunker (Amber, nsec.app)
                </button>
              </div>
            )}
          </>
        )}

        {/* ============ nsec / npub input ============ */}
        {(mode === "nsec" || mode === "npub") && (
          <>
            <h2 className="text-lg font-bold text-text mb-2">
              {mode === "nsec"
                ? "আপনার nsec দিন"
                : "আপনার npub দিন"}
            </h2>
            <p className="text-xs text-muted mb-4 leading-relaxed">
              {mode === "nsec"
                ? "আপনার গোপন চাবি। এটি শুধু আপনার ব্রাউজারে থাকবে — কোথাও পাঠানো হবে না।"
                : "npub দিয়ে ঢুকলে আপনি পড়তে পারবেন, কিন্তু পোস্ট করতে পারবেন না।"}
            </p>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === "nsec" ? "nsec1..." : "npub1..."}
              className="w-full p-3 bg-bg border border-border rounded-lg mb-3 text-text text-sm"
              autoFocus
            />

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <button
              onClick={handleImport}
              className="w-full bg-blue-600 text-white py-3 rounded-full font-medium hover:bg-blue-700 mb-3"
            >
              প্রবেশ করুন
            </button>

            <button
              onClick={resetToDefault}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← ফিরে যান
            </button>
          </>
        )}

        {/* ============ Bunker input ============ */}
        {mode === "bunker" && (
          <>
            <h2 className="text-lg font-bold text-text mb-2">
              Bunker সংযুক্ত করুন
            </h2>
            <p className="text-xs text-muted mb-4 leading-relaxed">
              Amber, nsec.app, বা অন্য NIP-46 সাইন অ্যাপ থেকে একটি{" "}
              <code className="bg-gray-100 px-1 rounded">bunker://</code>{" "}
              লিঙ্ক পান এবং এখানে পেস্ট করুন।
            </p>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="bunker://..."
              className="w-full p-3 bg-bg border border-border rounded-lg mb-3 text-text text-sm"
              autoFocus
            />

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <button
              onClick={() => handleBunkerLogin(input)}
              disabled={bunkerConnecting}
              className="w-full bg-blue-600 text-white py-3 rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 mb-3"
            >
              {bunkerConnecting ? "সংযুক্ত হচ্ছে..." : "সংযুক্ত করুন"}
            </button>

            <button
              onClick={resetToDefault}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← ফিরে যান
            </button>
          </>
        )}
      </div>
    </div>
  );
}