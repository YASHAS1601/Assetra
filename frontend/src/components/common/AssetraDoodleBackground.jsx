import React from 'react';

/**
 * AssetraDoodleBackground
 * A unified, WhatsApp-inspired hand-drawn doodle wallpaper designed specifically
 * for Assetra's real-world asset (RWA) tokenization platform.
 *
 * Featured hand-drawn illustration library:
 * - Real estate & buildings: Skyscrapers, residential houses, office towers, warehouses,
 *   suburban duplexes, modern villas, apartment blocks, windows, and structural cranes.
 * - Architecture & ownership: Floor plan blueprints, land survey plots (parcels), property
 *   keys, Roman archways, Greek institutional columns, bank vault doors, location pins.
 * - Documentation & legal: Title deeds with wax seals, signed contracts with quills,
 *   audited ledger folders, verification stamps, and hanging deed seals.
 * - Finance & blockchain: Connected node blocks, RWA token coins, token stacks,
 *   smart contract code brackets, verification shields, and portfolio growth charts.
 *
 * Dual-theme support:
 * - 'light' (default): Subtle charcoal (#20211F) & stone grey (#77766F) with muted copper (#B8734E).
 * - 'dark': Muted warm white (#F2EEE7) & soft graphite (#9E9D95) with warm copper (#B8734E).
 */
