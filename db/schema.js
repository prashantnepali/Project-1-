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
  `);

  console.log('[DB] Schema initialized');
}

module.exports = { initSchema };
