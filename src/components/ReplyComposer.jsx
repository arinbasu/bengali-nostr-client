import { useState } from "react";
import { Akshar } from "akshar-typing";
import { publishReply } from "../lib/nostr";
import { useAccount } from "../contexts/useAccount";

export function ReplyComposer({ parentEvent, onPublished, onCancel }) {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("idle");
  const { account } = useAccount();

  const handleSubmit = async () => {
  if (!content.trim() || !account?.secretKey) return;
  try {
    setStatus("publishing");
    const publishedEvent = await publishReply(parentEvent, content, account.secretKey);
    setStatus("done");
    setContent("");
    if (onPublished) onPublished(publishedEvent);
    setTimeout(() => setStatus("idle"), 800);
  } catch (err) {
    console.error("Reply publish failed:", err);
    setStatus("error");
  }
};

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <Akshar
        lang="bn"
        value={content}
        onChangeText={setContent}
        maxOptions={5}
        renderComponent={(props) => (
          <textarea
            {...props}
            rows={2}
            placeholder="উত্তর লিখুন..."
            className="w-full p-2 text-base bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        )}
      />
      <div className="flex justify-end gap-2 mt-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
          >
            বাতিল
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || status === "publishing"}
          className="px-4 py-1 text-sm bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {status === "publishing"
            ? "পাঠানো হচ্ছে..."
            : status === "done"
            ? "পাঠানো হয়েছে ✅"
            : "উত্তর দিন"}
        </button>
      </div>
    </div>
  );
}