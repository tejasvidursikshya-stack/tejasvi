CREATE TABLE users (
 id CHAR(36) PRIMARY KEY, email VARCHAR(254) NOT NULL UNIQUE,
 name VARCHAR(120) NOT NULL, password_hash VARCHAR(255) NOT NULL,
 platform_admin BOOLEAN NOT NULL DEFAULT FALSE,
 must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
CREATE TABLE sessions (
 token_hash CHAR(64) PRIMARY KEY, user_id CHAR(36) NOT NULL,
 expires_at DATETIME(3) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX idx_sessions_user(user_id), INDEX idx_sessions_expiry(expires_at),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE rate_limits (
 bucket CHAR(64) PRIMARY KEY, attempts INT NOT NULL, reset_at BIGINT NOT NULL,
 INDEX idx_rate_limits_reset(reset_at)
) ENGINE=InnoDB;
CREATE TABLE organizations (
 id CHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL,
 kind ENUM('school','corporate') NOT NULL, address VARCHAR(500) NOT NULL DEFAULT '',
 contact_email VARCHAR(254) NOT NULL DEFAULT '', phone VARCHAR(40) NOT NULL DEFAULT '',
 registration_number VARCHAR(100) NOT NULL DEFAULT '',
 created_by CHAR(36) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(created_by) REFERENCES users(id), INDEX idx_org_creator(created_by)
) ENGINE=InnoDB;
CREATE TABLE memberships (
 org_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL,
 role ENUM('admin','teacher','student','employee') NOT NULL,
 class_name VARCHAR(100) NOT NULL DEFAULT '', reference_number VARCHAR(100) NOT NULL DEFAULT '',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(org_id,user_id), INDEX idx_memberships_user(user_id),
 FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE quizzes (
 id CHAR(36) PRIMARY KEY, org_id CHAR(36) NOT NULL, author_id CHAR(36) NOT NULL,
 title VARCHAR(160) NOT NULL, revision CHAR(36) NOT NULL,
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_quiz_org(id,org_id), INDEX idx_quizzes_org_author(org_id,author_id),
 FOREIGN KEY(org_id) REFERENCES organizations(id), FOREIGN KEY(author_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE quiz_questions (
 id CHAR(36) PRIMARY KEY, quiz_id CHAR(36) NOT NULL,
 prompt TEXT NOT NULL, options JSON NOT NULL, correct_answer TINYINT NOT NULL,
 position INT NOT NULL, INDEX idx_questions_quiz_position(quiz_id,position),
 FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
 CHECK(correct_answer BETWEEN 0 AND 3)
) ENGINE=InnoDB;
CREATE TABLE courses (
 id CHAR(36) PRIMARY KEY, org_id CHAR(36) NOT NULL, author_id CHAR(36) NOT NULL,
 title VARCHAR(160) NOT NULL, description TEXT NOT NULL, audience VARCHAR(100) NOT NULL,
 status ENUM('draft','published') NOT NULL DEFAULT 'draft', quiz_id CHAR(36) NULL,
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX idx_courses_org_status(org_id,status), INDEX idx_courses_author(author_id),
 FOREIGN KEY(org_id) REFERENCES organizations(id), FOREIGN KEY(author_id) REFERENCES users(id),
 FOREIGN KEY(quiz_id,org_id) REFERENCES quizzes(id,org_id)
) ENGINE=InnoDB;
CREATE TABLE lessons (
 id CHAR(36) PRIMARY KEY, course_id CHAR(36) NOT NULL,
 title VARCHAR(200) NOT NULL, content MEDIUMTEXT NOT NULL, video_url VARCHAR(2000) NOT NULL DEFAULT '',
 position INT NOT NULL, INDEX idx_lessons_course_position(course_id,position),
 FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE lesson_plans (
 id CHAR(36) PRIMARY KEY, org_id CHAR(36) NOT NULL, author_id CHAR(36) NOT NULL,
 title VARCHAR(160) NOT NULL, subject VARCHAR(100) NOT NULL, grade VARCHAR(100) NOT NULL,
 lesson_date DATE NOT NULL, objectives TEXT NOT NULL,
 file_key VARCHAR(100) NOT NULL UNIQUE, file_name VARCHAR(180) NOT NULL, file_size INT NOT NULL,
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX idx_plans_org_author(org_id,author_id),
 FOREIGN KEY(org_id) REFERENCES organizations(id), FOREIGN KEY(author_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE enrollments (
 course_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL,
 started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(course_id,user_id), INDEX idx_enrollments_user(user_id),
 FOREIGN KEY(course_id) REFERENCES courses(id), FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE lesson_completions (
 lesson_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL,
 completed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(lesson_id,user_id), INDEX idx_completions_user(user_id),
 FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE quiz_attempts (
 id CHAR(36) PRIMARY KEY, course_id CHAR(36) NOT NULL, quiz_id CHAR(36) NOT NULL,
 quiz_revision CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL,
 answers JSON NOT NULL, score TINYINT NOT NULL, submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX idx_attempts_course_user(course_id,user_id,submitted_at),
 FOREIGN KEY(course_id) REFERENCES courses(id), FOREIGN KEY(quiz_id) REFERENCES quizzes(id),
 FOREIGN KEY(user_id) REFERENCES users(id), CHECK(score BETWEEN 0 AND 100)
) ENGINE=InnoDB;
