/**
 * Brand mark — "Site-Safe Badge" concept.
 * Hi-vis yellow caution-tape ring around a black disc, with a soundwave +
 * ²Q monogram inside, plus a pulsing record dot. Reads as
 * "voice in → quote out".
 *
 * Ported from the Emergent landing-export bundle. Pure inline SVG —
 * no fonts loaded server-side, safe to render on the server.
 *
 * The pulsing dot uses `<animate>` rather than CSS so it works inside
 * `<img src="...svg">` contexts too if we ever inline-export this. The
 * `data-` attributes are kept stable so existing test selectors keep
 * matching the wrapper.
 */
type LogoMarkProps = {
  size?: number;
  animated?: boolean;
  className?: string;
  title?: string;
};

export function LogoMark({
  size = 36,
  animated = true,
  className = "",
  title = "tradies2Quote",
}: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id={`t2q-caution-${size}`}
          patternUnits="userSpaceOnUse"
          width="6"
          height="6"
          patternTransform="rotate(45)"
        >
          <rect width="6" height="6" fill="#FFEA00" />
          <rect width="3" height="6" fill="#0A0A0A" />
        </pattern>
        <mask id={`t2q-mask-${size}`}>
          <rect width="64" height="64" fill="black" />
          <circle cx="32" cy="32" r="29" fill="white" />
          <circle cx="32" cy="32" r="22" fill="black" />
        </mask>
      </defs>
      <circle cx="32" cy="32" r="31" fill="#0A0A0A" />
      <circle cx="32" cy="32" r="31" fill="none" stroke="#FFEA00" strokeWidth="2" />
      <rect
        width="64"
        height="64"
        fill={`url(#t2q-caution-${size})`}
        mask={`url(#t2q-mask-${size})`}
      />
      <circle cx="32" cy="32" r="22" fill="#0A0A0A" />
      <circle cx="32" cy="32" r="22" fill="none" stroke="#FF5F15" strokeWidth="1.5" />
      {/* Soundwave bars */}
      <g fill="#FFEA00">
        <rect x="13" y="29" width="2" height="6" rx="1" />
        <rect x="17" y="26" width="2" height="12" rx="1" />
        <rect x="21" y="22" width="2" height="20" rx="1" />
      </g>
      {/* ²Q monogram */}
      <text
        x="29"
        y="40"
        fontFamily="'Archivo Black','Archivo',system-ui,sans-serif"
        fontSize="20"
        fontWeight="900"
        fill="#FFFFFF"
        letterSpacing="-1"
      >
        ²Q
      </text>
      {/* Pulsing record dot */}
      <circle cx="48" cy="22" r="2" fill="#FF5F15">
        {animated && (
          <animate
            attributeName="opacity"
            values="1;0.3;1"
            dur="1.6s"
            repeatCount="indefinite"
          />
        )}
      </circle>
    </svg>
  );
}

type LogoProps = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

export function Logo({ size = 36, withWordmark = true, className = "" }: LogoProps) {
  return (
    <span
      data-testid="brand-logo"
      className={`inline-flex items-center gap-3 ${className}`}
    >
      <LogoMark size={size} />
      {withWordmark && (
        <span className="font-display uppercase tracking-tight leading-none whitespace-nowrap">
          tradies<span className="text-brand">²</span>Quote
        </span>
      )}
    </span>
  );
}
