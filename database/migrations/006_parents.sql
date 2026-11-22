ALTER TABLE memberships MODIFY role ENUM('admin','teacher','student','employee','parent') NOT NULL;
CREATE TABLE parent_students (
 org_id CHAR(36) NOT NULL,
 parent_id CHAR(36) NOT NULL,
 student_id CHAR(36) NOT NULL,
 relationship VARCHAR(60) NOT NULL DEFAULT 'Parent / guardian',
 created_by CHAR(36) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(org_id,parent_id,student_id),
 INDEX idx_parent_child(org_id,student_id),
 FOREIGN KEY(org_id,parent_id) REFERENCES memberships(org_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(org_id,student_id) REFERENCES memberships(org_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(created_by) REFERENCES users(id),
 CHECK(parent_id<>student_id)
) ENGINE=InnoDB;
