-- Migration: 20261017015659_seed_sample_data
-- Purpose: Complete demonstration dataset (50 members, 7 sports, 7 facilities, 7 coaches, 3 receptionists, memberships, coupons, classes, bookings, checkins, attendance, evaluation)

-- 1. Sports (7 môn thể thao)
INSERT INTO "sports" ("name", "description") SELECT 'Bơi lội', 'Bơi tự do, bơi ếch, bơi sải cho mọi lứa tuổi' WHERE NOT EXISTS (SELECT 1 FROM "sports" WHERE "name" = 'Bơi lội' AND "deleted_at" IS NULL);
INSERT INTO "sports" ("name", "description") SELECT 'Cầu lông', 'Sân cầu lông tiêu chuẩn thi đấu' WHERE NOT EXISTS (SELECT 1 FROM "sports" WHERE "name" = 'Cầu lông' AND "deleted_at" IS NULL);
INSERT INTO "sports" ("name", "description") SELECT 'Bóng đá', 'Sân bóng đá cỏ nhân tạo mini' WHERE NOT EXISTS (SELECT 1 FROM "sports" WHERE "name" = 'Bóng đá' AND "deleted_at" IS NULL);
INSERT INTO "sports" ("name", "description") SELECT 'Yoga', 'Yoga cơ bản, phục hồi và nâng cao' WHERE NOT EXISTS (SELECT 1 FROM "sports" WHERE "name" = 'Yoga' AND "deleted_at" IS NULL);
INSERT INTO "sports" ("name", "description") SELECT 'Gym', 'Khu thể hình, cardio và tạ tự do' WHERE NOT EXISTS (SELECT 1 FROM "sports" WHERE "name" = 'Gym' AND "deleted_at" IS NULL);
INSERT INTO "sports" ("name", "description") SELECT 'Bóng rổ', 'Sân bóng rổ tiêu chuẩn thi đấu' WHERE NOT EXISTS (SELECT 1 FROM "sports" WHERE "name" = 'Bóng rổ' AND "deleted_at" IS NULL);
INSERT INTO "sports" ("name", "description") SELECT 'Tennis', 'Sân quần vợt mặt sân cứng tiêu chuẩn' WHERE NOT EXISTS (SELECT 1 FROM "sports" WHERE "name" = 'Tennis' AND "deleted_at" IS NULL);

-- 2. Facilities (7 cơ sở vật chất / sân tập)
INSERT INTO "facilities" ("name", "type", "capacity_per_slot", "price_per_slot") SELECT 'Hồ bơi trong nhà', 'ROOM', 30, 60000 WHERE NOT EXISTS (SELECT 1 FROM "facilities" WHERE "name" = 'Hồ bơi trong nhà' AND "deleted_at" IS NULL);
INSERT INTO "facilities" ("name", "type", "capacity_per_slot", "price_per_slot") SELECT 'Sân cầu lông 1', 'COURT', 4, 80000 WHERE NOT EXISTS (SELECT 1 FROM "facilities" WHERE "name" = 'Sân cầu lông 1' AND "deleted_at" IS NULL);
INSERT INTO "facilities" ("name", "type", "capacity_per_slot", "price_per_slot") SELECT 'Sân cầu lông 2', 'COURT', 4, 80000 WHERE NOT EXISTS (SELECT 1 FROM "facilities" WHERE "name" = 'Sân cầu lông 2' AND "deleted_at" IS NULL);
INSERT INTO "facilities" ("name", "type", "capacity_per_slot", "price_per_slot") SELECT 'Sân bóng đá mini', 'FIELD', 14, 300000 WHERE NOT EXISTS (SELECT 1 FROM "facilities" WHERE "name" = 'Sân bóng đá mini' AND "deleted_at" IS NULL);
INSERT INTO "facilities" ("name", "type", "capacity_per_slot", "price_per_slot") SELECT 'Phòng Yoga', 'ROOM', 20, 50000 WHERE NOT EXISTS (SELECT 1 FROM "facilities" WHERE "name" = 'Phòng Yoga' AND "deleted_at" IS NULL);
INSERT INTO "facilities" ("name", "type", "capacity_per_slot", "price_per_slot") SELECT 'Phòng Gym', 'GYM', 40, 40000 WHERE NOT EXISTS (SELECT 1 FROM "facilities" WHERE "name" = 'Phòng Gym' AND "deleted_at" IS NULL);
INSERT INTO "facilities" ("name", "type", "capacity_per_slot", "price_per_slot") SELECT 'Sân Tennis 1', 'COURT', 4, 150000 WHERE NOT EXISTS (SELECT 1 FROM "facilities" WHERE "name" = 'Sân Tennis 1' AND "deleted_at" IS NULL);

-- 2b. FacilitySports (Liên kết sân và bộ môn)
INSERT INTO "facility_sports" ("facility_id", "sport_id") SELECT f."id", s."id" FROM "facilities" f, "sports" s WHERE f."name" = 'Hồ bơi trong nhà' AND s."name" = 'Bơi lội' AND NOT EXISTS (SELECT 1 FROM "facility_sports" fs WHERE fs."facility_id" = f."id" AND fs."sport_id" = s."id");
INSERT INTO "facility_sports" ("facility_id", "sport_id") SELECT f."id", s."id" FROM "facilities" f, "sports" s WHERE f."name" = 'Sân cầu lông 1' AND s."name" = 'Cầu lông' AND NOT EXISTS (SELECT 1 FROM "facility_sports" fs WHERE fs."facility_id" = f."id" AND fs."sport_id" = s."id");
INSERT INTO "facility_sports" ("facility_id", "sport_id") SELECT f."id", s."id" FROM "facilities" f, "sports" s WHERE f."name" = 'Sân cầu lông 2' AND s."name" = 'Cầu lông' AND NOT EXISTS (SELECT 1 FROM "facility_sports" fs WHERE fs."facility_id" = f."id" AND fs."sport_id" = s."id");
INSERT INTO "facility_sports" ("facility_id", "sport_id") SELECT f."id", s."id" FROM "facilities" f, "sports" s WHERE f."name" = 'Sân bóng đá mini' AND s."name" = 'Bóng đá' AND NOT EXISTS (SELECT 1 FROM "facility_sports" fs WHERE fs."facility_id" = f."id" AND fs."sport_id" = s."id");
INSERT INTO "facility_sports" ("facility_id", "sport_id") SELECT f."id", s."id" FROM "facilities" f, "sports" s WHERE f."name" = 'Phòng Yoga' AND s."name" = 'Yoga' AND NOT EXISTS (SELECT 1 FROM "facility_sports" fs WHERE fs."facility_id" = f."id" AND fs."sport_id" = s."id");
INSERT INTO "facility_sports" ("facility_id", "sport_id") SELECT f."id", s."id" FROM "facilities" f, "sports" s WHERE f."name" = 'Phòng Gym' AND s."name" = 'Gym' AND NOT EXISTS (SELECT 1 FROM "facility_sports" fs WHERE fs."facility_id" = f."id" AND fs."sport_id" = s."id");
INSERT INTO "facility_sports" ("facility_id", "sport_id") SELECT f."id", s."id" FROM "facilities" f, "sports" s WHERE f."name" = 'Sân Tennis 1' AND s."name" = 'Tennis' AND NOT EXISTS (SELECT 1 FROM "facility_sports" fs WHERE fs."facility_id" = f."id" AND fs."sport_id" = s."id");

