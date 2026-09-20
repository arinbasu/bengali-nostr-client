import { generateSecretKey, getPublicKey, finalizeEvent, nip19 } from "nostr-tools";
import { SimplePool } from "nostr-tools/pool";

// Reduced to the two relays that actually work reliably.
export const DEFAULT_RELAYS = [
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://relay.primal.net",
];

export const PROFILE_RELAYS = [
  "wss://relay.primal.net",
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://nostr.wine",
  "wss://relay.snort.social",
  "wss://relay.nostr.bg",
  "wss://nostr.mom",
];

// NIP-50-capable search relays
export const SEARCH_RELAYS = [
  "wss://relay.nostr.band",
];

const STORAGE_KEY = "balaka_nsec";

// One pool for everything — reads and writes.
const pool = new SimplePool();

// Caches
const repliesCache = new Map();
const parentEventCache = new Map();

// ---------------------------------------------------------------------------
// CONCURRENCY GATE
// Relays cap the number of concurrent REQ subscriptions. Exceeding it
// returns "too many concurrent REQs" and drops the connection. Gate all
// queries behind a small semaphore so the app never exceeds the limit.
// ---------------------------------------------------------------------------

const MAX_CONCURRENT_QUERIES = 2;
let activeQueries = 0;
const pendingQueries = [];

async function acquireQuerySlot() {
  if (activeQueries < MAX_CONCURRENT_QUERIES) {
    activeQueries++;
    return;
  }
  await new Promise((resolve) => pendingQueries.push(resolve));
}

function releaseQuerySlot() {
  const next = pendingQueries.shift();
  if (next) {
    next();
  } else {
    activeQueries--;
  }
}

// Wraps pool.querySync with the semaphore. Every read goes through this.
async function gatedQuery(relays, filter) {
  await acquireQuerySlot();
  try {
    return await pool.querySync(relays, filter);
  } finally {
    releaseQuerySlot();
  }
}

// ---------------------------------------------------------------------------
// KEY HANDLING (legacy — kept for backward compatibility)
// ---------------------------------------------------------------------------

export function getOrCreateKeypair() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const { type, data } = nip19.decode(stored);
      if (type === "nsec") {
        return { secretKey: data, publicKey: getPublicKey(data) };
      }
    } catch (e) {
      console.error("Invalid stored key", e);
    }
  }
  const secretKey = generateSecretKey();
  const nsec = nip19.nsecEncode(secretKey);
  localStorage.setItem(STORAGE_KEY, nsec);
  return { secretKey, publicKey: getPublicKey(secretKey) };
}

export function getNpub() {
  const { publicKey } = getOrCreateKeypair();
  return nip19.npubEncode(publicKey);
}

// ---------------------------------------------------------------------------
// FETCHING
// ---------------------------------------------------------------------------

export async function fetchRecentNotes(limit = 30, authors = null) {
  const filter = { kinds: [1] };
  if (authors?.length) filter.authors = authors;

  try {
    const events = await gatedQuery(DEFAULT_RELAYS, filter);
    const unique = dedupe(events);
    unique.sort((a, b) => b.created_at - a.created_at);
    return unique.slice(0, limit);
  } catch (err) {
    console.warn("fetchRecentNotes failed:", err?.message || err);
    return [];
  }
}

export async function fetchContactList(pubkey) {
  try {
    const events = await gatedQuery(DEFAULT_RELAYS, {
      kinds: [3],
      authors: [pubkey],
    });
    if (!events.length) return [];

    events.sort((a, b) => b.created_at - a.created_at);
    return events[0].tags
      .filter((t) => t[0] === "p")
      .map((t) => t[1]);
  } catch (err) {
    console.warn("fetchContactList failed:", err?.message || err);
    return [];
  }
}

export async function fetchProfiles(pubkeys) {
  if (!pubkeys?.length) return new Map();
  const unique = [...new Set(pubkeys)].filter(Boolean);

  try {
    const events = await gatedQuery(PROFILE_RELAYS, {
      kinds: [0],
      authors: unique,
    });

    const map = new Map();
    events.sort((a, b) => b.created_at - a.created_at);
    for (const ev of events) {
      if (!map.has(ev.pubkey)) {
        try {
          map.set(ev.pubkey, JSON.parse(ev.content));
        } catch {}
      }
    }
    return map;
  } catch (err) {
    console.warn("fetchProfiles failed:", err?.message || err);
    return new Map();
  }
}

export async function fetchEventById(eventId) {
  if (!eventId) return null;
  try {
    const events = await gatedQuery(DEFAULT_RELAYS, { ids: [eventId] });
    return events[0] || null;
  } catch {
    return null;
  }
}

export async function fetchParentEvent(eventId) {
  if (parentEventCache.has(eventId)) return parentEventCache.get(eventId);
  const ev = await fetchEventById(eventId);
  if (ev) parentEventCache.set(eventId, ev);
  return ev;
}

export async function fetchNotifications(pubkey, limit = 50) {
  const since = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  try {
    const events = await gatedQuery(DEFAULT_RELAYS, {
      kinds: [1, 6, 7],
      "#p": [pubkey],
      since,
    });
    const unique = dedupe(events);
    unique.sort((a, b) => b.created_at - a.created_at);
    return unique.slice(0, limit);
  } catch {
    return [];
  }
}

