export default function Logo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="anicity-brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8A7BFF" />
          <stop offset="100%" stopColor="#6C5CE7" />
        </linearGradient>
        <linearGradient id="anicity-spark-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00CEC9" />
          <stop offset="100%" stopColor="#00B894" />
        </linearGradient>
        <filter id="anicity-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#6C5CE7" floodOpacity="0.5" />
        </filter>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#anicity-brand-grad)" filter="url(#anicity-glow)" />
      {/* Modern Anime Play Triangle & A Insignia */}
      <path
        d="M19 14L33 24L19 34V14Z"
        fill="#FFFFFF"
      />
      <circle cx="35" cy="13" r="3.5" fill="url(#anicity-spark-grad)" />
    </svg>
  );
}
