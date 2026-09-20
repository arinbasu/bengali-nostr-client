import { SensitiveContent } from "./SensitiveContent";
import { EmbeddedNote } from "./EmbeddedNote";
import { Mention } from "./Mention";
import { useSearchContext } from "../contexts/SearchContext";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i;
const YT_REGEX =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/;

const SPLIT_REGEX =
  /((?:https?:\/\/[^\s]+)|(?:nostr:nevent1[a-z0-9]+)|(?:nostr:nprofile1[a-z0-9]+)|(?:nostr:npub1[a-z0-9]+)|(?:@nprofile1[a-z0-9]+)|(?:@npub1[a-z0-9]+))/gi;

// Split plain-text chunks on hashtags. Bengali script and Latin word chars.
const HASHTAG_SPLIT = /(#[\u0980-\u09FF\w]+)/g;

function normalizeUrl(u) {
  try {
    const parsed = new URL(u);
    return `${parsed.host}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return u;
  }
}

export function NoteContent({
  content,
  isSensitive,
  warningReason,
  skipUrls = [],
}) {
  const searchCtx = useSearchContext();
  const onTagClick = searchCtx?.onSearchRequest;

  if (!content) return null;

  const parts = content.split(SPLIT_REGEX);

  // Render a plain-text chunk, turning hashtags into clickable elements.
  const renderPlainText = (text, outerKey) => {
    if (!onTagClick) return <span key={outerKey}>{text}</span>;

    const pieces = text.split(HASHTAG_SPLIT);
    return (
      <span key={outerKey}>
        {pieces.map((piece, j) => {
          if (piece.startsWith("#") && piece.length > 1) {
            return (
              <button
                key={`${outerKey}-${j}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick(piece);
                }}
                className="text-blue-600 hover:underline font-medium"
              >
                {piece}
              </button>
            );
          }
          return <span key={`${outerKey}-${j}`}>{piece}</span>;
        })}
      </span>
    );
  };

  return (
    <div className="mt-1 text-gray-900 leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (!part) return null;

        // --- nostr:nevent1... quote ---
        const neventMatch = part.match(/^nostr:(nevent1[a-z0-9]+)$/i);
        if (neventMatch) {
          return <EmbeddedNote key={i} neventId={neventMatch[1]} />;
        }

        // --- nostr:npub1... / nostr:nprofile1... ---
        const nostrMention = part.match(
          /^nostr:((?:npub1|nprofile1)[a-z0-9]+)$/i
        );
        if (nostrMention) {
          return <Mention key={i} npubId={nostrMention[1]} />;
        }

        // --- @npub1... / @nprofile1... ---
        const atMention = part.match(/^@((?:npub1|nprofile1)[a-z0-9]+)$/i);
        if (atMention) {
          return <Mention key={i} npubId={atMention[1]} />;
        }

        // --- Plain text (may contain hashtags) ---
        if (!/^https?:\/\//.test(part)) {
          return renderPlainText(part, i);
        }

        // --- URL handling ---
        const trailing = part.match(/[.,!?;:)\]]+$/)?.[0] || "";
        const url = trailing ? part.slice(0, -trailing.length) : part;

        if (skipUrls.some((s) => normalizeUrl(s) === normalizeUrl(url))) {
          return null;
        }

        const ytMatch = url.match(YT_REGEX);
        if (ytMatch) {
          const iframe = (
            <div className="my-2 aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${ytMatch[1]}`}
                title="YouTube video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full rounded-lg"
              />
            </div>
          );
          return isSensitive ? (
            <SensitiveContent key={i} reason={warningReason}>
              {iframe}
            </SensitiveContent>
          ) : (
            <div key={i}>{iframe}</div>
          );
        }

        if (IMAGE_EXT.test(url)) {
          const img = (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block my-2"
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                className="rounded-lg max-h-80 w-auto object-cover border border-gray-100"
              />
            </a>
          );
          return isSensitive ? (
            <SensitiveContent key={i} reason={warningReason}>
              {img}
            </SensitiveContent>
          ) : (
            <span key={i}>{img}</span>
          );
        }

        return (
          <span key={i}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline break-all"
            >
              {url}
            </a>
            {trailing}
          </span>
        );
      })}
    </div>
  );
}