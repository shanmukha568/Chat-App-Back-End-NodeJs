-- Add avatar columns to `users` for profile pictures (base64 + mime).
-- Run this against your WhatsApp Lite MySQL database.
ALTER TABLE users
  ADD COLUMN avatar_base64 MEDIUMTEXT NULL,
  ADD COLUMN avatar_mime_type VARCHAR(64) NULL;

