 
-- Driving School Booking & Payment System
-- 02_sample_data.sql  -  reference + operational data population
-- Run AFTER 01_schema_ddl.sql.  Triggers in 04 should be loaded AFTER
-- this file if you want the historic amount_outstanding values kept as-is;
-- otherwise load triggers first and let them recompute balances. 
-- Character set: UTF-8

USE driving_school;  

INSERT INTO Ref_Customer_Status (customer_status_code, customer_status_description) VALUES
('ACT','Active'),('INA','Inactive'),('SUS','Suspended for non-payment'),
('PASS','Passed test - archived'),('LEAD','Prospective lead, not yet enrolled');

INSERT INTO Ref_Lesson_Status (lesson_status_code, lesson_status_description) VALUES
('BOOK','Booked'),('CONF','Confirmed'),('COMP','Completed'),
('CANC','Cancelled by customer'),('NOSH','No show'),('RESC','Rescheduled');

INSERT INTO Ref_Payment_Methods (payment_method_code, payment_method_description) VALUES
('CASH','Cash'),('CARD','Debit / Credit card'),('BANK','Bank transfer / Interac e-Transfer'),
('DD','Pre-authorized debit'),('VOUCH','Gift voucher');

INSERT INTO app_roles (role_code, role_name, description) VALUES
('ADMIN',  'Administrator',    'Full administrative access (maps to ds_dba).'),
('STAFF',  'Front-desk staff', 'Operational booking/payment access (maps to ds_app).'),
('REPORT', 'Reporting analyst','Read-only access to reports (maps to ds_report).');

INSERT INTO Addresses
(line_1_number_building, line_2_number_street, line_3_area_locality, city, zip_postcode, state_province_county, country) VALUES
('1234','17 Avenue SW','Beltline','Calgary','T2T 0C5','Alberta','Canada'),
('88','Kensington Road NW','Hillhurst','Calgary','T2N 3P9','Alberta','Canada'),
('455','Macleod Trail SE','Victoria Park','Calgary','T2G 2G8','Alberta','Canada'),
('210','4 Street SW','Mission','Calgary','T2S 1Z1','Alberta','Canada'),
('77','Crowchild Trail NW','Brentwood','Calgary','T2L 1Y8','Alberta','Canada'),
('330','Bow Trail SW','Sunalta','Calgary','T3C 2E8','Alberta','Canada'),
('12','Edmonton Trail NE','Crescent Heights','Calgary','T2E 3W5','Alberta','Canada'),
('905','Memorial Drive NW','Sunnyside','Calgary','T2N 3C8','Alberta','Canada'),
('150','Country Hills Boulevard NW','Country Hills','Calgary','T3K 5J5','Alberta','Canada'),
('60','Elbow Drive SW','Britannia','Calgary','T2S 2J5','Alberta','Canada');

INSERT INTO vehicles (vehicle_details) VALUES
('Honda Civic 2.0 - Manual - Plate ABX 4471'),
('Toyota Corolla 1.8 - Manual - Plate BCK 8820'),
('Mazda3 2.0 - Manual - Plate CDL 1193'),
('Chevrolet Bolt - Automatic (EV) - Plate DEM 2204'),
('Hyundai Elantra 2.0 - Automatic - Plate EFP 6657'),
('Volkswagen Golf 1.4 - Manual - Plate FGS 3318');

INSERT INTO Staff
(staff_address_id, customer_status_code, nickname, first_name, middle_name, last_name,
 date_of_birth, date_joined_staff, date_left_staff, other_staff_details) VALUES
(1,'ACT','Dave','David','John','Thompson','1980-04-12','2015-01-10 09:00:00',NULL,'Licensed driving instructor, manual + automatic'),
(4,'ACT','Sue','Susan',NULL,'Patel','1985-09-23','2017-03-01 09:00:00',NULL,'Licensed instructor, automatic specialist'),
(6,'ACT','Mike','Michael','Andrew','OBrien','1978-12-02','2013-06-15 09:00:00',NULL,'Licensed instructor, manual'),
(9,'ACT','Anya','Anya',NULL,'Kowalski','1990-07-30','2020-09-01 09:00:00',NULL,'Licensed instructor, manual'),
(2,'INA','Tom','Thomas',NULL,'Edwards','1975-02-17','2012-02-20 09:00:00','2023-11-30 17:00:00','Retired instructor'),
(3,'ACT',NULL,'Grace','Marie','Lawson','1992-11-05','2021-04-12 09:00:00',NULL,'Office administrator - not an instructor');