-- 3. Accounts (1 Manager, 3 Lễ tân, 7 Huấn luyện viên, 50 Hội viên)
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'manager@sportscenter.local', '0900000001', '$2b$12$jGYybvpGl3ilG/hh3OSDJeVq6ijqIXtMH50JTL57NZdTdwd/CjYTa', 'Quản lý trung tâm', 'MANAGER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'manager@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'reception1@sportscenter.local', '0902000001', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Nguyễn Thu Hà', 'RECEPTIONIST', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'reception1@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'reception2@sportscenter.local', '0902000002', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Đỗ Quang Vinh', 'RECEPTIONIST', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'reception2@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'reception3@sportscenter.local', '0902000003', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Lê Thanh Trúc', 'RECEPTIONIST', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'reception3@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'coach1@sportscenter.local', '0901000001', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Trần Văn Huấn', 'COACH', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'coach1@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'coach2@sportscenter.local', '0901000002', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Lê Thị Mai', 'COACH', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'coach2@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'coach3@sportscenter.local', '0901000003', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Phạm Minh Tuấn', 'COACH', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'coach3@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'coach4@sportscenter.local', '0901000004', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Hoàng Quốc Bảo', 'COACH', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'coach4@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'coach5@sportscenter.local', '0901000005', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Nguyễn Hải Đăng', 'COACH', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'coach5@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'coach6@sportscenter.local', '0901000006', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Vũ Phương Thảo', 'COACH', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'coach6@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'coach7@sportscenter.local', '0901000007', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Đặng Tuấn Kiệt', 'COACH', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'coach7@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member1@sportscenter.local', '0903000001', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Hoàng Anh Thư', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member1@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member2@sportscenter.local', '0903000002', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Vũ Đức Long', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member2@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member3@sportscenter.local', '0903000003', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Bùi Ngọc Lan', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member3@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member4@sportscenter.local', '0903000004', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Nguyễn Minh Quân', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member4@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member5@sportscenter.local', '0903000005', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Trần Thu Trang', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member5@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member6@sportscenter.local', '0903000006', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Lê Tuấn Khang', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member6@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member7@sportscenter.local', '0903000007', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Phạm Quỳnh Anh', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member7@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member8@sportscenter.local', '0903000008', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Đỗ Thành Đạt', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member8@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member9@sportscenter.local', '0903000009', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Nguyễn Thị Hương', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member9@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member10@sportscenter.local', '0903000010', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Trần Văn Nam', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member10@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member11@sportscenter.local', '0903000011', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Lê Hoàng Yến', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member11@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member12@sportscenter.local', '0903000012', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Phạm Đức Huy', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member12@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member13@sportscenter.local', '0903000013', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Võ Thị Bích', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member13@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member14@sportscenter.local', '0903000014', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Đặng Gia Bảo', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member14@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member15@sportscenter.local', '0903000015', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Bùi Thanh Hằng', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member15@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member16@sportscenter.local', '0903000016', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Ngô Văn Phúc', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member16@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member17@sportscenter.local', '0903000017', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Dương Thảo My', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member17@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member18@sportscenter.local', '0903000018', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Hồ Quốc Cường', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member18@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member19@sportscenter.local', '0903000019', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Lý Ngọc Mai', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member19@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member20@sportscenter.local', '0903000020', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Trương Tiến Dũng', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member20@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member21@sportscenter.local', '0903000021', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Nguyễn Thùy Linh', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member21@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member22@sportscenter.local', '0903000022', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Trần Đình Trọng', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member22@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member23@sportscenter.local', '0903000023', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Lê Khánh Huyền', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member23@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member24@sportscenter.local', '0903000024', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Phạm Nhật Minh', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member24@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member25@sportscenter.local', '0903000025', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Võ Hoàng Nam', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member25@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member26@sportscenter.local', '0903000026', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Đỗ Mỹ Linh', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member26@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member27@sportscenter.local', '0903000027', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Nguyễn Hữu Thắng', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member27@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member28@sportscenter.local', '0903000028', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Trần Bảo Ngọc', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member28@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member29@sportscenter.local', '0903000029', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Lê Minh Triết', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member29@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member30@sportscenter.local', '0903000030', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Phạm Phương Thảo', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member30@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member31@sportscenter.local', '0903000031', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Đặng Đình Phong', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member31@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member32@sportscenter.local', '0903000032', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Bùi Thu Uyên', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member32@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member33@sportscenter.local', '0903000033', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Ngô Quốc Anh', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member33@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member34@sportscenter.local', '0903000034', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Dương Kim Ngân', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member34@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member35@sportscenter.local', '0903000035', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Hồ Tấn Tài', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member35@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member36@sportscenter.local', '0903000036', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Lý Thanh Hằng', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member36@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member37@sportscenter.local', '0903000037', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Trương Văn Hậu', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member37@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member38@sportscenter.local', '0903000038', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Nguyễn Hồng Nhung', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member38@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member39@sportscenter.local', '0903000039', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Trần Công Phượng', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member39@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member40@sportscenter.local', '0903000040', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Lê Văn Xuân', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member40@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member41@sportscenter.local', '0903000041', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Phạm Hải Yến', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member41@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member42@sportscenter.local', '0903000042', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Võ Minh Trí', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member42@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member43@sportscenter.local', '0903000043', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Đỗ Duy Mạnh', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member43@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member44@sportscenter.local', '0903000044', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Nguyễn Quang Hải', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member44@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member45@sportscenter.local', '0903000045', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Trần Thị Duyên', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member45@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member46@sportscenter.local', '0903000046', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Lê Tiến Đạt', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member46@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member47@sportscenter.local', '0903000047', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Phạm Thanh Sơn', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member47@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member48@sportscenter.local', '0903000048', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Đặng Văn Lâm', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member48@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member49@sportscenter.local', '0903000049', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Bùi Hoàng Việt', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member49@sportscenter.local');
INSERT INTO "accounts" ("email", "phone", "password_hash", "full_name", "role", "status", "email_verified_at") SELECT 'member50@sportscenter.local', '0903000050', '$2b$12$zs9gAkVf8ETjUmCIDsaOSeIk2eM1wmRzOcnIIE8AOT4Mca5euTety', 'Ngô Thị Thanh', 'MEMBER', 'ACTIVE', NOW() WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "email" = 'member50@sportscenter.local');

