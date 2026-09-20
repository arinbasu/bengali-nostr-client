import { SensitiveContent } from "./SensitiveContent";
import { EmbeddedNote } from "./EmbeddedNote";
import { Mention } from "./Mention";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i;
const YT_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/;

// Combined split: URLs, nostr:nevent refs, nostr:npub refs, nostr:nprofile refs
const SPLIT_REGEX =
  /((?:https?:\/\/[^\s]+)|(?:nostr:nevent1[a-z0-9]+)|(?:nostr:nprofile1[a-z0-9]+)|(?:nostr:npub1[a-z0-9]+)|(?:@nprofile1[a-z0-9]+)|(?:@npub1[a-z0-9]+))/gi;

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
  if (!content) return null;

  const parts = content.split(SPLIT_REGEX);

  return (
    <div className="mt-1 text-gray-900 leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (!part) return null;

        // --- nostr:nevent1... reference ---
        const neventMatch = part.match(/^nostr:(nevent1[a-z0-9]+)$/i);
        if (neventMatch) {
          return <EmbeddedNote key={i} neventId={neventMatch[1]} />;
        }

        // --- nostr:npub1... or nostr:nprofile1... mention ---
        const mentionMatch = part.match(
          /^nostr:((?:npub1|nprofile1)[a-z0-9]+)$/i
        );
        if (mentionMatch) {
          return <Mention key={i} npubId={mentionMatch[1]} />;
        }

        // --- @npub1... / @nprofile1... mention (no nostr: prefix) ---
        const atMentionMatch = part.match(
          /^@((?:npub1|nprofile1)[a-z0-9]+)$/i
        );
        if (atMentionMatch) {
          return <Mention key={i} npubId={atMentionMatch[1]} />;
        }


        // --- Plain text ---
        if (!/^https?:\/\//.test(part)) {
          return <span key={i}>{part}</span>;
        }

        // --- URL handling ---
        const trailing = part.match(/[.,!?;:)\]]+$/)?.[0] || "";
        const url = trailing ? part.slice(0, -trailing.length) : part;

        if (skipUrls.some((s) => normalizeUrl(s) === normalizeUrl(url))) {
          return null;
        }

        // YouTube embed
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

        // Inline image
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

        // Regular link
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