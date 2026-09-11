import { generateSecretKey, getPublicKey, finalizeEvent, nip19 } from "nostr-tools";
import { Relay } from "nostr-tools/relay";

// --- Relay list ---
// Relays known to work with plain NIP-01 filter objects.
// Add or remove as needed after testing.
export const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://nostr.mom",
];

const STORAGE_KEY = "balaka_nsec";

// --- Legacy key handling (kept for backward compatibility) ---
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
// FETCHING — uses the low-level Relay class (plain NIP-01 filter objects)
// =========================================================================

// Fetch from a single relay. Resolves with an array of events.
function fetchFromRelay(relayUrl, filter, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const events = [];
    const seen = new Set();
    let closed = false;
    let relay = null;
    let sub = null;

    const close = () => {
      if (closed) return;
      closed = true;
      try { sub?.close(); } catch {}
      try { relay?.close(); } catch {}
      events.sort((a, b) => b.created_at - a.created_at);
      resolve(events);
    };

    (async () => {
      try {
        relay = await Relay.connect(relayUrl);
        sub = relay.subscribe([filter], {
          onevent(event) {
            if (!seen.has(event.id)) {
              seen.add(event.id);
              events.push(event);
            }
          },
          oneose() {
            // End of stored events — relay has sent everything it has
            close();
          },
        });
        // Safety timeout in case the relay never sends EOSE
        setTimeout(close, timeoutMs);
      } catch (err) {
        console.warn(`Relay ${relayUrl} failed:`, err.message);
        close();
      }
    })();
  });
}

// Fetch recent kind-1 notes from all relays, merged and deduplicated.
export async function fetchRecentNotes(limit = 30, timeoutMs = 4000) {
  const filter = { kinds: [1] };
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

// Fetch the kind-3 contact list for a pubkey. Returns an array of pubkeys.
export async function fetchContactList(pubkey, timeoutMs = 4000) {
  const filter = { kinds: [3], authors: [pubkey] };
  const results = await Promise.all(
    DEFAULT_RELAYS.map((url) => fetchFromRelay(url, filter, timeoutMs))
  );

  // Kind 3 is replaceable — take the most recent across all relays
  const all = results.flat();
  if (all.length === 0) return [];
  all.sort((a, b) => b.created_at - a.created_at);
  const latest = all[0];

  return latest.tags
    .filter((t) => t[0] === "p")
    .map((t) => t[1]);
}

// =========================================================================
// PUBLISHING — uses SimplePool for outbound writes (works fine)
// =========================================================================
import { SimplePool } from "nostr-tools/pool";
const pool = new SimplePool();

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

export async function publishReaction(noteId, authorPubkey, secretKey) {
  const event = finalizeEvent(
    {
      kind: 7,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["e", noteId],
        ["p", authorPubkey],
        ["k", "1"],
      ],
      content: "+",
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