-- ─── Auth (Lucia v2) ─────────────────────────────────────────────────────────

CREATE TABLE user (
  id TEXT(15) PRIMARY KEY NOT NULL,
  email TEXT(255) NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX idx_user_email ON user(email);

CREATE TABLE user_key (
  id TEXT(255) PRIMARY KEY NOT NULL,
  user_id TEXT(15) NOT NULL REFERENCES user(id),
  hashed_password TEXT(255)
);

CREATE TABLE user_session (
  id TEXT(127) PRIMARY KEY NOT NULL,
  user_id TEXT(15) NOT NULL REFERENCES user(id),
  active_expires INTEGER NOT NULL,
  idle_expires INTEGER NOT NULL
);

CREATE TABLE email_verification_code (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT(15) NOT NULL REFERENCES user(id),
  code TEXT(8) NOT NULL,
  expires INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_verification_user ON email_verification_code(user_id);

CREATE TABLE password_reset_token (
  id TEXT(63) PRIMARY KEY NOT NULL,
  user_id TEXT(15) NOT NULL REFERENCES user(id),
  expires INTEGER NOT NULL
);

-- ─── Organizations ──────────────────────────────────────────────────────────

CREATE TABLE organization (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE organization_member (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT NOT NULL REFERENCES organization(id),
  user_id TEXT(15) NOT NULL REFERENCES user(id),
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_org_member_unique ON organization_member(org_id, user_id);
CREATE INDEX idx_org_member_user ON organization_member(user_id);
CREATE INDEX idx_org_member_org ON organization_member(org_id);

CREATE TABLE organization_invite (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL REFERENCES organization(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by TEXT NOT NULL REFERENCES user(id),
  expires INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_org_invite_email ON organization_invite(email);
CREATE UNIQUE INDEX idx_org_invite_unique ON organization_invite(org_id, email);

-- ─── Social Accounts & Posts (org-scoped) ───────────────────────────────────

CREATE TABLE social_account (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT(15) NOT NULL REFERENCES user(id),
  org_id TEXT NOT NULL REFERENCES organization(id),
  platform TEXT NOT NULL,
  platform_account_id TEXT NOT NULL,
  platform_username TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_social_user ON social_account(user_id);
CREATE INDEX idx_social_org ON social_account(org_id);
CREATE UNIQUE INDEX idx_social_platform_account ON social_account(org_id, platform, platform_account_id);

CREATE TABLE post (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT(15) NOT NULL REFERENCES user(id),
  org_id TEXT NOT NULL REFERENCES organization(id),
  content TEXT NOT NULL,
  media_urls TEXT,
  scheduled_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  durable_object_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_post_user ON post(user_id);
CREATE INDEX idx_post_org ON post(org_id);
CREATE INDEX idx_post_status ON post(status);
CREATE INDEX idx_post_scheduled ON post(scheduled_at);

CREATE TABLE post_target (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT NOT NULL REFERENCES post(id),
  social_account_id TEXT REFERENCES social_account(id) ON DELETE SET NULL,
  platform_post_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  published_at INTEGER
);
CREATE INDEX idx_target_post ON post_target(post_id);
CREATE UNIQUE INDEX idx_target_post_account ON post_target(post_id, social_account_id);