export const AssetraDoodleBackground = ({
  theme = 'light',
  opacity,
  className = '',
  style = {},
  patternId
}) => {
  const isDark = theme === 'dark';

  // Opacity defaults: refined low-contrast watermark (3.5% on light surfaces, 4.5% on dark surfaces)
  const resolvedOpacity = opacity !== undefined ? opacity : (isDark ? 0.045 : 0.035);

  // Palette adaptation for light vs dark surfaces
  const colors = isDark
    ? {
        primary: '#F8FAFC',    // Cool soft white
        secondary: '#94A3B8',  // Soft slate
        accent: '#D68A60',     // Copper highlight
        subtle: '#334155'      // Subtle dots
      }
    : {
        primary: '#101B2D',    // Deep midnight navy
        secondary: '#64748B',  // Muted slate blue
        accent: '#B9653A',     // Brand copper
        subtle: '#CBD5E1'      // Low contrast markers
      };

  const finalPatternId = patternId || (isDark ? 'assetra-doodle-dark' : 'assetra-doodle-light');

  return (
    <div
      className={`assetra-doodle-background ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        userSelect: 'none',
        overflow: 'hidden',
        zIndex: 0,
        ...style
      }}
      aria-hidden="true"
    >
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          opacity: resolvedOpacity
        }}
      >
        <defs>
          <pattern
            id={finalPatternId}
            width="540"
            height="540"
            patternUnits="userSpaceOnUse"
          >
            {/* ========================================================
                ROW 1 (Y ~ 20 - 70)
                ======================================================== */}

            {/* 1. Skyscraper / High-Rise Office Tower */}
            <g transform="translate(35, 26) rotate(-4)">
              <line x1="16" y1="0" x2="16" y2="8" stroke={colors.primary} strokeWidth="1.1" strokeLinecap="round" />
              <circle cx="16" cy="1" r="1.3" fill={colors.primary} />
              <path d="M11 8 L21 8 L21 14 L11 14 Z" stroke={colors.primary} strokeWidth="1.1" fill="none" strokeLinejoin="round" />
              <rect x="6" y="14" width="20" height="38" rx="1" stroke={colors.primary} strokeWidth="1.2" fill="none" />
              <line x1="10" y1="20" x2="13" y2="20" stroke={colors.primary} strokeWidth="1" />
              <line x1="19" y1="20" x2="22" y2="20" stroke={colors.primary} strokeWidth="1" />
              <line x1="10" y1="26" x2="13" y2="26" stroke={colors.primary} strokeWidth="1" />
              <line x1="19" y1="26" x2="22" y2="26" stroke={colors.primary} strokeWidth="1" />
              <line x1="10" y1="32" x2="13" y2="32" stroke={colors.primary} strokeWidth="1" />
              <line x1="19" y1="32" x2="22" y2="32" stroke={colors.primary} strokeWidth="1" />
              <line x1="10" y1="38" x2="13" y2="38" stroke={colors.primary} strokeWidth="1" />
              <line x1="19" y1="38" x2="22" y2="38" stroke={colors.primary} strokeWidth="1" />
              <rect x="13" y="45" width="6" height="7" stroke={colors.primary} strokeWidth="1" fill="none" />
            </g>

            {/* 2. Property Title Deed / Certificate */}
            <g transform="translate(140, 24) rotate(8)">
              <path d="M4 2 L20 2 L26 8 L26 34 L4 34 Z" stroke={colors.accent} strokeWidth="1.2" fill="none" strokeLinejoin="round" />
              <path d="M20 2 L20 8 L26 8" stroke={colors.accent} strokeWidth="1.1" fill="none" />
              <line x1="8" y1="12" x2="18" y2="12" stroke={colors.accent} strokeWidth="1" strokeLinecap="round" />
              <line x1="8" y1="17" x2="22" y2="17" stroke={colors.accent} strokeWidth="1" strokeLinecap="round" />
              <line x1="8" y1="22" x2="20" y2="22" stroke={colors.accent} strokeWidth="1" strokeLinecap="round" />
              <circle cx="15" cy="28" r="3.5" stroke={colors.accent} strokeWidth="1" fill="none" />
              <path d="M13.5 28 L14.5 29 L16.5 27" stroke={colors.accent} strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M13 31.5 L12 35 M17 31.5 L18 35" stroke={colors.accent} strokeWidth="0.9" strokeLinecap="round" />
            </g>

            {/* 3. Vintage Physical Property Key */}
            <g transform="translate(245, 34) rotate(-22)">
              <circle cx="8" cy="8" r="6" stroke={colors.secondary} strokeWidth="1.2" fill="none" />
              <circle cx="8" cy="8" r="2.5" stroke={colors.secondary} strokeWidth="1" fill="none" />
              <line x1="14" y1="8" x2="34" y2="8" stroke={colors.secondary} strokeWidth="1.2" strokeLinecap="round" />
              <line x1="27" y1="8" x2="27" y2="13" stroke={colors.secondary} strokeWidth="1.1" strokeLinecap="round" />
              <line x1="32" y1="8" x2="32" y2="14" stroke={colors.secondary} strokeWidth="1.1" strokeLinecap="round" />
              <line x1="29" y1="11" x2="32" y2="11" stroke={colors.secondary} strokeWidth="0.9" />
            </g>

            {/* 4. Architectural Floor Plan Blueprint */}
            <g transform="translate(345, 24) rotate(6)">
              <rect x="2" y="2" width="34" height="28" stroke={colors.primary} strokeWidth="1.3" fill="none" />
              <line x1="18" y1="2" x2="18" y2="30" stroke={colors.primary} strokeWidth="1.1" />
              <line x1="18" y1="16" x2="36" y2="16" stroke={colors.primary} strokeWidth="1.1" />
              <path d="M18 10 A6 6 0 0 1 24 16" stroke={colors.primary} strokeWidth="0.9" strokeDasharray="1.5 1.5" fill="none" />
              <line x1="18" y1="10" x2="18" y2="16" stroke={colors.primary} strokeWidth="1.1" />
              <line x1="6" y1="2" x2="14" y2="2" stroke={colors.primary} strokeWidth="0.9" />
              <circle cx="8" cy="8" r="0.8" fill={colors.primary} />
            </g>

            {/* 5. Connected Blockchain Nodes & Blocks */}
            <g transform="translate(452, 28) rotate(-8)">
              {/* Block 1 */}
              <g transform="translate(0, 10)">
                <path d="M6 0 L12 3 L6 6 L0 3 Z" stroke={colors.accent} strokeWidth="1" fill="none" />
                <path d="M0 3 L0 9 L6 12 L6 6" stroke={colors.accent} strokeWidth="1" fill="none" />
                <path d="M12 3 L12 9 L6 12" stroke={colors.accent} strokeWidth="1" fill="none" />
              </g>
              <line x1="12" y1="14" x2="20" y2="7" stroke={colors.accent} strokeWidth="1" strokeDasharray="2 2" />
              {/* Block 2 */}
              <g transform="translate(18, 0)">
                <path d="M6 0 L12 3 L6 6 L0 3 Z" stroke={colors.accent} strokeWidth="1" fill="none" />
                <path d="M0 3 L0 9 L6 12 L6 6" stroke={colors.accent} strokeWidth="1" fill="none" />
                <path d="M12 3 L12 9 L6 12" stroke={colors.accent} strokeWidth="1" fill="none" />
              </g>
              <line x1="28" y1="11" x2="35" y2="17" stroke={colors.accent} strokeWidth="1" strokeDasharray="2 2" />
              {/* Block 3 */}
              <g transform="translate(32, 14)">
                <path d="M6 0 L12 3 L6 6 L0 3 Z" stroke={colors.accent} strokeWidth="1" fill="none" />
                <path d="M0 3 L0 9 L6 12 L6 6" stroke={colors.accent} strokeWidth="1" fill="none" />
                <path d="M12 3 L12 9 L6 12" stroke={colors.accent} strokeWidth="1" fill="none" />
              </g>
            </g>

            {/* ========================================================
                ROW 2 (Y ~ 110 - 165)
                ======================================================== */}

            {/* 6. Verification Shield & Checkmark */}
            <g transform="translate(75, 118) rotate(6)">
              <path d="M13 2 L24 6 C24 16 18 24 13 28 C8 24 2 16 2 6 Z" stroke={colors.accent} strokeWidth="1.2" fill="none" strokeLinejoin="round" />
              <path d="M13 5 L21 8 C21 16 16 22 13 25 C10 22 5 16 5 8 Z" stroke={colors.accent} strokeWidth="0.8" fill="none" opacity="0.6" />
              <path d="M8 14 L11.5 17.5 L18 10" stroke={colors.accent} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>

            {/* 7. Residential Suburban House */}
            <g transform="translate(185, 112) rotate(-5)">
              <path d="M2 14 L18 2 L34 14" stroke={colors.primary} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M25 8 L25 3 L28 3 L28 10" stroke={colors.primary} strokeWidth="1" fill="none" />
              <rect x="5" y="14" width="26" height="19" stroke={colors.primary} strokeWidth="1.2" fill="none" />
              <rect x="15" y="23" width="6" height="10" stroke={colors.primary} strokeWidth="1" fill="none" />
              <circle cx="19.5" cy="28" r="0.6" fill={colors.primary} />
              <rect x="8" y="18" width="5" height="5" stroke={colors.primary} strokeWidth="0.9" fill="none" />
              <line x1="10.5" y1="18" x2="10.5" y2="23" stroke={colors.primary} strokeWidth="0.8" />
              <line x1="8" y1="20.5" x2="13" y2="20.5" stroke={colors.primary} strokeWidth="0.8" />
              <rect x="23" y="18" width="5" height="5" stroke={colors.primary} strokeWidth="0.9" fill="none" />
              <line x1="25.5" y1="18" x2="25.5" y2="23" stroke={colors.primary} strokeWidth="0.8" />
            </g>

            {/* 8. RWA Token Coin with Diamond Emblem */}
            <g transform="translate(295, 122) rotate(14)">
              <circle cx="14" cy="14" r="12" stroke={colors.accent} strokeWidth="1.2" fill="none" />
              <circle cx="14" cy="14" r="9.5" stroke={colors.accent} strokeWidth="0.8" strokeDasharray="2 1.5" fill="none" />
              <path d="M14 7 L19 14 L14 21 L9 14 Z" stroke={colors.accent} strokeWidth="1.1" fill="none" />
              <line x1="11.5" y1="14" x2="16.5" y2="14" stroke={colors.accent} strokeWidth="0.9" />
            </g>

            {/* 9. Greek Institutional Columns / Portico */}
            <g transform="translate(405, 115)">
              <path d="M2 9 L17 2 L32 9 Z" stroke={colors.secondary} strokeWidth="1.2" fill="none" strokeLinejoin="round" />
              <line x1="0" y1="9" x2="34" y2="9" stroke={colors.secondary} strokeWidth="1.2" />
              <line x1="6" y1="9" x2="6" y2="27" stroke={colors.secondary} strokeWidth="1.1" />
              <line x1="9" y1="9" x2="9" y2="27" stroke={colors.secondary} strokeWidth="0.8" />
              <line x1="16" y1="9" x2="16" y2="27" stroke={colors.secondary} strokeWidth="1.1" />
              <line x1="18" y1="9" x2="18" y2="27" stroke={colors.secondary} strokeWidth="0.8" />
              <line x1="25" y1="9" x2="25" y2="27" stroke={colors.secondary} strokeWidth="1.1" />
              <line x1="28" y1="9" x2="28" y2="27" stroke={colors.secondary} strokeWidth="0.8" />
              <line x1="2" y1="27" x2="32" y2="27" stroke={colors.secondary} strokeWidth="1.2" />
              <line x1="0" y1="30" x2="34" y2="30" stroke={colors.secondary} strokeWidth="1.2" />
            </g>

            {/* 10. Location Pin with Mini House */}
            <g transform="translate(495, 125) rotate(-10)">
              <path d="M13 2 C6 2 2 7 2 13 C2 21 13 32 13 32 C13 32 24 21 24 13 C24 7 20 2 13 2 Z" stroke={colors.primary} strokeWidth="1.2" fill="none" />
              <path d="M9 14 L13 10 L17 14 L17 19 L9 19 Z" stroke={colors.primary} strokeWidth="0.9" fill="none" />
              <line x1="12" y1="19" x2="12" y2="16" stroke={colors.primary} strokeWidth="0.9" />
            </g>

            {/* ========================================================
                ROW 3 (Y ~ 205 - 265)
                ======================================================== */}

            {/* 11. Land Survey Boundary Plot (Parcel) */}
            <g transform="translate(30, 225) rotate(10)">
              <path d="M4 6 L26 2 L36 18 L22 28 L6 22 Z" stroke={colors.secondary} strokeWidth="1.2" strokeDasharray="3 1.5" fill="none" />
              <circle cx="4" cy="6" r="1.4" fill={colors.secondary} />
              <circle cx="26" cy="2" r="1.4" fill={colors.secondary} />
              <circle cx="36" cy="18" r="1.4" fill={colors.secondary} />
              <circle cx="22" cy="28" r="1.4" fill={colors.secondary} />
              <circle cx="6" cy="22" r="1.4" fill={colors.secondary} />
              <text x="18" y="16.5" fill={colors.secondary} fontSize="6.5" fontFamily="monospace" textAnchor="middle">PARCEL</text>
            </g>

            {/* 12. Commercial Logistics Warehouse */}
            <g transform="translate(135, 220) rotate(-5)">
              <path d="M2 10 L24 2 L38 7 L38 24 L2 24 Z" stroke={colors.primary} strokeWidth="1.2" fill="none" />
              <line x1="24" y1="2" x2="24" y2="24" stroke={colors.primary} strokeWidth="1" />
              <rect x="6" y="13" width="12" height="11" stroke={colors.primary} strokeWidth="1" fill="none" />
              <line x1="6" y1="16" x2="18" y2="16" stroke={colors.primary} strokeWidth="0.7" />
              <line x1="6" y1="19" x2="18" y2="19" stroke={colors.primary} strokeWidth="0.7" />
              <line x1="6" y1="22" x2="18" y2="22" stroke={colors.primary} strokeWidth="0.7" />
              <rect x="28" y="10" width="6" height="5" stroke={colors.primary} strokeWidth="0.8" fill="none" />
            </g>

            {/* 13. Signed Contract with Quill */}
            <g transform="translate(240, 224) rotate(12)">
              <rect x="2" y="2" width="22" height="28" rx="1.5" stroke={colors.accent} strokeWidth="1.2" fill="none" />
              <line x1="6" y1="7" x2="18" y2="7" stroke={colors.accent} strokeWidth="0.9" />
              <line x1="6" y1="11" x2="16" y2="11" stroke={colors.accent} strokeWidth="0.9" />
              <line x1="6" y1="15" x2="19" y2="15" stroke={colors.accent} strokeWidth="0.9" />
              <path d="M6 22 Q10 19 13 22 T19 21" stroke={colors.accent} strokeWidth="1" fill="none" strokeLinecap="round" />
              <path d="M22 26 L29 12 L31 13 L24 27 Z" stroke={colors.accent} strokeWidth="0.9" fill="none" />
              <line x1="22" y1="26" x2="20" y2="29" stroke={colors.accent} strokeWidth="1" />
            </g>

            {/* 14. Urban Mid-Rise Apartment Complex */}
            <g transform="translate(350, 214) rotate(-8)">
              <rect x="4" y="6" width="26" height="36" rx="1" stroke={colors.primary} strokeWidth="1.2" fill="none" />
              <rect x="12" y="2" width="10" height="4" stroke={colors.primary} strokeWidth="1" fill="none" />
              <rect x="7" y="10" width="8" height="5" stroke={colors.primary} strokeWidth="0.9" fill="none" />
              <line x1="6" y1="15" x2="16" y2="15" stroke={colors.primary} strokeWidth="1.1" />
              <rect x="19" y="10" width="8" height="5" stroke={colors.primary} strokeWidth="0.9" fill="none" />
              <line x1="18" y1="15" x2="28" y2="15" stroke={colors.primary} strokeWidth="1.1" />
              <rect x="7" y="18" width="8" height="5" stroke={colors.primary} strokeWidth="0.9" fill="none" />
              <line x1="6" y1="23" x2="16" y2="23" stroke={colors.primary} strokeWidth="1.1" />
              <rect x="19" y="18" width="8" height="5" stroke={colors.primary} strokeWidth="0.9" fill="none" />
              <line x1="18" y1="23" x2="28" y2="23" stroke={colors.primary} strokeWidth="1.1" />
              <rect x="12" y="32" width="10" height="10" stroke={colors.primary} strokeWidth="1" fill="none" />
              <line x1="17" y1="32" x2="17" y2="42" stroke={colors.primary} strokeWidth="0.9" />
            </g>

            {/* 15. Bank Vault Security Door */}
            <g transform="translate(460, 222)">
              <circle cx="15" cy="15" r="14" stroke={colors.accent} strokeWidth="1.2" fill="none" />
              <circle cx="15" cy="15" r="10" stroke={colors.accent} strokeWidth="1" fill="none" />
              <circle cx="15" cy="15" r="3" stroke={colors.accent} strokeWidth="1.1" fill="none" />
              <line x1="15" y1="6" x2="15" y2="24" stroke={colors.accent} strokeWidth="1" />
              <line x1="6" y1="15" x2="24" y2="15" stroke={colors.accent} strokeWidth="1" />
              <circle cx="15" cy="2" r="1" fill={colors.accent} />
              <circle cx="28" cy="15" r="1" fill={colors.accent} />
              <circle cx="15" cy="28" r="1" fill={colors.accent} />
              <circle cx="2" cy="15" r="1" fill={colors.accent} />
            </g>

            {/* ========================================================
                ROW 4 (Y ~ 305 - 365)
                ======================================================== */}

            {/* 16. Audited Ledger Folder */}
            <g transform="translate(55, 318) rotate(-12)">
              <path d="M2 6 L12 6 L15 9 L28 9 L28 26 L2 26 Z" stroke={colors.primary} strokeWidth="1.2" fill="none" strokeLinejoin="round" />
              <line x1="6" y1="14" x2="24" y2="14" stroke={colors.primary} strokeWidth="0.8" />
              <line x1="6" y1="18" x2="24" y2="18" stroke={colors.primary} strokeWidth="0.8" />
              <line x1="6" y1="22" x2="18" y2="22" stroke={colors.primary} strokeWidth="0.8" />
              <path d="M20 21 L22 23 L25 19" stroke={colors.primary} strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>

            {/* 17. Roman Archway Door / Institutional Portal */}
            <g transform="translate(150, 318) rotate(5)">
              <path d="M4 32 L4 14 A12 12 0 0 1 28 14 L28 32" stroke={colors.secondary} strokeWidth="1.3" fill="none" />
              <polygon points="14,1 18,1 17,4 15,4" stroke={colors.secondary} strokeWidth="0.9" fill="none" />
              <line x1="16" y1="14" x2="16" y2="2" stroke={colors.secondary} strokeWidth="0.8" />
              <line x1="16" y1="14" x2="8" y2="6" stroke={colors.secondary} strokeWidth="0.8" />
              <line x1="16" y1="14" x2="24" y2="6" stroke={colors.secondary} strokeWidth="0.8" />
              <line x1="4" y1="14" x2="28" y2="14" stroke={colors.secondary} strokeWidth="1" />
              <rect x="7" y="16" width="8" height="16" stroke={colors.secondary} strokeWidth="0.9" fill="none" />
              <rect x="17" y="16" width="8" height="16" stroke={colors.secondary} strokeWidth="0.9" fill="none" />
            </g>

            {/* 18. Portfolio Growth & Asset Yield Chart */}
            <g transform="translate(242, 316) rotate(-4)">
              <path d="M3 26 L3 4" stroke={colors.primary} strokeWidth="1.1" strokeLinecap="round" />
              <path d="M3 26 L27 26" stroke={colors.primary} strokeWidth="1.1" strokeLinecap="round" />
              <path d="M5 21 L11 15 L17 18 L25 7" stroke={colors.accent} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <circle cx="11" cy="15" r="1.2" fill={colors.accent} />
              <circle cx="17" cy="18" r="1.2" fill={colors.accent} />
              <circle cx="25" cy="7" r="1.6" fill={colors.accent} />
              <rect x="7" y="17" width="2.5" height="9" stroke={colors.secondary} strokeWidth="0.8" fill="none" />
              <rect x="13" y="19" width="2.5" height="7" stroke={colors.secondary} strokeWidth="0.8" fill="none" />
              <rect x="19" y="12" width="2.5" height="14" stroke={colors.secondary} strokeWidth="0.8" fill="none" />
              <path d="M22 7 L25 7 L25 10" stroke={colors.accent} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>

            {/* 19. Construction Crane & Structural Framework */}
            <g transform="translate(335, 312) rotate(-6)">
              <rect x="2" y="16" width="22" height="20" stroke={colors.primary} strokeWidth="1" strokeDasharray="2 1.5" fill="none" />
              <line x1="13" y1="16" x2="13" y2="36" stroke={colors.primary} strokeWidth="0.8" strokeDasharray="2 1.5" />
              <line x1="2" y1="26" x2="24" y2="26" stroke={colors.primary} strokeWidth="0.8" strokeDasharray="2 1.5" />
              <line x1="18" y1="16" x2="18" y2="4" stroke={colors.primary} strokeWidth="1.2" />
              <line x1="8" y1="4" x2="34" y2="4" stroke={colors.primary} strokeWidth="1.2" />
              <line x1="18" y1="0" x2="18" y2="4" stroke={colors.primary} strokeWidth="1" />
              <line x1="18" y1="0" x2="10" y2="4" stroke={colors.primary} strokeWidth="0.8" />
              <line x1="18" y1="0" x2="30" y2="4" stroke={colors.primary} strokeWidth="0.8" />
              <line x1="28" y1="4" x2="28" y2="12" stroke={colors.primary} strokeWidth="0.9" />
              <path d="M27 12 C27 14 30 14 30 12" stroke={colors.primary} strokeWidth="0.9" fill="none" />
            </g>

            {/* 20. Circular Verification Stamp */}
            <g transform="translate(425, 322) rotate(16)">
              <circle cx="14" cy="14" r="13" stroke={colors.accent} strokeWidth="1.2" strokeDasharray="3 1.5" fill="none" />
              <circle cx="14" cy="14" r="10" stroke={colors.accent} strokeWidth="0.9" fill="none" />
              <path d="M9 14.5 L12.5 18 L19 10.5" stroke={colors.accent} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>

            {/* 21. Smart Contract Code Brackets with Token Block */}
            <g transform="translate(500, 318) rotate(-10)">
              <path d="M6 2 C2 2 2 7 2 11 C2 13 0 14 0 14 C0 14 2 15 2 17 C2 21 2 26 6 26" stroke={colors.secondary} strokeWidth="1.1" strokeLinecap="round" fill="none" />
              <path d="M22 2 C26 2 26 7 26 11 C26 13 28 14 28 14 C28 14 26 15 26 17 C26 21 26 26 22 26" stroke={colors.secondary} strokeWidth="1.1" strokeLinecap="round" fill="none" />
              <rect x="9" y="8" width="10" height="11" rx="1.5" stroke={colors.secondary} strokeWidth="1" fill="none" />
              <line x1="12" y1="8" x2="12" y2="19" stroke={colors.secondary} strokeWidth="0.8" />
              <line x1="9" y1="13.5" x2="19" y2="13.5" stroke={colors.secondary} strokeWidth="0.8" />
            </g>

            {/* ========================================================
                ROW 5 (Y ~ 405 - 465)
                ======================================================== */}

            {/* 22. Attached Townhouses / Duplex */}
            <g transform="translate(35, 418) rotate(4)">
              <path d="M2 12 L12 2 L22 12 L32 2 L42 12" stroke={colors.primary} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <rect x="4" y="12" width="36" height="16" stroke={colors.primary} strokeWidth="1.1" fill="none" />
              <line x1="22" y1="12" x2="22" y2="28" stroke={colors.primary} strokeWidth="1" />
              <rect x="8" y="19" width="5" height="9" stroke={colors.primary} strokeWidth="0.9" fill="none" />
              <rect x="25" y="19" width="5" height="9" stroke={colors.primary} strokeWidth="0.9" fill="none" />
              <rect x="15" y="15" width="4" height="4" stroke={colors.primary} strokeWidth="0.8" fill="none" />
              <rect x="32" y="15" width="4" height="4" stroke={colors.primary} strokeWidth="0.8" fill="none" />
            </g>

            {/* 23. Surveyor Compass Rose */}
            <g transform="translate(140, 418) rotate(15)">
              <circle cx="14" cy="14" r="13" stroke={colors.accent} strokeWidth="0.9" strokeDasharray="1.5 1.5" fill="none" />
              <polygon points="14,2 17,11 26,14 17,17 14,26 11,17 2,14 11,11" stroke={colors.accent} strokeWidth="1.1" fill="none" />
              <circle cx="14" cy="14" r="2" fill={colors.accent} />
            </g>

            {/* 24. Property Folder with Hanging Deed Seal */}
            <g transform="translate(245, 422) rotate(-6)">
              <path d="M2 4 L14 4 L17 8 L32 8 L32 26 L2 26 Z" stroke={colors.secondary} strokeWidth="1.2" fill="none" strokeLinejoin="round" />
              <line x1="7" y1="14" x2="27" y2="14" stroke={colors.secondary} strokeWidth="0.9" />
              <line x1="7" y1="18" x2="22" y2="18" stroke={colors.secondary} strokeWidth="0.9" />
              <path d="M26 26 L26 34 L28.5 32 L31 34 L31 26" stroke={colors.secondary} strokeWidth="0.9" fill="none" />
            </g>

            {/* 25. Modern Villa / Contemporary Architecture */}
            <g transform="translate(350, 412) rotate(6)">
              <rect x="10" y="2" width="28" height="14" stroke={colors.primary} strokeWidth="1.2" fill="none" />
              <rect x="2" y="16" width="30" height="14" stroke={colors.primary} strokeWidth="1.2" fill="none" />
              <line x1="16" y1="2" x2="16" y2="16" stroke={colors.primary} strokeWidth="0.8" />
              <line x1="24" y1="2" x2="24" y2="16" stroke={colors.primary} strokeWidth="0.8" />
              <line x1="32" y1="2" x2="32" y2="16" stroke={colors.primary} strokeWidth="0.8" />
              <line x1="8" y1="16" x2="8" y2="30" stroke={colors.primary} strokeWidth="0.8" />
              <line x1="18" y1="16" x2="18" y2="30" stroke={colors.primary} strokeWidth="0.8" />
            </g>

            {/* 26. Stack of Equity Token Coins */}
            <g transform="translate(455, 420) rotate(-12)">
              <ellipse cx="14" cy="20" rx="12" ry="4" stroke={colors.accent} strokeWidth="1.1" fill="none" />
              <path d="M2 16 C2 18.2 7.4 20 14 20 C20.6 20 26 18.2 26 16" stroke={colors.accent} strokeWidth="1.1" fill="none" />
              <ellipse cx="14" cy="14" rx="12" ry="4" stroke={colors.accent} strokeWidth="1.1" fill="none" />
              <path d="M2 10 C2 12.2 7.4 14 14 14 C20.6 14 26 12.2 26 10" stroke={colors.accent} strokeWidth="1.1" fill="none" />
              <ellipse cx="14" cy="8" rx="12" ry="4" stroke={colors.accent} strokeWidth="1.1" fill="none" />
              <ellipse cx="14" cy="8" rx="8" ry="2.6" stroke={colors.accent} strokeWidth="0.7" strokeDasharray="1.5 1.5" fill="none" />
              <line x1="2" y1="8" x2="2" y2="20" stroke={colors.accent} strokeWidth="1.1" />
              <line x1="26" y1="8" x2="26" y2="20" stroke={colors.accent} strokeWidth="1.1" />
            </g>

            {/* ========================================================
                SUBTLE FILLER SCATTER (Plus, Diamonds, Dots, Keyholes)
                ======================================================== */}
            {/* Row 1/2 Intermediates */}
            <g stroke={colors.accent} strokeWidth="0.9" strokeLinecap="round">
              <line x1="95" y1="36" x2="101" y2="36" />
              <line x1="98" y1="33" x2="98" y2="39" />
              <line x1="195" y1="45" x2="201" y2="45" />
              <line x1="198" y1="42" x2="198" y2="48" />
              <line x1="405" y1="40" x2="411" y2="40" />
              <line x1="408" y1="37" x2="408" y2="43" />
            </g>

            <g stroke={colors.secondary} strokeWidth="0.9" strokeLinecap="round">
              <line x1="40" y1="92" x2="46" y2="92" />
              <line x1="43" y1="89" x2="43" y2="95" />
              <line x1="150" y1="85" x2="156" y2="85" />
              <line x1="153" y1="82" x2="153" y2="88" />
              <line x1="260" y1="88" x2="266" y2="88" />
              <line x1="263" y1="85" x2="263" y2="91" />
              <line x1="365" y1="85" x2="371" y2="85" />
              <line x1="368" y1="82" x2="368" y2="88" />
              <line x1="475" y1="85" x2="481" y2="85" />
              <line x1="478" y1="82" x2="478" y2="88" />
            </g>

            {/* Micro Diamonds */}
            <polygon points="295,30 297,33 295,36 293,33" fill={colors.accent} />
            <polygon points="515,35 517,38 515,41 513,38" fill={colors.secondary} />
            <polygon points="130,135 132,138 130,141 128,138" fill={colors.primary} />
            <polygon points="355,130 357,133 355,136 353,133" fill={colors.accent} />

            {/* Row 2/3 Intermediates */}
            <g stroke={colors.primary} strokeWidth="0.9" strokeLinecap="round">
              <line x1="55" y1="185" x2="61" y2="185" />
              <line x1="58" y1="182" x2="58" y2="188" />
              <line x1="165" y1="185" x2="171" y2="185" />
              <line x1="168" y1="182" x2="168" y2="188" />
              <line x1="270" y1="182" x2="276" y2="182" />
              <line x1="273" y1="179" x2="273" y2="185" />
              <line x1="380" y1="185" x2="386" y2="185" />
              <line x1="383" y1="182" x2="383" y2="188" />
              <line x1="485" y1="182" x2="491" y2="182" />
              <line x1="488" y1="179" x2="488" y2="185" />
            </g>

            {/* Micro Keyhole */}
            <g transform="translate(195, 240)">
              <circle cx="2" cy="2" r="1.5" fill={colors.accent} />
              <polygon points="1,2 3,2 3.5,5 0.5,5" fill={colors.accent} />
            </g>

            {/* Row 3/4 Intermediates */}
            <g stroke={colors.accent} strokeWidth="0.9" strokeLinecap="round">
              <line x1="90" y1="280" x2="96" y2="280" />
              <line x1="93" y1="277" x2="93" y2="283" />
              <line x1="195" y1="285" x2="201" y2="285" />
              <line x1="198" y1="282" x2="198" y2="288" />
              <line x1="300" y1="280" x2="306" y2="280" />
              <line x1="303" y1="277" x2="303" y2="283" />
              <line x1="415" y1="280" x2="421" y2="280" />
              <line x1="418" y1="277" x2="418" y2="283" />
              <line x1="515" y1="280" x2="521" y2="280" />
              <line x1="518" y1="277" x2="518" y2="283" />
            </g>

            <polygon points="90,225 92,228 90,231 88,228" fill={colors.secondary} />
            <polygon points="300,220 302,223 300,226 298,223" fill={colors.primary} />
            <polygon points="515,230 517,233 515,236 513,233" fill={colors.accent} />

            {/* Row 4/5 Intermediates */}
            <g stroke={colors.secondary} strokeWidth="0.9" strokeLinecap="round">
              <line x1="45" y1="380" x2="51" y2="380" />
              <line x1="48" y1="377" x2="48" y2="383" />
              <line x1="150" y1="380" x2="156" y2="380" />
              <line x1="153" y1="377" x2="153" y2="383" />
              <line x1="260" y1="382" x2="266" y2="382" />
              <line x1="263" y1="379" x2="263" y2="385" />
              <line x1="365" y1="380" x2="371" y2="380" />
              <line x1="368" y1="377" x2="368" y2="383" />
              <line x1="470" y1="382" x2="476" y2="382" />
              <line x1="473" y1="379" x2="473" y2="385" />
            </g>

            {/* Bottom Row Intermediates */}
            <g stroke={colors.primary} strokeWidth="0.9" strokeLinecap="round">
              <line x1="95" y1="490" x2="101" y2="490" />
              <line x1="98" y1="487" x2="98" y2="493" />
              <line x1="195" y1="490" x2="201" y2="490" />
              <line x1="198" y1="487" x2="198" y2="493" />
              <line x1="305" y1="492" x2="311" y2="492" />
              <line x1="308" y1="489" x2="308" y2="495" />
              <line x1="415" y1="490" x2="421" y2="490" />
              <line x1="418" y1="487" x2="418" y2="493" />
              <line x1="515" y1="492" x2="521" y2="492" />
              <line x1="518" y1="489" x2="518" y2="495" />
            </g>

            {/* Corner boundary balances so tiling is completely seamless */}
            <circle cx="2" cy="2" r="1" fill={colors.accent} />
            <circle cx="538" cy="2" r="1" fill={colors.accent} />
            <circle cx="2" cy="538" r="1" fill={colors.accent} />
            <circle cx="538" cy="538" r="1" fill={colors.accent} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${finalPatternId})`} />
      </svg>
    </div>
  );
};

// Aliases for compatibility
export const DoodleWallpaper = AssetraDoodleBackground;
export default AssetraDoodleBackground;
