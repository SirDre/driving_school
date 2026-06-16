 
-- Driving School Booking & Payment System
-- 05_reports.sql  -  4 analytical reports (insight, not table dumps) 
-- Character set: UTF-8

USE driving_school;
 
-- REPORT 1: Revenue & Collections Analysis
-- Purpose: Monitor cash flow, payment methods, and collection efficiency 

CREATE OR REPLACE VIEW vw_revenue_analysis AS
SELECT
    DATE_TRUNC('month', cp.datetime_payment)::DATE AS month,
    pm.payment_method_description AS payment_method,
    COUNT(DISTINCT cp.customer_id) AS unique_payers,
    COUNT(*) AS payment_count,
    SUM(cp.amount_payment) AS total_revenue,
    AVG(cp.amount_payment) AS avg_payment_amount,
    MIN(cp.amount_payment) AS min_payment_amount,
    MAX(cp.amount_payment) AS max_payment_amount
FROM customer_payments cp
LEFT JOIN payment_methods pm ON cp.payment_method_code = pm.payment_method_code
GROUP BY DATE_TRUNC('month', cp.datetime_payment), pm.payment_method_description
ORDER BY month DESC, total_revenue DESC;

-- Summary: Total outstanding vs collections
CREATE OR REPLACE VIEW vw_financial_health AS
SELECT
    COUNT(DISTINCT c.customer_id) AS total_active_customers,
    COALESCE(SUM(c.amount_outstanding), 0)::NUMERIC(10,2) AS total_outstanding,
    COALESCE((SELECT SUM(amount_payment) FROM customer_payments), 0)::NUMERIC(10,2) AS lifetime_collections,
    ROUND(100.0 * COALESCE((SELECT SUM(amount_payment) FROM customer_payments), 0) / 
          NULLIF(COALESCE(SUM(c.amount_outstanding), 0) + COALESCE((SELECT SUM(amount_payment) FROM customer_payments), 0), 0), 2) AS collection_rate_percent,
    COUNT(CASE WHEN c.amount_outstanding > 0 THEN 1 END) AS customers_with_balance,
    ROUND(100.0 * COUNT(CASE WHEN c.amount_outstanding > 0 THEN 1 END) / NULLIF(COUNT(DISTINCT c.customer_id), 0), 2) AS percent_customers_owing
FROM customers c
WHERE c.customer_status_code NOT IN ('INACTIVE', 'SUSPENDED');

 
-- REPORT 2: Instructor Performance & Utilization
-- Purpose: Track instructor productivity, workload, and revenue contribution 
CREATE OR REPLACE VIEW vw_instructor_performance AS
SELECT
    st.staff_id,
    CONCAT(st.first_name, ' ', st.last_name) AS instructor_name,
    COUNT(DISTINCT l.lesson_id) AS total_lessons_taught,
    COUNT(CASE WHEN l.lesson_status_code IN ('COMP', 'CONF') THEN 1 END) AS completed_lessons,
    COUNT(CASE WHEN l.lesson_status_code = 'CANC' THEN 1 END) AS cancelled_lessons,
    ROUND(100.0 * COUNT(CASE WHEN l.lesson_status_code = 'CANC' THEN 1 END) / NULLIF(COUNT(DISTINCT l.lesson_id), 0), 1) AS cancellation_rate_percent,
    SUM(l.price) AS total_lesson_revenue,
    ROUND(AVG(l.price), 2) AS avg_lesson_price,
    COUNT(DISTINCT l.customer_id) AS unique_students,
    DATEDIFF(CURRENT_DATE, MIN(l.lesson_date)) AS days_since_first_lesson,
    DATEDIFF(CURRENT_DATE, MAX(l.lesson_date)) AS days_since_last_lesson,
    st.date_joined_staff,
    CASE 
        WHEN st.date_left_staff IS NULL THEN 'Active'
        ELSE 'Inactive'
    END AS employment_status
FROM staff st
LEFT JOIN lessons l ON st.staff_id = l.staff_id
GROUP BY st.staff_id, st.first_name, st.last_name, st.date_joined_staff, st.date_left_staff
ORDER BY total_lesson_revenue DESC NULLS LAST;
 
-- REPORT 3: Customer Acquisition & Retention Insights
-- Purpose: Track customer lifecycle, growth trends, and engagement 
CREATE OR REPLACE VIEW vw_customer_lifecycle AS
SELECT
    DATE_TRUNC('month', c.date_became_customer)::DATE AS acquisition_month,
    COUNT(DISTINCT c.customer_id) AS new_customers_acquired,
    SUM(COALESCE(cp_agg.lifetime_spend, 0)) AS cohort_lifetime_revenue,
    ROUND(AVG(COALESCE(cp_agg.lifetime_spend, 0)), 2) AS avg_customer_lifetime_value,
    COUNT(CASE WHEN c.customer_status_code = 'ACTIVE' THEN 1 END) AS still_active,
    COUNT(CASE WHEN c.customer_status_code = 'INACTIVE' THEN 1 END) AS became_inactive,
    COUNT(CASE WHEN c.amount_outstanding > 0 THEN 1 END) AS currently_owe_balance,
    COUNT(CASE WHEN EXISTS (
        SELECT 1 FROM lessons l WHERE l.customer_id = c.customer_id
    ) THEN 1 END) AS customers_with_lessons
FROM customers c
LEFT JOIN (
    SELECT customer_id, SUM(amount_payment) AS lifetime_spend
    FROM customer_payments
    GROUP BY customer_id
) cp_agg ON c.customer_id = cp_agg.customer_id
GROUP BY DATE_TRUNC('month', c.date_became_customer)
ORDER BY acquisition_month DESC;

