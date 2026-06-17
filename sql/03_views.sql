 
-- Driving School Booking & Payment System
-- 03_views.sql  -  7 views.  Every application query that uses a JOIN
-- is implemented here as a view (requirement: minimum 5 views).
-- Character set: UTF-8
 
SET search_path TO driving_school;

CREATE OR REPLACE VIEW view_customers AS
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
FROM customers c
LEFT JOIN addresses a ON c.customer_address_id = a.address_id
LEFT JOIN customer_status s ON c.customer_status_code = s.customer_status_code;

CREATE OR REPLACE VIEW view_staff AS
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
FROM staff st
LEFT JOIN addresses a ON st.staff_address_id = a.address_id
LEFT JOIN customer_status s ON st.customer_status_code = s.customer_status_code;

CREATE OR REPLACE VIEW view_lessons AS
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
FROM lessons l
LEFT JOIN lesson_status ls ON l.lesson_status_code = ls.lesson_status_code
LEFT JOIN customers c ON l.customer_id = c.customer_id
LEFT JOIN staff st ON l.staff_id = st.staff_id
LEFT JOIN vehicles v ON l.vehicle_id = v.vehicle_id;

CREATE OR REPLACE VIEW view_customer_payments AS
SELECT
	cp.customer_id,
	c.first_name,
	c.last_name,
	cp.datetime_payment,
	cp.payment_method_code,
	pm.payment_method_description,
	cp.amount_payment,
	cp.other_payment_details
FROM customer_payments cp
LEFT JOIN payment_methods pm ON cp.payment_method_code = pm.payment_method_code
LEFT JOIN customers c ON cp.customer_id = c.customer_id;

CREATE OR REPLACE VIEW view_user_roles AS
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
FROM app_users u
LEFT JOIN app_user_roles ur ON u.user_id = ur.user_id
LEFT JOIN app_roles r ON ur.role_code = r.role_code
LEFT JOIN staff st ON u.staff_id = st.staff_id
LEFT JOIN customers c ON u.customer_id = c.customer_id;

CREATE OR REPLACE VIEW view_customer_financials AS
SELECT
	c.customer_id,
	c.first_name,
	c.last_name,
	c.amount_outstanding,
	COALESCE(p.total_paid,0::numeric) AS total_paid,
	p.last_payment
FROM customers c
LEFT JOIN (
	SELECT customer_id, SUM(amount_payment) AS total_paid, MAX(datetime_payment) AS last_payment
	FROM customer_payments
	GROUP BY customer_id
) p ON c.customer_id = p.customer_id;

CREATE OR REPLACE VIEW view_lessons_schedule AS
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
FROM lessons l
LEFT JOIN lesson_status ls ON l.lesson_status_code = ls.lesson_status_code
LEFT JOIN customers c ON l.customer_id = c.customer_id
LEFT JOIN staff st ON l.staff_id = st.staff_id
LEFT JOIN vehicles v ON l.vehicle_id = v.vehicle_id;

 
-- 1. Active instructors only (excludes admin staff and leavers).
--    Demonstrates a derived attribute: instructor age.
CREATE OR REPLACE VIEW vw_active_instructors AS
SELECT  s.staff_id,
        CONCAT(s.first_name, ' ', s.last_name)                 AS instructor_name,
        s.nickname,
		EXTRACT(YEAR FROM age(CURRENT_DATE, s.date_of_birth))::int AS age,
        s.date_joined_staff,
        s.other_staff_details
FROM    Staff s
WHERE   s.date_left_staff IS NULL
  AND   s.other_staff_details NOT LIKE '%administrator%';

-- 2. Full lesson detail with all look-ups and names resolved (master JOIN view).
CREATE OR REPLACE VIEW vw_lesson_details AS
SELECT  l.lesson_id,
        l.lesson_date,
        l.lesson_time,
        l.price,
        ls.lesson_status_description                           AS status,
        CONCAT(c.first_name, ' ', c.last_name)                 AS customer_name,
        CONCAT(st.first_name, ' ', st.last_name)               AS instructor_name,
        v.vehicle_details,
        l.other_lesson_details
FROM        Lessons            l
JOIN        Customers          c  ON l.customer_id        = c.customer_id
JOIN        Lesson_Status  ls ON l.lesson_status_code = ls.lesson_status_code
LEFT JOIN   Staff              st ON l.staff_id           = st.staff_id
LEFT JOIN   vehicles           v  ON l.vehicle_id         = v.vehicle_id;
 
-- 2b. Reporting views for the two aggregate reports that the app reads
--     directly (Report 1 uses vw_instructor_workload, Report 3 uses
--     vw_customer_balance, both already defined in script 03).
--     Keeping these as views honours the rule: every JOIN is a view. 

