-- SQLite can't drop a column with a UNIQUE constraint, so recreate the table
CREATE TABLE user_new (
    id VARCHAR(15) NOT NULL PRIMARY KEY,
    email VARCHAR(255) NOT NULL DEFAULT '',
    email_verified INTEGER NOT NULL DEFAULT 0
);

INSERT INTO user_new (id, email, email_verified) SELECT id, email, email_verified FROM user;

-- Recreate dependent tables' foreign keys by dropping and re-adding
-- First, save data from dependent tables
CREATE TABLE user_key_backup AS SELECT * FROM user_key;
CREATE TABLE user_session_backup AS SELECT * FROM user_session;
CREATE TABLE email_verification_code_backup AS SELECT * FROM email_verification_code;
CREATE TABLE password_reset_token_backup AS SELECT * FROM password_reset_token;
CREATE TABLE social_account_backup AS SELECT * FROM social_account;
CREATE TABLE post_backup AS SELECT * FROM post;

-- Drop dependent tables
DROP TABLE IF EXISTS post_target;
DROP TABLE IF EXISTS post;
DROP TABLE IF EXISTS social_account;
DROP TABLE IF EXISTS password_reset_token;
DROP TABLE IF EXISTS email_verification_code;
DROP TABLE IF EXISTS user_session;
DROP TABLE IF EXISTS user_key;
DROP TABLE IF EXISTS user;

-- Rename new table
ALTER TABLE user_new RENAME TO user;

-- Recreate the email unique index
CREATE UNIQUE INDEX idx_user_email ON user(email);

-- Recreate dependent tables
CREATE TABLE user_key (
    id VARCHAR(255) NOT NULL PRIMARY KEY,
    user_id VARCHAR(15) NOT NULL,
    hashed_password VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES user(id)
);
INSERT INTO user_key SELECT * FROM user_key_backup;
DROP TABLE user_key_backup;

CREATE TABLE user_session (
    id VARCHAR(127) NOT NULL PRIMARY KEY,
    user_id VARCHAR(15) NOT NULL,
    active_expires BIGINT NOT NULL,
    idle_expires BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id)
);
INSERT INTO user_session SELECT * FROM user_session_backup;
DROP TABLE user_session_backup;

CREATE TABLE email_verification_code (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR(15) NOT NULL,
    code VARCHAR(8) NOT NULL,
    expires BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id)
);
CREATE UNIQUE INDEX idx_verification_user ON email_verification_code(user_id);
INSERT INTO email_verification_code SELECT * FROM email_verification_code_backup;
DROP TABLE email_verification_code_backup;

CREATE TABLE password_reset_token (
    id VARCHAR(63) NOT NULL PRIMARY KEY,
    user_id VARCHAR(15) NOT NULL,
    expires BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id)
);
INSERT INTO password_reset_token SELECT * FROM password_reset_token_backup;
DROP TABLE password_reset_token_backup;

CREATE TABLE social_account (
    id TEXT PRIMARY KEY,
    user_id VARCHAR(15) NOT NULL,
    platform TEXT NOT NULL,
    platform_account_id TEXT NOT NULL,
    platform_username TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at BIGINT,
    created_at BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id)
);
CREATE INDEX idx_social_user ON social_account(user_id);
CREATE UNIQUE INDEX idx_social_platform_account ON social_account(user_id, platform, platform_account_id);
INSERT INTO social_account SELECT * FROM social_account_backup;
DROP TABLE social_account_backup;

CREATE TABLE post (
    id TEXT PRIMARY KEY,
    user_id VARCHAR(15) NOT NULL,
    content TEXT NOT NULL,
    media_urls TEXT,
    scheduled_at BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    durable_object_id TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id)
);
CREATE INDEX idx_post_user ON post(user_id);
CREATE INDEX idx_post_status ON post(status);
CREATE INDEX idx_post_scheduled ON post(scheduled_at);
INSERT INTO post SELECT * FROM post_backup;
DROP TABLE post_backup;

CREATE TABLE post_target (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL,
    social_account_id TEXT NOT NULL,
    platform_post_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    published_at BIGINT,
    FOREIGN KEY (post_id) REFERENCES post(id),
    FOREIGN KEY (social_account_id) REFERENCES social_account(id)
);
CREATE INDEX idx_target_post ON post_target(post_id);
CREATE UNIQUE INDEX idx_target_post_account ON post_target(post_id, social_account_id);
