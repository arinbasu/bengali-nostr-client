import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { nip19 } from "nostr-tools";

const STORAGE_KEY = "balaka_account";

export function generateNewAccount() {
  const secretKey = generateSecretKey();
  const publicKey = getPublicKey(secretKey);
  const nsec = nip19.nsecEncode(secretKey);
  const npub = nip19.npubEncode(publicKey);
  return { nsec, npub, publicKey, secretKey };
}

export function importFromNsec(nsecInput) {
  try {
    const { type, data } = nip19.decode(nsecInput.trim());
    if (type !== "nsec") throw new Error("Not an nsec");
    const publicKey = getPublicKey(data);
    const npub = nip19.npubEncode(publicKey);
    return { nsec: nsecInput.trim(), npub, publicKey, secretKey: data };
  } catch (e) {
    throw new Error("অবৈধ nsec");
  }
}

export function importFromNpub(npubInput) {
  try {
    const { type, data } = nip19.decode(npubInput.trim());
    if (type !== "npub") throw new Error("Not an npub");
    return { npub: npubInput.trim(), publicKey: data, secretKey: null };
  } catch (e) {
    throw new Error("অবৈধ npub");
  }
}

export function saveAccount(account) {
  // We only save the nsec if it exists (view-only mode won't have one)
  const toStore = {
    nsec: account.nsec || null,
    npub: account.npub,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
}

export function loadStoredAccount() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    if (parsed.nsec) {
      return importFromNsec(parsed.nsec);
    } else if (parsed.npub) {
      return importFromNpub(parsed.npub);
    }
  } catch (e) {
    return null;
  }
}

export function clearAccount() {
  localStorage.removeItem(STORAGE_KEY);
}