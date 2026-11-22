CREATE TABLE ai_workspace_settings (
  org_id CHAR(36) PRIMARY KEY, staff_enabled BOOLEAN NOT NULL, learner_enabled BOOLEAN NOT NULL,
  narration_enabled BOOLEAN NOT NULL, avatar_enabled BOOLEAN NOT NULL, updated_by CHAR(36) NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY(org_id) REFERENCES organizations(id), FOREIGN KEY(updated_by) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE ai_narrations (
  id CHAR(36) PRIMARY KEY, org_id CHAR(36) NOT NULL, author_id CHAR(36) NOT NULL, fingerprint CHAR(64) NOT NULL,
  title VARCHAR(140) NOT NULL, script_text TEXT NOT NULL, spoken_text TEXT NOT NULL, language VARCHAR(16) NOT NULL,
  voice VARCHAR(32) NOT NULL, model VARCHAR(100) NOT NULL, wav MEDIUMBLOB NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_ai_voice(org_id,author_id,fingerprint), INDEX ix_ai_voice_author(org_id,author_id,created_at),
  FOREIGN KEY(org_id) REFERENCES organizations(id), FOREIGN KEY(author_id) REFERENCES users(id)
) ENGINE=InnoDB;
