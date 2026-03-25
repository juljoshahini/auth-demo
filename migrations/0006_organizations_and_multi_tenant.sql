-- Organization table
CREATE TABLE organization (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Organization membership
CREATE TABLE organization_member (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT NOT NULL REFERENCES organization(id),
  user_id TEXT NOT NULL REFERENCES user(id),
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_org_member_unique ON organization_member(org_id, user_id);
CREATE INDEX idx_org_member_user ON organization_member(user_id);
CREATE INDEX idx_org_member_org ON organization_member(org_id);

-- Organization invites
CREATE TABLE organization_invite (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organization(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by TEXT NOT NULL REFERENCES user(id),
  expires INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_org_invite_email ON organization_invite(email);
CREATE UNIQUE INDEX idx_org_invite_unique ON organization_invite(org_id, email);

-- Add org_id to social_account and post tables
ALTER TABLE social_account ADD COLUMN org_id TEXT REFERENCES organization(id);
ALTER TABLE post ADD COLUMN org_id TEXT REFERENCES organization(id);

CREATE INDEX idx_social_org ON social_account(org_id);
CREATE INDEX idx_post_org ON post(org_id);
