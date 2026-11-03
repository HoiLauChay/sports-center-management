-- Lets name searches ignore Vietnamese marks: "nguyen" finds "Nguyễn" (see src/utils/search.ts).
CREATE EXTENSION IF NOT EXISTS "unaccent";
