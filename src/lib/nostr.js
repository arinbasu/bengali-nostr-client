import { generateSecretKey, getPublicKey, finalizeEvent, nip19 } from "nostr-tools";
import { Relay } from "nostr-tools/relay";
import { SimplePool } from "nostr-tools/pool";

// --- Relays ---
export const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://nostr.mom",
];

const STORAGE_KEY = "balaka_nsec";

// SimplePool for publishing (writes work fine through it)
const pool = new SimplePool();

// Persistent relay connections — one per URL, reused for all fetches
const relayPool = new Map();

// In-memory cache for replies — keyed by root note ID
const repliesCache = new Map();
// In-memory cache for parent events — keyed by event ID
const parentEventCache = new Map();
// =========================================================================
// PERSISTENT CONNECTION HELPERS
// =========================================================================

async function getRelay(url) {
  const existing = relayPool.get(url);

  if (existing) {
    if (existing.connected) return existing;
    try { existing.close(); } catch {}
    relayPool.delete(url);
  }

  const relay = await Relay.connect(url);
  relayPool.set(url, relay);

  // Auto-remove from pool when the relay closes
  relay.onclose = () => {
    if (relayPool.get(url) === relay) {
      relayPool.delete(url);
    }
  };

  return relay;
}

// Fetch from a single relay using a pooled connection.
// Does NOT close the connection afterward.
function fetchFromRelay(relayUrl, filter, timeoutMs = 4000) {
  return new Promise(async (resolve) => {
    const events = [];
    const seen = new Set();
    let closed = false;
    let sub = null;

    const close = () => {
      if (closed) return;
      closed = true;
      try { sub?.close(); } catch {}
      events.sort((a, b) => b.created_at - a.created_at);
      resolve(events);
    };

    try {
      const relay = await getRelay(relayUrl);

      sub = relay.subscribe([filter], {
        onevent(event) {
          if (!seen.has(event.id)) {
            seen.add(event.id);
            events.push(event);
          }
        },
        oneose() {
          close();
        },
      });

      setTimeout(close, timeoutMs);
    } catch (err) {
      console.warn(`Relay ${relayUrl} failed:`, err?.message || err);
      close();
    }
  });
}

// =========================================================================
// LEGACY KEY HANDLING (kept for backward compatibility)
// =========================================================================

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

// =========================================================================
// FETCHING
// =========================================================================

export async function fetchRecentNotes(limit = 30, authors = null, timeoutMs = 4000) {
  const filter = { kinds: [1] };
  if (authors && authors.length > 0) {
    filter.authors = authors;
  }

  const results = await Promise.all(
    DEFAULT_RELAYS.map((url) => fetchFromRelay(url, filter, timeoutMs))
  );

  const merged = new Map();
  for (const relayEvents of results) {
    for (const ev of relayEvents) {
      if (!merged.has(ev.id)) merged.set(ev.id, ev);
    }
  }

  const all = Array.from(merged.values());
  all.sort((a, b) => b.created_at - a.created_at);
  return all.slice(0, limit);
}

export async function fetchContactList(pubkey, timeoutMs = 4000) {
  const filter = { kinds: [3], authors: [pubkey] };
  const results = await Promise.all(
    DEFAULT_RELAYS.map((url) => fetchFromRelay(url, filter, timeoutMs))
  );

  const all = results.flat();
  if (all.length === 0) return [];
  all.sort((a, b) => b.created_at - a.created_at);
  const latest = all[0];

  return latest.tags
    .filter((t) => t[0] === "p")
    .map((t) => t[1]);
}

export async function fetchProfiles(pubkeys, timeoutMs = 3000) {
  if (!pubkeys || pubkeys.length === 0) return new Map();

  const filter = { kinds: [0], authors: pubkeys };
  const results = await Promise.all(
    DEFAULT_RELAYS.map((url) => fetchFromRelay(url, filter, timeoutMs))
  );

  const profileMap = new Map();
  const all = results.flat();

  all.sort((a, b) => b.created_at - a.created_at);
  for (const ev of all) {
    if (!profileMap.has(ev.pubkey)) {
      try {
        const metadata = JSON.parse(ev.content);
        profileMap.set(ev.pubkey, metadata);
      } catch {
        // skip malformed metadata
      }
    }
  }

  return profileMap;
}

