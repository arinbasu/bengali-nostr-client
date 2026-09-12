// Detects whether an event should be treated as sensitive/NSFW.
// Checks multiple tag conventions used across the Nostr ecosystem.

const NSFW_KEYWORDS = [
  "nsfw",
  "nudity",
  "nude",
  "porn",
  "explicit",
  "sexual",
  "gore",
  "violence",
  "sensitive",
  "adult",
  "18+",
];

export function isSensitive(event) {
  if (!event || !event.tags) return false;

  // 1. NIP-36: content-warning tag
  const cwTag = event.tags.find((t) => t[0] === "content-warning");
  if (cwTag) return true;

  // 2. Hashtag conventions: ["t", "nsfw"], ["t", "nudity"]
  const hashtags = event.tags
    .filter((t) => t[0] === "t")
    .map((t) => (t[1] || "").toLowerCase());
  if (hashtags.some((h) => NSFW_KEYWORDS.some((kw) => h.includes(kw)))) {
    return true;
  }

  // 3. NIP-32 labels: ["L", "content-warning"] + ["l", "reason", "content-warning"]
  const LTags = event.tags
    .filter((t) => t[0] === "L")
    .map((t) => (t[1] || "").toLowerCase());
  const lTags = event.tags
    .filter((t) => t[0] === "l")
    .map((t) => (t[1] || "").toLowerCase());

  if (LTags.includes("content-warning")) return true;
  if (LTags.includes("social.nos.ontology") && lTags.some((l) => l.startsWith("ns-"))) {
    return true;
  }

  // 4. Fallback: scan content for common warning phrases
  const content = (event.content || "").toLowerCase();
  if (content.includes("#nsfw") || content.includes("#nudity")) return true;

  return false;
}

// Extracts a human-readable reason from the event, if available.
export function getWarningReason(event) {
  const cwTag = event.tags.find((t) => t[0] === "content-warning");
  if (cwTag && cwTag[1]) return cwTag[1];

  // NIP-32: ["l", "reason", "content-warning"]
  const lTag = event.tags.find(
    (t) => t[0] === "l" && t[2] === "content-warning"
  );
  if (lTag && lTag[1]) return lTag[1];

  return "সংবেদনশীল বিষয়বস্তু";
}