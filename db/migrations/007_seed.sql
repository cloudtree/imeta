-- ============================================================
-- 007_seed.sql  –  기본 마스터 데이터
-- ============================================================

INSERT INTO subject_area (subject_id, subject_name, description, use_yn)
VALUES
    ('STD01', '표준', '표준 주제영역', 'Y'),
    ('DEFAULT', '기본', '기본 주제영역', 'Y')
ON CONFLICT (subject_id) DO NOTHING;

INSERT INTO domain_groups (group_nm, group_desc, use_yn)
VALUES
    ('명칭', '명칭 도메인 그룹', 'Y'),
    ('코드', '코드 도메인 그룹', 'Y'),
    ('여부', '여부 도메인 그룹', 'Y'),
    ('번호', '번호 도메인 그룹', 'Y'),
    ('일자', '일자 도메인 그룹', 'Y'),
    ('금액', '금액 도메인 그룹', 'Y')
ON CONFLICT (group_nm) DO NOTHING;
