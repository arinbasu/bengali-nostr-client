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

// Relays that support NIP-50 full-text search
export const SEARCH_RELAYS = [
  "wss://relay.nostr.band",
  "wss://search.nos.today",
  "wss://nostr.wine",
];

const STORAGE_KEY = "balaka_nsec";

// SimplePool for publishing
const pool = new SimplePool();

// Persistent relay connections — one per URL, reused for all fetches
const relayPool = new Map();

// Caches
const repliesCache = new Map();
const parentEventCache = new Map();

// How long a connection can sit idle before we force a reconnect.
const RELAY_MAX_IDLE_MS = 20 * 1000;

// =========================================================================
// PERSISTENT CONNECTION HELPERS
// =========================================================================

async function getRelay(url) {
  const existing = relayPool.get(url);

  if (existing) {
    const idleMs = Date.now() - (existing._balakaLastUsed || 0);

    if (existing.connected && idleMs < RELAY_MAX_IDLE_MS) {
      existing._balakaLastUsed = Date.now();
      return existing;
    }

    try { existing.close(); } catch {}
    relayPool.delete(url);
  }

  const relay = await Relay.connect(url);
  relay._balakaLastUsed = Date.now();
  relayPool.set(url, relay);

  relay.onclose = () => {
    if (relayPool.get(url) === relay) {
      relayPool.delete(url);
    }
  };

  return relay;
}

function fetchFromRelay(relayUrl, filter, timeoutMs = 8000) {
  return new Promise(async (resolve) => {
    const events = [];
    const seen = new Set();
    let closed = false;
    let sub = null;

    const close = () => {
      if (closed) return;
      closed = true;
      try { sub?.close(); } catch {}

      const relay = relayPool.get(relayUrl);
      if (relay) relay._balakaLastUsed = Date.now();

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
      relayPool.delete(relayUrl);
      close();
    }
  });
}

// Force-close all pooled relay connections.
export function closeAllRelays() {
  for (const [, relay] of relayPool) {
    try { relay.close(); } catch {}
  }
  relayPool.clear();
}

// Force-close all relays and start fresh.
// Use when connections are suspected of being stale
// (Safari keeps them half-alive after idle).
export function resetRelayPool() {
  closeAllRelays();
}

// Diagnostic: how many relays are currently pooled
export function getRelayCount() {
  return relayPool.size;
}

// Generic retry-with-fresh-pool wrapper.
// Runs `fn`, and if it returns an empty result, resets the relay
// pool, waits briefly for Safari to release sockets, and tries again.
async function withRetry(fn, isEmpty) {
  let result = await fn();
  if (!isEmpty(result)) return result;

  console.warn("First fetch returned empty — resetting relay pool and retrying");
  resetRelayPool();

  // Give Safari a moment to fully release the sockets
  await new Promise((r) => setTimeout(r, 500));

  result = await fn();
  return result;
}

// =========================================================================
// LEGACY KEY HANDLING
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

// Internal: single-shot feed fetch with streaming resolution.
async function fetchRecentNotesOnce(limit, authors, timeoutMs) {
  const filter = { kinds: [1] };
  if (authors && authors.length > 0) {
    filter.authors = authors;
  }

  return new Promise((resolve) => {
    const merged = new Map();
    let responded = 0;
    let resolved = false;
    const total = DEFAULT_RELAYS.length;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      const all = Array.from(merged.values());
      all.sort((a, b) => b.created_at - a.created_at);
      resolve(all.slice(0, limit));
    };

    const hardTimeout = setTimeout(finish, timeoutMs);

    DEFAULT_RELAYS.forEach(async (url) => {
      try {
        const events = await fetchFromRelay(url, filter, timeoutMs);
        for (const ev of events) {
          if (!merged.has(ev.id)) merged.set(ev.id, ev);
        }
        responded++;

        if (!resolved && responded >= 2 && merged.size > 0) {
          clearTimeout(hardTimeout);
          finish();
          return;
        }
        if (!resolved && responded === total) {
          clearTimeout(hardTimeout);
          finish();
        }
      } catch {
        responded++;
        if (responded === total && !resolved) {
          clearTimeout(hardTimeout);
          finish();
        }
      }
    });
  });
}

