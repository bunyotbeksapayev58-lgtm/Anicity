export default function Logo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="anicity-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff4d6d" />
          <stop offset="1" stopColor="#7c5cff" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#anicity-g)" />
      <path d="M25 20l18 12-18 12z" fill="#fff" />
    </svg>
  );
}
