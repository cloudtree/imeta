# 메타데이터 관리 앱 PRD

> 데이터 표준(표준 단어 · 용어 · 도메인)을 등록·검증·조회하기 위한 웹 애플리케이션

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **프로젝트명** | 메타데이터 관리 앱 |
| **목적** | 데이터 표준 관리를 위한 메타데이터(표준 단어, 표준 용어, 표준 도메인)를 체계적으로 관리 |
| **대상 사용자** | 데이터 표준 담당자, 데이터 모델러 |
| **아키텍처** | 프론트엔드(React SPA)와 백엔드(Express REST API) 분리 개발 |

---

## 2. 개발 범위

### 2.1 핵심 기능

| 모듈 | 설명 | 상태 |
|------|------|------|
| **대시보드** | 단어/용어/도메인 전체 건수 및 주제영역별 현황 차트 | 구현됨 |
| **주제영역 관리** | 표준 데이터의 분류 단위(주제영역) CRUD | 구현됨 |
| **표준 단어 관리** | 단어 등록, 검색, 엑셀 일괄 등록 | 구현됨 |
| **표준 용어 관리** | 논리명→물리명 자동 변환, 도메인 연계, 엑셀 일괄 등록 | 구현됨 |
| **표준 도메인 관리** | 도메인 그룹·인포타입 관리, 엑셀 일괄 등록 | 구현됨 |

### 2.2 공통 기능

- 목록 조회 (검색, 주제영역 필터, 페이지네이션)
- 등록 · 수정 · 삭제 (모달 폼)
- 선택 항목 일괄 삭제
- 엑셀(xlsx) 업로드 일괄 등록
- 전체 삭제 (관리자용)
- 사용 여부(`Y`/`N`) 관리

---

## 3. 기술 스택

| 구분 | 기술 |
|------|------|
| **프론트엔드** | React 18, React Router, Vite, CSS |
| **백엔드** | Node.js, Express |
| **데이터베이스** | PostgreSQL |
| **기타** | xlsx (엑셀 파싱), cors, dotenv, pg |

### 3.1 기본 원칙

- 프론트엔드와 백엔드를 별도 프로젝트로 개발
- 기본적인 웹 기술만 사용 (프레임워크 최소화)
- REST API 기반 통신 (`/api/*`)

---

## 4. 시스템 구성

```
┌─────────────┐     HTTP/JSON      ┌─────────────┐     SQL      ┌──────────────┐
│  React UI   │ ◄───────────────► │ Express API │ ◄──────────► │  PostgreSQL  │
│  (Vite)     │   VITE_API_URL    │  (port 3000)│              │              │
└─────────────┘                   └─────────────┘              └──────────────┘
```

### 4.1 디렉터리 구조

| 경로 | 역할 |
|------|------|
| `ui/` | React 프론트엔드 (Vite) |
| `server/` | Express REST API 서버 |
| `db/migrations/` | PostgreSQL 스키마 마이그레이션 |
| `docs/` | 프로젝트 문서 |

### 4.2 환경 변수

**서버** (`.env`)

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | API 서버 포트 | `3000` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL 연결 | — |

**프론트엔드** (`ui/.env`)

| 변수 | 설명 | 예시 |
|------|------|------|
| `VITE_API_URL` | API 베이스 URL | `http://localhost:3000/api` |

---

## 5. 화면 구성

| 경로 | 화면명 | 기능 |
|------|--------|------|
| `/` | 대시보드 | 전체 건수 요약, 주제영역별 도넛 차트 |
| `/subject-areas` | 주제영역 | 주제영역 CRUD, 연결된 단어/용어/도메인 건수 표시 |
| `/words` | 표준 단어 | 단어 CRUD, 엑셀 업로드, 일괄 삭제 |
| `/terms` | 표준 용어 | 용어 CRUD, 논리명 자동 매칭, 엑셀 업로드 |
| `/domains` | 표준 도메인 | 도메인 CRUD, 도메인 그룹 관리, 엑셀 업로드 |

---

## 6. 데이터 모델

### 6.1 ER 관계

```
subject_area (1) ──< (N) words
subject_area (1) ──< (N) terms
subject_area (1) ──< (N) domains
domains      (1) ──< (N) terms  (domain_id, ON DELETE SET NULL)
domain_groups      ──> domains.info_type (그룹명 참조)
```

### 6.2 테이블 정의

