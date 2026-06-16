-- Driving School Booking & Payment System
-- 06_app_functions.sql
-- Run this AFTER: 
-- 01_schema_ddl, 02_sample_data, 03_views and 04_procedures_triggers.
--
-- Why this file exists:
--   * Supabase's API (PostgREST) exposes TABLES, VIEWS and FUNCTIONS, 
--     but not PROCEDURES. API access to the driving_school schema.
--   * PostgREST .rpc() calls FUNCTIONS, not PROCEDURES. The design's
--     sp_book_lesson / sp_cancel_lesson / sp_record_payment are
--     PROCEDUREs, so we add thin FUNCTION wrappers the web app can call.
--   * The web interface reads through views and writes through these
--     wrappers (and direct INSERT/UPDATE/DELETE on the two core tables).
--
-- The app calls these by NAME via .rpc(), passing parameters as JSON. 

SET search_path TO driving_school;
 
-- 1. Expose the schema to the Supabase API roles
--    (also add "driving_school" under Settings -> API -> Exposed schemas) 
GRANT USAGE ON SCHEMA driving_school TO anon, authenticated, service_role;

-- Read access to tables + views (the app reads the views; tables backing
-- direct CRUD on the two core tables also need table grants).
GRANT SELECT ON ALL TABLES    IN SCHEMA driving_school TO anon, authenticated;

-- Write access on the two core tables for the front-desk CRUD flows.
GRANT INSERT, UPDATE, DELETE ON driving_school.Customers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON driving_school.Lessons   TO authenticated;
GRANT INSERT                 ON driving_school.Customer_Payments TO authenticated;

-- IDENTITY sequences need USAGE so inserts can generate keys.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA driving_school TO authenticated;

-- Let the app execute the wrapper functions defined below.
-- (granted again at the end after the functions exist)
-- 2. RPC-callable FUNCTION wrappers around the stored PROCEDUREs
--    These let supabase-js call them with .rpc('fn_...', {...}).
--    Each simply CALLs the procedure, so all validation/business logic
--    still lives in the procedures and triggers from script 04. 

-- Book a lesson (delegates to sp_book_lesson; returns the new lesson_id).
CREATE OR REPLACE FUNCTION fn_book_lesson (
    p_customer_id INT,
    p_staff_id    INT,
    p_vehicle_id  INT,
    p_date        DATE,
    p_time        TIME,
    p_price       DECIMAL(10,2)
) RETURNS INT
LANGUAGE plpgsql
SET search_path = driving_school, public
AS $$
DECLARE
    v_lesson_id INT;
BEGIN
    CALL sp_book_lesson(p_customer_id, p_staff_id, p_vehicle_id,
                        p_date, p_time, p_price, v_lesson_id);
    RETURN v_lesson_id;
END;
$$;