-- 4. Profiles (Tạo hồ sơ cho từng Role)
INSERT INTO "manager_profile" ("account_id") SELECT "id" FROM "accounts" WHERE "role" = 'MANAGER' AND NOT EXISTS (SELECT 1 FROM "manager_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "receptionist_profile" ("account_id") SELECT "id" FROM "accounts" WHERE "email" = 'reception1@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "receptionist_profile" rp WHERE rp."account_id" = "accounts"."id");
INSERT INTO "receptionist_profile" ("account_id") SELECT "id" FROM "accounts" WHERE "email" = 'reception2@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "receptionist_profile" rp WHERE rp."account_id" = "accounts"."id");
INSERT INTO "receptionist_profile" ("account_id") SELECT "id" FROM "accounts" WHERE "email" = 'reception3@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "receptionist_profile" rp WHERE rp."account_id" = "accounts"."id");
INSERT INTO "coach_profile" ("account_id", "bio", "experience", "certifications") SELECT "id", 'HLV Bơi lội và Thể hình với 8 năm kinh nghiệm đào tạo vận động viên.', '8 năm đào tạo chuyên nghiệp', 'FINA Level 2, NASM-CPT' FROM "accounts" WHERE "email" = 'coach1@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_profile" cp WHERE cp."account_id" = "accounts"."id");
INSERT INTO "coach_specializations" ("coach_id", "sport_id", "status", "reviewed_by", "reviewed_at") SELECT a."id", s."id", 'APPROVED', m."id", NOW() FROM "accounts" a, "sports" s, "accounts" m WHERE a."email" = 'coach1@sportscenter.local' AND s."name" = 'Bơi lội' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_specializations" cs WHERE cs."coach_id" = a."id" AND cs."sport_id" = s."id");
INSERT INTO "coach_specializations" ("coach_id", "sport_id", "status", "reviewed_by", "reviewed_at") SELECT a."id", s."id", 'APPROVED', m."id", NOW() FROM "accounts" a, "sports" s, "accounts" m WHERE a."email" = 'coach1@sportscenter.local' AND s."name" = 'Gym' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_specializations" cs WHERE cs."coach_id" = a."id" AND cs."sport_id" = s."id");
INSERT INTO "coach_profile" ("account_id", "bio", "experience", "certifications") SELECT "id", 'Giáo viên Yoga chuyên sâu về trị liệu và phục hồi cơ xương khớp.', '6 năm giảng dạy Yoga', 'Yoga Alliance RYT-500' FROM "accounts" WHERE "email" = 'coach2@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_profile" cp WHERE cp."account_id" = "accounts"."id");
INSERT INTO "coach_specializations" ("coach_id", "sport_id", "status", "reviewed_by", "reviewed_at") SELECT a."id", s."id", 'APPROVED', m."id", NOW() FROM "accounts" a, "sports" s, "accounts" m WHERE a."email" = 'coach2@sportscenter.local' AND s."name" = 'Yoga' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_specializations" cs WHERE cs."coach_id" = a."id" AND cs."sport_id" = s."id");
INSERT INTO "coach_profile" ("account_id", "bio", "experience", "certifications") SELECT "id", 'Cựu VĐV Cầu lông cấp kiện tướng quốc gia, đào tạo chiến thuật đôi.', '7 năm huấn luyện thi đấu', 'HLV Cầu lông Cấp 1 Quốc gia' FROM "accounts" WHERE "email" = 'coach3@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_profile" cp WHERE cp."account_id" = "accounts"."id");
INSERT INTO "coach_specializations" ("coach_id", "sport_id", "status", "reviewed_by", "reviewed_at") SELECT a."id", s."id", 'APPROVED', m."id", NOW() FROM "accounts" a, "sports" s, "accounts" m WHERE a."email" = 'coach3@sportscenter.local' AND s."name" = 'Cầu lông' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_specializations" cs WHERE cs."coach_id" = a."id" AND cs."sport_id" = s."id");
INSERT INTO "coach_specializations" ("coach_id", "sport_id", "status", "reviewed_by", "reviewed_at") SELECT a."id", s."id", 'APPROVED', m."id", NOW() FROM "accounts" a, "sports" s, "accounts" m WHERE a."email" = 'coach3@sportscenter.local' AND s."name" = 'Bóng đá' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_specializations" cs WHERE cs."coach_id" = a."id" AND cs."sport_id" = s."id");
INSERT INTO "coach_profile" ("account_id", "bio", "experience", "certifications") SELECT "id", 'Chuyên gia thể lực và kỹ năng bóng rổ hiện đại.', '5 năm huấn luyện bóng rổ trẻ', 'FIBA Coach Level 1, CSCS' FROM "accounts" WHERE "email" = 'coach4@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_profile" cp WHERE cp."account_id" = "accounts"."id");
INSERT INTO "coach_specializations" ("coach_id", "sport_id", "status", "reviewed_by", "reviewed_at") SELECT a."id", s."id", 'APPROVED', m."id", NOW() FROM "accounts" a, "sports" s, "accounts" m WHERE a."email" = 'coach4@sportscenter.local' AND s."name" = 'Bóng rổ' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_specializations" cs WHERE cs."coach_id" = a."id" AND cs."sport_id" = s."id");
INSERT INTO "coach_specializations" ("coach_id", "sport_id", "status", "reviewed_by", "reviewed_at") SELECT a."id", s."id", 'APPROVED', m."id", NOW() FROM "accounts" a, "sports" s, "accounts" m WHERE a."email" = 'coach4@sportscenter.local' AND s."name" = 'Gym' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_specializations" cs WHERE cs."coach_id" = a."id" AND cs."sport_id" = s."id");
INSERT INTO "coach_profile" ("account_id", "bio", "experience", "certifications") SELECT "id", 'HLV bơi lội chuyên nghiệp, xử lý kỹ năng sinh tồn dưới nước.', '9 năm đào tạo bơi lội', 'Chứng chỉ cứu hộ bơi lội quốc tế, FINA' FROM "accounts" WHERE "email" = 'coach5@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_profile" cp WHERE cp."account_id" = "accounts"."id");
INSERT INTO "coach_specializations" ("coach_id", "sport_id", "status", "reviewed_by", "reviewed_at") SELECT a."id", s."id", 'APPROVED', m."id", NOW() FROM "accounts" a, "sports" s, "accounts" m WHERE a."email" = 'coach5@sportscenter.local' AND s."name" = 'Bơi lội' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_specializations" cs WHERE cs."coach_id" = a."id" AND cs."sport_id" = s."id");
INSERT INTO "coach_profile" ("account_id", "bio", "experience", "certifications") SELECT "id", 'Huấn luyện viên Yoga Vinyasa và Hatha cho người bận rộn.', '4 năm giảng dạy', 'Yoga Alliance RYT-200' FROM "accounts" WHERE "email" = 'coach6@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_profile" cp WHERE cp."account_id" = "accounts"."id");
INSERT INTO "coach_specializations" ("coach_id", "sport_id", "status", "reviewed_by", "reviewed_at") SELECT a."id", s."id", 'APPROVED', m."id", NOW() FROM "accounts" a, "sports" s, "accounts" m WHERE a."email" = 'coach6@sportscenter.local' AND s."name" = 'Yoga' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_specializations" cs WHERE cs."coach_id" = a."id" AND cs."sport_id" = s."id");
INSERT INTO "coach_profile" ("account_id", "bio", "experience", "certifications") SELECT "id", 'Chuyên sâu Tennis hiện đại và kỹ thuật bộ chân di chuyển linh hoạt.', '8 năm đào tạo Tennis & Cầu lông', 'ITF Level 1 Coaching Certificate' FROM "accounts" WHERE "email" = 'coach7@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_profile" cp WHERE cp."account_id" = "accounts"."id");
INSERT INTO "coach_specializations" ("coach_id", "sport_id", "status", "reviewed_by", "reviewed_at") SELECT a."id", s."id", 'APPROVED', m."id", NOW() FROM "accounts" a, "sports" s, "accounts" m WHERE a."email" = 'coach7@sportscenter.local' AND s."name" = 'Tennis' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_specializations" cs WHERE cs."coach_id" = a."id" AND cs."sport_id" = s."id");
INSERT INTO "coach_specializations" ("coach_id", "sport_id", "status", "reviewed_by", "reviewed_at") SELECT a."id", s."id", 'APPROVED', m."id", NOW() FROM "accounts" a, "sports" s, "accounts" m WHERE a."email" = 'coach7@sportscenter.local' AND s."name" = 'Cầu lông' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "coach_specializations" cs WHERE cs."coach_id" = a."id" AND cs."sport_id" = s."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 200000, 'Tập Yoga dẻo dai cơ thể và giảm stress', 'Người thân thành viên 1 (0918000001)' FROM "accounts" WHERE "email" = 'member1@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 500000, 'Học bơi sải kỹ thuật chuẩn', 'Người thân thành viên 2 (0918000002)' FROM "accounts" WHERE "email" = 'member2@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 800000, 'Rèn luyện thể lực và nâng cao sức bền', 'Người thân thành viên 3 (0918000003)' FROM "accounts" WHERE "email" = 'member3@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 1000000, 'Tập luyện đánh cầu lông phong trào', 'Người thân thành viên 4 (0918000004)' FROM "accounts" WHERE "email" = 'member4@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 1500000, 'Nâng cao kỹ năng chơi Tennis', 'Người thân thành viên 5 (0918000005)' FROM "accounts" WHERE "email" = 'member5@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 2000000, 'Cải thiện vóc dáng và tim mạch', 'Người thân thành viên 6 (0918000006)' FROM "accounts" WHERE "email" = 'member6@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 0, 'Tập thể hình tăng cân lành mạnh', 'Người thân thành viên 7 (0918000007)' FROM "accounts" WHERE "email" = 'member7@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 200000, 'Giảm 5kg mỡ, tăng cơ bắp', 'Người thân thành viên 8 (0918000008)' FROM "accounts" WHERE "email" = 'member8@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 500000, 'Tập Yoga dẻo dai cơ thể và giảm stress', 'Người thân thành viên 9 (0918000009)' FROM "accounts" WHERE "email" = 'member9@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 800000, 'Học bơi sải kỹ thuật chuẩn', 'Người thân thành viên 10 (0918000010)' FROM "accounts" WHERE "email" = 'member10@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 1000000, 'Rèn luyện thể lực và nâng cao sức bền', 'Người thân thành viên 11 (0918000011)' FROM "accounts" WHERE "email" = 'member11@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 1500000, 'Tập luyện đánh cầu lông phong trào', 'Người thân thành viên 12 (0918000012)' FROM "accounts" WHERE "email" = 'member12@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 2000000, 'Nâng cao kỹ năng chơi Tennis', 'Người thân thành viên 13 (0918000013)' FROM "accounts" WHERE "email" = 'member13@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 0, 'Cải thiện vóc dáng và tim mạch', 'Người thân thành viên 14 (0918000014)' FROM "accounts" WHERE "email" = 'member14@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 200000, 'Tập thể hình tăng cân lành mạnh', 'Người thân thành viên 15 (0918000015)' FROM "accounts" WHERE "email" = 'member15@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 500000, 'Giảm 5kg mỡ, tăng cơ bắp', 'Người thân thành viên 16 (0918000016)' FROM "accounts" WHERE "email" = 'member16@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 800000, 'Tập Yoga dẻo dai cơ thể và giảm stress', 'Người thân thành viên 17 (0918000017)' FROM "accounts" WHERE "email" = 'member17@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 1000000, 'Học bơi sải kỹ thuật chuẩn', 'Người thân thành viên 18 (0918000018)' FROM "accounts" WHERE "email" = 'member18@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 1500000, 'Rèn luyện thể lực và nâng cao sức bền', 'Người thân thành viên 19 (0918000019)' FROM "accounts" WHERE "email" = 'member19@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 2000000, 'Tập luyện đánh cầu lông phong trào', 'Người thân thành viên 20 (0918000020)' FROM "accounts" WHERE "email" = 'member20@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 0, 'Nâng cao kỹ năng chơi Tennis', 'Người thân thành viên 21 (0918000021)' FROM "accounts" WHERE "email" = 'member21@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 200000, 'Cải thiện vóc dáng và tim mạch', 'Người thân thành viên 22 (0918000022)' FROM "accounts" WHERE "email" = 'member22@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 500000, 'Tập thể hình tăng cân lành mạnh', 'Người thân thành viên 23 (0918000023)' FROM "accounts" WHERE "email" = 'member23@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 800000, 'Giảm 5kg mỡ, tăng cơ bắp', 'Người thân thành viên 24 (0918000024)' FROM "accounts" WHERE "email" = 'member24@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 1000000, 'Tập Yoga dẻo dai cơ thể và giảm stress', 'Người thân thành viên 25 (0918000025)' FROM "accounts" WHERE "email" = 'member25@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 1500000, 'Học bơi sải kỹ thuật chuẩn', 'Người thân thành viên 26 (0918000026)' FROM "accounts" WHERE "email" = 'member26@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 2000000, 'Rèn luyện thể lực và nâng cao sức bền', 'Người thân thành viên 27 (0918000027)' FROM "accounts" WHERE "email" = 'member27@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 0, 'Tập luyện đánh cầu lông phong trào', 'Người thân thành viên 28 (0918000028)' FROM "accounts" WHERE "email" = 'member28@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 200000, 'Nâng cao kỹ năng chơi Tennis', 'Người thân thành viên 29 (0918000029)' FROM "accounts" WHERE "email" = 'member29@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 500000, 'Cải thiện vóc dáng và tim mạch', 'Người thân thành viên 30 (0918000030)' FROM "accounts" WHERE "email" = 'member30@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 800000, 'Tập thể hình tăng cân lành mạnh', 'Người thân thành viên 31 (0918000031)' FROM "accounts" WHERE "email" = 'member31@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 1000000, 'Giảm 5kg mỡ, tăng cơ bắp', 'Người thân thành viên 32 (0918000032)' FROM "accounts" WHERE "email" = 'member32@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 1500000, 'Tập Yoga dẻo dai cơ thể và giảm stress', 'Người thân thành viên 33 (0918000033)' FROM "accounts" WHERE "email" = 'member33@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 2000000, 'Học bơi sải kỹ thuật chuẩn', 'Người thân thành viên 34 (0918000034)' FROM "accounts" WHERE "email" = 'member34@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 0, 'Rèn luyện thể lực và nâng cao sức bền', 'Người thân thành viên 35 (0918000035)' FROM "accounts" WHERE "email" = 'member35@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 200000, 'Tập luyện đánh cầu lông phong trào', 'Người thân thành viên 36 (0918000036)' FROM "accounts" WHERE "email" = 'member36@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 500000, 'Nâng cao kỹ năng chơi Tennis', 'Người thân thành viên 37 (0918000037)' FROM "accounts" WHERE "email" = 'member37@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 800000, 'Cải thiện vóc dáng và tim mạch', 'Người thân thành viên 38 (0918000038)' FROM "accounts" WHERE "email" = 'member38@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 1000000, 'Tập thể hình tăng cân lành mạnh', 'Người thân thành viên 39 (0918000039)' FROM "accounts" WHERE "email" = 'member39@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 1500000, 'Giảm 5kg mỡ, tăng cơ bắp', 'Người thân thành viên 40 (0918000040)' FROM "accounts" WHERE "email" = 'member40@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 2000000, 'Tập Yoga dẻo dai cơ thể và giảm stress', 'Người thân thành viên 41 (0918000041)' FROM "accounts" WHERE "email" = 'member41@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 0, 'Học bơi sải kỹ thuật chuẩn', 'Người thân thành viên 42 (0918000042)' FROM "accounts" WHERE "email" = 'member42@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 200000, 'Rèn luyện thể lực và nâng cao sức bền', 'Người thân thành viên 43 (0918000043)' FROM "accounts" WHERE "email" = 'member43@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 500000, 'Tập luyện đánh cầu lông phong trào', 'Người thân thành viên 44 (0918000044)' FROM "accounts" WHERE "email" = 'member44@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 800000, 'Nâng cao kỹ năng chơi Tennis', 'Người thân thành viên 45 (0918000045)' FROM "accounts" WHERE "email" = 'member45@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 1000000, 'Cải thiện vóc dáng và tim mạch', 'Người thân thành viên 46 (0918000046)' FROM "accounts" WHERE "email" = 'member46@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 1500000, 'Tập thể hình tăng cân lành mạnh', 'Người thân thành viên 47 (0918000047)' FROM "accounts" WHERE "email" = 'member47@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 2000000, 'Giảm 5kg mỡ, tăng cơ bắp', 'Người thân thành viên 48 (0918000048)' FROM "accounts" WHERE "email" = 'member48@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 0, 'Tập Yoga dẻo dai cơ thể và giảm stress', 'Người thân thành viên 49 (0918000049)' FROM "accounts" WHERE "email" = 'member49@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");
INSERT INTO "member_profile" ("account_id", "wallet_balance", "fitness_goals", "emergency_contact") SELECT "id", 200000, 'Học bơi sải kỹ thuật chuẩn', 'Người thân thành viên 50 (0918000050)' FROM "accounts" WHERE "email" = 'member50@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "member_profile" mp WHERE mp."account_id" = "accounts"."id");

