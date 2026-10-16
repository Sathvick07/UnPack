import React from 'react';

interface UnpackLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
  onClick?: () => void;
}

export const UnpackLogo: React.FC<UnpackLogoProps> = ({
  size = 'md',
  showTagline = true,
  className = '',
  onClick,
}) => {
  // Dimensions based on size
  const iconSize = size === 'sm' ? 30 : size === 'md' ? 38 : size === 'lg' ? 48 : 64;
  const wordmarkSize = size === 'sm' ? '1.15rem' : size === 'md' ? '1.45rem' : size === 'lg' ? '1.85rem' : '2.35rem';
  const taglineSize = size === 'sm' ? '0.62rem' : size === 'md' ? '0.72rem' : size === 'lg' ? '0.85rem' : '1rem';

  return (
    <div
      className={`unpack-brand-logo ${onClick ? 'clickable' : ''} ${className}`}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'sm' ? '0.6rem' : size === 'md' ? '0.75rem' : '0.95rem',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      {/* Official UnPack Stylized U with Barcode Lines & Green Scanning Corners */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="unpack-logo-mark"
        aria-label="UnPack Logo Mark"
        style={{ flexShrink: 0 }}
      >
        {/* Soft rounded subtle background */}
        <rect width="48" height="48" rx="10" className="logo-icon-bg" fill="var(--bg-secondary)" />

        {/* Green Scanning Corners (┌ ┐ └ ┘) */}
        <path
          d="M6 15V8C6 6.89543 6.89543 6 8 6H15"
          stroke="var(--color-lime)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M33 6H40C41.1046 6 42 6.89543 42 8V15"
          stroke="var(--color-lime)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M6 33V40C6 41.1046 6.89543 42 8 42H15"
          stroke="var(--color-lime)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M33 42H40C41.1046 42 42 41.1046 42 40V33"
          stroke="var(--color-lime)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Stylized U Base Frame with Forest Green & Lime Highlights */}
        {/* Left upright bar */}
        <rect x="13" y="14" width="3.5" height="15" rx="1.75" fill="var(--brand-primary)" />
        {/* Inner barcode stripe 1 */}
        <rect x="18.5" y="15" width="2" height="13" rx="1" fill="var(--brand-primary)" opacity="0.9" />
        {/* Inner barcode stripe 2 (slender) */}
        <rect x="22" y="15" width="1.2" height="13" rx="0.6" fill="var(--brand-primary)" opacity="0.8" />
        {/* Inner barcode stripe 3 (accent highlight) */}
        <rect x="24.8" y="15" width="2.2" height="13" rx="1" fill="var(--color-lime)" />
        {/* Inner barcode stripe 4 */}
        <rect x="28.5" y="15" width="1.5" height="13" rx="0.75" fill="var(--brand-primary)" opacity="0.85" />
        {/* Right upright bar */}
        <rect x="31.5" y="14" width="3.5" height="15" rx="1.75" fill="var(--brand-primary)" />

        {/* Connecting U Bottom curve anchor */}
        <path
          d="M13 26C13 32.5 18 36.5 24 36.5C30 36.5 35 32.5 35 26"
          stroke="var(--brand-primary)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />

        {/* Subtle laser scan line effect through the barcode */}
        <line
          x1="10"
          y1="23"
          x2="38"
          y2="23"
          stroke="var(--color-lime)"
          strokeWidth="1.2"
          strokeDasharray="2 2"
          opacity="0.85"
        />
      </svg>

      {/* Brand Typography */}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <div
          className="unpack-logo-wordmark"
          style={{
            fontSize: wordmarkSize,
            fontWeight: 800,
            letterSpacing: '-0.035em',
            color: 'var(--text-primary)',
            fontFamily: "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            display: 'flex',
            alignItems: 'baseline',
          }}
        >
          <span>Un</span>
          <span style={{ color: 'var(--brand-primary)', fontWeight: 800 }}>Pack</span>
        </div>

        {showTagline && (
          <span
            className="unpack-logo-tagline"
            style={{
              fontSize: taglineSize,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'none',
              color: 'var(--text-secondary)',
              marginTop: '0.12rem',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            Know What's Inside.
          </span>
        )}
      </div>
    </div>
  );
};
