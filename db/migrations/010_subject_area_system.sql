-- 주제영역 시스템 연계
ALTER TABLE subject_area
  ADD COLUMN IF NOT EXISTS system_id INTEGER,
  ADD COLUMN IF NOT EXISTS system_nm VARCHAR(200);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'meta_systems'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'subject_area'
      AND constraint_name = 'subject_area_system_id_fkey'
  ) THEN
    ALTER TABLE subject_area
      ADD CONSTRAINT subject_area_system_id_fkey
      FOREIGN KEY (system_id) REFERENCES meta_systems(system_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subject_area_system_id ON subject_area(system_id);
CREATE INDEX IF NOT EXISTS idx_subject_area_system_nm ON subject_area(system_nm);
