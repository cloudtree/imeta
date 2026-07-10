import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const FOOTER_COLUMNS = [
  {
    title: '데이터 모델',
    links: [
      { label: '주제영역', to: '/subject-areas' },
      { label: '메타데이터 현황', to: '/' },
    ],
  },
  {
    title: '데이터 표준',
    links: [
      { label: '표준 단어', to: '/words' },
      { label: '표준 용어', to: '/terms' },
      { label: '표준 도메인', to: '/domains' },
    ],
  },
  {
    title: '데이터베이스',
    links: [
      { label: '서버등록', to: '/servers/register' },
      { label: '데이터베이스검토', to: '/database/review' },
      { label: '테이블정의서검토', to: '/database/table-definition-review' },
    ],
  },
  {
    title: 'iMeta관리',
    adminOnly: true,
    links: [
      { label: '사용자 관리', to: '/users' },
    ],
  },
]

export default function Footer() {
  const { isAdmin } = useAuth()
  const columns = FOOTER_COLUMNS.filter((col) => !col.adminOnly || isAdmin)

  return (
    <footer className="apple-footer">
      <div className="apple-footer__inner">
        <div className="apple-footer__legal">
          <p>
            Meta Portal은 조직의 데이터 표준과 데이터베이스 스키마를 검토·관리하기 위한
            메타데이터 관리 포털입니다. 등록된 표준 단어·용어·도메인을 기준으로 실제 DB
            정의를 비교할 수 있습니다.
          </p>
          <p>
            일부 검토 결과는 연결된 데이터베이스의 권한과 네트워크 상태에 따라 달라질 수 있습니다.
          </p>
        </div>

        <div className="apple-footer__columns">
          {columns.map((col) => (
            <div key={col.title} className="apple-footer__col">
              <h3 className="apple-footer__col-title">{col.title}</h3>
              {col.links.map((link) => (
                <Link key={link.to + link.label} to={link.to} className="apple-footer__link">
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="apple-footer__bottom">
          <div className="apple-footer__meta">
            <p>Copyright © {new Date().getFullYear()} Meta Portal. All rights reserved.</p>
            <ul className="apple-footer__legal-links">
              <li>개인정보 처리방침</li>
              <li>이용약관</li>
              <li>사이트맵</li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  )
}
