ALTER TABLE "member_memberships" DROP CONSTRAINT "ck_mm_dates";
ALTER TABLE "member_memberships" ADD CONSTRAINT "ck_mm_dates" CHECK ("end_date" >= "start_date");
