ALTER TABLE ai_workspace_settings ADD COLUMN gamma_enabled BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN gamma_theme_id VARCHAR(160) NULL;
CREATE TABLE gamma_presentations (
 id CHAR(36) PRIMARY KEY, org_id CHAR(36) NOT NULL, author_id CHAR(36) NOT NULL,
 request_id CHAR(36) NOT NULL, input_hash CHAR(64) NOT NULL, title VARCHAR(160) NOT NULL, brief JSON NOT NULL,
 state ENUM('submitting','pending','ready','failed','uncertain') NOT NULL DEFAULT 'submitting',
 provider_id VARCHAR(200) NULL, gamma_url VARCHAR(2048) NULL, file_key VARCHAR(64) NULL,
 file_bytes INT UNSIGNED NULL, credits INT UNSIGNED NULL, message VARCHAR(600) NULL, lease_until DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_gamma_request(org_id,author_id,request_id), INDEX ix_gamma_library(org_id,author_id,created_at),
 FOREIGN KEY(org_id) REFERENCES organizations(id), FOREIGN KEY(author_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE gamma_course_copies (
 deck_id CHAR(36) NOT NULL,course_id CHAR(36) NOT NULL,material_id CHAR(36) NOT NULL,
 PRIMARY KEY(deck_id,course_id),UNIQUE KEY uq_gamma_material(material_id),
 FOREIGN KEY(deck_id) REFERENCES gamma_presentations(id) ON DELETE CASCADE,
 FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,
 FOREIGN KEY(material_id) REFERENCES course_materials(id) ON DELETE CASCADE
) ENGINE=InnoDB;