-- Top spenders and at-risk customers
CREATE OR REPLACE VIEW vw_customer_value_segments AS
SELECT
    'High Value' AS segment,
    COUNT(*) AS customer_count,
    ROUND(AVG(lifetime_value), 2) AS avg_lifetime_value,
    ROUND(SUM(lifetime_value), 2) AS segment_total_value,
    ROUND(AVG(outstanding_balance), 2) AS avg_outstanding,
    COUNT(CASE WHEN outstanding_balance > 0 THEN 1 END) AS customers_owing
FROM (
    SELECT
        c.customer_id,
        COALESCE(SUM(cp.amount_payment), 0) AS lifetime_value,
        c.amount_outstanding AS outstanding_balance,
        COUNT(DISTINCT l.lesson_id) AS lessons_attended
    FROM customers c
    LEFT JOIN customer_payments cp ON c.customer_id = cp.customer_id
    LEFT JOIN lessons l ON c.customer_id = l.customer_id AND l.lesson_status_code IN ('COMP', 'CONF')
    WHERE c.customer_status_code = 'ACTIVE'
    GROUP BY c.customer_id
) customer_metrics
WHERE lifetime_value >= (
    SELECT PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY COALESCE(SUM(cp.amount_payment), 0))
    FROM customers c
    LEFT JOIN customer_payments cp ON c.customer_id = cp.customer_id
    WHERE c.customer_status_code = 'ACTIVE'
    GROUP BY c.customer_id
)
UNION ALL
SELECT
    'At Risk' AS segment,
    COUNT(*) AS customer_count,
    ROUND(AVG(lifetime_value), 2) AS avg_lifetime_value,
    ROUND(SUM(lifetime_value), 2) AS segment_total_value,
    ROUND(AVG(outstanding_balance), 2) AS avg_outstanding,
    COUNT(CASE WHEN outstanding_balance > 0 THEN 1 END) AS customers_owing
FROM (
    SELECT
        c.customer_id,
        COALESCE(SUM(cp.amount_payment), 0) AS lifetime_value,
        c.amount_outstanding AS outstanding_balance,
        COUNT(DISTINCT l.lesson_id) AS lessons_attended
    FROM customers c
    LEFT JOIN customer_payments cp ON c.customer_id = cp.customer_id
    LEFT JOIN lessons l ON c.customer_id = l.customer_id AND l.lesson_status_code IN ('COMP', 'CONF')
    WHERE c.customer_status_code = 'ACTIVE'
    GROUP BY c.customer_id
) customer_metrics
WHERE outstanding_balance > 500 AND lifetime_value < (
    SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY COALESCE(SUM(cp.amount_payment), 0))
    FROM customers c
    LEFT JOIN customer_payments cp ON c.customer_id = cp.customer_id
    WHERE c.customer_status_code = 'ACTIVE'
    GROUP BY c.customer_id
);
 
-- REPORT 4: Lesson Booking & Utilization Analysis
-- Purpose: Optimize scheduling, identify demand patterns, track capacity 
CREATE OR REPLACE VIEW vw_scheduling_efficiency AS
SELECT
    DATE_TRUNC('week', l.lesson_date)::DATE AS week_starting,
    DAYOFWEEK(l.lesson_date) AS day_of_week,
    EXTRACT(HOUR FROM l.lesson_time) AS lesson_hour,
    l.lesson_status_code,
    COUNT(DISTINCT l.lesson_id) AS lessons_booked,
    COUNT(DISTINCT l.vehicle_id) AS vehicles_used,
    COUNT(DISTINCT l.staff_id) AS instructors_assigned,
    ROUND(AVG(l.price), 2) AS avg_lesson_price,
    SUM(l.price) AS weekly_revenue
FROM lessons l
GROUP BY DATE_TRUNC('week', l.lesson_date), DAYOFWEEK(l.lesson_date), EXTRACT(HOUR FROM l.lesson_time), l.lesson_status_code
ORDER BY week_starting DESC, day_of_week, lesson_hour;

-- Lesson completion rates by status
CREATE OR REPLACE VIEW vw_lesson_completion_metrics AS
SELECT
    COUNT(DISTINCT l.lesson_id) AS total_lessons,
    COUNT(CASE WHEN l.lesson_status_code IN ('COMP', 'CONF') THEN 1 END) AS completed,
    COUNT(CASE WHEN l.lesson_status_code = 'CANC' THEN 1 END) AS cancelled,
    COUNT(CASE WHEN l.lesson_status_code = 'RESC' THEN 1 END) AS rescheduled,
    COUNT(CASE WHEN l.lesson_status_code = 'PENDING' THEN 1 END) AS pending,
    ROUND(100.0 * COUNT(CASE WHEN l.lesson_status_code IN ('COMP', 'CONF') THEN 1 END) / NULLIF(COUNT(DISTINCT l.lesson_id), 0), 1) AS completion_rate_percent,
    ROUND(100.0 * COUNT(CASE WHEN l.lesson_status_code = 'CANC' THEN 1 END) / NULLIF(COUNT(DISTINCT l.lesson_id), 0), 1) AS cancellation_rate_percent,
    SUM(l.price) AS total_lesson_revenue,
    ROUND(SUM(CASE WHEN l.lesson_status_code IN ('COMP', 'CONF') THEN l.price ELSE 0 END), 2) AS completed_revenue,
    ROUND(SUM(CASE WHEN l.lesson_status_code = 'CANC' THEN l.price ELSE 0 END), 2) AS lost_revenue_cancelled
FROM lessons l
WHERE l.lesson_date >= DATE_SUB(CURRENT_DATE, INTERVAL 90 DAY);
 