-- Report 2: monthly revenue collected, by payment method.
CREATE OR REPLACE VIEW vw_monthly_revenue AS
SELECT TO_CHAR(cp.datetime_payment, 'YYYY-MM')       AS pay_month,
       rpm.payment_method_description                AS method,
       COUNT(*)                                      AS num_payments,
       SUM(cp.amount_payment)                        AS total_collected
FROM Customer_Payments cp
JOIN Payment_Methods rpm
     ON cp.payment_method_code = rpm.payment_method_code
GROUP BY TO_CHAR(cp.datetime_payment, 'YYYY-MM'),
         rpm.payment_method_description;

-- Report 4: vehicle utilisation - completed lessons & revenue per car.
CREATE OR REPLACE VIEW vw_vehicle_utilisation AS
SELECT v.vehicle_id,
       v.vehicle_details,
       COUNT(l.lesson_id)                                          AS lessons_assigned,
       COUNT(*) FILTER (WHERE l.lesson_status_code = 'COMP')       AS lessons_completed,
       COALESCE(SUM(l.price) FILTER
                (WHERE l.lesson_status_code = 'COMP'), 0)          AS revenue_from_vehicle
FROM vehicles v
LEFT JOIN Lessons l ON v.vehicle_id = l.vehicle_id
GROUP BY v.vehicle_id, v.vehicle_details;

-- 3. Upcoming (future, not cancelled) lessons.
CREATE OR REPLACE VIEW vw_upcoming_lessons AS
SELECT  *
FROM    vw_lesson_details
WHERE   lesson_date >= CURRENT_DATE
  AND   status NOT IN ('Cancelled by customer', 'No show')
ORDER BY lesson_date, lesson_time;

-- 4. Today's schedule.
CREATE OR REPLACE VIEW vw_today_lessons AS
SELECT  *
FROM    vw_lesson_details
WHERE   lesson_date = CURRENT_DATE
ORDER BY lesson_time;

-- 5. Customer with full postal address (JOIN abstraction).
CREATE OR REPLACE VIEW vw_customer_full_address AS
SELECT  c.customer_id,
        CONCAT(c.first_name, ' ', c.last_name)                 AS customer_name,
		EXTRACT(YEAR FROM age(CURRENT_DATE, c.date_of_birth))::int AS age,   -- derived attribute
        c.email_address,
        c.cell_mobile_phone_number,
        CONCAT_WS(', ', a.line_1_number_building, a.line_2_number_street,
                        a.line_3_area_locality, a.city, a.zip_postcode)  AS full_address,
        rcs.customer_status_description                        AS status
FROM        Customers          c
LEFT JOIN   Addresses          a   ON c.customer_address_id  = a.address_id
JOIN        Customer_Status rcs ON c.customer_status_code = rcs.customer_status_code;

-- 6. Customer financial balance: charges vs. payments vs. stored outstanding.
--    Verifies the stored derived column against the live calculation.
CREATE OR REPLACE VIEW vw_customer_balance AS
SELECT  c.customer_id,
        CONCAT(c.first_name, ' ', c.last_name)                 AS customer_name,
        COALESCE(charges.total_charged, 0)                     AS total_charged,
        COALESCE(pays.total_paid, 0)                           AS total_paid,
        COALESCE(charges.total_charged, 0) - COALESCE(pays.total_paid, 0)
                                                              AS calculated_outstanding,
        c.amount_outstanding                                   AS stored_outstanding
FROM        Customers c
LEFT JOIN (
        SELECT customer_id, SUM(price) AS total_charged
        FROM   Lessons
        WHERE  lesson_status_code IN ('COMP','NOSH')  -- billable statuses
        GROUP  BY customer_id
) charges ON c.customer_id = charges.customer_id
LEFT JOIN (
        SELECT customer_id, SUM(amount_payment) AS total_paid
        FROM   Customer_Payments
        GROUP  BY customer_id
) pays   ON c.customer_id = pays.customer_id;

-- 7. Instructor workload summary.
CREATE OR REPLACE VIEW vw_instructor_workload AS
SELECT  st.staff_id,
        CONCAT(st.first_name, ' ', st.last_name)               AS instructor_name,
        COUNT(l.lesson_id)                                     AS total_lessons,
		COUNT(CASE WHEN l.lesson_status_code = 'COMP' THEN 1 END) AS completed_lessons,
		COUNT(CASE WHEN l.lesson_status_code = 'CANC' THEN 1 END) AS cancelled_lessons,
        COALESCE(SUM(CASE WHEN l.lesson_status_code IN ('COMP','NOSH')
                          THEN l.price END), 0)                AS revenue_generated
FROM        Staff    st
LEFT JOIN   Lessons  l ON st.staff_id = l.staff_id
GROUP BY    st.staff_id, instructor_name;

