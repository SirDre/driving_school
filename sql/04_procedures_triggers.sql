 
-- Driving School Booking & Payment System
-- 04_procedures_triggers.sql  -  3 stored procedures + 3 triggers
-- (requirement: implement at least 3 of procedures/triggers in any mix) 

SET search_path TO driving_school;
 
-- PROCEDURE 1: sp_book_lesson
-- Books a new lesson for a customer. Sets initial status to 'BOOKED'.
-- Returns the new lesson_id via output parameter. 
-- Validates customer is active, staff and vehicle availability, and future date/time.

CREATE OR REPLACE PROCEDURE sp_book_lesson (
    IN p_customer_id INT,
    IN p_staff_id INT,
    IN p_vehicle_id INT,
    IN p_date DATE,
    IN p_time TIME,
    IN p_price DECIMAL(10,2),
    OUT p_lesson_id INT
)
LANGUAGE plpgsql
SET search_path = driving_school
AS $$
BEGIN
    -- Validate customer exists and is ACTIVE
    IF NOT EXISTS (SELECT 1 FROM Customers WHERE customer_id = p_customer_id 
                   AND customer_status_code = 'ACTIVE') THEN
        RAISE EXCEPTION 'Customer % does not exist or is not active', p_customer_id;
    END IF;

    -- Validate staff exists
    IF p_staff_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Staff WHERE staff_id = p_staff_id) THEN
        RAISE EXCEPTION 'Staff % does not exist', p_staff_id;
    END IF;

    -- Validate vehicle exists
    IF p_vehicle_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vehicles WHERE vehicle_id = p_vehicle_id) THEN
        RAISE EXCEPTION 'Vehicle % does not exist', p_vehicle_id;
    END IF;

    -- Validate lesson is in the future
    IF p_date < CURRENT_DATE OR (p_date = CURRENT_DATE AND p_time <= CURRENT_TIME) THEN
        RAISE EXCEPTION 'Cannot book lesson in the past';
    END IF;

    -- Check no conflicting staff booking at same time
    IF p_staff_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM Lessons 
                   WHERE staff_id = p_staff_id 
                   AND lesson_date = p_date 
                   AND lesson_time = p_time
                   AND lesson_status_code != 'CANCELLED') THEN
            RAISE EXCEPTION 'Staff % is already booked at % on %', p_staff_id, p_time, p_date;
        END IF;
    END IF;

    -- Check no conflicting vehicle booking at same time
    IF p_vehicle_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM Lessons 
                   WHERE vehicle_id = p_vehicle_id 
                   AND lesson_date = p_date 
                   AND lesson_time = p_time
                   AND lesson_status_code != 'CANCELLED') THEN
            RAISE EXCEPTION 'Vehicle % is already booked at % on %', p_vehicle_id, p_time, p_date;
        END IF;
    END IF;

    -- Insert new lesson with BOOKED status
    INSERT INTO Lessons (
        customer_id, 
        staff_id, 
        vehicle_id, 
        lesson_date, 
        lesson_time, 
        price, 
        lesson_status_code
    ) VALUES (
        p_customer_id, 
        p_staff_id, 
        p_vehicle_id, 
        p_date, 
        p_time, 
        p_price, 
        'BOOKED'
    )
    RETURNING lesson_id INTO p_lesson_id;

    -- Update customer balance: add lesson price to amount_outstanding
    UPDATE Customers 
    SET amount_outstanding = amount_outstanding + p_price
    WHERE customer_id = p_customer_id;

END;
$$;
 
-- PROCEDURE 2: sp_record_payment
-- Records a customer payment and updates their outstanding balance.
-- Triggered by customer paying via various methods. 
-- Validates customer and payment method exist, and amount is positive.

