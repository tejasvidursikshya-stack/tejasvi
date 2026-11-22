CREATE TABLE mobile_push_tokens (
 token VARCHAR(255) PRIMARY KEY,
 mobile_session_id CHAR(36) NOT NULL,
 user_id CHAR(36) NOT NULL,
 platform VARCHAR(10) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_push_session(mobile_session_id),
 INDEX idx_push_user(user_id),
 FOREIGN KEY(mobile_session_id) REFERENCES mobile_sessions(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE mobile_push_sent (
 user_id CHAR(36) NOT NULL,
 org_id CHAR(36) NOT NULL,
 item_key CHAR(64) NOT NULL,
 sent_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(user_id,org_id,item_key),
 INDEX idx_push_sent_at(sent_at),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB
