CREATE TABLE tutoring_decks (
 id CHAR(36) PRIMARY KEY, org_id CHAR(36) NOT NULL, author_id CHAR(36) NOT NULL,
 kind ENUM('cue','flash') NOT NULL, title VARCHAR(140) NOT NULL, theme ENUM('ocean','amber','iris') NOT NULL,
 cards_json JSON NOT NULL, revision INT UNSIGNED NOT NULL DEFAULT 1,
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 INDEX ix_tutoring_author(org_id,author_id,updated_at),
 FOREIGN KEY(org_id) REFERENCES organizations(id), FOREIGN KEY(author_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE tutoring_course_decks (
 deck_id CHAR(36) NOT NULL, course_id CHAR(36) NOT NULL, title VARCHAR(140) NOT NULL, theme ENUM('ocean','amber','iris') NOT NULL,
 cards_json JSON NOT NULL, revision INT UNSIGNED NOT NULL, shared_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(deck_id,course_id), INDEX ix_tutoring_course(course_id,shared_at),
 FOREIGN KEY(deck_id) REFERENCES tutoring_decks(id) ON DELETE CASCADE,
 FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;