#### subject_area (주제영역)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `subject_id` | VARCHAR(20) PK | 주제영역 ID |
| `subject_name` | VARCHAR(100) | 주제영역명 |
| `system_id` | INTEGER FK | 시스템 (`meta_systems`) |
| `system_nm` | VARCHAR(200) | 시스템명 |
| `description` | VARCHAR(1000) | 설명 |
| `use_yn` | CHAR(1) | 사용 여부 (`Y`/`N`) |

- 기본값: `DEFAULT` / `기본` 주제영역 자동 생성
- FK: `ON UPDATE CASCADE`, `ON DELETE SET NULL`

#### words (표준 단어)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `word_id` | SERIAL PK | 단어 ID |
| `subject_id` | VARCHAR(20) FK | 주제영역 |
| `word_nm` | VARCHAR(100) | 단어명 (한글) |
| `abb_word_nm` | VARCHAR(100) UNIQUE | 영문 약어 |
| `all_word_nm` | VARCHAR(100) | 영문 전체명 |
| `kor_synonym_nm` | VARCHAR(100) | 한글 동의어 |
| `taxon_yn` | VARCHAR(1) | 분류어 여부 (`Y`/`N`) |
| `word_desc` | TEXT | 설명 |
| `use_yn` | CHAR(1) | 사용 여부 |

#### domains (표준 도메인)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `domain_id` | SERIAL PK | 도메인 ID |
| `subject_id` | VARCHAR(20) FK | 주제영역 |
| `domain_nm` | VARCHAR(100) | 도메인명 |
| `info_type` | VARCHAR(50) | 도메인 그룹명 |
| `infotype` | VARCHAR(50) | 인포타입 (자동 생성: `{도메인명}{타입}{길이}`) |
| `data_type` | VARCHAR(50) | 데이터 타입 |
| `data_length` | VARCHAR(100) | 데이터 길이 (`100` 또는 `7,2` 형식) |
| `domain_desc` | TEXT | 설명 |
| `use_yn` | CHAR(1) | 사용 여부 |

**지원 데이터 타입:** `VARCHAR`, `CHAR`, `NUMBER`, `INTEGER`, `DATE`, `TIMESTAMP`, `BOOLEAN`, `CLOB`

#### terms (표준 용어)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `term_id` | SERIAL PK | 용어 ID |
| `subject_id` | VARCHAR(20) FK | 주제영역 |
| `logical_term` | VARCHAR(200) | 논리명 (한글) |
| `physical_term` | VARCHAR(200) | 물리명 (영문) |
| `domain_div_cd` | VARCHAR(200) | 도메인 그룹명 |
| `domain_id` | INT FK | 연결 도메인 |
| `data_type` | VARCHAR(50) | 데이터 타입 |
| `data_len` | VARCHAR(100) | 데이터 길이 |
| `term_desc` | TEXT | 설명 |
| `use_yn` | CHAR(1) | 사용 여부 |

#### domain_groups (도메인 그룹)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `group_id` | SERIAL PK | 그룹 ID |
| `group_nm` | VARCHAR UNIQUE | 그룹명 |
| `group_desc` | TEXT | 설명 |
| `use_yn` | CHAR(1) | 사용 여부 |

---

## 7. 기능 상세

### 7.1 표준 단어

**비즈니스 규칙**

- 영문 약어(`abb_word_nm`)는 대문자로 저장, 중복 불가
- 분류어(`taxon_yn = Y`)는 용어 등록 시 도메인 자동 추천에 사용

**엑셀 업로드 컬럼**

| 컬럼 | 필수 | 예시 |
|------|------|------|
| 주제영역ID | — | `STD01` |
| 단어명 | ✓ | `고객` |
| 영문명(전체) | ✓ | `Customer` |
| 영문약어 | ✓ | `CUST` |
| 한글동의어 | — | `거래처` |
| 분류어여부 | — | `N` |
| 사용여부 | — | `Y` |
| 설명 | — | — |

### 7.2 표준 용어

**논리명 → 물리명 자동 변환**

1. 등록된 표준 단어 사전과 논리명 매칭 (최장 일치)
2. 공백이 있으면 구간별로 분리하여 매칭
3. 매칭된 단어의 영문 약어를 `_`로 연결하여 물리명 생성
4. 앞→뒤 / 뒤→앞 양방향 매칭으로 모호성 검출

**도메인 자동 추천**

- 마지막 매칭 단어가 분류어(`taxon_yn = Y`)이면 도메인 그룹·인포타입·데이터 타입·길이 자동 제안
- `코드` 분류어는 도메인 그룹명을 `코드`로 설정

