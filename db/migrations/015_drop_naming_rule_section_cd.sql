-- 명명규칙: 섹션코드(section_cd) 제거, 시스템·규칙제목 단위 유니크

ALTER TABLE meta_naming_rule_m DROP CONSTRAINT IF EXISTS meta_naming_rule_m_sys_section_uk;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meta_naming_rule_m'
      AND column_name = 'section_cd'
  ) THEN
    ALTER TABLE meta_naming_rule_m DROP COLUMN section_cd;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meta_naming_rule_m_sys_title_uk'
  ) THEN
    ALTER TABLE meta_naming_rule_m
      ADD CONSTRAINT meta_naming_rule_m_sys_title_uk UNIQUE (system_id, rule_title_nm);
  END IF;
END $$;
