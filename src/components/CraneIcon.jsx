export function CraneIcon({ className = "w-6 h-6" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label="সারস"
    >
      <path d="M 19.5 5.5 L 22.5 5" />
      <circle cx="18" cy="6" r="1.5" fill="#C1272D" stroke="none" />
      <path d="M 17 7 Q 15 10 13.5 13 Q 12.5 15 12 16" />
      <path d="M 12 16 Q 8 17 5.5 16 Q 3 14.5 3.5 12 Q 4 9.5 8 9.5 Q 12 9.5 12.5 12 Q 12.5 14 12 16 Z" />
      <path d="M 3.5 12.5 Q 1.5 12 1 13.5" />
      <path d="M 7 16.5 L 6.5 22" />
      <path d="M 9.5 16.5 L 10 22" />
    </svg>
  );
}