**엑셀 업로드 컬럼**

| 컬럼 | 필수 | 예시 |
|------|------|------|
| 주제영역ID | — | `STD01` |
| 논리명 | ✓ | `고객번호` |
| 물리명 | ✓ | `CUST_NO` |
| 도메인그룹명 | — | `명칭` |
| 도메인 인포타입 | — | `이름VC100` |
| 데이터타입 | ✓ | `VARCHAR` |
| 데이터길이 | ✓ | `100` 또는 `7,2` |
| 사용여부 | — | `Y` |
| 설명 | — | — |

### 7.3 표준 도메인

**인포타입 자동 생성**

- 형식: `{도메인명}{타입약어}{길이}` (예: `이름VC100`, `금액NM7,2`)
- 도메인명·데이터 타입·데이터 길이 변경 시 자동 갱신

**도메인 그룹 관리**

- 도메인 등록 화면에서 그룹 CRUD 가능
- 사용 중인 그룹은 삭제 불가

**엑셀 업로드 컬럼**

| 컬럼 | 필수 | 예시 |
|------|------|------|
| 주제영역ID | — | `STD01` |
| 도메인그룹명 | ✓ | `명칭` |
| 도메인명 | ✓ | `이름` |
| 데이터타입 | ✓ | `VARCHAR` |
| 데이터길이 | — | `100` 또는 `7,2` |
| 사용여부 | — | `Y` |
| 설명 | — | — |

### 7.4 주제영역

- 주제영역 ID는 등록 후 변경 가능 (`ON UPDATE CASCADE`로 하위 데이터 연동)
- 삭제 시 하위 단어/용어/도메인의 `subject_id`는 `NULL`로 설정
- 목록에 연결된 단어/용어/도메인 건수 표시

---

## 8. API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/health` | 서버 상태 확인 |
| GET/POST/PUT/DELETE | `/api/subject-areas` | 주제영역 CRUD |
| GET/POST/PUT/DELETE | `/api/words` | 표준 단어 CRUD |
| GET | `/api/words/dictionary` | 용어 매칭용 단어 사전 |
| POST | `/api/words/bulk` | 단어 엑셀 일괄 등록 |
| DELETE | `/api/words/all` | 단어 전체 삭제 |
| GET/POST/PUT/DELETE | `/api/terms` | 표준 용어 CRUD |
| POST | `/api/terms/bulk` | 용어 엑셀 일괄 등록 |
| DELETE | `/api/terms/all` | 용어 전체 삭제 |
| GET/POST/PUT/DELETE | `/api/domains` | 표준 도메인 CRUD |
| POST | `/api/domains/bulk` | 도메인 엑셀 일괄 등록 |
| DELETE | `/api/domains/all` | 도메인 전체 삭제 |
| GET/POST/PUT/DELETE | `/api/domain-groups` | 도메인 그룹 CRUD |

**공통 쿼리 파라미터:** `search`, `use_yn`, `subject_id`, `page`, `limit`

---

## 9. 비기능 요구사항

| 항목 | 내용 |
|------|------|
| **페이지 크기** | 목록 기본 50건, 최대 100건 |
| **요청 크기** | JSON 본문 최대 50MB (엑셀 bulk 업로드) |
| **타임스탬프** | `created_at`, `updated_at` 자동 관리 (DB 트리거) |
| **마이그레이션** | 서버 시작 시 `data_length` 스키마 자동 마이그레이션 |
| **CORS** | 개발 환경에서 프론트엔드 origin 허용 |

---

## 10. 실행 방법

```bash
# 1. DB 마이그레이션 (순서대로 실행)
psql -d metadata_db -f db/migrations/001_init.sql
psql -d metadata_db -f db/migrations/002_words_abb_unique.sql
psql -d metadata_db -f db/migrations/003_subject_area.sql
psql -d metadata_db -f db/migrations/004_add_subject_id_fk.sql
psql -d metadata_db -f db/migrations/005_subject_fk_cascade.sql

# 2. 백엔드
cp .env.example .env   # DB 접속 정보 설정
npm install && npm run dev

# 3. 프론트엔드
cd ui
cp .env.example .env   # VITE_API_URL 설정
npm install && npm run dev
```

---

## 11. 변경 이력

| 버전 | 날짜 | 내용 |
|------|------|------|
| 0.1 | — | 초기 PRD (프로젝트 개요, 기술 스택) |
| 1.0 | 2026-07-02 | 코드베이스 반영 — 기능·데이터 모델·API·실행 방법 정리 |
