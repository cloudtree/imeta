export default function RoaringCat({ size = 48, idPrefix = 'cat', animated = true }) {
  const faceId = `${idPrefix}-face`
  const earId = `${idPrefix}-ear`
  return (
    <div
      className={`roaring-cat${animated ? '' : ' roaring-cat--static'}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={faceId} cx="50%" cy="40%" r="58%">
            <stop offset="0%" stopColor="#ffcba4" />
            <stop offset="55%" stopColor="#f4a261" />
            <stop offset="100%" stopColor="#e76f51" />
          </radialGradient>
          <radialGradient id={earId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffb4a2" />
            <stop offset="100%" stopColor="#f4a261" />
          </radialGradient>
        </defs>

        <g className="roaring-cat__body">
          <ellipse cx="50" cy="58" rx="30" ry="26" fill={`url(#${faceId})`} />

          <polygon className="roaring-cat__ear roaring-cat__ear--left" points="22,36 14,12 38,28" fill="#f4a261" />
          <polygon className="roaring-cat__ear roaring-cat__ear--left" points="24,34 18,18 34,28" fill={`url(#${earId})`} />
          <polygon className="roaring-cat__ear roaring-cat__ear--right" points="78,36 86,12 62,28" fill="#f4a261" />
          <polygon className="roaring-cat__ear roaring-cat__ear--right" points="76,34 82,18 66,28" fill={`url(#${earId})`} />

          <ellipse cx="36" cy="52" rx="7" ry="8" fill="#fff" opacity="0.35" />
          <ellipse cx="64" cy="52" rx="7" ry="8" fill="#fff" opacity="0.35" />

          <ellipse className="roaring-cat__eye roaring-cat__eye--left" cx="37" cy="54" rx="5" ry="6" fill="#1f2937" />
          <ellipse className="roaring-cat__eye roaring-cat__eye--right" cx="63" cy="54" rx="5" ry="6" fill="#1f2937" />
          <circle cx="38.5" cy="52" r="1.8" fill="#fff" />
          <circle cx="64.5" cy="52" r="1.8" fill="#fff" />

          <ellipse cx="50" cy="62" rx="3" ry="2" fill="#e76f51" />

          <g className="roaring-cat__whiskers roaring-cat__whiskers--left">
            <line x1="8" y1="58" x2="28" y2="56" stroke="#fef3c7" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="6" y1="64" x2="28" y2="62" stroke="#fef3c7" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="8" y1="70" x2="28" y2="68" stroke="#fef3c7" strokeWidth="1.2" strokeLinecap="round" />
          </g>
          <g className="roaring-cat__whiskers roaring-cat__whiskers--right">
            <line x1="92" y1="58" x2="72" y2="56" stroke="#fef3c7" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="94" y1="64" x2="72" y2="62" stroke="#fef3c7" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="92" y1="70" x2="72" y2="68" stroke="#fef3c7" strokeWidth="1.2" strokeLinecap="round" />
          </g>

          <g className="roaring-cat__jaw">
            <path d="M36 66 Q50 86 64 66 Q50 76 36 66 Z" fill="#e76f51" />
            <path className="roaring-cat__tongue" d="M43 68 Q50 80 57 68 Q50 74 43 68 Z" fill="#fb7185" />
            <path d="M40 66 L43 72 M47 66 L49 73 M53 66 L51 73 M57 66 L54 72" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.85" />
          </g>
        </g>

        <g className="roaring-cat__waves">
          <text x="6" y="48" fontSize="10" fill="#fbbf24" fontWeight="700">♪</text>
          <text x="82" y="44" fontSize="12" fill="#f59e0b" fontWeight="700">♫</text>
          <path d="M4 52 Q-2 46 4 40" fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M96 52 Q102 46 96 40" fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  )
}