CREATE OR REPLACE PROCEDURE sp_record_payment (
    IN p_customer_id INT,
    IN p_payment_method VARCHAR(10),
    IN p_amount DECIMAL(10,2),
    IN p_details TEXT DEFAULT NULL
)
LANGUAGE plpgsql
SET search_path = driving_school
AS $$
BEGIN
    -- Validate customer exists
    IF NOT EXISTS (SELECT 1 FROM Customers WHERE customer_id = p_customer_id) THEN
        RAISE EXCEPTION 'Customer % does not exist', p_customer_id;
    END IF;

    -- Validate payment method exists
    IF NOT EXISTS (SELECT 1 FROM Payment_Methods WHERE payment_method_code = p_payment_method) THEN
        RAISE EXCEPTION 'Payment method % does not exist', p_payment_method;
    END IF;

    -- Validate amount is positive
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be positive';
    END IF;

    -- Insert payment record
    INSERT INTO Customer_Payments (
        customer_id,
        datetime_payment,
        payment_method_code,
        amount_payment,
        other_payment_details
    ) VALUES (
        p_customer_id,
        NOW(),
        p_payment_method,
        p_amount,
        p_details
    );

    -- Update customer balance: reduce outstanding amount
    UPDATE Customers
    SET amount_outstanding = GREATEST(0, amount_outstanding - p_amount)
    WHERE customer_id = p_customer_id;

END;
$$;
 
-- PROCEDURE 3: sp_cancel_lesson
-- Cancels a lesson with a 24-hour free cancellation policy.
-- If cancelled within 24 hours, customer is charged 50% fee.
-- If cancelled more than 24 hours ahead, no charge and refund any prior charge. 
-- Validates lesson exists, is not already cancelled or completed, and applies appropriate fees.

CREATE OR REPLACE PROCEDURE sp_cancel_lesson (
    IN p_lesson_id INT
)
LANGUAGE plpgsql
SET search_path = driving_school
AS $$
DECLARE
    v_customer_id INT;
    v_lesson_date DATE;
    v_lesson_time TIME;
    v_price DECIMAL(10,2);
    v_hours_until_lesson NUMERIC;
    v_cancellation_fee DECIMAL(10,2);
    v_current_outstanding DECIMAL(10,2);
BEGIN
    -- Fetch lesson details
    SELECT customer_id, lesson_date, lesson_time, price, c.amount_outstanding
    INTO v_customer_id, v_lesson_date, v_lesson_time, v_price, v_current_outstanding
    FROM Lessons l
    JOIN Customers c ON l.customer_id = c.customer_id
    WHERE lesson_id = p_lesson_id;

    -- Check lesson exists
    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'Lesson % does not exist', p_lesson_id;
    END IF;

    -- Check lesson is not already cancelled
    IF EXISTS (SELECT 1 FROM Lessons WHERE lesson_id = p_lesson_id AND lesson_status_code = 'CANCELLED') THEN
        RAISE EXCEPTION 'Lesson % is already cancelled', p_lesson_id;
    END IF;

    -- Check lesson is not already completed
    IF EXISTS (SELECT 1 FROM Lessons WHERE lesson_id = p_lesson_id AND lesson_status_code = 'COMPLETED') THEN
        RAISE EXCEPTION 'Cannot cancel completed lesson %', p_lesson_id;
    END IF;

    -- Calculate hours until lesson
    v_hours_until_lesson := EXTRACT(EPOCH FROM (v_lesson_date::TIMESTAMP + v_lesson_time - NOW())) / 3600;

    -- Determine cancellation fee based on timing
    IF v_hours_until_lesson > 24 THEN
        -- More than 24 hours: free cancellation, full refund
        v_cancellation_fee := 0;
    ELSE
        -- Within 24 hours: 50% penalty fee
        v_cancellation_fee := v_price * 0.5;
    END IF;

    -- Update lesson status to CANCELLED
    UPDATE Lessons 
    SET lesson_status_code = 'CANCELLED'
    WHERE lesson_id = p_lesson_id;

    -- Update customer balance: remove lesson price, add back any refund (price - fee)
    UPDATE Customers
    SET amount_outstanding = GREATEST(0, amount_outstanding - v_price + v_cancellation_fee)
    WHERE customer_id = v_customer_id;

