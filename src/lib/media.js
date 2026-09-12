import { finalizeEvent } from "nostr-tools";

// Free Blossom servers — tried in order until one succeeds.
// These are known-good public servers as of late 2025.
const BLOSSOM_SERVERS = [
  "https://blossom.primal.net",
  "https://cdn.nostr.build",
  "https://blossom.band",
  "https://cdn.satellite.earth",
];

// Calculate SHA-256 hash of a file (required by Blossom protocol)
async function sha256Hex(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Build a Blossom auth event (kind 24242)
function buildBlossomAuth(secretKey, sha256, mimeType) {
  return finalizeEvent(
    {
      kind: 24242,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["t", "upload"],
        ["x", sha256],
        ["m", mimeType],
        ["expiration", String(Math.floor(Date.now() / 1000) + 300)],
      ],
      content: "Upload via বলাকা",
    },
    secretKey
  );
}

// Encode the signed event as base64 for the Authorization header
function encodeAuthHeader(signedEvent) {
  const json = JSON.stringify(signedEvent);
  // btoa handles only Latin-1; encode UTF-8 first
  const utf8 = new TextEncoder().encode(json);
  const binary = Array.from(utf8).map((b) => String.fromCharCode(b)).join("");
  return `Nostr ${btoa(binary)}`;
}

/**
 * Upload a file to the first Blossom server that accepts it.
 * Returns { url, mime } on success, throws on total failure.
 */
export async function uploadImage(file, secretKey) {
  if (!secretKey) {
    throw new Error("No secret key — cannot sign upload");
  }

  const sha256 = await sha256Hex(file);
  const authEvent = buildBlossomAuth(secretKey, sha256, file.type);
  const authHeader = encodeAuthHeader(authEvent);

  const errors = [];

  for (const server of BLOSSOM_SERVERS) {
    try {
      const url = `${server}/upload`;
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: authHeader,
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        errors.push(`${server}: HTTP ${response.status} ${text.slice(0, 80)}`);
        continue;
      }

      const data = await response.json();
      // Blossom returns { url, sha256, size, type, uploaded }
      const blobUrl = data.url || `${server}/${sha256}`;
      console.log(`Uploaded to ${server}:`, blobUrl);
      return { url: blobUrl, mime: file.type };
    } catch (err) {
      errors.push(`${server}: ${err?.message || err}`);
    }
  }

  console.error("All Blossom servers failed:", errors);
  throw new Error("ছবি আপলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।");
}