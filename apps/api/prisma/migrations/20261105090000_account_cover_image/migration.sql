-- Cover images belong to the account (like avatars), so every role can set one.
-- Coaches keep the cover they already had.
ALTER TABLE "accounts" ADD COLUMN "cover_image_url" TEXT;

UPDATE "accounts" AS a
SET "cover_image_url" = c."cover_image_url"
FROM "coach_profile" AS c
WHERE c."account_id" = a."id" AND c."cover_image_url" IS NOT NULL;

ALTER TABLE "coach_profile" DROP COLUMN "cover_image_url";
