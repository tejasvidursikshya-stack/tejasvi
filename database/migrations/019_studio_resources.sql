ALTER TABLE ai_studio_drafts ADD COLUMN resources_shared_at DATETIME(3) NULL, ADD INDEX ix_studio_course_release(imported_course_id,resources_shared_at);
