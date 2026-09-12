import { useState, useEffect } from "react";
import { publishProfile } from "../lib/nostr";
import { uploadImage } from "../lib/media";
import { useAccount } from "../contexts/useAccount";
import { useProfile } from "../contexts/useProfile";

export function EditProfileModal({ isOpen, onClose }) {
  const { account } = useAccount();
  const { profiles, updateProfileCache } = useProfile();
  const existing = account?.publicKey ? profiles.get(account.publicKey) : null;

  const [displayName, setDisplayName] = useState("");
  const [about, setAbout] = useState("");
  const [picture, setPicture] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && existing) {
      setDisplayName(existing.display_name || existing.name || "");
      setAbout(existing.about || "");
      setPicture(existing.picture || "");
    }
  }, [isOpen, existing]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
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
    if (!displayName.trim()) {
      setError("নাম আবশ্যক");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const metadata = {
        ...(existing || {}),
        display_name: displayName.trim(),
        name: displayName.trim().toLowerCase().replace(/\s+/g, "") || undefined,
        about: about.trim(),
        picture: picture.trim(),
      };

      await publishProfile(metadata, account.secretKey);
      updateProfileCache(account.publicKey, metadata);
      onClose();
    } catch (err) {
      console.error(err);
      setError("সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="text-lg font-bold">প্রোফাইল সম্পাদনা</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-col items-center">
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
                {uploading ? "আপলোড হচ্ছে..." : "ছবি পরিবর্তন করুন"}
              </p>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              প্রদর্শিত নাম
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="যেমন: অরিন্দম বসু"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              পরিচিতি
            </label>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={3}
              placeholder="আপনার সম্পর্কে দুটি কথা..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-full border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            বাতিল
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploading || !displayName.trim()}
            className="flex-1 py-2 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
        </div>
      </div>
    </div>
  );
}