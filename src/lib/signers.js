import { finalizeEvent, getPublicKey, generateSecretKey } from "nostr-tools/pure";
import { BunkerSigner, parseBunkerInput } from "nostr-tools/nip46";

// --- Local key signer (nsec flow) ---
export class LocalSigner {
  constructor(secretKey) {
    this.secretKey = secretKey;
    this.publicKey = getPublicKey(secretKey);
    this.type = "local";
  }
  async getPublicKey() { return this.publicKey; }
  async signEvent(eventTemplate) { return finalizeEvent(eventTemplate, this.secretKey); }
  async close() {}
}

// --- NIP-07 browser extension signer ---
export class Nip07Signer {
  constructor() {
    if (!window.nostr) throw new Error("No NIP-07 extension detected");
    this.type = "nip07";
  }
  async getPublicKey() { return window.nostr.getPublicKey(); }
  async signEvent(eventTemplate) { return window.nostr.signEvent(eventTemplate); }
  async nip04Encrypt(pubkey, plaintext) {
    if (!window.nostr.nip04) throw new Error("NIP-04 not supported");
    return window.nostr.nip04.encrypt(pubkey, plaintext);
  }
  async nip04Decrypt(pubkey, ciphertext) {
    if (!window.nostr.nip04) throw new Error("NIP-04 not supported");
    return window.nostr.nip04.decrypt(pubkey, ciphertext);
  }
  async nip44Encrypt(pubkey, plaintext) {
    if (!window.nostr.nip44) throw new Error("NIP-44 not supported");
    return window.nostr.nip44.encrypt(pubkey, plaintext);
  }
  async nip44Decrypt(pubkey, ciphertext) {
    if (!window.nostr.nip44) throw new Error("NIP-44 not supported");
    return window.nostr.nip44.decrypt(pubkey, ciphertext);
  }
  async close() {}
  static isAvailable() { return typeof window !== "undefined" && !!window.nostr; }
}

// --- NIP-46 remote bunker signer ---
export class Nip46Signer {
  constructor(bunkerSigner, clientSecretKey, bunkerUri) {
    this.bunkerSigner = bunkerSigner;
    this.clientSecretKey = clientSecretKey; // Uint8Array, disposable
    this.bunkerUri = bunkerUri;
    this.publicKey = null;
    this.type = "nip46";
  }

  async getPublicKey() {
    if (!this.publicKey) {
      this.publicKey = await this.bunkerSigner.getPublicKey();
    }
    return this.publicKey;
  }

  async signEvent(eventTemplate) {
    return this.bunkerSigner.signEvent(eventTemplate);
  }

  async nip44Encrypt(pubkey, plaintext) {
    return this.bunkerSigner.nip44Encrypt(pubkey, plaintext);
  }

  async nip44Decrypt(pubkey, ciphertext) {
    return this.bunkerSigner.nip44Decrypt(pubkey, ciphertext);
  }

  async close() {
    try { await this.bunkerSigner.close(); } catch {}
  }
}

const NIP46_TIMEOUT_MS = 30000;

// Connect to a new bunker using a bunker:// URI
export async function connectBunker(bunkerUri, onAuth) {
  const bp = await parseBunkerInput(bunkerUri.trim());
  if (!bp) throw new Error("Invalid bunker URI");

  // Disposable client key for this session — never the user's real key
  const clientSecretKey = generateSecretKey();
  let authRequested = false;

  const bunkerSigner = BunkerSigner.fromBunker(clientSecretKey, bp, {
    onauth: (url) => {
      authRequested = true;
      if (onAuth) onAuth(url);
    },
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      if (!authRequested) reject(new Error("Bunker connection timed out"));
    }, NIP46_TIMEOUT_MS);
  });

  await Promise.race([bunkerSigner.connect(), timeoutPromise]);

  const signer = new Nip46Signer(bunkerSigner, clientSecretKey, bunkerUri);
  await Promise.race([signer.getPublicKey(), timeoutPromise]);
  return signer;
}

// Reconnect an existing bunker session on page reload
export async function reconnectBunker(bunkerUri, clientSecretHex, onAuth) {
  const bp = await parseBunkerInput(bunkerUri);
  if (!bp) throw new Error("Invalid bunker URI");

  const bytes = new Uint8Array(
    clientSecretHex.match(/.{1,2}/g).map((b) => parseInt(b, 16))
  );

  let authRequested = false;
  const bunkerSigner = BunkerSigner.fromBunker(bytes, bp, {
    onauth: (url) => {
      authRequested = true;
      if (onAuth) onAuth(url);
    },
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      if (!authRequested) reject(new Error("Bunker reconnect timed out"));
    }, NIP46_TIMEOUT_MS);
  });

  await Promise.race([bunkerSigner.connect(), timeoutPromise]);

  const signer = new Nip46Signer(bunkerSigner, bytes, bunkerUri);
  await Promise.race([signer.getPublicKey(), timeoutPromise]);
  return signer;
}