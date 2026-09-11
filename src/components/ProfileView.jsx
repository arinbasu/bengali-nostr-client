import { useAccount } from "../contexts/useAccount";

export function ProfileView() {
  const { account, logout } = useAccount();

  const shortNpub = account?.npub
    ? `${account.npub.slice(0, 12)}...${account.npub.slice(-6)}`
    : "";

  const handleCopyNpub = () => {
    navigator.clipboard.writeText(account.npub);
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500" />
        <div>
          <h2 className="text-lg font-bold text-text">আপনার প্রোফাইল</h2>
          <p className="text-sm text-muted font-mono">{shortNpub}</p>
        </div>
      </div>

      <button
        onClick={handleCopyNpub}
        className="w-full mb-3 py-2 rounded-lg border border-border text-text text-sm hover:bg-surface"
      >
        npub কপি করুন
      </button>

      <button
        onClick={logout}
        className="w-full py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600"
      >
        লগ আউট
      </button>
    </div>
  );
}