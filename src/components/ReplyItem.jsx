import { nip19 } from "nostr-tools";
import { useProfile, getDisplayName } from "../contexts/useProfile";
import { NoteContent } from "./NoteContent";
import { isSensitive, getWarningReason } from "../lib/nsfw";
import { SensitiveContent } from "./SensitiveContent";

function timeAgo(timestamp) {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return "এখনই";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} মিনিট আগে`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ঘণ্টা আগে`;
  return `${Math.floor(hours / 24)} দিন আগে`;
}

export function ReplyItem({ event, onReply }) {
  const { profiles } = useProfile();
  const npub = nip19.npubEncode(event.pubkey);
  const shortNpub = `${npub.slice(0, 10)}...${npub.slice(-4)}`;
  const profile = profiles.get(event.pubkey);
  const displayName = getDisplayName(profile, shortNpub);

  const sensitive = isSensitive(event);
  const warningReason = sensitive ? getWarningReason(event) : "";

  const imetaTags = event.tags.filter((t) => t[0] === "imeta");
  const imetaUrls = imetaTags.flatMap((tag) =>
    tag
      .filter(
        (t) =>
          typeof t === "string" &&
          (t.startsWith("url ") ||
            t.startsWith("thumb ") ||
            t.startsWith("image "))
      )
      .map((t) => t.split(" ").slice(1).join(" "))
  );
  const primaryImageUrl = imetaUrls[0] || null;

  return (
    <div className="py-2">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {profile?.picture ? (
          <img
            src={profile.picture}
            alt=""
            className="w-5 h-5 rounded-full object-cover"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500" />
        )}
        <a
          href={`https://njump.me/${npub}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`font-medium hover:underline ${
            profile ? "text-gray-800" : "text-gray-500"
          }`}
        >
          {displayName}
        </a>
        <span>·</span>
        <span>{timeAgo(event.created_at)}</span>
      </div>

      {sensitive ? (
        <SensitiveContent reason={warningReason}>
          <NoteContent
            content={event.content}
            isSensitive={true}
            warningReason={warningReason}
            skipUrls={imetaUrls}
          />
        </SensitiveContent>
      ) : (
        <NoteContent
          content={event.content}
          isSensitive={false}
          warningReason=""
          skipUrls={imetaUrls}
        />
      )}

      {primaryImageUrl && (
        <img
          src={primaryImageUrl}
          alt=""
          loading="lazy"
          className="mt-2 rounded-lg max-h-60 object-contain"
        />
      )}

      <button
        onClick={onReply}
        className="mt-1 text-xs text-gray-500 hover:text-blue-500"
      >
        উত্তর দিন
      </button>
    </div>
  );
}