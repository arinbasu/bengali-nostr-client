import { useContext } from "react";
import { ProfileContext } from "./ProfileContext";

export function useProfile() {
  return useContext(ProfileContext);
}

// Helper: get the best display name for a profile
export function getDisplayName(profile, fallbackNpub) {
  if (!profile) return fallbackNpub;
  return profile.display_name || profile.name || fallbackNpub;
}