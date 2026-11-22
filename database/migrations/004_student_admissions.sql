ALTER TABLE student_profiles ADD COLUMN details JSON NULL, ADD COLUMN photo_data MEDIUMBLOB NULL;
ALTER TABLE memberships ADD COLUMN display_name VARCHAR(120) NOT NULL DEFAULT '';
CREATE INDEX idx_student_admission ON student_profiles(org_id,admission_number);
