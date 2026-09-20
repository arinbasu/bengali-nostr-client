import { useState, useEffect, useRef } from "react";
import { Akshar } from "akshar-typing";
import { publishReplyWithSigner } from "../lib/nostr";
import { useAccount } from "../contexts/useAccount";
import { useProfile } from "../contexts/useProfile";
import { useMentions } from "../hooks/useMentions";
import { MentionDropdown } from "./MentionDropdown";

const MAX_LENGTH = 5000;
const MIN_HEIGHT = 60;
const MAX_HEIGHT = 240;

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

export function ReplyComposer({ parentEvent, onPublished, onCancel }) {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("idle");
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

  const handleSubmit = async () => {
    if (!content.trim() || !account?.signer) return;
    try {
      setStatus("publishing");
      const publishedEvent = await publishReplyWithSigner(
        parentEvent,
        content,
        account.signer
      );
      setStatus("done");
      setContent("");
      if (onPublished) onPublished(publishedEvent);
      setTimeout(() => setStatus("idle"), 800);
    } catch (err) {
      console.error("Reply publish failed:", err);
      setStatus("error");
    }
  };

  const isNearLimit = MAX_LENGTH - content.length < 200;

  const textareaClassName =
    "w-full p-2 text-base bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

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
          if (mentions.handleKeyDown(e, setContent)) return;
          aksharOnKeyDown?.(e);
        }}
        placeholder="উত্তর লিখুন..."
        className={textareaClassName}
      />
    );
  };

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="relative z-50">
        {mentions.isActive && (
          <MentionDropdown
            candidates={mentions.candidates}
            activeIndex={mentions.activeIndex}
            onSelect={handleMentionSelect}
          />
        )}

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
      </div>

      <div className="flex justify-between items-center mt-2">
        <span
          className={`text-xs ${
            isNearLimit ? "text-red-500" : "text-gray-400"
          }`}
        >
          {content.length} / {MAX_LENGTH}
        </span>

        <div className="flex gap-2">
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
            disabled={
              !content.trim() ||
              status === "publishing" ||
              content.length > MAX_LENGTH
            }
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
    </div>
  );
}