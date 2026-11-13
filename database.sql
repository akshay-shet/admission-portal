-- Student Portal database schema
-- Import with:  mysql -u root -p < database.sql   (or via phpMyAdmin > Import)

CREATE DATABASE IF NOT EXISTS student_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE student_portal;

-- ---------------------------------------------------------------
-- Admin users  (default login: admin / admin  -- change after first login)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO admins (username, password) VALUES ('admin', '$2y$10$t9x8mz8QCB8bgvn83/iVVeHcyMo0olh0l4CajaDx8iS/K/pHK9T1S')
  ON DUPLICATE KEY UPDATE username = username;

-- ---------------------------------------------------------------
-- Lookup tables
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  board_name VARCHAR(100) NOT NULL,
  level VARCHAR(20) DEFAULT ''
);
CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_name VARCHAR(100) NOT NULL,
  level VARCHAR(20) DEFAULT ''
);
CREATE TABLE IF NOT EXISTS combinations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  combination_name VARCHAR(100) NOT NULL,
  level VARCHAR(20) DEFAULT ''
);

INSERT INTO boards (id, board_name, level) VALUES
 (1,'BISE','PUC'),(2,'BOSSE','SSLC'),(3,'BOSSE','PUC'),(7,'KSOU','Degree');
INSERT INTO courses (id, course_name, level) VALUES
 (5,'B.COM','Degree'),(6,'BA','Degree'),(7,'BBA','Degree'),(8,'BCA','Degree'),(9,'BSC','Degree'),
 (10,'MA','Degree'),(11,'M.COM','Degree'),(12,'M.B.A','Degree'),(13,'M.C.A','Degree');
INSERT INTO combinations (id, combination_name, level) VALUES
 (1,'PCMC','PUC'),(3,'PCMB','PUC'),(5,'CEBA','PUC'),(6,'HEBA','PUC'),(7,'HEPS','PUC'),(8,'SSLC',''),(10,'BOSSE','');

-- ---------------------------------------------------------------
-- Students
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sslc_students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(20) UNIQUE,
  student_name VARCHAR(150) NOT NULL,
  father_name VARCHAR(150) DEFAULT '',
  mother_name VARCHAR(150) DEFAULT '',
  dob DATE NULL,
  age VARCHAR(5) DEFAULT '0',
  category VARCHAR(50) DEFAULT '',
  caste VARCHAR(50) DEFAULT '',
  subcaste VARCHAR(50) DEFAULT '',
  gender VARCHAR(10) DEFAULT 'Male',
  aadhar_card VARCHAR(30) DEFAULT '',
  address TEXT,
  mobile VARCHAR(20) DEFAULT '',
  whatsapp VARCHAR(20) DEFAULT '',
  email VARCHAR(150) DEFAULT '',
  nationality VARCHAR(50) DEFAULT '',
  religion VARCHAR(50) DEFAULT '',
  mother_tongue VARCHAR(50) DEFAULT '',
  admission_year VARCHAR(10) DEFAULT '',
  admission_batch VARCHAR(20) DEFAULT '',
  admission_number VARCHAR(50) DEFAULT '',
  register_number VARCHAR(50) DEFAULT '',
  photo VARCHAR(255) DEFAULT '',
  board_id VARCHAR(100) DEFAULT '',
  course_id VARCHAR(100) DEFAULT '',
  combination_id VARCHAR(100) DEFAULT '',
  language1 VARCHAR(50) DEFAULT '',
  language2 VARCHAR(50) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS puc_students LIKE sslc_students;
ALTER TABLE puc_students
  ADD sslc_register_number VARCHAR(50) DEFAULT '',
  ADD sslc_passed_year VARCHAR(10) DEFAULT '',
  ADD sslc_board_name VARCHAR(100) DEFAULT '',
  ADD sslc_marks_card VARCHAR(255) DEFAULT '';

