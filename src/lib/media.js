// src/lib/media.js
// Blossom uploads using any Nostr signer (LocalSigner, Nip07Signer, Nip46Signer).
// The signer signs a kind-24242 auth event; the raw private key never leaves it.

// Free Blossom servers — tried in order until one succeeds.
const BLOSSOM_SERVERS = [
  "https://blossom.primal.net",
  "https://cdn.nostr.build",
  "https://blossom.band",
  "https://cdn.satellite.earth",
];

// SHA-256 of a file, as lowercase hex
async function sha256Hex(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Build the kind-24242 auth event template (BUD-01)
function buildBlossomAuthTemplate(sha256, mimeType) {
  const now = Math.floor(Date.now() / 1000);
  return {
    kind: 24242,
    created_at: now,
    tags: [
      ["t", "upload"],
      ["x", sha256],
      ["m", mimeType],
      ["expiration", String(now + 300)],
    ],
    content: "Upload via বলাকা",
  };
}

// Base64-encode the signed event for the Authorization header.
// btoa handles only Latin-1, so encode UTF-8 first.
function encodeAuthHeader(signedEvent) {
  const json = JSON.stringify(signedEvent);
  const utf8 = new TextEncoder().encode(json);
  const binary = Array.from(utf8).map((b) => String.fromCharCode(b)).join("");
  return `Nostr ${btoa(binary)}`;
}

/**
 * Upload a file to the first Blossom server that accepts it.
 * @param {File} file
 * @param {object} signer - Any signer with a .signEvent(template) method
 * @returns {Promise<{ url: string, mime: string }>}
 */
export async function uploadImage(file, signer) {
  if (!signer) {
    throw new Error("No signer — cannot upload");
  }

  const sha256 = await sha256Hex(file);
  const template = buildBlossomAuthTemplate(sha256, file.type);
  const signedEvent = await signer.signEvent(template);
  const authHeader = encodeAuthHeader(signedEvent);

  const errors = [];

  for (const server of BLOSSOM_SERVERS) {
    try {
      const response = await fetch(`${server}/upload`, {
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