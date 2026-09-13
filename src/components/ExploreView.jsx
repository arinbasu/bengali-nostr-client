import { useEffect, useState } from "react";
import { nip19 } from "nostr-tools";
import { fetchRecentNotes } from "../lib/nostr";
import { useProfile, getDisplayName } from "../contexts/useProfile";
import { useAccount } from "../contexts/useAccount";
import { NoteCard } from "./NoteCard";

const CACHE_KEY = "balaka_explore_cache_v3";
const CACHE_MAX_AGE_MS = 30 * 60 * 1000;

function countMatches(text, regex) {
  return (text.match(regex) || []).length;
}

function isAllowedScript(text) {
  const bengali = countMatches(text, /[\u0980-\u09FF]/g);
  const latin = countMatches(text, /[a-zA-Z\u00C0-\u024F]/g);
  const cjk = countMatches(text, /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/g);
  const cyrillic = countMatches(text, /[\u0400-\u04FF]/g);
  const arabic = countMatches(text, /[\u0600-\u06FF]/g);
  const devanagari = countMatches(text, /[\u0900-\u097F]/g);

  const allowed = bengali + latin;
  const disallowed = cjk + cyrillic + arabic + devanagari;
  if (allowed === 0) return false;
  return disallowed / (allowed + disallowed) <= 0.15;
}

function hasBengali(text) {
  return /[\u0980-\u09FF]/.test(text);
}

function extractHashtags(event) {
  const tags = new Set();
  const content = event.content || "";

  const contentTags = content.match(/#[\u0980-\u09FF\w]+/g) || [];
  contentTags.forEach((t) => tags.add(t.slice(1).toLowerCase()));

  event.tags
    .filter((t) => t[0] === "t" && t[1])
    .forEach((t) => tags.add(t[1].toLowerCase()));

  return [...tags];
}

function isMeaningfulTag(tag) {
  if (!tag) return false;
  if (tag.length < 2) return false;
  if (tag.length > 30) return false;
  if (/^[0-9a-f]{16,}$/i.test(tag)) return false;
  if (/^\d+$/.test(tag)) return false;
  return true;
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(data) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        trendingTags: data.trendingTags,
        suggestedAccounts: data.suggestedAccounts,
        popularNotes: data.popularNotes,
      })
    );
  } catch {}
}

