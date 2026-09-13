ALTER TABLE "channels" RENAME COLUMN "credentials" TO "credentials_enc";
ALTER TABLE "channels" ALTER COLUMN "credentials_enc" TYPE text;
