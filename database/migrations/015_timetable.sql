CREATE TABLE timetable_sessions (
 id CHAR(36) PRIMARY KEY,org_id CHAR(36) NOT NULL,course_id CHAR(36) NOT NULL,batch_id CHAR(36) NOT NULL,teacher_id CHAR(36) NOT NULL,
 title VARCHAR(160) NOT NULL,room VARCHAR(120) NOT NULL DEFAULT '',meeting_url VARCHAR(2000) NOT NULL DEFAULT '',
 starts_at DATETIME(3) NOT NULL,ends_at DATETIME(3) NOT NULL,status ENUM('draft','published','cancelled') NOT NULL DEFAULT 'draft',version INT NOT NULL DEFAULT 1,
 created_by CHAR(36) NOT NULL,updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX(org_id,starts_at),INDEX(batch_id,starts_at),INDEX(teacher_id,starts_at),
 FOREIGN KEY(org_id) REFERENCES organizations(id),FOREIGN KEY(course_id) REFERENCES courses(id),FOREIGN KEY(batch_id) REFERENCES batches(id),FOREIGN KEY(teacher_id) REFERENCES users(id),FOREIGN KEY(created_by) REFERENCES users(id)
) ENGINE=InnoDB;
