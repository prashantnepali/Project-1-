const { getDb } = require('./connection');

function initSchema() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      normalizedName TEXT NOT NULL,
      category TEXT,
      industry TEXT,
      country TEXT,
      city TEXT,
      address TEXT,
      latitude REAL,
      longitude REAL,
      website TEXT,
      phone TEXT,
      email TEXT,
      brand TEXT,
      description TEXT,
      numberOfLocations INTEGER DEFAULT 1,
      socialProfiles TEXT DEFAULT '{}',
      source TEXT,
      sourceId TEXT,
      domain TEXT,
      status TEXT DEFAULT 'discovered',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      name TEXT NOT NULL,
      title TEXT,
      linkedinUrl TEXT,
      email TEXT,
      phone TEXT,
      source TEXT,
      confidence INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS discovery_searches (
      id TEXT PRIMARY KEY,
      country TEXT NOT NULL,
      city TEXT,
      industry TEXT,
      businessType TEXT,
      minScore INTEGER DEFAULT 0,
      resultCount INTEGER DEFAULT 0,
      qualifiedCount INTEGER DEFAULT 0,
      addedCount INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discovery_results (
      id TEXT PRIMARY KEY,
      searchId TEXT NOT NULL,
      companyId TEXT,
      rawData TEXT,
      normalizedData TEXT,
      prequalificationStatus TEXT DEFAULT 'pending',
      prequalificationScore INTEGER DEFAULT 0,
      prequalificationReasons TEXT DEFAULT '[]',
      status TEXT DEFAULT 'discovered',
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (searchId) REFERENCES discovery_searches(id) ON DELETE CASCADE,
      FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS enrichments (
      id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      provider TEXT DEFAULT 'tavily',
      version INTEGER DEFAULT 1,
      data TEXT DEFAULT '{}',
      lastEnrichedAt TEXT,
      nextRefreshAt TEXT,
      error TEXT,
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lead_scores (
      id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      totalScore INTEGER DEFAULT 0,
      classification TEXT DEFAULT 'Low Priority',
      breakdown TEXT DEFAULT '{}',
      calculatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      companyId TEXT,
      name TEXT NOT NULL,
      firstName TEXT,
      lastName TEXT,
      email TEXT,
      phone TEXT,
      company TEXT,
      title TEXT,
      industry TEXT,
      location TEXT,
      source TEXT,
      status TEXT DEFAULT 'new',
      priority TEXT DEFAULT 'medium',
      score INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      fitScoreId TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      lastActivity TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE SET NULL,
      FOREIGN KEY (fitScoreId) REFERENCES lead_scores(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS lead_tags (
      leadId TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (leadId, tag),
      FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      leadId TEXT,
      companyId TEXT,
      type TEXT NOT NULL,
      description TEXT,
      metadata TEXT DEFAULT '{}',
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE SET NULL,
      FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      leadId TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      enrichmentId TEXT,
      field TEXT NOT NULL,
      value TEXT,
      sourceUrl TEXT,
      sourceTitle TEXT,
      confidence INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (enrichmentId) REFERENCES enrichments(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      teamId TEXT,
      avatar TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      lastLogin TEXT,
      FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ownerId TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (ownerId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_members (
      teamId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      joinedAt TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (teamId, userId),
      FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      userId TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (userId, key),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS leads_fts USING fts5(
      name, company, email, title, industry, location, tags,
      content='leads',
      content_rowid='rowid'
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS companies_fts USING fts5(
      name, industry, city, country, description, category,
      content='companies',
      content_rowid='rowid'
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(companyId);
    CREATE INDEX IF NOT EXISTS idx_discovery_results_search ON discovery_results(searchId);
    CREATE INDEX IF NOT EXISTS idx_discovery_results_company ON discovery_results(companyId);
    CREATE INDEX IF NOT EXISTS idx_enrichments_company ON enrichments(companyId);
    CREATE INDEX IF NOT EXISTS idx_lead_scores_company ON lead_scores(companyId);
    CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(companyId);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities(leadId);
    CREATE INDEX IF NOT EXISTS idx_activities_company ON activities(companyId);
    CREATE INDEX IF NOT EXISTS idx_notes_lead ON notes(leadId);
    CREATE INDEX IF NOT EXISTS idx_evidence_company ON evidence(companyId);
    CREATE INDEX IF NOT EXISTS idx_evidence_enrichment ON evidence(enrichmentId);
    CREATE INDEX IF NOT EXISTS idx_companies_normalizedName ON companies(normalizedName);
    CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_team ON users(teamId);
    CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(teamId);
    CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(userId);
    CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(companyId);
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS leads_ai AFTER INSERT ON leads BEGIN
      INSERT INTO leads_fts(rowid, name, company, email, title, industry, location, tags)
      VALUES (new.rowid, new.name, new.company, new.email, new.title, new.industry, new.location, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS leads_ad AFTER DELETE ON leads BEGIN
      INSERT INTO leads_fts(leads_fts, rowid, name, company, email, title, industry, location, tags)
      VALUES ('delete', old.rowid, old.name, old.company, old.email, old.title, old.industry, old.location, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS leads_au AFTER UPDATE ON leads BEGIN
      INSERT INTO leads_fts(leads_fts, rowid, name, company, email, title, industry, location, tags)
      VALUES ('delete', old.rowid, old.name, old.company, old.email, old.title, old.industry, old.location, old.tags);
      INSERT INTO leads_fts(rowid, name, company, email, title, industry, location, tags)
      VALUES (new.rowid, new.name, new.company, new.email, new.title, new.industry, new.location, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS companies_ai AFTER INSERT ON companies BEGIN
      INSERT INTO companies_fts(rowid, name, industry, city, country, description, category)
      VALUES (new.rowid, new.name, new.industry, new.city, new.country, new.description, new.category);
    END;

    CREATE TRIGGER IF NOT EXISTS companies_ad AFTER DELETE ON companies BEGIN
      INSERT INTO companies_fts(companies_fts, rowid, name, industry, city, country, description, category)
      VALUES ('delete', old.rowid, old.name, old.industry, old.city, old.country, old.description, old.category);
    END;

    CREATE TRIGGER IF NOT EXISTS companies_au AFTER UPDATE ON companies BEGIN
      INSERT INTO companies_fts(companies_fts, rowid, name, industry, city, country, description, category)
      VALUES ('delete', old.rowid, old.name, old.industry, old.city, old.country, old.description, old.category);
      INSERT INTO companies_fts(rowid, name, industry, city, country, description, category)
      VALUES (new.rowid, new.name, new.industry, new.city, new.country, new.description, new.category);
    END;
  `);

  console.log('[DB] Schema initialized');
}

module.exports = { initSchema };
