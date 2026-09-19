import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { nip19 } from "nostr-tools";
import { loadStoredAccount, saveAccount, clearAccount } from "../lib/account";
import { fetchContactList, publishContactListWithSigner } from "../lib/nostr";
import {
  LocalSigner,
  Nip07Signer,
  reconnectBunker,
} from "../lib/signers";

export const AccountContext = createContext(null);

// Wait up to `timeoutMs` for window.nostr to appear.
// Extensions inject it asynchronously — checking once is unreliable.
async function waitForNip07(timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (typeof window !== "undefined" && window.nostr) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

export function AccountProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [following, setFollowing] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [bunkerAuthUrl, setBunkerAuthUrl] = useState(null);

  // ---------- Restore session on mount ----------
  useEffect(() => {
    (async () => {
      const stored = loadStoredAccount();
      if (!stored) {
        setLoading(false);
        return;
      }

      console.log("Restoring session type:", stored.loginType || "legacy-npub");

      try {
        let signer = null;
        let pubkey = null;

        // --- NIP-07 extension (also handles legacy npub-only format) ---
        if (stored.loginType === "nip07" || (!stored.loginType && stored.npub)) {
          console.log("Waiting for extension...");

          // Poll up to 30 seconds. Extensions inject late on busy tabs.
          let available = false;
          for (let i = 0; i < 15; i++) {
            available = await waitForNip07(2000);
            if (available) {
              console.log(`Extension found after ${(i + 1) * 2}s`);
              break;
            }
            console.log(`Waiting for extension (attempt ${i + 1}/15)`);
          }

          if (!available) {
            console.warn("Extension never appeared — keeping stored account");
            setLoading(false);
            return;
          }

          signer = new Nip07Signer();
          pubkey = await signer.getPublicKey();

          // If the stored npub is stale (legacy entry, or user switched
          // extension accounts), update the stored account to match the
          // extension. The extension holds the real key — trust it.
          const actualNpub = nip19.npubEncode(pubkey);
          if (stored.npub && actualNpub !== stored.npub) {
            console.warn("Stored npub mismatch — adopting extension pubkey");
            saveAccount({ npub: actualNpub, loginType: "nip07" });
          }
        }
        // --- View-only (npub) ---
        else if (stored.loginType === "viewonly") {
          const { data } = nip19.decode(stored.npub);
          pubkey = data;
          signer = null;
        }
        // --- NIP-46 bunker ---
        else if (stored.loginType === "nip46") {
          signer = await reconnectBunker(
            stored.bunkerUri,
            stored.clientSecretHex,
            (url) => setBunkerAuthUrl(url)
          );
          pubkey = await signer.getPublicKey();
        }
        // --- Local nsec ---
        else if (stored.nsec) {
          const { data: secretKey } = nip19.decode(stored.nsec);
          signer = new LocalSigner(secretKey);
          pubkey = signer.publicKey;
        }
        // --- Nothing we can use ---
        else {
          console.warn("Stored account has no usable credentials");
          clearAccount();
          setLoading(false);
          return;
        }

        if (pubkey) {
          setAccount({
            signer,
            publicKey: pubkey,
            npub: nip19.npubEncode(pubkey),
            loginType: stored.loginType || "nip07",
            nsec: stored.nsec || null,
          });
          fetchContactList(pubkey).then((list) =>
            setFollowing(new Set(list))
          );
        }
      } catch (err) {
        console.error("Session restore failed:", err);
        // Don't clear — user can re-login manually
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---------- Login ----------
  const login = useCallback(async (newAccount) => {
    // newAccount: { signer, publicKey, npub, loginType, nsec?, bunkerUri? }
    setAccount(newAccount);

    // Persist only what's needed to reconnect on next reload
    if (newAccount.loginType === "local" && newAccount.nsec) {
      saveAccount({
        nsec: newAccount.nsec,
        npub: newAccount.npub,
        loginType: "local",
      });
    } else if (newAccount.loginType === "nip07") {
      saveAccount({ npub: newAccount.npub, loginType: "nip07" });
    } else if (newAccount.loginType === "nip46") {
      const clientSecretHex = Array.from(newAccount.signer.clientSecretKey)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      saveAccount({
        npub: newAccount.npub,
        loginType: "nip46",
        bunkerUri: newAccount.signer.bunkerUri,
        clientSecretHex,
      });
    } else if (newAccount.loginType === "viewonly") {
      saveAccount({ npub: newAccount.npub, loginType: "viewonly" });
    }

    if (newAccount.publicKey) {
      fetchContactList(newAccount.publicKey).then((list) =>
        setFollowing(new Set(list))
      );
    }
  }, []);

  // ---------- Logout ----------
  const logout = useCallback(async () => {
    if (account?.signer) {
      try {
        await account.signer.close();
      } catch {}
    }
    clearAccount();
    setAccount(null);
    setFollowing(new Set());
    setBunkerAuthUrl(null);
  }, [account]);

  // ---------- Follow ----------
  const follow = useCallback(
    async (pubkey) => {
      if (!account?.signer) return;
      if (following.has(pubkey)) return;

      const next = new Set(following);
      next.add(pubkey);
      setFollowing(next);

      try {
        await publishContactListWithSigner([...next], account.signer);
      } catch (err) {
        console.error("Failed to follow:", err);
        setFollowing(new Set(following));
      }
    },
    [account, following]
  );

  // ---------- Unfollow ----------
  const unfollow = useCallback(
    async (pubkey) => {
      if (!account?.signer) return;
      if (!following.has(pubkey)) return;

      const next = new Set(following);
      next.delete(pubkey);
      setFollowing(next);

      try {
        await publishContactListWithSigner([...next], account.signer);
      } catch (err) {
        console.error("Failed to unfollow:", err);
        setFollowing(new Set(following));
      }
    },
    [account, following]
  );

  return (
    <AccountContext.Provider
      value={{
        account,
        login,
        logout,
        loading,
        following,
        follow,
        unfollow,
        bunkerAuthUrl,
        clearBunkerAuth: () => setBunkerAuthUrl(null),
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  return useContext(AccountContext);
}