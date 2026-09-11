import { useState } from "react";
import { nip19 } from "nostr-tools";
import { publishReaction, publishRepost } from "../lib/nostr";
import { useAccount } from "../contexts/useAccount";
import { useProfile, getDisplayName } from "../contexts/useProfile";

function timeAgo(timestamp) {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return "এখনই";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} মিনিট আগে`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ঘণ্টা আগে`;
  return `${Math.floor(hours / 24)} দিন আগে`;
}

export function NoteCard({ event }) {
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [hasReposted, setHasReposted] = useState(false);
  const { account, following, follow, unfollow } = useAccount();
  const { profiles } = useProfile();

  const npub = nip19.npubEncode(event.pubkey);
  const shortNpub = `${npub.slice(0, 10)}...${npub.slice(-4)}`;
  const profile = profiles.get(event.pubkey);
  const displayName = getDisplayName(profile, "অজ্ঞাত ব্যবহারকারী");

  const isFollowing = following?.has(event.pubkey) ?? false;
  const isOwnNote = event.pubkey === account?.publicKey;

  const imetaTag = event.tags.find((t) => t[0] === "imeta");
  const imageUrl = imetaTag
    ? imetaTag.find((t) => t.startsWith("url "))?.replace("url ", "")
    : null;

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
        {/* Avatar — sibling to content column */}
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
            <span className="font-medium text-gray-900" title={npub}>{displayName}
              
            </span>


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

          <p className="mt-1 text-gray-900 leading-relaxed whitespace-pre-wrap">
            {event.content}
          </p>

          {imageUrl && (
            <img
              src={imageUrl}
              alt="Note media"
              className="mt-3 rounded-xl max-h-80 object-cover w-full"
            />
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