-- Record a payment (delegates to sp_record_payment; balance trigger fires).
CREATE OR REPLACE FUNCTION fn_record_payment (
    p_customer_id INT,
    p_method      VARCHAR(10),
    p_amount      DECIMAL(10,2),
    p_details     TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SET search_path = driving_school, public
AS $$
BEGIN
    CALL sp_record_payment(p_customer_id, p_method, p_amount, p_details);
END;
$$;

-- Cancel a lesson with the 24-hour free-cancellation rule.
CREATE OR REPLACE FUNCTION fn_cancel_lesson (
    p_lesson_id INT
) RETURNS VOID
LANGUAGE plpgsql
SET search_path = driving_school, public
AS $$
BEGIN
    CALL sp_cancel_lesson(p_lesson_id);
END;
$$;

-- Insert a customer and return the new customer_id.
CREATE OR REPLACE FUNCTION fn_add_customer (
    p_address_id     INT,
    p_status_code    VARCHAR(10),
    p_date_became    DATE,
    p_date_of_birth  DATE,
    p_first_name     VARCHAR(50),
    p_last_name      VARCHAR(50),
    p_email          VARCHAR(150) DEFAULT NULL,
    p_cell           VARCHAR(30) DEFAULT NULL
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = driving_school, public
AS $$
DECLARE
    v_customer_id INT;
BEGIN
    INSERT INTO Customers (
        customer_address_id, customer_status_code, date_became_customer,
        date_of_birth, first_name, last_name, amount_outstanding,
        email_address, cell_mobile_phone_number
    ) VALUES (
        p_address_id, p_status_code, p_date_became,
        p_date_of_birth, p_first_name, p_last_name, 0,
        p_email, p_cell
    ) RETURNING customer_id INTO v_customer_id;

    RETURN v_customer_id;
END;
$$;

-- Update an existing customer.
CREATE OR REPLACE FUNCTION fn_update_customer (
    p_customer_id    INT,
    p_address_id     INT,
    p_status_code    VARCHAR(10),
    p_date_became    DATE,
    p_date_of_birth  DATE,
    p_first_name     VARCHAR(50),
    p_last_name      VARCHAR(50),
    p_email          VARCHAR(150) DEFAULT NULL,
    p_cell           VARCHAR(30) DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = driving_school, public
AS $$
BEGIN
    UPDATE Customers
       SET customer_address_id = p_address_id,
           customer_status_code = p_status_code,
           date_became_customer = p_date_became,
           date_of_birth = p_date_of_birth,
           first_name = p_first_name,
           last_name = p_last_name,
           email_address = p_email,
           cell_mobile_phone_number = p_cell
     WHERE customer_id = p_customer_id;
END;
$$;

-- Delete a customer and any payment history.
CREATE OR REPLACE FUNCTION fn_delete_customer (
    p_customer_id INT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = driving_school, public
AS $$
BEGIN
    DELETE FROM Customer_Payments WHERE customer_id = p_customer_id;
    DELETE FROM Customers WHERE customer_id = p_customer_id;
END;
$$;

-- Resolve an address by its components, or create it if it does not exist.
-- Returns the address_id so the app can store the foreign key directly.
CREATE OR REPLACE FUNCTION driving_school.fn_resolve_address (
    p_city     VARCHAR(100),
    p_country  VARCHAR(100),
    p_line1    VARCHAR(100),
    p_line2    VARCHAR(100),
    p_line3    VARCHAR(100),
    p_postcode VARCHAR(20),
    p_province VARCHAR(100)
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = driving_school, public
AS $$
DECLARE
    v_address_id INT;
BEGIN
    SELECT address_id
      INTO v_address_id
      FROM Addresses
     WHERE city = p_city
       AND COALESCE(country, 'Canada') = COALESCE(p_country, 'Canada')
       AND line_1_number_building = p_line1
       AND line_2_number_street IS NOT DISTINCT FROM p_line2
       AND line_3_area_locality IS NOT DISTINCT FROM p_line3
       AND zip_postcode = p_postcode
       AND state_province_county IS NOT DISTINCT FROM p_province
     LIMIT 1;

    IF v_address_id IS NOT NULL THEN
        RETURN v_address_id;
    END IF;

    INSERT INTO Addresses (
        line_1_number_building,
        line_2_number_street,
        line_3_area_locality,
        city,
        zip_postcode,
        state_province_county,
        country
    ) VALUES (
        p_line1,
        p_line2,
        p_line3,
        p_city,
        p_postcode,
        p_province,
        COALESCE(p_country, 'Canada')
    )
    RETURNING address_id INTO v_address_id;

    RETURN v_address_id;
END;
$$;

-- Delete a lesson record.
CREATE OR REPLACE FUNCTION driving_school.fn_delete_lesson (
    p_lesson_id INT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = driving_school, public
AS $$
BEGIN
    DELETE FROM Lessons WHERE lesson_id = p_lesson_id;
END;
$$;

-- Insert an instructor/staff row and return the new staff_id.
-- NOTE: required parameters first, optional (DEFAULT NULL) parameters last.
CREATE OR REPLACE FUNCTION driving_school.fn_add_staff (
    p_staff_address_id    INT,
    p_status_code         VARCHAR(10),
    p_first_name          VARCHAR(50),
    p_last_name           VARCHAR(50),
    p_date_joined_staff   TIMESTAMP,
    p_nickname            VARCHAR(50) DEFAULT NULL,
    p_middle_name         VARCHAR(50) DEFAULT NULL,
    p_date_of_birth       DATE        DEFAULT NULL,
    p_date_left_staff     TIMESTAMP   DEFAULT NULL,
    p_other_staff_details TEXT        DEFAULT NULL
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = driving_school, public
AS $$
DECLARE
    v_staff_id INT;
BEGIN
    INSERT INTO Staff (
        staff_address_id, customer_status_code, nickname, first_name,
        middle_name, last_name, date_of_birth, date_joined_staff,
        date_left_staff, other_staff_details
    ) VALUES (
        p_staff_address_id, p_status_code, p_nickname, p_first_name,
        p_middle_name, p_last_name, p_date_of_birth, p_date_joined_staff,
        p_date_left_staff, p_other_staff_details
    ) RETURNING staff_id INTO v_staff_id;

    RETURN v_staff_id;
END;
$$;

-- Update an instructor/staff row.
-- NOTE: required parameters first, optional (DEFAULT NULL) parameters last.
CREATE OR REPLACE FUNCTION driving_school.fn_update_staff (
    p_staff_id            INT,
    p_staff_address_id    INT,
    p_status_code         VARCHAR(10),
    p_first_name          VARCHAR(50),
    p_last_name           VARCHAR(50),
    p_date_joined_staff   TIMESTAMP,
    p_nickname            VARCHAR(50) DEFAULT NULL,
    p_middle_name         VARCHAR(50) DEFAULT NULL,
    p_date_of_birth       DATE        DEFAULT NULL,
    p_date_left_staff     TIMESTAMP   DEFAULT NULL,
    p_other_staff_details TEXT        DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = driving_school, public
AS $$
BEGIN
    UPDATE Staff
       SET staff_address_id = p_staff_address_id,
           customer_status_code = p_status_code,
           nickname = p_nickname,
           first_name = p_first_name,
           middle_name = p_middle_name,
           last_name = p_last_name,
           date_of_birth = p_date_of_birth,
           date_joined_staff = p_date_joined_staff,
           date_left_staff = p_date_left_staff,
           other_staff_details = p_other_staff_details
     WHERE staff_id = p_staff_id;
END;
$$;

-- Delete an instructor/staff row.
CREATE OR REPLACE FUNCTION driving_school.fn_delete_staff (
    p_staff_id INT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = driving_school, public
AS $$
BEGIN
    DELETE FROM Staff WHERE staff_id = p_staff_id;
END;
$$;

 
CREATE OR REPLACE FUNCTION fn_delete_user (
    p_user_id INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = driving_school, public
AS $$
DECLARE
    v_email       VARCHAR(150);
    v_is_admin    BOOLEAN;
    v_admin_count INT;
BEGIN
    -- 1. Does the user exist?
    SELECT email INTO v_email FROM app_users WHERE user_id = p_user_id;
    IF v_email IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'message', 'User not found.');
    END IF;

    -- 2. Guard: never delete the last remaining administrator.
    SELECT EXISTS (
        SELECT 1 FROM app_user_roles
        WHERE user_id = p_user_id AND role_code = 'ADMIN'
    ) INTO v_is_admin;

    IF v_is_admin THEN
        SELECT COUNT(DISTINCT user_id) INTO v_admin_count
        FROM app_user_roles WHERE role_code = 'ADMIN';
        IF v_admin_count <= 1 THEN
            RETURN jsonb_build_object('ok', false,
                'message', 'Cannot delete the last administrator account.');
        END IF;
    END IF;

    -- 3. Delete. Rows in app_user_roles are removed via ON DELETE CASCADE.
    DELETE FROM app_users WHERE user_id = p_user_id;

    -- 4. FEATURE: leave an audit trail of the removal. app_login_audit has
    --    no FK to app_users, so this row survives the delete.
    INSERT INTO app_login_audit (email, user_id, success, detail)
    VALUES (v_email, p_user_id, true, 'account deleted');

    RETURN jsonb_build_object('ok', true, 'message', 'User deleted.',
                              'email', v_email);
END;
$$;
 
-- 3. Allow the app to execute the wrappers
--    (staff signatures match the reordered parameters above) 
GRANT EXECUTE ON FUNCTION fn_book_lesson(INT,INT,INT,DATE,TIME,DECIMAL)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_record_payment(INT,VARCHAR,DECIMAL,TEXT)           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_cancel_lesson(INT)                                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_add_customer(INT,VARCHAR,DATE,DATE,VARCHAR,VARCHAR,VARCHAR,VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_update_customer(INT,INT,VARCHAR,DATE,DATE,VARCHAR,VARCHAR,VARCHAR,VARCHAR) TO anon, authenticated;

GRANT SELECT ON vw_monthly_revenue, vw_vehicle_utilisation TO anon, authenticated;


GRANT EXECUTE ON FUNCTION fn_delete_customer(INT)                                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION driving_school.fn_delete_lesson(INT)                   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION driving_school.fn_add_staff(INT,VARCHAR,VARCHAR,VARCHAR,TIMESTAMP,VARCHAR,VARCHAR,DATE,TIMESTAMP,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION driving_school.fn_update_staff(INT,INT,VARCHAR,VARCHAR,VARCHAR,TIMESTAMP,VARCHAR,VARCHAR,DATE,TIMESTAMP,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION driving_school.fn_delete_staff(INT)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION driving_school.fn_delete_user(INT)                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION driving_school.fn_resolve_address(VARCHAR,VARCHAR,VARCHAR,VARCHAR,VARCHAR,VARCHAR,VARCHAR) TO anon, authenticated;



-- Least privilege: PostgreSQL grants EXECUTE to PUBLIC by default, which
-- would let the unauthenticated 'anon' role call this destructive
-- SECURITY DEFINER function. Revoke that, then allow signed-in users only.
-- REVOKE EXECUTE ON FUNCTION fn_delete_user(INT) FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION fn_delete_user(INT) TO PUBLIC; 