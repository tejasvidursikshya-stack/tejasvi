-- Question types, question bank, exam rules, unit release/prerequisites and grading policy.
ALTER TABLE course_units
  ADD COLUMN quiz_settings JSON NULL,
  ADD COLUMN release_at DATETIME(3) NULL,
  ADD COLUMN prerequisite_unit_id CHAR(36) NULL,
  ADD COLUMN prerequisite_score INT NULL;
ALTER TABLE courses ADD COLUMN grading_policy JSON NULL;
-- One row per started attempt. The served questions (with answers and choice order) stay on the server.
CREATE TABLE quiz_sessions (
  id CHAR(36) PRIMARY KEY,
  unit_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  quiz_revision CHAR(36) NOT NULL,
  served JSON NOT NULL,
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deadline_at DATETIME(3) NULL,
  submitted_at DATETIME(3) NULL,
  attempt_id CHAR(36) NULL,
  INDEX(unit_id,user_id),
  FOREIGN KEY(unit_id) REFERENCES course_units(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE quiz_extensions (
  unit_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  extra_minutes INT NOT NULL DEFAULT 0,
  extra_attempts INT NOT NULL DEFAULT 0,
  closes_at DATETIME(3) NULL,
  reason VARCHAR(300) NOT NULL DEFAULT '',
  granted_by CHAR(36) NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY(unit_id,user_id),
  FOREIGN KEY(unit_id) REFERENCES course_units(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE question_bank (
  id CHAR(36) PRIMARY KEY,
  org_id CHAR(36) NOT NULL,
  course_id CHAR(36) NULL,
  tags VARCHAR(400) NOT NULL DEFAULT '',
  difficulty ENUM('easy','medium','hard') NOT NULL DEFAULT 'medium',
  question JSON NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  archived TINYINT NOT NULL DEFAULT 0,
  INDEX(org_id,archived),
  FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB;