// Public: fetch feed with automatic retry on empty result.
export async function fetchRecentNotes(limit = 30, authors = null, timeoutMs = 10000) {
  return withRetry(
    () => fetchRecentNotesOnce(limit, authors, timeoutMs),
    (events) => events.length === 0
  );
}

// Internal: contact list fetch.
async function fetchContactListOnce(pubkey, timeoutMs) {
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

export async function fetchContactList(pubkey, timeoutMs = 10000) {
  return withRetry(
    () => fetchContactListOnce(pubkey, timeoutMs),
    (list) => list.length === 0
  );
}

// Internal: profiles fetch with chunking.
async function fetchProfilesOnce(pubkeys, timeoutMs) {
  const profileMap = new Map();

  const chunks = [];
  for (let i = 0; i < pubkeys.length; i += 10) {
    chunks.push(pubkeys.slice(i, i + 10));
  }

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      const filter = { kinds: [0], authors: chunk };
      const results = await Promise.all(
        DEFAULT_RELAYS.map((url) => fetchFromRelay(url, filter, timeoutMs))
      );
      return results.flat();
    })
  );

  const all = chunkResults.flat();
  all.sort((a, b) => b.created_at - a.created_at);

  for (const ev of all) {
    if (!profileMap.has(ev.pubkey)) {
      try {
        profileMap.set(ev.pubkey, JSON.parse(ev.content));
      } catch {}
    }
  }

  return profileMap;
}