END;
$$;
 
-- TRIGGER 1: trg_update_customer_balance_on_payment
-- After a payment is inserted, automatically recalculate customer balance.
-- (Backup validation: ensures balance never goes negative) 

CREATE OR REPLACE FUNCTION fn_update_customer_balance_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure customer balance is never negative
    UPDATE Customers
    SET amount_outstanding = GREATEST(0, amount_outstanding - NEW.amount_payment)
    WHERE customer_id = NEW.customer_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_customer_balance_on_payment
AFTER INSERT ON Customer_Payments
FOR EACH ROW
EXECUTE FUNCTION fn_update_customer_balance_on_payment();

 
-- TRIGGER 2: trg_validate_lesson_slot_availability
-- Before inserting or updating a lesson, validate staff and vehicle
-- are not double-booked at the same date/time. 
CREATE OR REPLACE FUNCTION fn_validate_lesson_slot_availability()
RETURNS TRIGGER AS $$
BEGIN
    -- Check for staff conflict (if staff_id is provided)
    IF NEW.staff_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM Lessons
            WHERE staff_id = NEW.staff_id
            AND lesson_date = NEW.lesson_date
            AND lesson_time = NEW.lesson_time
            AND lesson_status_code != 'CANCELLED'
            AND lesson_id != COALESCE(OLD.lesson_id, -1)  -- Exclude current lesson on UPDATE
        ) THEN
            RAISE EXCEPTION 'Staff % is already booked at % on %', 
                NEW.staff_id, NEW.lesson_time, NEW.lesson_date;
        END IF;
    END IF;

    -- Check for vehicle conflict (if vehicle_id is provided)
    IF NEW.vehicle_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM Lessons
            WHERE vehicle_id = NEW.vehicle_id
            AND lesson_date = NEW.lesson_date
            AND lesson_time = NEW.lesson_time
            AND lesson_status_code != 'CANCELLED'
            AND lesson_id != COALESCE(OLD.lesson_id, -1)  -- Exclude current lesson on UPDATE
        ) THEN
            RAISE EXCEPTION 'Vehicle % is already booked at % on %', 
                NEW.vehicle_id, NEW.lesson_time, NEW.lesson_date;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_lesson_slot_availability
BEFORE INSERT OR UPDATE ON Lessons
FOR EACH ROW
EXECUTE FUNCTION fn_validate_lesson_slot_availability();
 
-- TRIGGER 3: trg_audit_lesson_status_change
-- After a lesson status changes, log the change for audit purposes.
-- This helps track when lessons were completed, cancelled, etc. 

CREATE TABLE IF NOT EXISTS Lesson_Audit_Log (
    audit_id BIGINT GENERATED ALWAYS AS IDENTITY,
    lesson_id INT NOT NULL,
    old_status VARCHAR(10),
    new_status VARCHAR(10),
    changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    changed_by VARCHAR(100) DEFAULT 'system',
    CONSTRAINT pk_lesson_audit_log PRIMARY KEY (audit_id),
    CONSTRAINT fk_audit_lesson FOREIGN KEY (lesson_id) 
        REFERENCES Lessons(lesson_id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION fn_audit_lesson_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if status actually changed
    IF NEW.lesson_status_code != OLD.lesson_status_code THEN
        INSERT INTO Lesson_Audit_Log (
            lesson_id,
            old_status,
            new_status,
            changed_at
        ) VALUES (
            NEW.lesson_id,
            OLD.lesson_status_code,
            NEW.lesson_status_code,
            NOW()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_lesson_status_change
AFTER UPDATE ON Lessons
FOR EACH ROW
EXECUTE FUNCTION fn_audit_lesson_status_change();
