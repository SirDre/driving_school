-- 
-- Driving School Booking & Payment System
-- 01_schema_app.sql  -  Data Definition Language for postgreSQL 15
-- Character set: UTF-8

DROP SCHEMA IF EXISTS driving_school CASCADE;
CREATE SCHEMA driving_school;
SET search_path TO driving_school;

-- Additional app tables used by the application (authentication/authorization)
CREATE TABLE app_roles (
	role_code VARCHAR(50) NOT NULL,
	role_name VARCHAR(100) NOT NULL,
	description TEXT,
	CONSTRAINT pk_app_roles PRIMARY KEY (role_code)
);

CREATE TABLE app_users (
	user_id INT GENERATED ALWAYS AS IDENTITY,
	email VARCHAR(255) NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	full_name VARCHAR(200),
	is_active BOOLEAN NOT NULL DEFAULT TRUE,
	staff_id INT,
	customer_id INT,
	failed_attempts INT NOT NULL DEFAULT 0,
	locked_until TIMESTAMP,
	created_at TIMESTAMP NOT NULL DEFAULT NOW(),
	last_login_at TIMESTAMP,
	CONSTRAINT pk_app_users PRIMARY KEY (user_id),
	CONSTRAINT fk_app_users_staff FOREIGN KEY (staff_id) REFERENCES Staff (staff_id) ON DELETE SET NULL,
	CONSTRAINT fk_app_users_customer FOREIGN KEY (customer_id) REFERENCES Customers (customer_id) ON DELETE SET NULL
);

CREATE TABLE app_user_roles (
	user_id INT NOT NULL,
	role_code VARCHAR(50) NOT NULL,
	assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
	CONSTRAINT pk_app_user_roles PRIMARY KEY (user_id, role_code),
	CONSTRAINT fk_aur_user FOREIGN KEY (user_id) REFERENCES app_users (user_id) ON DELETE CASCADE,
	CONSTRAINT fk_aur_role FOREIGN KEY (role_code) REFERENCES app_roles (role_code) ON DELETE RESTRICT
);

CREATE TABLE app_login_audit (
	audit_id BIGINT GENERATED ALWAYS AS IDENTITY,
	email VARCHAR(255),
	user_id INT,
	success BOOLEAN NOT NULL,
	detail VARCHAR(200),
	attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
	CONSTRAINT pk_app_login_audit PRIMARY KEY (audit_id)
);
