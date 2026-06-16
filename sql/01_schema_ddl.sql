-- 
-- Driving School Booking & Payment System
-- 01_schema_ddl.sql  -  Data Definition Language for postgreSQL 15
-- Character set: UTF-8

DROP SCHEMA IF EXISTS driving_school CASCADE;
CREATE SCHEMA driving_school;
SET search_path TO driving_school;

CREATE TABLE customer_Status (
	customer_status_code        VARCHAR(10)  NOT NULL,
	customer_status_description VARCHAR(100) NOT NULL,
	CONSTRAINT pk_customer_status PRIMARY KEY (customer_status_code)
);

CREATE TABLE lesson_Status (
	lesson_status_code        VARCHAR(10)  NOT NULL,
	lesson_status_description VARCHAR(100) NOT NULL,
	CONSTRAINT pk_lesson_status PRIMARY KEY (lesson_status_code)
);

CREATE TABLE payment_Methods (
	payment_method_code        VARCHAR(10)  NOT NULL,
	payment_method_description VARCHAR(100) NOT NULL,
	CONSTRAINT pk_payment_methods PRIMARY KEY (payment_method_code)
);

CREATE TABLE addresses (
	address_id             INT GENERATED ALWAYS AS IDENTITY,
	line_1_number_building VARCHAR(100) NOT NULL,
	line_2_number_street   VARCHAR(100),
	line_3_area_locality   VARCHAR(100),
	city                   VARCHAR(100) NOT NULL,
	zip_postcode           VARCHAR(20)  NOT NULL,
	state_province_county  VARCHAR(100),
	country                VARCHAR(100) NOT NULL DEFAULT 'Canada',
	other_address_details  TEXT,
	CONSTRAINT pk_addresses PRIMARY KEY (address_id)
);

CREATE TABLE vehicles (
	vehicle_id      INT GENERATED ALWAYS AS IDENTITY,
	vehicle_details VARCHAR(100) NOT NULL,
	CONSTRAINT pk_vehicles PRIMARY KEY (vehicle_id)
);

CREATE TABLE staff (
	staff_id            INT GENERATED ALWAYS AS IDENTITY,
	staff_address_id    INT,
	customer_status_code VARCHAR(10) NOT NULL,
	nickname            VARCHAR(50),
	first_name          VARCHAR(50) NOT NULL,
	middle_name         VARCHAR(50),
	last_name           VARCHAR(50) NOT NULL,
	date_of_birth       DATE,
	date_joined_staff   TIMESTAMP NOT NULL,
	date_left_staff     TIMESTAMP,
	other_staff_details TEXT,
	CONSTRAINT pk_staff PRIMARY KEY (staff_id),
	CONSTRAINT fk_staff_address
		FOREIGN KEY (staff_address_id) REFERENCES addresses (address_id)
		ON UPDATE CASCADE ON DELETE SET NULL,
	CONSTRAINT fk_staff_status
		FOREIGN KEY (customer_status_code) REFERENCES customer_Status (customer_status_code)
		ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT chk_staff_left_after_join
		CHECK (date_left_staff IS NULL OR date_left_staff >= date_joined_staff)
);

CREATE TABLE customers (
	customer_id          INT GENERATED ALWAYS AS IDENTITY,
	customer_address_id  INT,
	customer_status_code VARCHAR(10) NOT NULL,
	date_became_customer DATE NOT NULL,
	date_of_birth        DATE NOT NULL,
	first_name           VARCHAR(50) NOT NULL,
	last_name            VARCHAR(50) NOT NULL,
	amount_outstanding   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
	email_address        VARCHAR(150),
	phone_number         VARCHAR(30),
	cell_mobile_phone_number VARCHAR(30),
	other_customer_details   TEXT,
	CONSTRAINT pk_customers PRIMARY KEY (customer_id),
	CONSTRAINT uq_customers_email UNIQUE (email_address),
	CONSTRAINT fk_customer_address
		FOREIGN KEY (customer_address_id) REFERENCES addresses (address_id)
		ON UPDATE CASCADE ON DELETE SET NULL,
	CONSTRAINT fk_customer_status
		FOREIGN KEY (customer_status_code) REFERENCES customer_status (customer_status_code)
		ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT chk_customer_outstanding_nonneg
		CHECK (amount_outstanding >= 0)
);

CREATE TABLE customer_payments (
	customer_id         INT NOT NULL,
	datetime_payment    TIMESTAMP NOT NULL,
	payment_method_code VARCHAR(10) NOT NULL,
	amount_payment      DECIMAL(10,2) NOT NULL,
	other_payment_details TEXT,
	CONSTRAINT pk_customer_payments PRIMARY KEY (customer_id, datetime_payment),
	CONSTRAINT fk_payment_customer
		FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
		ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT fk_payment_method
		FOREIGN KEY (payment_method_code) REFERENCES payment_methods (payment_method_code)
		ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT chk_payment_positive
		CHECK (amount_payment > 0)
);

CREATE TABLE lessons (
	lesson_id          INT GENERATED ALWAYS AS IDENTITY,
	customer_id        INT NOT NULL,
	lesson_status_code VARCHAR(10) NOT NULL,
	staff_id           INT,
	vehicle_id         INT,
	lesson_date        DATE NOT NULL,
	lesson_time        TIME NOT NULL,
	price              DECIMAL(10,2) NOT NULL,
	other_lesson_details TEXT,
	CONSTRAINT pk_lessons PRIMARY KEY (lesson_id),
	CONSTRAINT fk_lesson_customer
		FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
		ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT fk_lesson_status
		FOREIGN KEY (lesson_status_code) REFERENCES lesson_status (lesson_status_code)
		ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT fk_lesson_staff
		FOREIGN KEY (staff_id) REFERENCES staff (staff_id)
		ON UPDATE CASCADE ON DELETE SET NULL,
	CONSTRAINT fk_lesson_vehicle
		FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id)
		ON UPDATE CASCADE ON DELETE SET NULL,
	CONSTRAINT chk_lesson_price_nonneg
		CHECK (price >= 0)
);

CREATE INDEX ix_lessons_customer     ON lessons (customer_id);
CREATE INDEX ix_lessons_staff_slot   ON lessons (staff_id, lesson_date, lesson_time);
CREATE INDEX ix_lessons_vehicle_slot ON lessons (vehicle_id, lesson_date, lesson_time);
CREATE INDEX ix_lessons_date         ON lessons (lesson_date);
CREATE INDEX ix_customers_name       ON customers (last_name, first_name);
CREATE INDEX ix_staff_name           ON staff (last_name, first_name);


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

-- SAMPLE DATA (reference + operational seed data)
-- Run AFTER 01_schema_ddl.sql.  Triggers in 04 should be loaded
-- AFTER this file if you want the historic amount_outstanding values kept as-is;
-- otherwise load triggers first and let them recompute balances. 