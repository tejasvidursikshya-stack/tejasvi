CREATE TABLE demo_requests (
 id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
 request_key CHAR(36) CHARACTER SET ascii NOT NULL,
 payload_hash CHAR(64) CHARACTER SET ascii NOT NULL,
 contact_name VARCHAR(100) NOT NULL,
 contact_email VARCHAR(200) NOT NULL,
 organization_name VARCHAR(160) NOT NULL,
 audience ENUM('school','college','corporate') NOT NULL,
 interests VARCHAR(600) NOT NULL DEFAULT '',
 consent_at DATETIME(3) NOT NULL,
 status ENUM('new','contacted','closed') NOT NULL DEFAULT 'new',
 created_at DATETIME(3) NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 UNIQUE KEY uq_demo_request_retry (request_key),
 KEY ix_demo_requests_filter (status,created_at,id),
 KEY ix_demo_requests_date (created_at,id)
) ENGINE=InnoDB;
