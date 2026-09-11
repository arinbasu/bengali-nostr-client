import { createContext, useState, useCallback } from "react";
import { fetchProfiles } from "../lib/nostr";

export const ProfileContext = createContext(null);

const CACHE_KEY = "balaka_profiles";

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw)));
  } catch {
    return new Map();
  }
}

function saveCache(map) {
  try {
    const obj = {};
    for (const [k, v] of map) obj[k] = v;
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {}
}

export function ProfileProvider({ children }) {
  const [profiles, setProfiles] = useState(loadCache);

  const ensureProfiles = useCallback(
    async (pubkeys) => {
      const unique = [...new Set(pubkeys)].filter((pk) => pk);
      const missing = unique.filter((pk) => !profiles.has(pk));
      if (missing.length === 0) return;

      const fetched = await fetchProfiles(missing);
      if (fetched.size > 0) {
        setProfiles((prev) => {
          const next = new Map(prev);
          for (const [k, v] of fetched) next.set(k, v);
          saveCache(next);
          return next;
        });
      }
    },
    [profiles]
  );

  return (
    <ProfileContext.Provider value={{ profiles, ensureProfiles }}>
      {children}
    </ProfileContext.Provider>
  );
}