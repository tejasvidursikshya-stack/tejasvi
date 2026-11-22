CREATE TABLE mobile_sessions (
 id CHAR(36) PRIMARY KEY,
 user_id CHAR(36) NOT NULL,
 parent_hash CHAR(64) NOT NULL,
 access_hash CHAR(64) NOT NULL,
 refresh_hash CHAR(64) NOT NULL,
 device_name VARCHAR(100) NOT NULL,
 access_expires_at DATETIME(3) NOT NULL,
 refresh_expires_at DATETIME(3) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 refreshed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_mobile_access(access_hash),
 UNIQUE KEY uq_mobile_refresh(refresh_hash),
 UNIQUE KEY uq_mobile_parent(parent_hash),
 INDEX idx_mobile_user(user_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(parent_hash) REFERENCES sessions(token_hash) ON DELETE CASCADE
) ENGINE=InnoDB;
