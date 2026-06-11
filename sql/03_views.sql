 
-- Driving School Booking & Payment System
-- 03_views.sql  -  7 views.  Every application query that uses a JOIN
-- is implemented here as a view (requirement: minimum 5 views).
-- Character set: UTF-8
 
USE driving_school;

CREATE OR REPLACE VIEW driving_school.view_customers AS
SELECT
	c.customer_id,
	c.first_name,
	c.last_name,
	c.date_became_customer,
	c.date_of_birth,
	c.email_address,
	c.phone_number,
	c.cell_mobile_phone_number,
	c.amount_outstanding,
	c.other_customer_details,
	c.customer_status_code,
	s.customer_status_description,
	a.address_id,
	a.line_1_number_building,
	a.line_2_number_street,
	a.line_3_area_locality,
	a.city,
	a.zip_postcode,
	a.state_province_county,
	a.country,
	a.other_address_details
FROM driving_school.customers c
LEFT JOIN driving_school.addresses a ON c.customer_address_id = a.address_id
LEFT JOIN driving_school.ref_customer_status s ON c.customer_status_code = s.customer_status_code;

CREATE OR REPLACE VIEW driving_school.view_staff AS
SELECT
	st.staff_id,
	st.nickname,
	st.first_name,
	st.middle_name,
	st.last_name,
	st.date_of_birth,
	st.date_joined_staff,
	st.date_left_staff,
	st.other_staff_details,
	st.customer_status_code,
	s.customer_status_description,
	a.address_id,
	a.line_1_number_building,
	a.line_2_number_street,
	a.city,
	a.zip_postcode,
	a.state_province_county,
	a.country
FROM driving_school.staff st
LEFT JOIN driving_school.addresses a ON st.staff_address_id = a.address_id
LEFT JOIN driving_school.ref_customer_status s ON st.customer_status_code = s.customer_status_code;

CREATE OR REPLACE VIEW driving_school.view_lessons AS
SELECT
	l.lesson_id,
	l.customer_id,
	c.first_name AS customer_first_name,
	c.last_name AS customer_last_name,
	l.staff_id,
	st.first_name AS staff_first_name,
	st.last_name AS staff_last_name,
	l.vehicle_id,
	v.vehicle_details,
	l.lesson_date,
	l.lesson_time,
	(l.lesson_date + l.lesson_time) AS lesson_datetime,
	l.price,
	l.other_lesson_details,
	l.lesson_status_code,
	ls.lesson_status_description
FROM driving_school.lessons l
LEFT JOIN driving_school.ref_lesson_status ls ON l.lesson_status_code = ls.lesson_status_code
LEFT JOIN driving_school.customers c ON l.customer_id = c.customer_id
LEFT JOIN driving_school.staff st ON l.staff_id = st.staff_id
LEFT JOIN driving_school.vehicles v ON l.vehicle_id = v.vehicle_id;

CREATE OR REPLACE VIEW driving_school.view_customer_payments AS
SELECT
	cp.customer_id,
	c.first_name,
	c.last_name,
	cp.datetime_payment,
	cp.payment_method_code,
	pm.payment_method_description,
	cp.amount_payment,
	cp.other_payment_details
FROM driving_school.customer_payments cp
LEFT JOIN driving_school.ref_payment_methods pm ON cp.payment_method_code = pm.payment_method_code
LEFT JOIN driving_school.customers c ON cp.customer_id = c.customer_id;

CREATE OR REPLACE VIEW driving_school.view_user_roles AS
SELECT
	u.user_id,
	u.email,
	u.full_name,
	u.is_active,
	u.staff_id,
	st.first_name AS staff_first_name,
	st.last_name AS staff_last_name,
	u.customer_id,
	c.first_name AS customer_first_name,
	c.last_name AS customer_last_name,
	ur.role_code,
	r.role_name,
	ur.assigned_at
FROM driving_school.app_users u
LEFT JOIN driving_school.app_user_roles ur ON u.user_id = ur.user_id
LEFT JOIN driving_school.app_roles r ON ur.role_code = r.role_code
LEFT JOIN driving_school.staff st ON u.staff_id = st.staff_id
LEFT JOIN driving_school.customers c ON u.customer_id = c.customer_id;

CREATE OR REPLACE VIEW driving_school.view_customer_financials AS
SELECT
	c.customer_id,
	c.first_name,
	c.last_name,
	c.amount_outstanding,
	COALESCE(p.total_paid,0::numeric) AS total_paid,
	p.last_payment
FROM driving_school.customers c
LEFT JOIN (
	SELECT customer_id, SUM(amount_payment) AS total_paid, MAX(datetime_payment) AS last_payment
	FROM driving_school.customer_payments
	GROUP BY customer_id
) p ON c.customer_id = p.customer_id;

CREATE OR REPLACE VIEW driving_school.view_lessons_schedule AS
SELECT
	l.lesson_id,
	(l.lesson_date + l.lesson_time) AS lesson_datetime,
	l.lesson_date,
	l.lesson_time,
	ls.lesson_status_description,
	l.price,
	l.customer_id,
	c.first_name AS customer_first_name,
	c.last_name AS customer_last_name,
	c.email_address AS customer_email,
	l.staff_id,
	st.first_name AS staff_first_name,
	st.last_name AS staff_last_name,
	v.vehicle_details
FROM driving_school.lessons l
LEFT JOIN driving_school.ref_lesson_status ls ON l.lesson_status_code = ls.lesson_status_code
LEFT JOIN driving_school.customers c ON l.customer_id = c.customer_id
LEFT JOIN driving_school.staff st ON l.staff_id = st.staff_id
LEFT JOIN driving_school.vehicles v ON l.vehicle_id = v.vehicle_id;

 