-- 5. Memberships (Gói hội viên)
INSERT INTO "memberships" ("name", "description", "price", "duration_days", "gym_access", "booking_discount_pct", "class_discount_pct", "free_booking_slots_per_month") SELECT 'Gói Cơ bản 1 tháng', 'Vào phòng gym không giới hạn trong 30 ngày', 300000, 30, true, 0, 0, 0 WHERE NOT EXISTS (SELECT 1 FROM "memberships" WHERE "name" = 'Gói Cơ bản 1 tháng' AND "deleted_at" IS NULL);
INSERT INTO "memberships" ("name", "description", "price", "duration_days", "gym_access", "booking_discount_pct", "class_discount_pct", "free_booking_slots_per_month") SELECT 'Gói Tiêu chuẩn 3 tháng', 'Vào phòng gym, giảm 10% đặt sân và 5% khóa học', 800000, 90, true, 10, 5, 2 WHERE NOT EXISTS (SELECT 1 FROM "memberships" WHERE "name" = 'Gói Tiêu chuẩn 3 tháng' AND "deleted_at" IS NULL);
INSERT INTO "memberships" ("name", "description", "price", "duration_days", "gym_access", "booking_discount_pct", "class_discount_pct", "free_booking_slots_per_month") SELECT 'Gói Cao cấp 12 tháng', 'Vào phòng gym, giảm 20% đặt sân và 15% khóa học', 2800000, 365, true, 20, 15, 4 WHERE NOT EXISTS (SELECT 1 FROM "memberships" WHERE "name" = 'Gói Cao cấp 12 tháng' AND "deleted_at" IS NULL);

-- 5b. MemberMemberships (Gán gói tập cho thành viên 1, 2, 3, 4, 5)
INSERT INTO "member_memberships" ("account_id", "package_id", "start_date", "end_date", "status", "auto_renew") SELECT a."id", m."id", CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days', 'ACTIVE', false FROM "accounts" a, "memberships" m WHERE a."email" = 'member1@sportscenter.local' AND m."name" = 'Gói Cơ bản 1 tháng' AND NOT EXISTS (SELECT 1 FROM "member_memberships" x WHERE x."account_id" = a."id" AND x."status" = 'ACTIVE');
INSERT INTO "member_memberships" ("account_id", "package_id", "start_date", "end_date", "status", "auto_renew") SELECT a."id", m."id", CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days', 'ACTIVE', false FROM "accounts" a, "memberships" m WHERE a."email" = 'member2@sportscenter.local' AND m."name" = 'Gói Tiêu chuẩn 3 tháng' AND NOT EXISTS (SELECT 1 FROM "member_memberships" x WHERE x."account_id" = a."id" AND x."status" = 'ACTIVE');
INSERT INTO "member_memberships" ("account_id", "package_id", "start_date", "end_date", "status", "auto_renew") SELECT a."id", m."id", CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days', 'ACTIVE', false FROM "accounts" a, "memberships" m WHERE a."email" = 'member3@sportscenter.local' AND m."name" = 'Gói Cao cấp 12 tháng' AND NOT EXISTS (SELECT 1 FROM "member_memberships" x WHERE x."account_id" = a."id" AND x."status" = 'ACTIVE');
INSERT INTO "member_memberships" ("account_id", "package_id", "start_date", "end_date", "status", "auto_renew") SELECT a."id", m."id", CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days', 'ACTIVE', false FROM "accounts" a, "memberships" m WHERE a."email" = 'member4@sportscenter.local' AND m."name" = 'Gói Cơ bản 1 tháng' AND NOT EXISTS (SELECT 1 FROM "member_memberships" x WHERE x."account_id" = a."id" AND x."status" = 'ACTIVE');
INSERT INTO "member_memberships" ("account_id", "package_id", "start_date", "end_date", "status", "auto_renew") SELECT a."id", m."id", CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days', 'ACTIVE', false FROM "accounts" a, "memberships" m WHERE a."email" = 'member5@sportscenter.local' AND m."name" = 'Gói Tiêu chuẩn 3 tháng' AND NOT EXISTS (SELECT 1 FROM "member_memberships" x WHERE x."account_id" = a."id" AND x."status" = 'ACTIVE');

