 
-- Driving School Booking & Payment System  —  AUTH EXTENSION
-- 07_auth_extension.sql
--
-- Adds a basic username/password authentication layer with roles to the
-- driving_school schema. Run AFTER driving_school_full_supabase.sql.
--
-- Objects added:
--   * app_roles        - catalogue of roles (ADMIN / STAFF / REPORT)
--   * app_users        - login accounts (bcrypt password hash, never plaintext)
--   * app_user_roles   - many-to-many: which roles a user holds
--   * app_login_audit  - every sign-in attempt (success or failure)
--   * vw_app_users / vw_user_roles - safe views (no password hash)
--   * fn_register / fn_signin / fn_assign_role / fn_revoke_role /
--     fn_set_password - SECURITY DEFINER functions the app calls via .rpc()
--
-- SECURITY MODEL
--   - Passwords are hashed with bcrypt (pgcrypto crypt/gen_salt('bf')).
--   - anon/authenticated get NO direct access to app_users (the hash table).
--     They may only EXECUTE the register/sign-in functions, which run as the
--     definer (postgres) and therefore reach the table safely.
--   - Basic account lockout after 5 failed attempts (15 minutes).
--
-- Note: In production, you would want to lock down the role/permission
-- management functions to admins only, and probably add more roles. For this demo, we keep it open to authenticated users for testing.

-- pgcrypto provides crypt() and gen_salt(); on Supabase it lives in `extensions`.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

SET search_path TO driving_school;

-- TABLES 
CREATE TABLE IF NOT EXISTS app_roles (
    role_code   VARCHAR(20)  NOT NULL,
    role_name   VARCHAR(50)  NOT NULL,
    description TEXT,
    CONSTRAINT pk_app_roles PRIMARY KEY (role_code)
);