export async function fetchProfiles(pubkeys, timeoutMs = 10000) {
  if (!pubkeys || pubkeys.length === 0) return new Map();
  return withRetry(
    () => fetchProfilesOnce(pubkeys, timeoutMs),
    (map) => map.size === 0
  );
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

export async function fetchParentEvent(eventId, relayHints = [], timeoutMs = 3000) {
  if (parentEventCache.has(eventId)) {
    return parentEventCache.get(eventId);
  }
  const ev = await fetchEventById(eventId, relayHints, timeoutMs);
  if (ev) parentEventCache.set(eventId, ev);
  return ev;
}

// Internal: notifications fetch.
async function fetchNotificationsOnce(pubkey, limit, timeoutMs) {
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

export async function fetchNotifications(pubkey, limit = 50, timeoutMs = 8000) {
  return withRetry(
    () => fetchNotificationsOnce(pubkey, limit, timeoutMs),
    (list) => list.length === 0
  );
}

// Internal: hashtag search.
async function searchByHashtagOnce(tag, limit, timeoutMs) {
  const cleanTag = tag.toLowerCase().replace(/^#/, "");

  const tagFilter = { kinds: [1], "#t": [cleanTag] };
  const tagResults = await Promise.all(
    DEFAULT_RELAYS.map((url) => fetchFromRelay(url, tagFilter, timeoutMs))
  );

  const recentFilter = { kinds: [1] };
  const recentResults = await Promise.all(
    DEFAULT_RELAYS.map((url) => fetchFromRelay(url, recentFilter, timeoutMs))
  );

  const merged = new Map();

  for (const relayEvents of tagResults) {
    for (const ev of relayEvents) {
      if (!merged.has(ev.id)) merged.set(ev.id, ev);
    }
  }

  const pattern = `#${cleanTag}`;
  for (const relayEvents of recentResults) {
    for (const ev of relayEvents) {
      if (merged.has(ev.id)) continue;

      const content = (ev.content || "").toLowerCase();
      const tTags = ev.tags
        .filter((t) => t[0] === "t")
        .map((t) => (t[1] || "").toLowerCase());

      if (content.includes(pattern) || tTags.includes(cleanTag)) {
        merged.set(ev.id, ev);
      }
    }
  }

  const all = Array.from(merged.values());
  all.sort((a, b) => b.created_at - a.created_at);
  return all.slice(0, limit);
}

export async function searchByHashtag(tag, limit = 50, timeoutMs = 8000) {
  return withRetry(
    () => searchByHashtagOnce(tag, limit, timeoutMs),
    (list) => list.length === 0
  );
}

// Internal: keyword search.
async function searchNotesOnce(keyword, limit, timeoutMs) {
  const filter = { kinds: [1], search: keyword.trim() };

  const results = await Promise.all(
    SEARCH_RELAYS.map((url) => fetchFromRelay(url, filter, timeoutMs))
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

export async function searchNotes(keyword, limit = 50, timeoutMs = 8000) {
  if (!keyword || !keyword.trim()) return [];
  return withRetry(
    () => searchNotesOnce(keyword, limit, timeoutMs),
    (list) => list.length === 0
  );
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

export async function publishDeletionRequest(eventIds, secretKey) {
  const tags = eventIds.map((id) => ["e", id]);
  tags.push(["k", "1"]);

  const event = finalizeEvent(
    {
      kind: 5,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: "Deleted by author",
    },
    secretKey
  );

  try {
    const results = await Promise.allSettled(pool.publish(DEFAULT_RELAYS, event));
    console.log("Deletion publish results:", results);
    return event;
  } catch (err) {
    console.error("Deletion publish error:", err);
    throw err;
  }
}

export async function fetchDeletions(pubkeys, timeoutMs = 3000) {
  if (!pubkeys || pubkeys.length === 0) return new Set();

  const filter = { kinds: [5], authors: pubkeys };

  const results = await Promise.all(
    DEFAULT_RELAYS.map((url) => fetchFromRelay(url, filter, timeoutMs))
  );

  const deletedIds = new Set();
  for (const relayEvents of results) {
    for (const ev of relayEvents) {
      ev.tags
        .filter((t) => t[0] === "e")
        .forEach((t) => {
          if (t[1]) deletedIds.add(t[1]);
        });
    }
  }

  return deletedIds;
}

// =========================================================================
// REPLIES (NIP-10)
// =========================================================================

export function buildReplyTags(parentEvent) {
  const eTags = parentEvent.tags.filter((t) => t[0] === "e");

  let rootId, parentId;

  const rootMarker = eTags.find((t) => t[3] === "root");

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

// Internal: replies fetch.
async function fetchRepliesOnce(noteId, timeoutMs) {
  console.log("🔍 fetchReplies called for:", noteId);

  if (repliesCache.has(noteId)) {
    const cached = repliesCache.get(noteId);
    console.log("📦 Returning cached:", cached.length, "replies");
    return cached;
  }

  const filter = { kinds: [1], "#e": [noteId] };

  const results = await Promise.all(
    DEFAULT_RELAYS.map(async (url) => {
      try {
        const events = await fetchFromRelay(url, filter, timeoutMs);
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

  if (all.length > 0) {
    repliesCache.set(noteId, all);
  }

  return all;
}

export async function fetchReplies(noteId, timeoutMs = 8000) {
  // Note: we don't retry replies on empty — a note with no replies
  // is a normal, common case. Retrying would double the latency
  // for every reply-less note.
  return fetchRepliesOnce(noteId, timeoutMs);
}

export function clearRepliesCache(noteId) {
  if (noteId) {
    repliesCache.delete(noteId);
  } else {
    repliesCache.clear();
  }
}

export function updateRepliesCache(noteId, replies) {
  if (noteId) {
    repliesCache.set(noteId, replies);
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
      parentId = eTags[eTags.length - 1][1];
    }

    const node = byId.get(r.id);
    if (parentId === rootId) {
      roots.push(node);
    } else {
      const parent = byId.get(parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  });

  return roots;
}