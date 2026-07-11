import { useEffect, useState } from 'react'
import RoaringCat from './RoaringCat'
import './LoginConsultingSlide.css'

const SLIDE_MS = 4200

const SLIDES = [
  {
    id: 'dg',
    kicker: '01',
    title: '데이터 거버넌스',
    highlight: 'Data Governance',
    bullets: ['정책 · 역할 · 프로세스', 'Ownership · Stewardship', 'Meta SSOT · Compliance'],
  },
  {
    id: 'standard',
    kicker: '02',
    title: '데이터 표준화',
    highlight: 'Data Standardization',
    bullets: ['표준 단어', '표준 용어', '표준 도메인', 'Business Glossary'],
  },
  {
    id: 'meta',
    kicker: '03',
    title: '메타데이터 관리',
    highlight: 'Metadata Management',
    bullets: ['테이블 정의서', '논리명 ↔ 물리명', '주제영역', 'Data Catalog'],
  },
  {
    id: 'quality',
    kicker: '04',
    title: '데이터 정합 · 품질',
    highlight: 'Data Quality & Reconciliation',
    bullets: ['Semantic Reconciliation', 'Schema Compliance', 'Naming Rule', 'DB Schema 검토'],
  },
  {
    id: 'operate',
    kicker: '05',
    title: '거버넌스 운영',
    highlight: 'Stewardship & Lineage',
    bullets: ['Data Steward', 'DG Council', 'Lineage', 'Active Metadata'],
  },
]

function SettledTopic({ slide, isLatest }) {
  return (
    <article className={`keynote__settled-item${isLatest ? ' keynote__settled-item--latest' : ''}`}>
      <span className="keynote__settled-kicker">{slide.kicker}</span>
      <h2 className="keynote__settled-title">{slide.title}</h2>
      <p className="keynote__settled-keywords">{slide.bullets.join(' · ')}</p>
    </article>
  )
}

function ActiveTopic({ slide }) {
  return (
    <div key={slide.id} className="keynote__stage" aria-live="polite">
      <p className="keynote__kicker">{slide.kicker}</p>
      <h1 id="login-intro-title" className="keynote__title">
        {slide.title}
      </h1>
      <p className="keynote__highlight">{slide.highlight}</p>
      <ul className="keynote__bullets">
        {slide.bullets.map((line, i) => (
          <li
            key={line}
            className="keynote__bullet"
            style={{ animationDelay: `${0.6 + i * 0.35}s` }}
          >
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function LoginConsultingSlide({ animate = true, loginOpen = false }) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!animate || loginOpen) return undefined

    const timer = window.setInterval(() => {
      setActiveIndex((i) => Math.min(i + 1, SLIDES.length - 1))
    }, SLIDE_MS)

    return () => window.clearInterval(timer)
  }, [animate, loginOpen])

  const settledCount = loginOpen ? activeIndex + 1 : activeIndex
  const settledSlides = SLIDES.slice(0, settledCount)
  const showActive = !loginOpen && settledSlides.length < SLIDES.length
  const activeSlide = showActive ? SLIDES[activeIndex] : null

  return (
    <div
      className={[
        'keynote',
        settledSlides.length > 0 ? 'keynote--has-settled' : '',
        loginOpen ? 'keynote--login-open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="keynote__header">
        <div className="keynote__brand">
          <RoaringCat size={28} className="keynote__logo" />
          <span>iMETA</span>
        </div>
        <span className="keynote__counter">
          {activeIndex + 1} / {SLIDES.length}
        </span>
      </header>

      <div className="keynote__body">
        {settledSlides.length > 0 && (
          <aside className="keynote__settled" aria-label="이전 주제">
            {settledSlides.map((slide, i) => (
              <SettledTopic
                key={slide.id}
                slide={slide}
                isLatest={i === settledSlides.length - 1}
              />
            ))}
          </aside>
        )}

        {activeSlide && (
          <div className="keynote__stage-wrap">
            <ActiveTopic slide={activeSlide} />
          </div>
        )}
      </div>

      <footer className="keynote__footer">
        <div className="keynote__dots" aria-hidden="true">
          {SLIDES.map((s, i) => (
            <span
              key={s.id}
              className={`keynote__dot${i === activeIndex ? ' keynote__dot--active' : ''}`}
            />
          ))}
        </div>
        <p className="keynote__refs">
          데이터 거버넌스 → 표준화 → 메타데이터 → 정합 · 품질 → 운영
        </p>
      </footer>
    </div>
  )
}
