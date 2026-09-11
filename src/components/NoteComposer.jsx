import { useState } from "react";
import { Akshar } from "akshar-typing";
import { publishNote, getOrCreateKeypair } from "../lib/nostr";
import { uploadImage } from "../lib/media";

export function NoteComposer({ onPublished }) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle");

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handlePublish = async () => {
    if (!content.trim() && !file) return;
    try {
      setStatus("uploading");
      let tags = [];
      if (file) {
        const { url, mime } = await uploadImage(file);
        tags.push(["imeta", `url ${url}`, `m ${mime}`]);
      }
      setStatus("publishing");
      const { secretKey } = getOrCreateKeypair();
      const publishedEvent = await publishNote(content, secretKey, tags);

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

  return (
    <div className="bg-white p-4 border-b border-gray-200">
      <Akshar
        lang="bn"
        value={content}
        onChangeText={setContent}
        maxOptions={5}
        renderComponent={(props) => (
          <textarea
            {...props}
            rows={3}
            placeholder="কিছু লিখুন..."
            className="w-full text-lg p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        )}
      />
      {preview && (
        <div className="mt-2 relative">
          <img src={preview} alt="Preview" className="rounded-lg max-h-60 object-cover" />
          <button
            onClick={() => { setFile(null); setPreview(null); }}
            className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 text-xs"
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex items-center justify-between mt-3">
        <label className="cursor-pointer text-blue-600 hover:text-blue-700">
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <span className="text-2xl">📷</span>
        </label>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {status === "uploading" && "ছবি আপলোড হচ্ছে..."}
            {status === "publishing" && "পোস্ট হচ্ছে..."}
            {status === "done" && "পোস্ট হয়েছে ✅"}
            {status === "error" && "সমস্যা হয়েছে"}
          </span>
          <button
            onClick={handlePublish}
            disabled={(!content.trim() && !file) || status === "publishing" || status === "uploading"}
            className="px-5 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            পোস্ট করুন
          </button>
        </div>
      </div>
    </div>
  );
}