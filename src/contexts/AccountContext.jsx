import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { loadStoredAccount, saveAccount, clearAccount } from "../lib/account";
import { fetchContactList, publishContactList } from "../lib/nostr";

export const AccountContext = createContext(null);

export function AccountProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [following, setFollowing] = useState(new Set());
  const [loading, setLoading] = useState(true);

  // Load account and contact list on first render
  useEffect(() => {
    const stored = loadStoredAccount();
    if (stored) {
      setAccount(stored);
      if (stored.publicKey) {
        fetchContactList(stored.publicKey).then((list) => {
          setFollowing(new Set(list));
        });
      }
    }
    setLoading(false);
  }, []);

  const login = (newAccount) => {
    saveAccount(newAccount);
    setAccount(newAccount);
    if (newAccount.publicKey) {
      fetchContactList(newAccount.publicKey).then((list) => {
        setFollowing(new Set(list));
      });
    }
  };

  const logout = () => {
    clearAccount();
    setAccount(null);
    setFollowing(new Set());
  };

  const follow = useCallback(
    async (pubkey) => {
      if (!account?.secretKey) return;
      if (following.has(pubkey)) return;

      const next = new Set(following);
      next.add(pubkey);
      setFollowing(next);

      try {
        await publishContactList([...next], account.secretKey);
      } catch (err) {
        console.error("Failed to follow:", err);
        // Rollback on failure
        setFollowing(new Set(following));
      }
    },
    [account, following]
  );

  const unfollow = useCallback(
    async (pubkey) => {
      if (!account?.secretKey) return;
      if (!following.has(pubkey)) return;

      const next = new Set(following);
      next.delete(pubkey);
      setFollowing(next);

      try {
        await publishContactList([...next], account.secretKey);
      } catch (err) {
        console.error("Failed to unfollow:", err);
        setFollowing(new Set(following));
      }
    },
    [account, following]
  );

  return (
    <AccountContext.Provider
      value={{ account, login, logout, loading, following, follow, unfollow }}
    >
      {children}
    </AccountContext.Provider>
  );
}