export async function fetchEventById(eventId, relayHints = [], timeoutMs = 4000) {
  if (!eventId) return null;

  const relays = [...new Set([...relayHints, ...DEFAULT_RELAYS])];

  const results = await Promise.all(
    relays.map((url) => fetchFromRelay(url, { ids: [eventId] }, timeoutMs))
  );

  const flat = results.flat();
  return flat[0] || null;
}

export async function fetchNotifications(pubkey, limit = 50, timeoutMs = 4000) {
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  const filter = {
    kinds: [1, 6, 7],
    "#p": [pubkey],
    since: sevenDaysAgo,
  };

  const results = await Promise.all(
    DEFAULT_RELAYS.map((url) => fetchFromRelay(url, filter, timeoutMs))
  );

  const merged = new Map();
  for (const relayEvents of results) {
    for (const ev of relayEvents) {
      if (!merged.has(ev.id)) merged.set(ev.id, ev);
    }
  }

  const all = Array.from(merged.values());
  all.sort((a, b) => b.created_at - a.created_at);
  return all.slice(0, limit);
}

// =========================================================================
// PUBLISHING
// =========================================================================

export async function publishNote(content, secretKey, tags = []) {
  const event = finalizeEvent(
    {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
    },
    secretKey
  );

  try {
    console.log("Publishing to relays:", DEFAULT_RELAYS);
    const results = await Promise.allSettled(pool.publish(DEFAULT_RELAYS, event));
    console.log("Publish results:", results);
    return event;
  } catch (err) {
    console.error("Publish error:", err);
    throw err;
  }
}

export async function publishReaction(noteId, authorPubkey, secretKey, content = "+") {
  const event = finalizeEvent(
    {
      kind: 7,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["e", noteId],
        ["p", authorPubkey],
        ["k", "1"],
      ],
      content,
    },
    secretKey
  );

  try {
    const results = await Promise.allSettled(pool.publish(DEFAULT_RELAYS, event));
    console.log("Reaction publish results:", results);
    return event;
  } catch (err) {
    console.error("Reaction publish error:", err);
    throw err;
  }
}

export async function publishRepost(originalEvent, secretKey) {
  const event = finalizeEvent(
    {
      kind: 6,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["e", originalEvent.id],
        ["p", originalEvent.pubkey],
      ],
      content: "",
    },
    secretKey
  );

  try {
    const results = await Promise.allSettled(pool.publish(DEFAULT_RELAYS, event));
    console.log("Repost publish results:", results);
    return event;
  } catch (err) {
    console.error("Repost publish error:", err);
    throw err;
  }
}

export async function publishContactList(followedPubkeys, secretKey) {
  const tags = followedPubkeys.map((pk) => ["p", pk]);
  const event = finalizeEvent(
    {
      kind: 3,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: "",
    },
    secretKey
  );

  try {
    const results = await Promise.allSettled(pool.publish(DEFAULT_RELAYS, event));
    console.log("Contact list publish results:", results);
    return event;
  } catch (err) {
    console.error("Contact list publish error:", err);
    throw err;
  }
}

// =========================================================================
// REPLIES (NIP-10)
// =========================================================================

export function buildReplyTags(parentEvent) {
  const eTags = parentEvent.tags.filter((t) => t[0] === "e");

  let rootId, parentId;

  const rootMarker = eTags.find((t) => t[3] === "root");

  if (rootMarker) {
    // Parent already references a root — inherit it,
    // and set our parent to the event we're replying to.
    rootId = rootMarker[1];
    parentId = parentEvent.id;
  } else if (eTags.length === 0) {
    // Parent is the thread root
    rootId = parentEvent.id;
    parentId = parentEvent.id;
  } else if (eTags.length === 1) {
    // Single unmarked e tag — legacy, treat as direct reply to root
    rootId = eTags[0][1];
    parentId = rootId;
  } else {
    // Multiple unmarked — NIP-10 positional: first is root, last is parent
    rootId = eTags[0][1];
    parentId = eTags[eTags.length - 1][1];
  }

  const tags = [];
  tags.push(["e", rootId, "", "root"]);
  if (parentId !== rootId) {
    tags.push(["e", parentId, "", "reply"]);
  }

  const pSet = new Set();
  pSet.add(parentEvent.pubkey);
  parentEvent.tags
    .filter((t) => t[0] === "p")
    .forEach((t) => pSet.add(t[1]));
  pSet.forEach((pk) => tags.push(["p", pk]));

  return tags;
}

