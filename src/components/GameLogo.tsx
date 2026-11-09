export function GameLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="inline-flex flex-col items-center select-none">
      <svg
        viewBox="0 0 520 190"
        className={compact ? 'w-64 h-auto drop-shadow-lg' : 'w-80 sm:w-96 h-auto drop-shadow-2xl'}
        role="img"
        aria-label="LUDO WARZONE 3D Logo"
      >
        <defs>
          <linearGradient id="lwGoldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="45%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#CA8A04" />
          </linearGradient>
          <linearGradient id="lwSilverGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>
          <linearGradient id="lwRibbonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#B45309" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
        </defs>

        {/* Crossed AK-47 Barrels Silhouette Behind Shield */}
        <g stroke="#0F172A" strokeWidth="3" fill="#334155">
          <rect x="75" y="55" width="370" height="10" rx="3" transform="rotate(-14 260 60)" />
          <rect x="75" y="55" width="370" height="10" rx="3" transform="rotate(14 260 60)" />
        </g>

        {/* Left 3D Die */}
        <g transform="translate(58, 30) rotate(-18)">
          <rect
            x="0"
            y="0"
            width="46"
            height="46"
            rx="9"
            fill="#F8FAFC"
            stroke="#0F172A"
            strokeWidth="3.5"
          />
          <circle cx="13" cy="13" r="4" fill="#0F172A" />
          <circle cx="33" cy="13" r="4" fill="#0F172A" />
          <circle cx="23" cy="23" r="4" fill="#DC2626" />
          <circle cx="13" cy="33" r="4" fill="#0F172A" />
          <circle cx="33" cy="33" r="4" fill="#0F172A" />
        </g>

        {/* Right 3D Die */}
        <g transform="translate(414, 16) rotate(18)">
          <rect
            x="0"
            y="0"
            width="46"
            height="46"
            rx="9"
            fill="#F8FAFC"
            stroke="#0F172A"
            strokeWidth="3.5"
          />
          <circle cx="12" cy="12" r="3.8" fill="#0F172A" />
          <circle cx="34" cy="12" r="3.8" fill="#0F172A" />
          <circle cx="12" cy="23" r="3.8" fill="#0F172A" />
          <circle cx="34" cy="23" r="3.8" fill="#0F172A" />
          <circle cx="12" cy="34" r="3.8" fill="#0F172A" />
          <circle cx="34" cy="34" r="3.8" fill="#0F172A" />
        </g>

        {/* Royal Golden Crown */}
        <g transform="translate(215, 6)">
          <path
            d="M10 38 L2 12 L26 25 L45 4 L64 25 L88 12 L80 38 Z"
            fill="url(#lwGoldGrad)"
            stroke="#0F172A"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <circle cx="2" cy="10" r="4" fill="#FEF08A" stroke="#0F172A" strokeWidth="2" />
          <circle cx="45" cy="3" r="4.5" fill="#EF4444" stroke="#0F172A" strokeWidth="2" />
          <circle cx="88" cy="10" r="4" fill="#FEF08A" stroke="#0F172A" strokeWidth="2" />
        </g>

        {/* Main Emblem Backing Plate */}
        <path
          d="M92 44 H428 L448 136 H72 Z"
          fill="#0F172A"
          stroke="#FACC15"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* "LUDO" Metallic Silver Typography */}
        <text
          x="260"
          y="85"
          textAnchor="middle"
          fill="url(#lwSilverGrad)"
          stroke="#0F172A"
          strokeWidth="6"
          paintOrder="stroke"
          fontFamily="'Chakra Petch', sans-serif"
          fontWeight="800"
          fontSize="44"
          letterSpacing="4"
        >
          LUDO
        </text>

        {/* "WARZONE 3D" Golden Impact Typography */}
        <text
          x="260"
          y="128"
          textAnchor="middle"
          fill="url(#lwGoldGrad)"
          stroke="#0F172A"
          strokeWidth="7"
          paintOrder="stroke"
          fontFamily="'Chakra Petch', sans-serif"
          fontWeight="800"
          fontSize="44"
          letterSpacing="2"
        >
          WARZONE 3D
        </text>

        {/* Tagline Ribbon */}
        <g transform="translate(46, 144)">
          <polygon
            points="0,16 14,0 414,0 428,16 414,32 14,32"
            fill="url(#lwRibbonGrad)"
            stroke="#0F172A"
            strokeWidth="3"
          />
          <text
            x="214"
            y="21"
            textAnchor="middle"
            fill="#0F172A"
            fontFamily="'Plus Jakarta Sans', sans-serif"
            fontWeight="800"
            fontSize="13.5"
            letterSpacing="0.6"
          >
            Roll The Dice. Load Your Gun. Rule The Arena!
          </text>
        </g>
      </svg>
    </div>
  );
}