-- 6. Coupons (Mã giảm giá)
INSERT INTO "coupons" ("code", "name", "discount_type", "discount_value", "max_discount", "min_order_amount", "max_uses", "max_uses_per_user", "applicable_types", "valid_from", "valid_to", "is_active") SELECT 'WELCOME10', 'Giảm 10% cho hội viên mới', 'PERCENT', 10, 100000, 200000, 100, 1, ARRAY['MEMBERSHIP'::order_item_type, 'COURSE_ENROLLMENT'::order_item_type], NOW() - INTERVAL '10 days', NOW() + INTERVAL '90 days', true WHERE NOT EXISTS (SELECT 1 FROM "coupons" WHERE "code" = 'WELCOME10' AND "deleted_at" IS NULL);
INSERT INTO "coupons" ("code", "name", "discount_type", "discount_value", "max_discount", "min_order_amount", "max_uses", "max_uses_per_user", "applicable_types", "valid_from", "valid_to", "is_active") SELECT 'SUMMER50K', 'Giảm trực tiếp 50.000đ đặt sân', 'FIXED', 50000, NULL, 150000, 200, 1, ARRAY['FACILITY_BOOKING'::order_item_type], NOW() - INTERVAL '10 days', NOW() + INTERVAL '90 days', true WHERE NOT EXISTS (SELECT 1 FROM "coupons" WHERE "code" = 'SUMMER50K' AND "deleted_at" IS NULL);
INSERT INTO "coupons" ("code", "name", "discount_type", "discount_value", "max_discount", "min_order_amount", "max_uses", "max_uses_per_user", "applicable_types", "valid_from", "valid_to", "is_active") SELECT 'VIPSPORTS20', 'Ưu đãi 20% thẻ hội viên VIP', 'PERCENT', 20, 300000, 500000, 50, 1, ARRAY['MEMBERSHIP'::order_item_type, 'COURSE_ENROLLMENT'::order_item_type], NOW() - INTERVAL '10 days', NOW() + INTERVAL '90 days', true WHERE NOT EXISTS (SELECT 1 FROM "coupons" WHERE "code" = 'VIPSPORTS20' AND "deleted_at" IS NULL);
INSERT INTO "coupons" ("code", "name", "discount_type", "discount_value", "max_discount", "min_order_amount", "max_uses", "max_uses_per_user", "applicable_types", "valid_from", "valid_to", "is_active") SELECT 'SPORTSDAY', 'Giảm 30.000đ ngày thể thao', 'FIXED', 30000, NULL, 100000, 150, 1, ARRAY['FACILITY_BOOKING'::order_item_type], NOW() - INTERVAL '10 days', NOW() + INTERVAL '90 days', true WHERE NOT EXISTS (SELECT 1 FROM "coupons" WHERE "code" = 'SPORTSDAY' AND "deleted_at" IS NULL);

-- 7. Courses (7 khóa học)
INSERT INTO "courses" ("name", "sport_id", "price", "total_sessions", "description") SELECT 'Yoga Thanh Lọc & Cân Bằng Thân Tâm', s."id", 500000, 12, 'Khóa học yoga toàn diện giúp tăng cường sức khỏe và thư giãn cơ thể.' FROM "sports" s WHERE s."name" = 'Yoga' AND NOT EXISTS (SELECT 1 FROM "courses" cs WHERE cs."name" = 'Yoga Thanh Lọc & Cân Bằng Thân Tâm');
INSERT INTO "courses" ("name", "sport_id", "price", "total_sessions", "description") SELECT 'Bơi Lội Kỹ Thuật Ếch & Sải Chuẩn Quốc Tế', s."id", 1200000, 10, 'Lớp bơi chuẩn kỹ thuật dành cho người lớn và thanh thiếu niên.' FROM "sports" s WHERE s."name" = 'Bơi lội' AND NOT EXISTS (SELECT 1 FROM "courses" cs WHERE cs."name" = 'Bơi Lội Kỹ Thuật Ếch & Sải Chuẩn Quốc Tế');
INSERT INTO "courses" ("name", "sport_id", "price", "total_sessions", "description") SELECT 'Cầu Lông Chiến Thuật & Kỹ Năng Đôi', s."id", 800000, 8, 'Chiến thuật di chuyển, đập cầu và phòng thủ đỉnh cao.' FROM "sports" s WHERE s."name" = 'Cầu lông' AND NOT EXISTS (SELECT 1 FROM "courses" cs WHERE cs."name" = 'Cầu Lông Chiến Thuật & Kỹ Năng Đôi');
INSERT INTO "courses" ("name", "sport_id", "price", "total_sessions", "description") SELECT 'Bóng Rổ Cơ Bản & Phối Hợp Tấn Công', s."id", 900000, 10, 'Ném bóng, nhồi bóng và tư duy chiến thuật đồng đội.' FROM "sports" s WHERE s."name" = 'Bóng rổ' AND NOT EXISTS (SELECT 1 FROM "courses" cs WHERE cs."name" = 'Bóng Rổ Cơ Bản & Phối Hợp Tấn Công');
INSERT INTO "courses" ("name", "sport_id", "price", "total_sessions", "description") SELECT 'Gym Tăng Cơ Giảm Mỡ Cùng PT', s."id", 1500000, 12, 'Lộ trình cá nhân hóa tăng cơ giảm mỡ chuẩn khoa học.' FROM "sports" s WHERE s."name" = 'Gym' AND NOT EXISTS (SELECT 1 FROM "courses" cs WHERE cs."name" = 'Gym Tăng Cơ Giảm Mỡ Cùng PT');
INSERT INTO "courses" ("name", "sport_id", "price", "total_sessions", "description") SELECT 'Tennis Nhập Môn & Kỹ Thuật Forehand/Backhand', s."id", 1800000, 10, 'Học bộ chân di chuyển và các cú đánh cơ bản trong quần vợt.' FROM "sports" s WHERE s."name" = 'Tennis' AND NOT EXISTS (SELECT 1 FROM "courses" cs WHERE cs."name" = 'Tennis Nhập Môn & Kỹ Thuật Forehand/Backhand');
INSERT INTO "courses" ("name", "sport_id", "price", "total_sessions", "description") SELECT 'Bóng Đá Phong Trào & Kỹ Thuật Chuyền Sút', s."id", 700000, 8, 'Kỹ năng đỡ bóng bước một, chuyền ngắn và dứt điểm.' FROM "sports" s WHERE s."name" = 'Bóng đá' AND NOT EXISTS (SELECT 1 FROM "courses" cs WHERE cs."name" = 'Bóng Đá Phong Trào & Kỹ Thuật Chuyền Sút');