export async function searchByHashtag(tag, limit = 50) {
  const cleanTag = tag.toLowerCase().replace(/^#/, "");
  try {
    const events = await gatedQuery(DEFAULT_RELAYS, {
      kinds: [1],
      "#t": [cleanTag],
    });
    const unique = dedupe(events);
    unique.sort((a, b) => b.created_at - a.created_at);
    return unique.slice(0, limit);
  } catch {
    return [];
  }
}

export async function searchNotes(keyword, limit = 50) {
  if (!keyword?.trim()) return [];
  try {
    const events = await gatedQuery(SEARCH_RELAYS, {
      kinds: [1],
      search: keyword.trim(),
    });
    const unique = dedupe(events);
    unique.sort((a, b) => b.created_at - a.created_at);
    return unique.slice(0, limit);
  } catch {
    return [];
  }
}

export async function fetchDeletions(pubkeys) {
  if (!pubkeys?.length) return new Set();
  try {
    const events = await gatedQuery(DEFAULT_RELAYS, {
      kinds: [5],
      authors: pubkeys,
    });
    const ids = new Set();
    for (const ev of events) {
      ev.tags
        .filter((t) => t[0] === "e")
        .forEach((t) => t[1] && ids.add(t[1]));
    }
    return ids;
  } catch {
    return new Set();
  }
}

// ---------------------------------------------------------------------------
// PUBLISHING (signer-aware)
// ---------------------------------------------------------------------------

export async function publishWithSigner(kind, content, signer, tags = []) {
  const template = {
    kind,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
  };

  const signed = await signer.signEvent(template);
  const results = await Promise.allSettled(
    pool.publish(DEFAULT_RELAYS, signed)
  );

  const fulfilled = results.filter((r) => r.status === "fulfilled").length;
  console.log(
    `Published kind ${kind}: ${fulfilled}/${DEFAULT_RELAYS.length} relays`
  );

  return signed;
}

export async function publishNoteWithSigner(content, signer, tags = []) {
  return publishWithSigner(1, content, signer, tags);
}

export async function publishReactionWithSigner(
  noteId,
  authorPubkey,
  signer,
  content = "+"
) {
  return publishWithSigner(7, content, signer, [
    ["e", noteId],
    ["p", authorPubkey],
    ["k", "1"],
  ]);
}

export async function publishRepostWithSigner(originalEvent, signer) {
  return publishWithSigner(6, "", signer, [
    ["e", originalEvent.id],
    ["p", originalEvent.pubkey],
  ]);
}

export async function publishContactListWithSigner(followedPubkeys, signer) {
  return publishWithSigner(
    3,
    "",
    signer,
    followedPubkeys.map((pk) => ["p", pk])
  );
}

export async function publishProfileWithSigner(metadata, signer) {
  return publishWithSigner(0, JSON.stringify(metadata), signer, []);
}

export async function publishDeletionWithSigner(eventIds, signer) {
  const tags = eventIds.map((id) => ["e", id]);
  tags.push(["k", "1"]);
  return publishWithSigner(5, "Deleted by author", signer, tags);
}

export async function publishReplyWithSigner(
  parentEvent,
  content,
  signer,
  extraTags = []
) {
  const replyTags = buildReplyTags(parentEvent);
  return publishWithSigner(1, content, signer, [...replyTags, ...extraTags]);
}

// ---------------------------------------------------------------------------
// REPLIES (NIP-10)
// ---------------------------------------------------------------------------

export function buildReplyTags(parentEvent) {
  const eTags = parentEvent.tags.filter((t) => t[0] === "e");
  const rootMarker = eTags.find((t) => t[3] === "root");

  let rootId, parentId;
  if (rootMarker) {
    rootId = rootMarker[1];
    parentId = parentEvent.id;
  } else if (eTags.length === 0) {
    rootId = parentEvent.id;
    parentId = parentEvent.id;
  } else if (eTags.length === 1) {
    rootId = eTags[0][1];
    parentId = rootId;
  } else {
    rootId = eTags[0][1];
    parentId = eTags[eTags.length - 1][1];
  }

  const tags = [["e", rootId, "", "root"]];
  if (parentId !== rootId) {
    tags.push(["e", parentId, "", "reply"]);
  }

  const pSet = new Set([parentEvent.pubkey]);
  parentEvent.tags
    .filter((t) => t[0] === "p")
    .forEach((t) => pSet.add(t[1]));
  pSet.forEach((pk) => tags.push(["p", pk]));

  return tags;
}

export async function fetchReplies(noteId) {
  if (repliesCache.has(noteId)) return repliesCache.get(noteId);

  try {
    const events = await gatedQuery(DEFAULT_RELAYS, {
      kinds: [1],
      "#e": [noteId],
    });
    const unique = dedupe(events);
    unique.sort((a, b) => a.created_at - b.created_at);
    if (unique.length > 0) repliesCache.set(noteId, unique);
    return unique;
  } catch {
    return [];
  }
}

export function clearRepliesCache(noteId) {
  if (noteId) repliesCache.delete(noteId);
  else repliesCache.clear();
}

export function updateRepliesCache(noteId, replies) {
  if (noteId) repliesCache.set(noteId, replies);
}

export function buildReplyTree(replies, rootId) {
  const byId = new Map();
  replies.forEach((r) => byId.set(r.id, { event: r, children: [] }));

  const roots = [];
  replies.forEach((r) => {
    const eTags = r.tags.filter((t) => t[0] === "e");
    const replyMarker = eTags.find((t) => t[3] === "reply");
    let parentId;
    if (replyMarker) parentId = replyMarker[1];
    else if (eTags.length <= 1) parentId = rootId;
    else parentId = eTags[eTags.length - 1][1];

    const node = byId.get(r.id);
    if (parentId === rootId) roots.push(node);
    else {
      const parent = byId.get(parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  });

  return roots;
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------

export function closeAllRelays() {
  try {
    pool.close(DEFAULT_RELAYS);
  } catch {}
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function dedupe(events) {
  const seen = new Set();
  const out = [];
  for (const ev of events) {
    if (!seen.has(ev.id)) {
      seen.add(ev.id);
      out.push(ev);
    }
  }
  return out;
}