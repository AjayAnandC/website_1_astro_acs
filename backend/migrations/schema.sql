-- Example SQL schema for a Postgres `projects` table
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  repo_url TEXT,
  status TEXT DEFAULT 'active',
  owner TEXT,
  tags TEXT,
  metadata JSONB
);
