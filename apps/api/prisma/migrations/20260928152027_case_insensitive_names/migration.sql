DO $$
BEGIN
  IF lower('ĐÁ BÓNG') <> 'đá bóng' THEN
    RAISE EXCEPTION 'Database locale cannot lowercase Vietnamese letters, case-insensitive names would not work';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS citext;

ALTER TABLE "sports" ALTER COLUMN "name" TYPE CITEXT USING "name"::citext;
ALTER TABLE "sports" ADD CONSTRAINT "ck_sports_name_length" CHECK (char_length("name") <= 100);

ALTER TABLE "facilities" ALTER COLUMN "name" TYPE CITEXT USING "name"::citext;
ALTER TABLE "facilities" ADD CONSTRAINT "ck_facilities_name_length" CHECK (char_length("name") <= 100);