CREATE TABLE IF NOT EXISTS degree_students LIKE puc_students;
ALTER TABLE degree_students
  ADD puc_register_number VARCHAR(50) DEFAULT '',
  ADD puc_passed_year VARCHAR(10) DEFAULT '',
  ADD puc_board_name VARCHAR(100) DEFAULT '',
  ADD puc_marks_card VARCHAR(255) DEFAULT '',
  ADD year VARCHAR(10) DEFAULT '',
  ADD batch VARCHAR(20) DEFAULT '',
  ADD sem VARCHAR(10) DEFAULT '';

CREATE TABLE IF NOT EXISTS pg_students LIKE degree_students;
ALTER TABLE pg_students
  ADD degree_register_number VARCHAR(50) DEFAULT '',
  ADD degree_passed_year VARCHAR(10) DEFAULT '',
  ADD degree_board_name VARCHAR(100) DEFAULT '',
  ADD degree_marks_card VARCHAR(255) DEFAULT '',
  ADD degree_course_id VARCHAR(100) DEFAULT '',
  ADD degree_combination_id VARCHAR(100) DEFAULT '';

-- ---------------------------------------------------------------
-- Fee installments
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS installments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL,
  student_name VARCHAR(150) DEFAULT '',
  admission_year VARCHAR(10) DEFAULT '',
  admission_batch VARCHAR(20) DEFAULT '',
  admission_number VARCHAR(50) DEFAULT '',
  register_number VARCHAR(50) DEFAULT '',
  phone VARCHAR(20) DEFAULT '',
  course VARCHAR(50) DEFAULT '',
  board_id VARCHAR(100) DEFAULT '',
  course_id VARCHAR(100) DEFAULT '',
  combination_id VARCHAR(100) DEFAULT '',
  total_fees DECIMAL(10,2) DEFAULT 0,
  installment_no INT DEFAULT 1,
  amount DECIMAL(10,2) DEFAULT 0,
  balance DECIMAL(10,2) DEFAULT 0,
  payment_date DATE,
  status VARCHAR(20) DEFAULT 'Paid',
  payment_mode VARCHAR(20) DEFAULT 'Cash',
  cash_amount DECIMAL(10,2) NULL,
  online_amount DECIMAL(10,2) NULL,
  reference VARCHAR(100) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (student_id),
  INDEX (payment_date)
);

-- ---------------------------------------------------------------
-- Sample (fictional) data so every screen has something to show.
-- Delete these rows before going live.
-- ---------------------------------------------------------------
INSERT INTO sslc_students (student_id, student_name, father_name, gender, dob, age, category, mobile, email, admission_number, board_id, course_id, combination_id, language1, language2)
VALUES ('SSL001','SAMPLE STUDENT A','Sample Father','Male','2010-05-14','16','GENERAL','9000000001','sample.a@example.com','2026SSLCJUNE01','State','SSLC','SSLC','KANNADA','ENGLISH');
INSERT INTO puc_students (student_id, student_name, gender, mobile, admission_number, board_id, course_id, combination_id)
VALUES ('PUC001','SAMPLE STUDENT B','Female','9000000002','2026JUNCOM01','STATE','PUC','COMMERCE');
INSERT INTO degree_students (student_id, student_name, gender, mobile, admission_number, board_id, course_id, year, batch, sem)
VALUES ('DEG001','SAMPLE STUDENT C','Male','9000000003','2026JANBBA01','7','7','2026','JAN','1');
INSERT INTO pg_students (student_id, student_name, gender, mobile, nationality, board_id, course_id, combination_id, language1, language2)
VALUES ('PGO001','SAMPLE STUDENT D','Female','9000000004','INDIAN','State','MA','MA','Kannada','English');
INSERT INTO installments (student_id, student_name, admission_number, phone, course, board_id, course_id, combination_id, total_fees, installment_no, amount, balance, payment_date, status, payment_mode)
VALUES ('SSL001','SAMPLE STUDENT A','2026SSLCJUNE01','9000000001','SSLC','State','SSLC','SSLC',30000,1,10000,20000,CURDATE(),'Paid','Cash');
