CREATE TABLE learning_results (
 id CHAR(36) PRIMARY KEY, course_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL,
 revision INT NOT NULL, label VARCHAR(120) NOT NULL, score DECIMAL(12,2) NOT NULL,
 max_score DECIMAL(12,2) NOT NULL, source_digest CHAR(64) NOT NULL, snapshot JSON NOT NULL,
 approved_by CHAR(36) NOT NULL, approved_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_learning_result_revision(course_id,user_id,revision),
 FOREIGN KEY(course_id) REFERENCES courses(id), FOREIGN KEY(user_id) REFERENCES users(id),
 FOREIGN KEY(approved_by) REFERENCES users(id),
 CHECK(score>=0 AND score<=max_score AND max_score>0)
) ENGINE=InnoDB;
CREATE TABLE learning_result_exports (
 result_id CHAR(36) PRIMARY KEY, org_id CHAR(36) NOT NULL, exam_id VARCHAR(64) NOT NULL,
 student_id VARCHAR(64) NOT NULL, record_id VARCHAR(64) NOT NULL,
 exported_by CHAR(36) NOT NULL, exported_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_learning_result_record(org_id,record_id),
 FOREIGN KEY(result_id) REFERENCES learning_results(id),
 FOREIGN KEY(org_id,record_id) REFERENCES emis_records(org_id,id),
 FOREIGN KEY(exported_by) REFERENCES users(id)
) ENGINE=InnoDB;