-- 8. Classes (7 lớp học tương ứng các môn)
INSERT INTO "classes" ("name", "course_id", "facility_id", "coach_id", "min_students", "max_students", "start_date", "end_date", "weekly_schedule", "status", "approved_by", "approved_at") SELECT 'Yoga Sáng Năng Lượng K01', cr."id", f."id", c."id", 1, 12, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '[{"dayOfWeek": 2, "startTime": "08:00", "endTime": "09:30"}]'::jsonb, 'OPEN', m."id", NOW() FROM "courses" cr, "facilities" f, "accounts" c, "accounts" m WHERE cr."name" = 'Yoga Thanh Lọc & Cân Bằng Thân Tâm' AND f."name" = 'Phòng Yoga' AND c."email" = 'coach2@sportscenter.local' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "classes" cls WHERE cls."name" = 'Yoga Sáng Năng Lượng K01');
INSERT INTO "classes" ("name", "course_id", "facility_id", "coach_id", "min_students", "max_students", "start_date", "end_date", "weekly_schedule", "status", "approved_by", "approved_at") SELECT 'Bơi Sải Nâng Cao K03', cr."id", f."id", c."id", 1, 10, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '[{"dayOfWeek": 3, "startTime": "14:00", "endTime": "15:30"}]'::jsonb, 'OPEN', m."id", NOW() FROM "courses" cr, "facilities" f, "accounts" c, "accounts" m WHERE cr."name" = 'Bơi Lội Kỹ Thuật Ếch & Sải Chuẩn Quốc Tế' AND f."name" = 'Hồ bơi trong nhà' AND c."email" = 'coach1@sportscenter.local' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "classes" cls WHERE cls."name" = 'Bơi Sải Nâng Cao K03');
INSERT INTO "classes" ("name", "course_id", "facility_id", "coach_id", "min_students", "max_students", "start_date", "end_date", "weekly_schedule", "status", "approved_by", "approved_at") SELECT 'Cầu Lông Thi Đấu Chuyên Sâu K05', cr."id", f."id", c."id", 1, 8, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '[{"dayOfWeek": 2, "startTime": "17:30", "endTime": "19:00"}]'::jsonb, 'OPEN', m."id", NOW() FROM "courses" cr, "facilities" f, "accounts" c, "accounts" m WHERE cr."name" = 'Cầu Lông Chiến Thuật & Kỹ Năng Đôi' AND f."name" = 'Sân cầu lông 1' AND c."email" = 'coach3@sportscenter.local' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "classes" cls WHERE cls."name" = 'Cầu Lông Thi Đấu Chuyên Sâu K05');
INSERT INTO "classes" ("name", "course_id", "facility_id", "coach_id", "min_students", "max_students", "start_date", "end_date", "weekly_schedule", "status", "approved_by", "approved_at") SELECT 'Bóng Rổ Cơ Bản K02', cr."id", f."id", c."id", 1, 14, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '[{"dayOfWeek": 4, "startTime": "16:00", "endTime": "17:30"}]'::jsonb, 'OPEN', m."id", NOW() FROM "courses" cr, "facilities" f, "accounts" c, "accounts" m WHERE cr."name" = 'Bóng Rổ Cơ Bản & Phối Hợp Tấn Công' AND f."name" = 'Sân bóng đá mini' AND c."email" = 'coach4@sportscenter.local' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "classes" cls WHERE cls."name" = 'Bóng Rổ Cơ Bản K02');
INSERT INTO "classes" ("name", "course_id", "facility_id", "coach_id", "min_students", "max_students", "start_date", "end_date", "weekly_schedule", "status", "approved_by", "approved_at") SELECT 'Gym Tăng Cơ K01', cr."id", f."id", c."id", 1, 15, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '[{"dayOfWeek": 5, "startTime": "09:00", "endTime": "10:30"}]'::jsonb, 'OPEN', m."id", NOW() FROM "courses" cr, "facilities" f, "accounts" c, "accounts" m WHERE cr."name" = 'Gym Tăng Cơ Giảm Mỡ Cùng PT' AND f."name" = 'Phòng Gym' AND c."email" = 'coach1@sportscenter.local' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "classes" cls WHERE cls."name" = 'Gym Tăng Cơ K01');
INSERT INTO "classes" ("name", "course_id", "facility_id", "coach_id", "min_students", "max_students", "start_date", "end_date", "weekly_schedule", "status", "approved_by", "approved_at") SELECT 'Tennis Cơ Bản Cho Người Mới K01', cr."id", f."id", c."id", 1, 4, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '[{"dayOfWeek": 6, "startTime": "07:30", "endTime": "09:00"}]'::jsonb, 'OPEN', m."id", NOW() FROM "courses" cr, "facilities" f, "accounts" c, "accounts" m WHERE cr."name" = 'Tennis Nhập Môn & Kỹ Thuật Forehand/Backhand' AND f."name" = 'Sân Tennis 1' AND c."email" = 'coach7@sportscenter.local' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "classes" cls WHERE cls."name" = 'Tennis Cơ Bản Cho Người Mới K01');
INSERT INTO "classes" ("name", "course_id", "facility_id", "coach_id", "min_students", "max_students", "start_date", "end_date", "weekly_schedule", "status", "approved_by", "approved_at") SELECT 'Yoga Vinyasa Trị Liệu K04', cr."id", f."id", c."id", 1, 12, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '[{"dayOfWeek": 5, "startTime": "18:00", "endTime": "19:30"}]'::jsonb, 'OPEN', m."id", NOW() FROM "courses" cr, "facilities" f, "accounts" c, "accounts" m WHERE cr."name" = 'Yoga Thanh Lọc & Cân Bằng Thân Tâm' AND f."name" = 'Phòng Yoga' AND c."email" = 'coach6@sportscenter.local' AND m."email" = 'manager@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "classes" cls WHERE cls."name" = 'Yoga Vinyasa Trị Liệu K04');

-- 9. Sessions (Buổi học)
INSERT INTO "class_sessions" ("class_id", "facility_id", "session_number", "session_date", "start_time", "end_time", "status", "note_title", "note_content") SELECT cl."id", f."id", 1, CURRENT_DATE, '08:00:00'::time, '09:30:00'::time, 'SCHEDULED', 'Khởi động và làm quen các tư thế cơ bản', 'Học viên chuẩn bị thảm tập và trang phục thoải mái.' FROM "classes" cl, "facilities" f WHERE cl."name" = 'Yoga Sáng Năng Lượng K01' AND f."name" = 'Phòng Yoga' AND NOT EXISTS (SELECT 1 FROM "class_sessions" cs WHERE cs."facility_id" = f."id" AND cs."session_date" = CURRENT_DATE AND cs."start_time" = '08:00:00'::time);
INSERT INTO "class_sessions" ("class_id", "facility_id", "session_number", "session_date", "start_time", "end_time", "status", "note_title", "note_content") SELECT cl."id", f."id", 1, CURRENT_DATE, '14:00:00'::time, '15:30:00'::time, 'SCHEDULED', 'Kiểm tra thể lực và kỹ thuật bơi sải', 'Yêu cầu kính bơi và mũ bơi đầy đủ.' FROM "classes" cl, "facilities" f WHERE cl."name" = 'Bơi Sải Nâng Cao K03' AND f."name" = 'Hồ bơi trong nhà' AND NOT EXISTS (SELECT 1 FROM "class_sessions" cs WHERE cs."facility_id" = f."id" AND cs."session_date" = CURRENT_DATE AND cs."start_time" = '14:00:00'::time);
INSERT INTO "class_sessions" ("class_id", "facility_id", "session_number", "session_date", "start_time", "end_time", "status", "note_title", "note_content") SELECT cl."id", f."id", 1, CURRENT_DATE, '17:30:00'::time, '19:00:00'::time, 'SCHEDULED', 'Bài tập di chuyển bộ pháp sân đôi', 'Tập trung phản xạ và phối hợp đồng đội.' FROM "classes" cl, "facilities" f WHERE cl."name" = 'Cầu Lông Thi Đấu Chuyên Sâu K05' AND f."name" = 'Sân cầu lông 1' AND NOT EXISTS (SELECT 1 FROM "class_sessions" cs WHERE cs."facility_id" = f."id" AND cs."session_date" = CURRENT_DATE AND cs."start_time" = '17:30:00'::time);
INSERT INTO "class_sessions" ("class_id", "facility_id", "session_number", "session_date", "start_time", "end_time", "status", "note_title", "note_content") SELECT cl."id", f."id", 1, CURRENT_DATE, '07:30:00'::time, '09:00:00'::time, 'SCHEDULED', 'Tập kỹ thuật cầm vợt và đánh bóng căn bản', 'Chuẩn bị vợt tennis và giày sân cứng.' FROM "classes" cl, "facilities" f WHERE cl."name" = 'Tennis Cơ Bản Cho Người Mới K01' AND f."name" = 'Sân Tennis 1' AND NOT EXISTS (SELECT 1 FROM "class_sessions" cs WHERE cs."facility_id" = f."id" AND cs."session_date" = CURRENT_DATE AND cs."start_time" = '07:30:00'::time);

-- 10. Orders, OrderItems & ClassEnrollments

DO $$
DECLARE
  v_account_id uuid;
  v_class_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
