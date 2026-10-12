import { BANNER_LABELS, textOn, TeamBanner } from "@/lib/banner-types";
import { smallImageUrl } from "@/lib/blob-url";

// One hanging pennant, drawn as SVG so it stays sharp at any size. Colours come
// from the team's banner colours; the logo is the team's uploaded logo.
export default function TeamBannerPennant({ banner }: { banner: TeamBanner }) {
  const { kind, season, teamName, logoUrl, primary, trim } = banner;
  const text = textOn(primary, banner.text);
  const initials = teamName
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const label = BANNER_LABELS[kind];
  const font = { fontFamily: "var(--font-display), sans-serif" } as const;

  return (
    <svg viewBox="0 0 160 266" role="img" aria-label={`${teamName}, ${label} ${season}`} className="w-full h-auto drop-shadow-[0_6px_8px_rgba(0,0,0,0.55)]">
      <title>{`${teamName} — ${label} ${season}`}</title>

      {/* rod and finials */}
      <rect x="2" y="1" width="156" height="7" rx="3.5" fill="#C9A24A" />
      <circle cx="4" cy="4.5" r="4.5" fill="#E2BE63" />
      <circle cx="156" cy="4.5" r="4.5" fill="#E2BE63" />

      {/* fabric, with a pointed bottom */}
      <path d="M10 8 H150 V228 L80 258 L10 228 Z" fill={primary} />
      <path d="M17 15 H143 V223 L80 249 L17 223 Z" fill="none" stroke={trim} strokeWidth="3" strokeLinejoin="round" />

      {/* logo, or the team's initials until a logo is uploaded */}
      {logoUrl ? (
        <image href={smallImageUrl(logoUrl, 256)} x="32" y="26" width="96" height="84" preserveAspectRatio="xMidYMid meet" />
      ) : (
        <g>
          <circle cx="80" cy="68" r="34" fill="none" stroke={trim} strokeWidth="3" />
          <text x="80" y="80" textAnchor="middle" fontSize="32" fontWeight="700" fill={text} style={font}>
            {initials}
          </text>
        </g>
      )}

      {kind === "champion" ? (
        <text x="80" y="148" textAnchor="middle" fontSize="19" fontWeight="700" letterSpacing="1" fill={text} style={font}>
          CHAMPIONS
        </text>
      ) : kind === "runnerUp" ? (
        <text x="80" y="148" textAnchor="middle" fontSize="17" fontWeight="700" letterSpacing="1" fill={text} style={font}>
          RUNNER-UP
        </text>
      ) : (
        <>
          <text x="80" y="138" textAnchor="middle" fontSize="12" fontWeight="700" letterSpacing="1" fill={text} style={font}>
            REGULAR SEASON
          </text>
          <text x="80" y="155" textAnchor="middle" fontSize="12" fontWeight="700" letterSpacing="1" fill={text} style={font}>
            CHAMPIONS
          </text>
        </>
      )}

      <line x1="48" y1="168" x2="112" y2="168" stroke={trim} strokeWidth="1.5" />
      <text x="80" y="205" textAnchor="middle" fontSize="30" fontWeight="700" letterSpacing="1" fill={text} style={font}>
        {season}
      </text>
    </svg>
  );
}
