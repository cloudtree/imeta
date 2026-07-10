# 내부 메타 스키마 표준 물리명

전사표준 6.3 + 표준단어/용어 원칙에 따라 **imetadb** 테이블·컬럼 물리명을 표준화한다.
**DB / API / UI 모두 동일 표준 물리명**을 사용한다. (호환 VIEW·SELECT 별칭 없음)

## 기동 순서

1. `migrateDomainsDataLength` — 길이 컬럼 타입 보정
2. `migrateInternalSchemaRename` — `ALTER TABLE … RENAME` / `RENAME COLUMN`
3. `migrateUsers` / `migrateDataObjects` / `migrateNamingRules` / `migrateSubjectAreaSystem`
4. `migrateDropCompatViews` — 구 호환 VIEW 삭제
5. `migrateInternalComments` — COMMENT + 표준사전 시드

## 테이블

| 엔티티(논리) | 물리명 |
|-------------|--------|
| 표준단어기본 | `meta_std_word_m` |
| 표준도메인기본 | `meta_std_domain_m` |
| 표준용어기본 | `meta_std_term_m` |
| 도메인그룹기본 | `meta_domain_group_m` |
| 주제영역기본 | `meta_subject_area_m` |
| DB서버기본 | `meta_db_server_m` |
| 테이블정의기본 | `meta_table_def_m` |
| 시스템기본 | `meta_system_m` |
| 명명규칙기본 | `meta_naming_rule_m` |
| 사용자기본 | `meta_user_m` |
| 데이터객체기본 | `meta_data_object_m` |

매핑: [`server/metaSchema.js`](../server/metaSchema.js)

## 컬럼 원칙

- 식별자 `*_id` / 명칭 `*_nm` / 여부 `*_yn`
- 등록·수정일시 `reg_dtm` / `upd_dtm`
- 테이블 유형 접미사 `*_m` (기본)
- 영문명 단수형 (복수형 ~s 불가)

## 확인

1. 서버 재시작 → rename / drop views / comments 로그
2. `\dt meta_*` — BASE TABLE만, 구명 VIEW 없음
3. API 응답 필드가 `std_word_nm`, `subject_area_id`, `login_id` 등 표준명