BEGIN
  SELECT "id" INTO v_account_id FROM "accounts" WHERE "email" = 'member1@sportscenter.local';
  SELECT "id" INTO v_class_id FROM "classes" WHERE "name" = 'Yoga Sáng Năng Lượng K01';
  
  IF v_account_id IS NOT NULL AND v_class_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "class_enrollments" WHERE "account_id" = v_account_id AND "class_id" = v_class_id) THEN
    INSERT INTO "orders" ("order_number", "idempotency_key", "account_id", "subtotal", "total_amount", "payment_method", "receipt_snapshot")
    VALUES ('ORD-ENR-seed:enr:m1', 'seed:enr:m1', v_account_id, 500000, 500000, 'WALLET', '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_id;
    
    INSERT INTO "order_items" ("order_id", "line_number", "type", "subtotal", "total_amount", "item_snapshot")
    VALUES (v_order_id, 1, 'COURSE_ENROLLMENT', 500000, 500000, '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_item_id;
    
    INSERT INTO "class_enrollments" ("class_id", "account_id", "order_item_id", "status")
    VALUES (v_class_id, v_account_id, v_order_item_id, 'ENROLLED');
  END IF;
END $$;

DO $$
DECLARE
  v_account_id uuid;
  v_class_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
BEGIN
  SELECT "id" INTO v_account_id FROM "accounts" WHERE "email" = 'member2@sportscenter.local';
  SELECT "id" INTO v_class_id FROM "classes" WHERE "name" = 'Yoga Sáng Năng Lượng K01';
  
  IF v_account_id IS NOT NULL AND v_class_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "class_enrollments" WHERE "account_id" = v_account_id AND "class_id" = v_class_id) THEN
    INSERT INTO "orders" ("order_number", "idempotency_key", "account_id", "subtotal", "total_amount", "payment_method", "receipt_snapshot")
    VALUES ('ORD-ENR-seed:enr:m2', 'seed:enr:m2', v_account_id, 500000, 500000, 'WALLET', '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_id;
    
    INSERT INTO "order_items" ("order_id", "line_number", "type", "subtotal", "total_amount", "item_snapshot")
    VALUES (v_order_id, 1, 'COURSE_ENROLLMENT', 500000, 500000, '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_item_id;
    
    INSERT INTO "class_enrollments" ("class_id", "account_id", "order_item_id", "status")
    VALUES (v_class_id, v_account_id, v_order_item_id, 'ENROLLED');
  END IF;
END $$;

DO $$
DECLARE
  v_account_id uuid;
  v_class_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
BEGIN
  SELECT "id" INTO v_account_id FROM "accounts" WHERE "email" = 'member3@sportscenter.local';
  SELECT "id" INTO v_class_id FROM "classes" WHERE "name" = 'Yoga Sáng Năng Lượng K01';
  
  IF v_account_id IS NOT NULL AND v_class_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "class_enrollments" WHERE "account_id" = v_account_id AND "class_id" = v_class_id) THEN
    INSERT INTO "orders" ("order_number", "idempotency_key", "account_id", "subtotal", "total_amount", "payment_method", "receipt_snapshot")
    VALUES ('ORD-ENR-seed:enr:m3', 'seed:enr:m3', v_account_id, 500000, 500000, 'WALLET', '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_id;
    
    INSERT INTO "order_items" ("order_id", "line_number", "type", "subtotal", "total_amount", "item_snapshot")
    VALUES (v_order_id, 1, 'COURSE_ENROLLMENT', 500000, 500000, '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_item_id;
    
    INSERT INTO "class_enrollments" ("class_id", "account_id", "order_item_id", "status")
    VALUES (v_class_id, v_account_id, v_order_item_id, 'ENROLLED');
  END IF;
END $$;

DO $$
DECLARE
  v_account_id uuid;
  v_class_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
BEGIN
  SELECT "id" INTO v_account_id FROM "accounts" WHERE "email" = 'member4@sportscenter.local';
  SELECT "id" INTO v_class_id FROM "classes" WHERE "name" = 'Bơi Sải Nâng Cao K03';
  
  IF v_account_id IS NOT NULL AND v_class_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "class_enrollments" WHERE "account_id" = v_account_id AND "class_id" = v_class_id) THEN
    INSERT INTO "orders" ("order_number", "idempotency_key", "account_id", "subtotal", "total_amount", "payment_method", "receipt_snapshot")
    VALUES ('ORD-ENR-seed:enr:m4', 'seed:enr:m4', v_account_id, 1200000, 1200000, 'WALLET', '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_id;
    
    INSERT INTO "order_items" ("order_id", "line_number", "type", "subtotal", "total_amount", "item_snapshot")
    VALUES (v_order_id, 1, 'COURSE_ENROLLMENT', 1200000, 1200000, '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_item_id;
    
    INSERT INTO "class_enrollments" ("class_id", "account_id", "order_item_id", "status")
    VALUES (v_class_id, v_account_id, v_order_item_id, 'ENROLLED');
  END IF;
END $$;

DO $$
DECLARE
  v_account_id uuid;
  v_class_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
BEGIN
  SELECT "id" INTO v_account_id FROM "accounts" WHERE "email" = 'member5@sportscenter.local';
  SELECT "id" INTO v_class_id FROM "classes" WHERE "name" = 'Bơi Sải Nâng Cao K03';
  
  IF v_account_id IS NOT NULL AND v_class_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "class_enrollments" WHERE "account_id" = v_account_id AND "class_id" = v_class_id) THEN
    INSERT INTO "orders" ("order_number", "idempotency_key", "account_id", "subtotal", "total_amount", "payment_method", "receipt_snapshot")
    VALUES ('ORD-ENR-seed:enr:m5', 'seed:enr:m5', v_account_id, 1200000, 1200000, 'WALLET', '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_id;
    
    INSERT INTO "order_items" ("order_id", "line_number", "type", "subtotal", "total_amount", "item_snapshot")
    VALUES (v_order_id, 1, 'COURSE_ENROLLMENT', 1200000, 1200000, '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_item_id;
    
    INSERT INTO "class_enrollments" ("class_id", "account_id", "order_item_id", "status")
    VALUES (v_class_id, v_account_id, v_order_item_id, 'ENROLLED');
  END IF;
END $$;

DO $$
DECLARE
  v_account_id uuid;
  v_class_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
BEGIN
  SELECT "id" INTO v_account_id FROM "accounts" WHERE "email" = 'member6@sportscenter.local';
  SELECT "id" INTO v_class_id FROM "classes" WHERE "name" = 'Cầu Lông Thi Đấu Chuyên Sâu K05';
  
  IF v_account_id IS NOT NULL AND v_class_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "class_enrollments" WHERE "account_id" = v_account_id AND "class_id" = v_class_id) THEN
    INSERT INTO "orders" ("order_number", "idempotency_key", "account_id", "subtotal", "total_amount", "payment_method", "receipt_snapshot")
    VALUES ('ORD-ENR-seed:enr:m6', 'seed:enr:m6', v_account_id, 800000, 800000, 'WALLET', '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_id;
    
    INSERT INTO "order_items" ("order_id", "line_number", "type", "subtotal", "total_amount", "item_snapshot")
    VALUES (v_order_id, 1, 'COURSE_ENROLLMENT', 800000, 800000, '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_item_id;
    
    INSERT INTO "class_enrollments" ("class_id", "account_id", "order_item_id", "status")
    VALUES (v_class_id, v_account_id, v_order_item_id, 'ENROLLED');
  END IF;
END $$;

DO $$
DECLARE
  v_account_id uuid;
  v_class_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
BEGIN
  SELECT "id" INTO v_account_id FROM "accounts" WHERE "email" = 'member7@sportscenter.local';
  SELECT "id" INTO v_class_id FROM "classes" WHERE "name" = 'Tennis Cơ Bản Cho Người Mới K01';
  
  IF v_account_id IS NOT NULL AND v_class_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "class_enrollments" WHERE "account_id" = v_account_id AND "class_id" = v_class_id) THEN
    INSERT INTO "orders" ("order_number", "idempotency_key", "account_id", "subtotal", "total_amount", "payment_method", "receipt_snapshot")
    VALUES ('ORD-ENR-seed:enr:m7', 'seed:enr:m7', v_account_id, 1800000, 1800000, 'WALLET', '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_id;
    
    INSERT INTO "order_items" ("order_id", "line_number", "type", "subtotal", "total_amount", "item_snapshot")
    VALUES (v_order_id, 1, 'COURSE_ENROLLMENT', 1800000, 1800000, '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_item_id;
    
    INSERT INTO "class_enrollments" ("class_id", "account_id", "order_item_id", "status")
    VALUES (v_class_id, v_account_id, v_order_item_id, 'ENROLLED');
  END IF;
END $$;

-- 11. FacilityBookings (Đặt sân mẫu)

DO $$
DECLARE
  v_account_id uuid;
  v_facility_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
BEGIN
  SELECT "id" INTO v_account_id FROM "accounts" WHERE "email" = 'member1@sportscenter.local';
  SELECT "id" INTO v_facility_id FROM "facilities" WHERE "name" = 'Sân cầu lông 2';
  
  IF v_account_id IS NOT NULL AND v_facility_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "facility_bookings" WHERE "facility_id" = v_facility_id AND "booking_date" = CURRENT_DATE AND "start_time" = '10:00:00'::time) THEN
    INSERT INTO "orders" ("order_number", "idempotency_key", "account_id", "subtotal", "total_amount", "payment_method", "receipt_snapshot")
    VALUES ('ORD-BK-seed:bk:bad2', 'seed:bk:bad2', v_account_id, 80000, 80000, 'WALLET', '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_id;
    
    INSERT INTO "order_items" ("order_id", "line_number", "type", "subtotal", "total_amount", "item_snapshot")
    VALUES (v_order_id, 1, 'FACILITY_BOOKING', 80000, 80000, '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_item_id;
    
    INSERT INTO "facility_bookings" ("facility_id", "account_id", "order_item_id", "booking_date", "start_time", "end_time", "unit_price", "benefit", "status")
    VALUES (v_facility_id, v_account_id, v_order_item_id, CURRENT_DATE, '10:00:00'::time, '11:00:00'::time, 80000, 'NONE', 'CONFIRMED');
  END IF;
END $$;

DO $$
DECLARE
  v_account_id uuid;
  v_facility_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
BEGIN
  SELECT "id" INTO v_account_id FROM "accounts" WHERE "email" = 'member2@sportscenter.local';
  SELECT "id" INTO v_facility_id FROM "facilities" WHERE "name" = 'Sân Tennis 1';
  
  IF v_account_id IS NOT NULL AND v_facility_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "facility_bookings" WHERE "facility_id" = v_facility_id AND "booking_date" = CURRENT_DATE AND "start_time" = '15:00:00'::time) THEN
    INSERT INTO "orders" ("order_number", "idempotency_key", "account_id", "subtotal", "total_amount", "payment_method", "receipt_snapshot")
    VALUES ('ORD-BK-seed:bk:ten1', 'seed:bk:ten1', v_account_id, 150000, 150000, 'WALLET', '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_id;
    
    INSERT INTO "order_items" ("order_id", "line_number", "type", "subtotal", "total_amount", "item_snapshot")
    VALUES (v_order_id, 1, 'FACILITY_BOOKING', 150000, 150000, '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_item_id;
    
    INSERT INTO "facility_bookings" ("facility_id", "account_id", "order_item_id", "booking_date", "start_time", "end_time", "unit_price", "benefit", "status")
    VALUES (v_facility_id, v_account_id, v_order_item_id, CURRENT_DATE, '15:00:00'::time, '16:00:00'::time, 150000, 'NONE', 'CONFIRMED');
  END IF;
END $$;

DO $$
DECLARE
  v_account_id uuid;
  v_facility_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
BEGIN
  SELECT "id" INTO v_account_id FROM "accounts" WHERE "email" = 'member3@sportscenter.local';
  SELECT "id" INTO v_facility_id FROM "facilities" WHERE "name" = 'Sân bóng đá mini';
  
  IF v_account_id IS NOT NULL AND v_facility_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "facility_bookings" WHERE "facility_id" = v_facility_id AND "booking_date" = CURRENT_DATE AND "start_time" = '18:00:00'::time) THEN
    INSERT INTO "orders" ("order_number", "idempotency_key", "account_id", "subtotal", "total_amount", "payment_method", "receipt_snapshot")
    VALUES ('ORD-BK-seed:bk:fb1', 'seed:bk:fb1', v_account_id, 300000, 300000, 'WALLET', '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_id;
    
    INSERT INTO "order_items" ("order_id", "line_number", "type", "subtotal", "total_amount", "item_snapshot")
    VALUES (v_order_id, 1, 'FACILITY_BOOKING', 300000, 300000, '{"schema_version": 1}'::jsonb)
    RETURNING "id" INTO v_order_item_id;
    
    INSERT INTO "facility_bookings" ("facility_id", "account_id", "order_item_id", "booking_date", "start_time", "end_time", "unit_price", "benefit", "status")
    VALUES (v_facility_id, v_account_id, v_order_item_id, CURRENT_DATE, '18:00:00'::time, '19:30:00'::time, 300000, 'NONE', 'CONFIRMED');
  END IF;
END $$;

-- 12. CenterCheckins (Quẹt thẻ check-in cổng trung tâm)
INSERT INTO "center_checkins" ("account_id", "checked_by", "check_in_time") SELECT m."id", r."id", NOW() - INTERVAL '15 minutes' FROM "accounts" m, "accounts" r WHERE m."email" = 'member1@sportscenter.local' AND r."email" = 'reception1@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "center_checkins" cc WHERE cc."account_id" = m."id" AND cc."check_in_time"::date = CURRENT_DATE);
INSERT INTO "center_checkins" ("account_id", "checked_by", "check_in_time") SELECT m."id", r."id", NOW() - INTERVAL '30 minutes' FROM "accounts" m, "accounts" r WHERE m."email" = 'member2@sportscenter.local' AND r."email" = 'reception1@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "center_checkins" cc WHERE cc."account_id" = m."id" AND cc."check_in_time"::date = CURRENT_DATE);
INSERT INTO "center_checkins" ("account_id", "checked_by", "check_in_time") SELECT m."id", r."id", NOW() - INTERVAL '45 minutes' FROM "accounts" m, "accounts" r WHERE m."email" = 'member3@sportscenter.local' AND r."email" = 'reception1@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "center_checkins" cc WHERE cc."account_id" = m."id" AND cc."check_in_time"::date = CURRENT_DATE);
INSERT INTO "center_checkins" ("account_id", "checked_by", "check_in_time") SELECT m."id", r."id", NOW() - INTERVAL '60 minutes' FROM "accounts" m, "accounts" r WHERE m."email" = 'member4@sportscenter.local' AND r."email" = 'reception1@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "center_checkins" cc WHERE cc."account_id" = m."id" AND cc."check_in_time"::date = CURRENT_DATE);
INSERT INTO "center_checkins" ("account_id", "checked_by", "check_in_time") SELECT m."id", r."id", NOW() - INTERVAL '75 minutes' FROM "accounts" m, "accounts" r WHERE m."email" = 'member5@sportscenter.local' AND r."email" = 'reception1@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "center_checkins" cc WHERE cc."account_id" = m."id" AND cc."check_in_time"::date = CURRENT_DATE);
INSERT INTO "center_checkins" ("account_id", "checked_by", "check_in_time") SELECT m."id", r."id", NOW() - INTERVAL '90 minutes' FROM "accounts" m, "accounts" r WHERE m."email" = 'member6@sportscenter.local' AND r."email" = 'reception1@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "center_checkins" cc WHERE cc."account_id" = m."id" AND cc."check_in_time"::date = CURRENT_DATE);
INSERT INTO "center_checkins" ("account_id", "checked_by", "check_in_time") SELECT m."id", r."id", NOW() - INTERVAL '105 minutes' FROM "accounts" m, "accounts" r WHERE m."email" = 'member7@sportscenter.local' AND r."email" = 'reception1@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "center_checkins" cc WHERE cc."account_id" = m."id" AND cc."check_in_time"::date = CURRENT_DATE);
INSERT INTO "center_checkins" ("account_id", "checked_by", "check_in_time") SELECT m."id", r."id", NOW() - INTERVAL '120 minutes' FROM "accounts" m, "accounts" r WHERE m."email" = 'member8@sportscenter.local' AND r."email" = 'reception1@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "center_checkins" cc WHERE cc."account_id" = m."id" AND cc."check_in_time"::date = CURRENT_DATE);
INSERT INTO "center_checkins" ("account_id", "checked_by", "check_in_time") SELECT m."id", r."id", NOW() - INTERVAL '135 minutes' FROM "accounts" m, "accounts" r WHERE m."email" = 'member9@sportscenter.local' AND r."email" = 'reception1@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "center_checkins" cc WHERE cc."account_id" = m."id" AND cc."check_in_time"::date = CURRENT_DATE);
INSERT INTO "center_checkins" ("account_id", "checked_by", "check_in_time") SELECT m."id", r."id", NOW() - INTERVAL '150 minutes' FROM "accounts" m, "accounts" r WHERE m."email" = 'member10@sportscenter.local' AND r."email" = 'reception1@sportscenter.local' AND NOT EXISTS (SELECT 1 FROM "center_checkins" cc WHERE cc."account_id" = m."id" AND cc."check_in_time"::date = CURRENT_DATE);

-- 13. ClassAttendance & MemberEvaluation

DO $$
DECLARE
  v_session_id uuid;
  v_coach_id uuid;
  v_mem1_id uuid;
  v_mem2_id uuid;
BEGIN
  SELECT cs."id" INTO v_session_id FROM "class_sessions" cs JOIN "classes" cl ON cs."class_id" = cl."id" WHERE cl."name" = 'Yoga Sáng Năng Lượng K01' LIMIT 1;
  SELECT "id" INTO v_coach_id FROM "accounts" WHERE "email" = 'coach2@sportscenter.local';
  SELECT "id" INTO v_mem1_id FROM "accounts" WHERE "email" = 'member1@sportscenter.local';
  SELECT "id" INTO v_mem2_id FROM "accounts" WHERE "email" = 'member2@sportscenter.local';

  IF v_session_id IS NOT NULL AND v_mem1_id IS NOT NULL THEN
    INSERT INTO "class_attendance" ("session_id", "account_id", "status", "note", "updated_by")
    VALUES (v_session_id, v_mem1_id, 'PRESENT', 'Đến đúng giờ, tập luyện rất tích cực', v_coach_id)
    ON CONFLICT ("session_id", "account_id") DO NOTHING;

    INSERT INTO "member_evaluations" ("session_id", "account_id", "coach_id", "rating", "comment")
    VALUES (v_session_id, v_mem1_id, v_coach_id, 5, 'Tư thế uốn cong và thở nhịp nhàng, tiến bộ nhanh')
    ON CONFLICT ("session_id", "account_id") WHERE ("deleted_at" IS NULL) DO NOTHING;
  END IF;

  IF v_session_id IS NOT NULL AND v_mem2_id IS NOT NULL THEN
    INSERT INTO "class_attendance" ("session_id", "account_id", "status", "note", "updated_by")
    VALUES (v_session_id, v_mem2_id, 'PRESENT', 'Tham gia đầy đủ buổi học', v_coach_id)
    ON CONFLICT ("session_id", "account_id") DO NOTHING;

    INSERT INTO "member_evaluations" ("session_id", "account_id", "coach_id", "rating", "comment")
    VALUES (v_session_id, v_mem2_id, v_coach_id, 4, 'Cần chú ý giữ thẳng lưng trong tư thế chiến binh')
    ON CONFLICT ("session_id", "account_id") WHERE ("deleted_at" IS NULL) DO NOTHING;
  END IF;
END $$;
