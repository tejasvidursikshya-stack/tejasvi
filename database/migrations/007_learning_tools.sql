CREATE TABLE course_discussions (
 id CHAR(36) PRIMARY KEY,course_id CHAR(36) NOT NULL,user_id CHAR(36) NOT NULL,
 body TEXT NOT NULL,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 removed_at DATETIME(3) NULL,removed_by CHAR(36) NULL,
 INDEX idx_discussion_course(course_id,created_at),
 FOREIGN KEY(course_id) REFERENCES courses(id),FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(removed_by) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE course_sessions (
 id CHAR(36) PRIMARY KEY,course_id CHAR(36) NOT NULL,created_by CHAR(36) NOT NULL,
 title VARCHAR(160) NOT NULL,starts_at DATETIME(3) NOT NULL,ends_at DATETIME(3) NOT NULL,
 meeting_url VARCHAR(2000) NOT NULL,cancelled BOOLEAN NOT NULL DEFAULT FALSE,
 INDEX idx_session_course(course_id,starts_at),
 FOREIGN KEY(course_id) REFERENCES courses(id),FOREIGN KEY(created_by) REFERENCES users(id),CHECK(ends_at>starts_at)
) ENGINE=InnoDB;
CREATE TABLE organization_policies (
 id CHAR(36) PRIMARY KEY,org_id CHAR(36) NOT NULL,title VARCHAR(160) NOT NULL,
 body TEXT NOT NULL,created_by CHAR(36) NOT NULL,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 archived BOOLEAN NOT NULL DEFAULT FALSE,FOREIGN KEY(org_id) REFERENCES organizations(id),FOREIGN KEY(created_by) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE policy_acknowledgements (
 policy_id CHAR(36) NOT NULL,user_id CHAR(36) NOT NULL,acknowledged_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(policy_id,user_id),FOREIGN KEY(policy_id) REFERENCES organization_policies(id),FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE course_offers (
 course_id CHAR(36) PRIMARY KEY,price_paisa INT NOT NULL,currency CHAR(3) NOT NULL DEFAULT 'NPR',
 payment_instructions VARCHAR(2000) NOT NULL,active BOOLEAN NOT NULL DEFAULT TRUE,
 FOREIGN KEY(course_id) REFERENCES courses(id),CHECK(price_paisa BETWEEN 0 AND 100000000)
) ENGINE=InnoDB;
CREATE TABLE course_orders (
 id CHAR(36) PRIMARY KEY,course_id CHAR(36) NOT NULL,user_id CHAR(36) NOT NULL,
 price_paisa INT NOT NULL,currency CHAR(3) NOT NULL,reference VARCHAR(200) NOT NULL DEFAULT '',
 status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),reviewed_at DATETIME(3) NULL,reviewed_by CHAR(36) NULL,
 UNIQUE(course_id,user_id),FOREIGN KEY(course_id) REFERENCES courses(id),FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE learning_audit (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,org_id CHAR(36) NOT NULL,actor_id CHAR(36) NOT NULL,
 action VARCHAR(60) NOT NULL,target_id CHAR(36) NULL,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX idx_audit_org(org_id,created_at),FOREIGN KEY(org_id) REFERENCES organizations(id),FOREIGN KEY(actor_id) REFERENCES users(id)
) ENGINE=InnoDB;