CREATE TABLE IF NOT EXISTS app_users (
    user_id        INT GENERATED ALWAYS AS IDENTITY,
    email          VARCHAR(150) NOT NULL,
    password_hash  TEXT         NOT NULL,
    full_name      VARCHAR(100),
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    -- optional links to existing people in the system
    staff_id       INT,
    customer_id    INT,
    -- basic brute-force protection
    failed_attempts INT         NOT NULL DEFAULT 0,
    locked_until   TIMESTAMP,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    last_login_at  TIMESTAMP,
    CONSTRAINT pk_app_users PRIMARY KEY (user_id),
    CONSTRAINT uq_app_users_email UNIQUE (email),
    CONSTRAINT chk_app_users_email CHECK (POSITION('@' IN email) > 1),
    CONSTRAINT fk_app_users_staff
        FOREIGN KEY (staff_id) REFERENCES Staff (staff_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_app_users_customer
        FOREIGN KEY (customer_id) REFERENCES Customers (customer_id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS app_user_roles (
    user_id     INT          NOT NULL,
    role_code   VARCHAR(20)  NOT NULL,
    assigned_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_app_user_roles PRIMARY KEY (user_id, role_code),
    CONSTRAINT fk_aur_user
        FOREIGN KEY (user_id) REFERENCES app_users (user_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_aur_role
        FOREIGN KEY (role_code) REFERENCES app_roles (role_code)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS app_login_audit (
    audit_id     BIGINT GENERATED ALWAYS AS IDENTITY,
    email        VARCHAR(150),
    user_id      INT,
    success      BOOLEAN NOT NULL,
    detail       VARCHAR(100),
    attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_app_login_audit PRIMARY KEY (audit_id)
);

CREATE INDEX IF NOT EXISTS ix_app_users_email   ON app_users (email);
CREATE INDEX IF NOT EXISTS ix_app_audit_email   ON app_login_audit (email, attempted_at);
 


-- TRIGGER: normalise e-mail to lower-case before write 
CREATE OR REPLACE FUNCTION trg_app_users_normalise_fn()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = driving_school, public
AS $$
BEGIN
    NEW.email := lower(trim(NEW.email));
    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_app_users_normalise ON app_users;
CREATE TRIGGER trg_app_users_normalise
    BEFORE INSERT OR UPDATE ON app_users
    FOR EACH ROW EXECUTE FUNCTION trg_app_users_normalise_fn();


-- SEED: role catalogue (mirrors the DDD's three access classes) 
INSERT INTO app_roles (role_code, role_name, description) VALUES
('ADMIN',  'Administrator',    'Full administrative access (maps to ds_dba).'),
('STAFF',  'Front-desk staff', 'Operational booking/payment access (maps to ds_app).'),
('REPORT', 'Reporting analyst','Read-only access to reports (maps to ds_report).')
ON CONFLICT (role_code) DO NOTHING;


-- SAFE VIEWS (never expose the password hash) 
CREATE OR REPLACE VIEW vw_app_users AS
SELECT u.user_id, u.email, u.full_name, u.is_active,
       u.staff_id, u.customer_id, u.created_at, u.last_login_at,
       COALESCE(
         (SELECT string_agg(r.role_code, ',' ORDER BY r.role_code)
          FROM app_user_roles r WHERE r.user_id = u.user_id), '') AS roles
FROM app_users u;

CREATE OR REPLACE VIEW vw_user_roles AS
SELECT ur.user_id, u.email, ur.role_code, ro.role_name, ur.assigned_at
FROM app_user_roles ur
JOIN app_users u  ON ur.user_id = u.user_id
JOIN app_roles ro ON ur.role_code = ro.role_code;

 
-- FUNCTION: register a new account.  Returns JSONB {ok, ...}. 
CREATE OR REPLACE FUNCTION fn_register (
    p_email     VARCHAR(150),
    p_password  TEXT,
    p_full_name VARCHAR(100) DEFAULT NULL,
    p_role      VARCHAR(20)  DEFAULT 'STAFF' )
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = driving_school, extensions, public
AS $$
DECLARE
    v_email VARCHAR(150) := lower(trim(p_email));
    v_id    INT;
BEGIN
    IF v_email IS NULL OR POSITION('@' IN v_email) < 2 THEN
        RETURN jsonb_build_object('ok', false, 'message', 'A valid e-mail is required.');
    END IF;
    IF p_password IS NULL OR length(p_password) < 8 THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Password must be at least 8 characters.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM app_roles WHERE role_code = upper(p_role)) THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Unknown role: ' || p_role);
    END IF;
    IF EXISTS (SELECT 1 FROM app_users WHERE email = v_email) THEN
        RETURN jsonb_build_object('ok', false, 'message', 'That e-mail is already registered.');
    END IF;

    INSERT INTO app_users (email, password_hash, full_name)
    VALUES (v_email, extensions.crypt(p_password, extensions.gen_salt('bf')), p_full_name)
    RETURNING user_id INTO v_id;

    INSERT INTO app_user_roles (user_id, role_code) VALUES (v_id, upper(p_role));

    RETURN jsonb_build_object('ok', true, 'user_id', v_id, 'email', v_email,
                              'full_name', p_full_name, 'role', upper(p_role),
                              'message', 'Account created.');
END; $$;

 
-- FUNCTION: sign in.  Verifies the bcrypt hash, applies lockout, audits.
-- Returns JSONB {ok, user_id, full_name, roles[], message}. 
CREATE OR REPLACE FUNCTION fn_signin (
    p_email    VARCHAR(150),
    p_password TEXT )
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = driving_school, extensions, public
AS $$
DECLARE
    v_email VARCHAR(150) := lower(trim(p_email));
    u       app_users%ROWTYPE;
    v_roles TEXT[];
BEGIN
    SELECT * INTO u FROM app_users WHERE email = v_email;

    IF NOT FOUND THEN
        INSERT INTO app_login_audit (email, success, detail) VALUES (v_email, false, 'no such user');
        RETURN jsonb_build_object('ok', false, 'message', 'Invalid e-mail or password.');
    END IF;

    IF NOT u.is_active THEN
        INSERT INTO app_login_audit (email, user_id, success, detail) VALUES (v_email, u.user_id, false, 'inactive');
        RETURN jsonb_build_object('ok', false, 'message', 'This account is deactivated.');
    END IF;

    IF u.locked_until IS NOT NULL AND u.locked_until > NOW() THEN
        INSERT INTO app_login_audit (email, user_id, success, detail) VALUES (v_email, u.user_id, false, 'locked');
        RETURN jsonb_build_object('ok', false, 'message',
               'Account locked until ' || to_char(u.locked_until, 'HH24:MI') || '. Try again later.');
    END IF;

    -- verify password: crypt(input, stored_hash) = stored_hash
    IF u.password_hash = extensions.crypt(p_password, u.password_hash) THEN
        UPDATE app_users
           SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW()
         WHERE user_id = u.user_id;
        INSERT INTO app_login_audit (email, user_id, success, detail) VALUES (v_email, u.user_id, true, 'ok');

        SELECT array_agg(role_code ORDER BY role_code) INTO v_roles
          FROM app_user_roles WHERE user_id = u.user_id;

        RETURN jsonb_build_object('ok', true, 'user_id', u.user_id,
                                  'email', u.email, 'full_name', u.full_name,
                                  'roles', COALESCE(v_roles, ARRAY[]::TEXT[]),
                                  'message', 'Signed in.');
    ELSE
        UPDATE app_users
           SET failed_attempts = failed_attempts + 1,
               locked_until = CASE WHEN failed_attempts + 1 >= 5
                                   THEN NOW() + INTERVAL '15 minutes' ELSE locked_until END
         WHERE user_id = u.user_id;
        INSERT INTO app_login_audit (email, user_id, success, detail) VALUES (v_email, u.user_id, false, 'bad password');
        RETURN jsonb_build_object('ok', false, 'message', 'Invalid e-mail or password.');
    END IF;
END; $$;

 
-- ADMIN HELPERS (assign / revoke a role, reset a password) 
CREATE OR REPLACE FUNCTION fn_assign_role (p_user_id INT, p_role_code VARCHAR(20))
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = driving_school, public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app_users WHERE user_id = p_user_id) THEN
        RETURN jsonb_build_object('ok', false, 'message', 'No such user.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM app_roles WHERE role_code = upper(p_role_code)) THEN
        RETURN jsonb_build_object('ok', false, 'message', 'No such role.');
    END IF;
    INSERT INTO app_user_roles (user_id, role_code) VALUES (p_user_id, upper(p_role_code))
    ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('ok', true, 'message', 'Role assigned.');
END; $$;

CREATE OR REPLACE FUNCTION fn_revoke_role (p_user_id INT, p_role_code VARCHAR(20))
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = driving_school, public
AS $$
BEGIN
    DELETE FROM app_user_roles WHERE user_id = p_user_id AND role_code = upper(p_role_code);
    RETURN jsonb_build_object('ok', true, 'message', 'Role revoked.');
END; $$;

CREATE OR REPLACE FUNCTION fn_set_password (p_user_id INT, p_new_password TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = driving_school, extensions, public
AS $$
BEGIN
    IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Password must be at least 8 characters.');
    END IF;
    UPDATE app_users
       SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
           failed_attempts = 0, locked_until = NULL
     WHERE user_id = p_user_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'message', 'No such user.'); END IF;
    RETURN jsonb_build_object('ok', true, 'message', 'Password updated.');
END; $$;

 
-- GRANTS  (least privilege) 
-- The credentials table is NEVER directly readable by API roles.
REVOKE ALL ON app_users        FROM anon, authenticated;
REVOKE ALL ON app_user_roles   FROM anon, authenticated;
REVOKE ALL ON app_login_audit  FROM anon, authenticated;

-- Read-only catalogue + safe views.
GRANT SELECT ON app_roles      TO anon, authenticated;
GRANT SELECT ON vw_app_users   TO authenticated;
GRANT SELECT ON vw_user_roles  TO authenticated;

-- Public can register and sign in; only the definer functions touch hashes.
GRANT EXECUTE ON FUNCTION fn_register(VARCHAR,TEXT,VARCHAR,VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_signin(VARCHAR,TEXT)                   TO anon, authenticated;

-- Role/password management: authenticated only (lock to admins in production).
GRANT EXECUTE ON FUNCTION fn_assign_role(INT,VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_revoke_role(INT,VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_set_password(INT,TEXT)   TO authenticated;

-- For testing/demo purposes, we also grant read access to the active instructors and customer balance views, which include personally identifiable information. In production, you would likely restrict these to staff-only roles or create sanitized versions.
GRANT SELECT ON driving_school.vw_customer_balance      TO anon, authenticated;
GRANT SELECT ON driving_school.vw_active_instructors      TO anon, authenticated;
GRANT SELECT ON driving_school.vw_customer_full_address     TO anon, authenticated;
GRANT SELECT ON driving_school.vw_instructor_workload    TO anon, authenticated;
GRANT SELECT ON driving_school.vw_lesson_details    TO anon, authenticated;
GRANT SELECT ON driving_school.vw_today_lessons   TO anon, authenticated;
GRANT SELECT ON driving_school.vw_upcoming_lessons   TO anon, authenticated;


-- SEED: three demo accounts (CHANGE THESE PASSWORDS). 
SELECT fn_register('admin@dsbps.ca',     'Admin#2026',  'System Administrator', 'ADMIN');
SELECT fn_register('frontdesk@dsbps.ca', 'Desk#2026',   'Front Desk Operator',  'STAFF');
SELECT fn_register('analyst@dsbps.ca',   'Report#2026', 'Reporting Analyst',    'REPORT');
 