-- Add email fields to user table
ALTER TABLE user ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE user ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

-- Drop the username unique constraint and add email unique
CREATE UNIQUE INDEX idx_user_email ON user(email);

-- Email verification codes (OTP)
CREATE TABLE IF NOT EXISTS email_verification_code (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR(15) NOT NULL,
    code VARCHAR(8) NOT NULL,
    expires BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE UNIQUE INDEX idx_verification_user ON email_verification_code(user_id);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_token (
    id VARCHAR(63) NOT NULL PRIMARY KEY,
    user_id VARCHAR(15) NOT NULL,
    expires BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id)
);
