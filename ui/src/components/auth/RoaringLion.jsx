export default function RoaringLion({ size = 48 }) {
  return (
    <div className="roaring-lion" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="lionFace" cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
          <radialGradient id="lionMane" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#92400e" />
            <stop offset="100%" stopColor="#451a03" />
          </radialGradient>
        </defs>

        <g className="roaring-lion__mane">
          {Array.from({ length: 14 }).map((_, i) => {
            const angle = -140 + i * 20
            return (
              <ellipse
                key={i}
                cx="50"
                cy="50"
                rx="10"
                ry="24"
                fill="url(#lionMane)"
                transform={`rotate(${angle} 50 50) translate(0 -24)`}
                opacity="0.92"
              />
            )
          })}
        </g>

        <circle cx="50" cy="52" r="28" fill="url(#lionFace)" />

        <ellipse className="roaring-lion__ear roaring-lion__ear--left" cx="28" cy="34" rx="7" ry="9" fill="#b45309" />
        <ellipse className="roaring-lion__ear roaring-lion__ear--right" cx="72" cy="34" rx="7" ry="9" fill="#b45309" />

        <ellipse cx="38" cy="48" rx="4.5" ry="5.5" fill="#1f2937" />
        <ellipse cx="62" cy="48" rx="4.5" ry="5.5" fill="#1f2937" />
        <circle cx="39.5" cy="46.5" r="1.4" fill="#fff" />
        <circle cx="63.5" cy="46.5" r="1.4" fill="#fff" />

        <ellipse cx="50" cy="58" rx="5" ry="3.5" fill="#78350f" />

        <g className="roaring-lion__jaw">
          <path
            d="M34 62 Q50 80 66 62 Q50 72 34 62 Z"
            fill="#92400e"
          />
          <path
            className="roaring-lion__tongue"
            d="M42 64 Q50 76 58 64 Q50 70 42 64 Z"
            fill="#ef4444"
          />
          <path d="M38 62 L42 68 M47 62 L49 69 M53 62 L51 69 M58 62 L54 68" stroke="#fef3c7" strokeWidth="1.2" strokeLinecap="round" />
        </g>

        <g className="roaring-lion__waves">
          <path d="M8 58 Q2 50 8 42" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 60 Q-4 50 4 40" fill="none" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M92 58 Q98 50 92 42" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
          <path d="M96 60 Q104 50 96 40" fill="none" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  )
}
