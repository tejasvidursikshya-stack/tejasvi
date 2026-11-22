CREATE TABLE live_classes (
 id CHAR(36) PRIMARY KEY,
 course_id CHAR(36) NOT NULL,
 title VARCHAR(160) NOT NULL,
 agenda TEXT NOT NULL,
 meeting_url VARCHAR(2000) NOT NULL,
 starts_at DATETIME(3) NOT NULL,
 ends_at DATETIME(3) NOT NULL,
 status ENUM('draft','published','cancelled') NOT NULL DEFAULT 'draft',
 version INT NOT NULL DEFAULT 1,
 created_by CHAR(36) NOT NULL,
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX idx_live_course_start(course_id,starts_at),
 FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,
 FOREIGN KEY(created_by) REFERENCES users(id)
) ENGINE=InnoDB;
