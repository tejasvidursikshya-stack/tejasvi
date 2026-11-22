ALTER TABLE course_materials
 ADD COLUMN lesson_id CHAR(36) NULL,
 ADD COLUMN resource_type ENUM('presentation','activity','worksheet','facilitation','resource') NOT NULL DEFAULT 'presentation',
 ADD COLUMN visibility ENUM('learners','teachers') NOT NULL DEFAULT 'learners',
 ADD INDEX idx_material_lesson(lesson_id),
 ADD FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE;