export function ExploreView({ onSearchRequest }) {
  const { profiles, ensureProfiles } = useProfile();
  const { account, following, follow } = useAccount();
  const [trendingTags, setTrendingTags] = useState([]);
  const [suggestedAccounts, setSuggestedAccounts] = useState([]);
  const [popularNotes, setPopularNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [debugInfo, setDebugInfo] = useState("");

  const computeExplore = async () => {
    const events = await fetchRecentNotes(300);
    console.log(`Explore: fetched ${events.length} notes`);

    const clean = events.filter((e) => {
      const c = (e.content || "").trim();
      if (!c || c.length < 8) return false;
      if (c.startsWith("{") && c.endsWith("}")) return false;
      return isAllowedScript(c);
    });

    const bengaliNotes = clean.filter((e) => hasBengali(e.content || ""));
    console.log(`Explore: ${clean.length} clean, ${bengaliNotes.length} with Bengali`);

    // Trending hashtags
    const tagCounts = new Map();
    clean.forEach((e) => {
      extractHashtags(e).forEach((tag) => {
        if (!isMeaningfulTag(tag)) return;
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    const topTags = [...tagCounts.entries()]
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Suggested accounts
    const authorStats = new Map();
    clean.forEach((e) => {
      const prev = authorStats.get(e.pubkey) || { total: 0, bengali: 0, latest: 0 };
      prev.total += 1;
      if (hasBengali(e.content || "")) prev.bengali += 1;
      prev.latest = Math.max(prev.latest, e.created_at);
      authorStats.set(e.pubkey, prev);
    });

    const suggestions = [...authorStats.entries()]
      .filter(([pubkey, stats]) => {
        if (stats.bengali === 0) return false;
        if (following?.has(pubkey)) return false;
        if (pubkey === account?.publicKey) return false;
        return true;
      })
      .sort((a, b) => {
        if (b[1].bengali !== a[1].bengali) return b[1].bengali - a[1].bengali;
        return b[1].latest - a[1].latest;
      })
      .slice(0, 8)
      .map(([pubkey]) => pubkey);

    // Recent Bengali posts (excluding own)
    const popular = clean
      .filter((e) => {
        if (!hasBengali(e.content || "")) return false;
        if (account?.publicKey && e.pubkey === account.publicKey) return false;
        return true;
      })
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 10);

    return {
      trendingTags: topTags,
      suggestedAccounts: suggestions,
      popularNotes: popular,
      debug: `${events.length} fetched, ${clean.length} clean, ${bengaliNotes.length} Bengali`,
    };
  };

  // Load cached data as initial state, then ALWAYS fetch fresh
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Show cached data immediately (if any)
      const cached = loadCache();
      if (cached) {
        setTrendingTags(cached.trendingTags || []);
        setSuggestedAccounts(cached.suggestedAccounts || []);
        setPopularNotes(cached.popularNotes || []);
        setLoading(false);
      }

      // Always fetch fresh
      setLoading(true);
      try {
        const data = await computeExplore();
        if (cancelled) return;

        setTrendingTags(data.trendingTags);
        setSuggestedAccounts(data.suggestedAccounts);
        setPopularNotes(data.popularNotes);
        setDebugInfo(data.debug);
        ensureProfiles(data.suggestedAccounts);

        // Only save to cache if we actually got results
        const hasData =
          data.trendingTags.length > 0 ||
          data.suggestedAccounts.length > 0 ||
          data.popularNotes.length > 0;

        if (hasData) {
          saveCache(data);
        } else {
          console.warn("Explore: no data to cache");
        }
      } catch (err) {
        console.error("Explore fetch failed:", err);
        if (!cancelled) setDebugInfo("fetch failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [account?.publicKey]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await computeExplore();
      setTrendingTags(data.trendingTags);
      setSuggestedAccounts(data.suggestedAccounts);
      setPopularNotes(data.popularNotes);
      setDebugInfo(data.debug);
      ensureProfiles(data.suggestedAccounts);
      saveCache(data);
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTagClick = (tag) => {
    if (onSearchRequest) onSearchRequest(`#${tag}`);
  };

  // If everything is empty, show a diagnostic
  const isAllEmpty =
    trendingTags.length === 0 &&
    suggestedAccounts.length === 0 &&
    popularNotes.length === 0;

  return (
    <div>
      <div className="flex justify-between items-center px-4 pt-3">
        <span className="text-[10px] text-gray-400">{debugInfo}</span>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-xs text-gray-500 hover:text-blue-600 disabled:opacity-50"
        >
          {refreshing ? "রিফ্রেশ হচ্ছে..." : "🔄 রিফ্রেশ"}
        </button>
      </div>

      {loading && isAllEmpty && (
        <div className="p-8 text-center text-gray-400">লোড হচ্ছে...</div>
      )}

      {!loading && isAllEmpty && (
        <div className="p-8 text-center text-gray-500 text-sm">
          <p className="mb-3">সাম্প্রতিক পোস্টে বাংলা কনটেন্ট পাওয়া যায়নি।</p>
          <p className="text-xs text-gray-400">
            আরও বাংলা পোস্ট তৈরি হলে এখানে দেখা যাবে।
          </p>
        </div>
      )}

      {trendingTags.length > 0 && (
        <section className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            ট্রেন্ডিং হ্যাশট্যাগ
          </h3>
          <div className="flex flex-wrap gap-2">
            {trendingTags.map(([tag, count]) => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm rounded-full transition"
              >
                #{tag}
                <span className="ml-1 text-xs text-blue-400">{count}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {suggestedAccounts.length > 0 && (
        <section className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            বাংলায় লেখেন যারা
          </h3>
          <div className="space-y-3">
            {suggestedAccounts.map((pubkey) => {
              const profile = profiles.get(pubkey);
              const npub = nip19.npubEncode(pubkey);
              const shortNpub = `${npub.slice(0, 10)}...${npub.slice(-4)}`;
              const name = getDisplayName(profile, shortNpub);

              return (
                <div key={pubkey} className="flex items-center gap-3">
                  {profile?.picture ? (
                    <img
                      src={profile.picture}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <a
                      href={`https://njump.me/${npub}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm font-medium hover:underline truncate block ${
                        profile ? "text-gray-900" : "text-gray-500"
                      }`}
                    >
                      {name}
                    </a>
                    {profile?.about && (
                      <p className="text-xs text-gray-500 truncate">
                        {profile.about}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => follow(pubkey)}
                    className="text-xs px-3 py-1 rounded-full border border-blue-500 text-blue-600 hover:bg-blue-50 flex-shrink-0"
                  >
                    অনুসরণ
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {popularNotes.length > 0 && (
        <section>
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
            বাংলা পোস্ট
          </div>
          {popularNotes.map((event) => (
            <NoteCard key={event.id} event={event} />
          ))}
        </section>
      )}
    </div>
  );
}