-- Customers inserted with amount_outstanding 0; triggers in the full build
-- compute the live balance after the lesson/payment inserts below.
INSERT INTO Customers
(customer_address_id, customer_status_code, date_became_customer, date_of_birth,
 first_name, last_name, amount_outstanding, email_address, phone_number, cell_mobile_phone_number) VALUES
(2,'ACT','2024-01-15','2006-05-20','James','Wright',0.00,'james.wright@example.ca','(403) 555-0101','(587) 555-0111'),
(3,'ACT','2024-02-02','2005-08-11','Sophie','Clarke',0.00,'sophie.clarke@example.ca','(403) 555-0102','(587) 555-0112'),
(5,'ACT','2024-02-20','2007-01-30','Liam','Murphy',0.00,'liam.murphy@example.ca','(403) 555-0103','(587) 555-0113'),
(7,'ACT','2024-03-05','2004-12-09','Aisha','Khan',0.00,'aisha.khan@example.ca','(403) 555-0104','(587) 555-0114'),
(8,'SUS','2023-11-10','2003-03-17','Daniel','Evans',0.00,'daniel.evans@example.ca','(403) 555-0105','(587) 555-0115'),
(10,'ACT','2024-04-01','2006-09-25','Chloe','Roberts',0.00,'chloe.roberts@example.ca','(403) 555-0106','(587) 555-0116'),
(1,'PASS','2023-09-12','2002-06-14','Oliver','Bennett',0.00,'oliver.bennett@example.ca','(403) 555-0107','(587) 555-0117'),
(4,'ACT','2024-05-18','2008-02-28','Maya','Singh',0.00,'maya.singh@example.ca','(403) 555-0108','(587) 555-0118');

INSERT INTO Lessons
(customer_id, lesson_status_code, staff_id, vehicle_id, lesson_date, lesson_time, price, other_lesson_details) VALUES
(1,'COMP',1,1,'2024-06-03','09:00:00',65.00,'Introductory lesson - residential streets'),
(1,'COMP',1,1,'2024-06-10','09:00:00',70.00,'Traffic circles and merging'),
(1,'BOOK',1,1,'2026-06-15','09:00:00',80.00,'Mock road-test preparation'),
(2,'COMP',2,4,'2024-06-05','11:00:00',75.00,'Automatic - downtown core driving'),
(2,'CONF',2,4,'2026-06-12','11:00:00',75.00,'Deerfoot Trail - divided highway'),
(3,'COMP',3,2,'2024-06-07','14:00:00',70.00,'Parking and manoeuvres'),
(3,'CANC',3,2,'2024-06-14','14:00:00',70.00,'Cancelled - illness'),
(4,'COMP',4,3,'2024-06-08','10:00:00',70.00,'Night driving'),
(4,'BOOK',4,3,'2026-06-16','10:00:00',70.00,'Stoney Trail - highway introduction'),
(5,'NOSH',1,1,'2024-06-09','16:00:00',70.00,'No show - charged'),
(6,'COMP',2,5,'2024-06-11','13:00:00',75.00,'Automatic basics'),
(6,'BOOK',2,5,'2026-06-18','13:00:00',75.00,'Hill starts - Crescent Heights'),
(7,'COMP',1,1,'2024-05-20','09:00:00',65.00,'Final pre-test'),
(8,'COMP',3,6,'2024-06-02','15:00:00',70.00,'Parallel parking');

INSERT INTO Customer_Payments
(customer_id, datetime_payment, payment_method_code, amount_payment, other_payment_details) VALUES
(1,'2024-06-03 09:45:00','CARD',65.00,'Lesson 1 paid'),
(1,'2024-06-10 09:45:00','CARD',70.00,'Lesson 2 paid'),
(2,'2024-06-05 11:45:00','CASH',75.00,'Paid on the day'),
(3,'2024-06-07 14:45:00','BANK',70.00,'Interac e-Transfer'),
(4,'2024-06-08 10:45:00','CARD',50.00,'Part payment'),
(6,'2024-06-11 13:45:00','DD',40.00,'Pre-authorized debit - part payment'),
(7,'2024-05-20 10:00:00','CARD',65.00,'Paid in full'),
(8,'2024-06-02 15:45:00','VOUCH',10.00,'Gift voucher - part payment');