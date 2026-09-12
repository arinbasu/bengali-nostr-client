import { useState } from "react";
import { Akshar } from "akshar-typing";
import { publishNote } from "../lib/nostr";
import { uploadImage } from "../lib/media";
import { useAccount } from "../contexts/useAccount";

const MAX_LENGTH = 5000;

export function NoteComposer({ onPublished }) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle");
  const [bengaliOn, setBengaliOn] = useState(true);
  const { account } = useAccount();

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handlePublish = async () => {
    if (!content.trim() && !file) return;
    if (!account?.secretKey) {
      setStatus("error");
      return;
    }

    try {
      setStatus("uploading");
      let tags = [];
      if (file) {
        const { url, mime } = await uploadImage(file);
        tags.push(["imeta", `url ${url}`, `m ${mime}`]);
      }

      setStatus("publishing");
      const publishedEvent = await publishNote(content, account.secretKey, tags);

      setStatus("done");
      setContent("");
      setFile(null);
      setPreview(null);
      if (onPublished) onPublished(publishedEvent);
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const remaining = MAX_LENGTH - content.length;
  const isNearLimit = remaining < 200;

  const textareaClassName =
    "w-full text-lg p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none";

  return (
    <div className="bg-white p-4 border-b border-gray-200">
      {/* relative + z-50 ensures the suggestion dropdown isn't clipped by the feed below */}
      <div className="relative z-50">
        {bengaliOn ? (
          <Akshar
            lang="bn"
            value={content}
            onChangeText={(text) => {
              if (text.length <= MAX_LENGTH) setContent(text);
            }}
            maxOptions={5}
            containerClassName="relative z-50"
            renderComponent={(props) => (
              <textarea
                {...props}
                style={{ height: "120px" }}
                placeholder="কিছু লিখুন... (ইংরেজি অক্ষরে টাইপ করুন)"
                className={textareaClassName}
              />
            )}
          />
        ) : (
          <textarea
            style={{ height: "120px" }}
            value={content}
            maxLength={MAX_LENGTH}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write in English..."
            className={textareaClassName}
          />
        )}
      </div>

      {preview && (
        <div className="mt-2 relative">
          <img
            src={preview}
            alt="Preview"
            className="rounded-lg max-h-60 object-cover"
          />
          <button
            onClick={() => {
              setFile(null);
              setPreview(null);
            }}
            className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3">
          <label className="cursor-pointer text-blue-600 hover:text-blue-700">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <span className="text-2xl">📷</span>
          </label>

          <button
            onClick={() => setBengaliOn((v) => !v)}
            className={`text-xs px-2 py-1 rounded-full border transition ${
              bengaliOn
                ? "border-blue-500 text-blue-600 bg-blue-50"
                : "border-gray-300 text-gray-500 bg-white"
            }`}
            title={bengaliOn ? "Switch to English typing" : "বাংলায় টাইপ করুন"}
          >
            {bengaliOn ? "অ" : "A"}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`text-xs ${
              isNearLimit ? "text-red-500" : "text-gray-400"
            }`}
          >
            {content.length} / {MAX_LENGTH}
          </span>

          <span className="text-sm text-gray-500">
            {status === "uploading" && "ছবি আপলোড হচ্ছে..."}
            {status === "publishing" && "পোস্ট হচ্ছে..."}
            {status === "done" && "পোস্ট হয়েছে ✅"}
            {status === "error" && "সমস্যা হয়েছে"}
          </span>

          <button
            onClick={handlePublish}
            disabled={
              (!content.trim() && !file) ||
              status === "publishing" ||
              status === "uploading" ||
              content.length > MAX_LENGTH
            }
            className="px-5 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            পোস্ট করুন
          </button>
        </div>
      </div>
    </div>
  );
}