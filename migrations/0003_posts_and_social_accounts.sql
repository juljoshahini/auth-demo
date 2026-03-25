-- Social accounts (connected platforms)
CREATE TABLE IF NOT EXISTS social_account (
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

CREATE INDEX IF NOT EXISTS idx_social_user ON social_account(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_platform_account ON social_account(user_id, platform, platform_account_id);

-- Scheduled posts
CREATE TABLE IF NOT EXISTS post (
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

CREATE INDEX IF NOT EXISTS idx_post_user ON post(user_id);
CREATE INDEX IF NOT EXISTS idx_post_status ON post(status);
CREATE INDEX IF NOT EXISTS idx_post_scheduled ON post(scheduled_at);

-- Post targets (many-to-many: post → social accounts)
CREATE TABLE IF NOT EXISTS post_target (
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

CREATE INDEX IF NOT EXISTS idx_target_post ON post_target(post_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_target_post_account ON post_target(post_id, social_account_id);
