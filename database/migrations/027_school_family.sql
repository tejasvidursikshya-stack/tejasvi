CREATE TABLE emis_guardians (
 org_id CHAR(36) NOT NULL,
 user_id CHAR(36) NOT NULL,
 student_person_id VARCHAR(64) NOT NULL,
 relation VARCHAR(40) NOT NULL DEFAULT 'Guardian',
 created_by CHAR(36),
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(org_id,user_id,student_person_id),
 INDEX idx_guardian_child(org_id,student_person_id),
 FOREIGN KEY(org_id,user_id) REFERENCES institution_memberships(org_id,user_id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE emis_sms_outbox (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 org_id CHAR(36) NOT NULL,
 phone VARCHAR(20) NOT NULL,
 message VARCHAR(480) NOT NULL,
 kind VARCHAR(32) NOT NULL,
 record_id VARCHAR(64),
 status ENUM('Queued','Sent','Failed','Not configured') NOT NULL DEFAULT 'Queued',
 error VARCHAR(255),
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 sent_at DATETIME(3),
 UNIQUE KEY uq_sms_once(org_id,kind,record_id,phone),
 INDEX idx_sms_org(org_id,created_at),
 FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE emis_online_payments (
 id CHAR(36) PRIMARY KEY,
 org_id CHAR(36) NOT NULL,
 invoice_id VARCHAR(64) NOT NULL,
 user_id CHAR(36) NOT NULL,
 provider VARCHAR(16) NOT NULL,
 amount DECIMAL(12,2) NOT NULL,
 status ENUM('Started','Complete','Failed') NOT NULL DEFAULT 'Started',
 reference VARCHAR(64),
 payment_record_id VARCHAR(64),
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 completed_at DATETIME(3),
 INDEX idx_online_invoice(org_id,invoice_id),
 FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
