import { useState } from "react";
import { nip19 } from "nostr-tools";
import { publishReaction, publishRepost } from "../lib/nostr";
import { useAccount } from "../contexts/useAccount";
import { useProfile, getDisplayName } from "../contexts/useProfile";
import { NoteContent } from "./NoteContent";
import { SensitiveContent } from "./SensitiveContent";
import { isSensitive, getWarningReason } from "../lib/nsfw";

const TRUNCATE_LENGTH = 400;

function truncateContent(text, maxLength) {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastBreak = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n"));
  return (lastBreak > maxLength * 0.7 ? cut.slice(0, lastBreak) : cut).trimEnd() + "…";
}

function timeAgo(timestamp) {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return "এখনই";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} মিনিট আগে`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ঘণ্টা আগে`;
  return `${Math.floor(hours / 24)} দিন আগে`;
}

function extractImetaUrls(tag) {
  const urls = [];
  for (const entry of tag) {
    if (typeof entry !== "string") continue;
    if (
      entry.startsWith("url ") ||
      entry.startsWith("thumb ") ||
      entry.startsWith("image ")
    ) {
      const value = entry.split(" ").slice(1).join(" ");
      if (value) urls.push(value);
    }
  }
  return urls;
}

export function NoteCard({ event }) {
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [hasReposted, setHasReposted] = useState(false);
  const [textRevealed, setTextRevealed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { account, following, follow, unfollow } = useAccount();
  const { profiles } = useProfile();

  const npub = nip19.npubEncode(event.pubkey);
  const shortNpub = `${npub.slice(0, 12)}...${npub.slice(-4)}`;   // ← NEW
  const profile = profiles.get(event.pubkey);
  const displayName = getDisplayName(profile, shortNpub);          // ← CHANGED

  const isFollowing = following?.has(event.pubkey) ?? false;
  const isOwnNote = event.pubkey === account?.publicKey;

  const sensitive = isSensitive(event);
  const warningReason = sensitive ? getWarningReason(event) : "";

  const imetaTags = event.tags.filter((t) => t[0] === "imeta");
  const allImetaUrls = imetaTags.flatMap(extractImetaUrls);
  const primaryImageUrl =
    imetaTags
      .flatMap((tag) =>
        tag
          .filter((t) => typeof t === "string" && t.startsWith("url "))
          .map((t) => t.split(" ").slice(1).join(" "))
      )[0] || null;

  const isLong = event.content.length > TRUNCATE_LENGTH;
  const displayContent =
    isLong && !expanded
      ? truncateContent(event.content, TRUNCATE_LENGTH)
      : event.content;

  const handleFollowToggle = () => {
    if (isFollowing) unfollow(event.pubkey);
    else follow(event.pubkey);
  };

  const handleLike = async () => {
    if (hasLiked || !account?.secretKey) return;
    setHasLiked(true);
    setLikes((prev) => prev + 1);
    try {
      await publishReaction(event.id, event.pubkey, account.secretKey);
    } catch (err) {
      console.error("Failed to publish like", err);
      setHasLiked(false);
      setLikes((prev) => prev - 1);
    }
  };

  const handleRepost = async () => {
    if (hasReposted || !account?.secretKey) return;
    setHasReposted(true);
    try {
      await publishRepost(event, account.secretKey);
    } catch (err) {
      console.error("Failed to repost", err);
      setHasReposted(false);
    }
  };

  return (
    <div className="bg-white px-4 py-3 border-b border-gray-100">
      <div className="flex gap-3">
        {profile?.picture ? (
          <img
            src={profile.picture}
            alt=""
            className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {/* ← CHANGED: name is now a link, gray if no profile, black if profile */}
            <a
              href={`https://njump.me/${npub}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`font-medium hover:underline ${
                profile ? "text-gray-900" : "text-gray-500"
              }`}
              title={npub}
            >
              {displayName}
            </a>

            {!isOwnNote && (
              <button
                onClick={handleFollowToggle}
                className={`text-xs px-2 py-0.5 rounded-full border transition ${
                  isFollowing
                    ? "border-green-500 text-green-600 hover:bg-green-50"
                    : "border-blue-500 text-blue-600 hover:bg-blue-50"
                }`}
              >
                {isFollowing ? "অনুসরণ করছেন" : "অনুসরণ"}
              </button>
            )}

            <span>·</span>
            <span>{timeAgo(event.created_at)}</span>
          </div>

          {sensitive && !textRevealed ? (
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 mb-2">⚠️ {warningReason}</p>
              <button
                onClick={() => setTextRevealed(true)}
                className="text-xs px-3 py-1 bg-amber-600 text-white rounded-full hover:bg-amber-700"
              >
                পাঠ দেখুন
              </button>
            </div>
          ) : (
            <>
              <NoteContent
                content={displayContent}
                isSensitive={sensitive}
                warningReason={warningReason}
                skipUrls={allImetaUrls}
              />

              {isLong && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 text-sm text-blue-600 hover:underline font-medium"
                >
                  {expanded ? "কম দেখান" : "বাকিটা দেখুন"}
                </button>
              )}

              {primaryImageUrl &&
                (sensitive ? (
                  <SensitiveContent reason={warningReason}>
                    <img
                      src={primaryImageUrl}
                      alt="Note media"
                      className="mt-3 rounded-xl max-h-[600px] w-auto object-contain"
                    />
                  </SensitiveContent>
                ) : (
                  <img
                    src={primaryImageUrl}
                    alt="Note media"
                    className="mt-3 rounded-xl max-h-[600px] w-auto object-contain"
                  />
                ))}
            </>
          )}

          <div className="flex items-center gap-8 mt-3 text-gray-500">
            <button className="flex items-center gap-1.5 hover:text-blue-500 transition">
              <span className="text-lg">💬</span>
              <span className="text-sm">উত্তর</span>
            </button>

            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 transition ${
                hasLiked ? "text-red-500" : "hover:text-red-500"
              }`}
            >
              <span className="text-lg">{hasLiked ? "❤️" : "🤍"}</span>
              <span className="text-sm">{likes > 0 ? likes : "লাইক"}</span>
            </button>

            <button
              onClick={handleRepost}
              className={`flex items-center gap-1.5 transition ${
                hasReposted ? "text-green-500" : "hover:text-green-500"
              }`}
            >
              <span className="text-lg">🔄</span>
              <span className="text-sm">
                {hasReposted ? "রিপোস্ট হয়েছে" : "রিপোস্ট"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}