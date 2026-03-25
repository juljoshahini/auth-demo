-- Make social_account_id nullable on post_target so we can preserve
-- post history after a social account is disconnected.
-- SQLite doesn't support ALTER COLUMN, so we recreate the table.

PRAGMA foreign_keys = OFF;

CREATE TABLE post_target_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL,
    social_account_id TEXT,
    platform_post_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    published_at BIGINT,
    FOREIGN KEY (post_id) REFERENCES post(id),
    FOREIGN KEY (social_account_id) REFERENCES social_account(id) ON DELETE SET NULL
);

INSERT INTO post_target_new SELECT * FROM post_target;

DROP TABLE post_target;
ALTER TABLE post_target_new RENAME TO post_target;

CREATE INDEX idx_target_post ON post_target(post_id);
CREATE UNIQUE INDEX idx_target_post_account ON post_target(post_id, social_account_id);

PRAGMA foreign_keys = ON;
