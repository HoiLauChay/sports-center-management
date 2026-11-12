-- Set only when a refresh rotates the token, so the short reuse grace of a rotation never covers a token that a
-- logout, a password change or an account lock revoked on purpose.
ALTER TABLE "refresh_tokens" ADD COLUMN "rotated_at" TIMESTAMPTZ;
