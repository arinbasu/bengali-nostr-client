import { createContext, useState, useCallback, useRef } from "react";
import { fetchProfiles } from "../lib/nostr";

export const ProfileContext = createContext(null);

const CACHE_KEY = "balaka_profiles_v3";
const MY_PROFILE_KEY = "balaka_my_profile_v1";

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

function loadMyProfile() {
  try {
    const raw = localStorage.getItem(MY_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveMyProfile(pubkey, metadata) {
  try {
    localStorage.setItem(
      MY_PROFILE_KEY,
      JSON.stringify({ pubkey, ...metadata })
    );
  } catch {}
}

export function ProfileProvider({ children }) {
  const [profiles, setProfiles] = useState(() => {
    const cache = loadCache();
    const my = loadMyProfile();
    if (my && my.pubkey) {
      const { pubkey, ...metadata } = my;
      cache.set(pubkey, metadata);
    }
    return cache;
  });

  // Track in-flight fetches so we don't duplicate work
  const inflightRef = useRef(new Set());

  // Fetch missing profiles. Always fetches if any are missing.
  const ensureProfiles = useCallback(async (pubkeys) => {
    const unique = [...new Set(pubkeys)].filter((pk) => pk);
    const missing = unique.filter((pk) => !inflightRef.current.has(pk));
    if (missing.length === 0) return;

    missing.forEach((pk) => inflightRef.current.add(pk));

    try {
      const fetched = await fetchProfiles(missing);
      if (fetched.size === 0) return;

      setProfiles((prev) => {
        const next = new Map(prev);
        for (const [k, v] of fetched) next.set(k, v);
        saveCache(next);
        return next;
      });
    } finally {
      missing.forEach((pk) => inflightRef.current.delete(pk));
    }
  }, []);

  // Force-refresh a specific profile from relays, bypassing cache entirely.
  // Use this for the current user's own profile.
  const forceRefreshProfile = useCallback(async (pubkey) => {
    if (!pubkey) return null;
    try {
      const fetched = await fetchProfiles([pubkey]);
      const fresh = fetched.get(pubkey);
      if (fresh) {
        setProfiles((prev) => {
          const next = new Map(prev);
          next.set(pubkey, fresh);
          saveCache(next);
          saveMyProfile(pubkey, fresh);
          return next;
        });
        return fresh;
      }
    } catch (err) {
      console.warn("forceRefreshProfile failed:", err);
    }
    return null;
  }, []);

  // Called by ProfileSetupPage / EditProfileModal after publishing
  const updateProfileCache = useCallback((pubkey, metadata) => {
    if (!pubkey || !metadata) return;
    setProfiles((prev) => {
      const next = new Map(prev);
      next.set(pubkey, metadata);
      saveCache(next);
      saveMyProfile(pubkey, metadata);
      return next;
    });
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        ensureProfiles,
        forceRefreshProfile,
        updateProfileCache,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}