export async function publishReply(parentEvent, content, secretKey, extraTags = []) {
  const replyTags = buildReplyTags(parentEvent);
  const event = finalizeEvent(
    {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [...replyTags, ...extraTags],
      content,
    },
    secretKey
  );

  const results = await Promise.allSettled(pool.publish(DEFAULT_RELAYS, event));
  console.log("Reply publish results:", results);
  return event;
}

export async function fetchReplies(noteId, timeoutMs = 4000) {
  console.log("🔍 fetchReplies called for:", noteId);

  if (repliesCache.has(noteId)) {
    const cached = repliesCache.get(noteId);
    console.log("📦 Returning cached:", cached.length, "replies");
    return cached;
  }

  const filter = { kinds: [1], "#e": [noteId] };
  console.log("📤 Filter:", JSON.stringify(filter));

  const results = await Promise.all(
    DEFAULT_RELAYS.map(async (url) => {
      try {
        const events = await fetchFromRelay(url, filter, timeoutMs);
        console.log(`✅ ${url} returned ${events.length} events`);
        return events;
      } catch (err) {
        console.log(`❌ ${url} failed:`, err?.message || err);
        return [];
      }
    })
  );

  const merged = new Map();
  for (const relayEvents of results) {
    for (const ev of relayEvents) {
      if (!merged.has(ev.id)) merged.set(ev.id, ev);
    }
  }

  const all = Array.from(merged.values());
  all.sort((a, b) => a.created_at - b.created_at);
  console.log("📊 Total replies:", all.length);

  // Only cache non-empty results
  if (all.length > 0) {
    repliesCache.set(noteId, all);
  }

  return all;
}

export function clearRepliesCache(noteId) {
  if (noteId) {
    repliesCache.delete(noteId);
  } else {
    repliesCache.clear();
  }
}

export function buildReplyTree(replies, rootId) {
  const byId = new Map();
  replies.forEach((r) => byId.set(r.id, { event: r, children: [] }));

  const roots = [];
  replies.forEach((r) => {
    const eTags = r.tags.filter((t) => t[0] === "e");

    let parentId = null;

    const replyMarker = eTags.find((t) => t[3] === "reply");
    if (replyMarker) {
      parentId = replyMarker[1];
    } else if (eTags.length <= 1) {
      parentId = rootId;
    } else {
      // Unmarked NIP-10 positional: last e tag is the parent
      parentId = eTags[eTags.length - 1][1];
    }

    const node = byId.get(r.id);
    if (parentId === rootId) {
      roots.push(node);
    } else {
      const parent = byId.get(parentId);
      if (parent) parent.children.push(node);
      else roots.push(node); // orphan — show at top level
    }
  });

  return roots;
}

export function updateRepliesCache(noteId, replies) {
  repliesCache.set(noteId, replies);
}

export async function fetchParentEvent(eventId, relayHints = [], timeoutMs = 3000) {
  if (parentEventCache.has(eventId)) {
    return parentEventCache.get(eventId);
  }
  const ev = await fetchEventById(eventId, relayHints, timeoutMs);
  if (ev) parentEventCache.set(eventId, ev);
  return ev;
}

// Search for notes with a specific hashtag using NIP-12 `t` tag filtering.
export async function searchByHashtag(tag, limit = 50, timeoutMs = 4000) {
  const cleanTag = tag.toLowerCase().replace(/^#/, "");

  const filter = { kinds: [1], "#t": [cleanTag] };

  const results = await Promise.all(
    DEFAULT_RELAYS.map((url) => fetchFromRelay(url, filter, timeoutMs))
  );

  const merged = new Map();
  for (const relayEvents of results) {
    for (const ev of relayEvents) {
      if (!merged.has(ev.id)) merged.set(ev.id, ev);
    }
  }

  const all = Array.from(merged.values());
  all.sort((a, b) => b.created_at - a.created_at);
  return all.slice(0, limit);
}

// Publish or update the user's profile metadata (kind 0).
// Kind 0 is replaceable — publishing a new one supersedes the old.
export async function publishProfile(metadata, secretKey) {
  const event = finalizeEvent(
    {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(metadata),
    },
    secretKey
  );

  try {
    const results = await Promise.allSettled(pool.publish(DEFAULT_RELAYS, event));
    console.log("Profile publish results:", results);
    return event;
  } catch (err) {
    console.error("Profile publish error:", err);
    throw err;
  }
}