CREATE TABLE ai_course_films (
 id CHAR(36) PRIMARY KEY,org_id CHAR(36) NOT NULL,course_id CHAR(36) NOT NULL,author_id CHAR(36) NOT NULL,
 title VARCHAR(140) NOT NULL,mime VARCHAR(32) NOT NULL,fingerprint CHAR(64) NOT NULL,movie MEDIUMBLOB NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),INDEX ix_course_films(org_id,course_id,created_at),
 UNIQUE KEY uq_course_film(course_id,fingerprint),FOREIGN KEY(org_id) REFERENCES organizations(id),
 FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,FOREIGN KEY(author_id) REFERENCES users(id)
) ENGINE=InnoDB;
