import { useState, useEffect, useRef } from "react";
import { Akshar } from "akshar-typing";
import { publishNoteWithSigner } from "../lib/nostr";
import { uploadImage } from "../lib/media";
import { useAccount } from "../contexts/useAccount";
import { useProfile } from "../contexts/useProfile";
import { useMentions } from "../hooks/useMentions";
import { MentionDropdown } from "./MentionDropdown";

const MAX_LENGTH = 5000;
const MIN_HEIGHT = 90;
const MAX_HEIGHT = 320;

// Auto-growing textarea. No forwardRef — accepts `innerRef` as a
// regular prop, which works in both React 18 and React 19 and avoids
// interfering with Akshar's control over the textarea.
function AutoGrowTextarea({ placeholder, className, innerRef, ...props }) {
  const localRef = useRef(null);

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height =
      Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT) + "px";
  }, [props.value]);

  const setRef = (node) => {
    localRef.current = node;
    if (typeof innerRef === "function") innerRef(node);
    else if (innerRef) innerRef.current = node;
  };

  return (
    <textarea
      ref={setRef}
      placeholder={placeholder}
      className={className}
      style={{
        minHeight: `${MIN_HEIGHT}px`,
        maxHeight: `${MAX_HEIGHT}px`,
        overflowY: "auto",
        resize: "none",
      }}
      {...props}
    />
  );
}

function extractHashtags(text) {
  const matches = text.match(/#[\u0980-\u09FF\w]+/g) || [];
  return [...new Set(matches.map((t) => t.slice(1).toLowerCase()))];
}

export function NoteComposer({ onPublished }) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle");
  const [bengaliOn, setBengaliOn] = useState(true);
  const [cursorPos, setCursorPos] = useState(0);

  const { account, following } = useAccount();
  const { profiles } = useProfile();
  const textareaRef = useRef(null);

  const mentions = useMentions({
    text: content,
    cursorPos,
    following,
    profiles,
  });

  const handleMentionSelect = (candidate) => {
    const newCursor = mentions.insertMention(candidate, setContent);
    setTimeout(() => {
      if (textareaRef.current && newCursor != null) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handlePublish = async () => {
    if (!content.trim() && !file) return;
    if (!account?.signer) {
      setStatus("error");
      return;
    }

    try {
      setStatus("uploading");
      let tags = [];

      const hashtags = extractHashtags(content);
      hashtags.forEach((tag) => tags.push(["t", tag]));

      if (file) {
        const { url, mime } = await uploadImage(file, account.signer);
        tags.push(["imeta", `url ${url}`, `m ${mime}`]);
      }

      setStatus("publishing");
      const publishedEvent = await publishNoteWithSigner(
        content,
        account.signer,
        tags
      );

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

  const isNearLimit = MAX_LENGTH - content.length < 200;

  const textareaClassName =
    "w-full text-lg p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

  // Chains Akshar's event handlers with ours so transliteration keeps
  // working while we track cursor position for mention detection.
  const renderTextarea = (props) => {
    const {
      onSelect: aksharOnSelect,
      onKeyUp: aksharOnKeyUp,
      onClick: aksharOnClick,
      onKeyDown: aksharOnKeyDown,
      ...rest
    } = props;

    return (
      <AutoGrowTextarea
        {...rest}
        innerRef={textareaRef}
        onSelect={(e) => {
          setCursorPos(e.target.selectionStart);
          aksharOnSelect?.(e);
        }}
        onKeyUp={(e) => {
          setCursorPos(e.target.selectionStart);
          aksharOnKeyUp?.(e);
        }}
        onClick={(e) => {
          setCursorPos(e.target.selectionStart);
          aksharOnClick?.(e);
        }}
        onKeyDown={(e) => {
          // Mention handler runs first. If it consumes the event
          // (Enter/Tab/Escape/arrows), stop so Akshar doesn't also react.
          if (mentions.handleKeyDown(e, setContent)) return;
          aksharOnKeyDown?.(e);
        }}
        placeholder="কিছু লিখুন... (ইংরেজি অক্ষরে টাইপ করুন)"
        className={textareaClassName}
      />
    );
  };

  return (
    <div className="bg-white p-4 border-b border-gray-200">
      <div className="relative z-50">
        {mentions.isActive && (
          <MentionDropdown
            candidates={mentions.candidates}
            activeIndex={mentions.activeIndex}
            onSelect={handleMentionSelect}
          />
        )}

        {bengaliOn ? (
          <Akshar
            lang="bn"
            value={content}
            onChangeText={(text) => {
              if (text.length <= MAX_LENGTH) setContent(text);
            }}
            maxOptions={5}
            offsetY={-40}
            containerClassName="relative z-50"
            renderComponent={renderTextarea}
          />
        ) : (
          <AutoGrowTextarea
            innerRef={textareaRef}
            value={content}
            maxLength={MAX_LENGTH}
            onChange={(e) => setContent(e.target.value)}
            onSelect={(e) => setCursorPos(e.target.selectionStart)}
            onKeyUp={(e) => setCursorPos(e.target.selectionStart)}
            onClick={(e) => setCursorPos(e.target.selectionStart)}
            onKeyDown={(e) => {
              if (mentions.handleKeyDown(e, setContent)) return;
            }}
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