import { useState } from "react";
import { publishProfile } from "../lib/nostr";
import { uploadImage } from "../lib/media";
import { useAccount } from "../contexts/useAccount";
import { CraneIcon } from "./CraneIcon";

export function ProfileSetupPage({ onComplete }) {
  const { account } = useAccount();
  const [displayName, setDisplayName] = useState("");
  const [about, setAbout] = useState("");
  const [picture, setPicture] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadImage(file, account.secretKey);
      setPicture(url);
    } catch (err) {
      console.error(err);
      setError("ছবি আপলোড ব্যর্থ হয়েছে");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!account?.secretKey) return;
    setSaving(true);
    setError("");
    try {
      const metadata = {
        display_name: displayName.trim(),
        name: displayName.trim().toLowerCase().replace(/\s+/g, "") || undefined,
        about: about.trim(),
        picture: picture.trim(),
      };
      await publishProfile(metadata, account.secretKey);
      onComplete();
    } catch (err) {
      console.error(err);
      setError("সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <CraneIcon className="w-6 h-6 text-blue-600" />
        <span className="font-bold text-text">বলাকা</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto p-6">
          <h1 className="text-2xl font-bold text-text mb-2">
            আপনার পরিচয় তৈরি করুন
          </h1>
          <p className="text-sm text-muted mb-8 leading-relaxed">
            আপনার নাম ও ছবি যোগ করলে অন্য ব্যবহারকারীরা আপনাকে সহজে চিনতে
            পারবেন। চাইলে এই ধাপটি এড়িয়ে যেতে পারেন।
          </p>

          {/* Avatar */}
          <div className="flex justify-center mb-6">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
              {picture ? (
                <img
                  src={picture}
                  alt=""
                  className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-3xl">
                  {uploading ? "..." : "+"}
                </div>
              )}
              <p className="text-center text-xs text-blue-600 mt-2">
                {uploading ? "আপলোড হচ্ছে..." : "ছবি যোগ করুন"}
              </p>
            </label>
          </div>

          {/* Display name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              আপনার নাম
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="যেমন: অরিন্দম বসু"
              className="w-full px-3 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* About */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              নিজের সম্পর্কে (ঐচ্ছিক)
            </label>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={3}
              placeholder="আপনার সম্পর্কে দুটি কথা..."
              className="w-full px-3 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 mb-4">{error}</p>
          )}

          {/* Actions */}
          <button
            onClick={handleSave}
            disabled={saving || uploading || !displayName.trim()}
            className="w-full py-3 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 mb-3"
          >
            {saving ? "সংরক্ষণ হচ্ছে..." : "শুরু করুন"}
          </button>

          <button
            onClick={handleSkip}
            disabled={saving}
            className="w-full py-2 text-sm text-muted hover:text-text"
          >
            পরে করব
          </button>
        </div>
      </div>
    </div>
  );
}