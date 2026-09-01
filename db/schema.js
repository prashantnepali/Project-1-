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
      companyId TEXT,
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

    CREATE TABLE IF NOT EXISTS email_accounts (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL DEFAULT 'google',
      email TEXT NOT NULL,
      displayName TEXT,
      accessToken TEXT,
      refreshToken TEXT,
      tokenExpiry TEXT,
      scope TEXT,
      status TEXT DEFAULT 'active',
      connectedAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      smtpHost TEXT,
      smtpPort INTEGER,
      smtpSecure TEXT,
      smtpUser TEXT,
      smtpPass TEXT
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      accountId TEXT,
      subject TEXT NOT NULL,
      templateId TEXT,
      body TEXT,
      status TEXT DEFAULT 'draft',
      targetFilter TEXT DEFAULT '{}',
      sent INTEGER DEFAULT 0,
      delivered INTEGER DEFAULT 0,
      opened INTEGER DEFAULT 0,
      clicked INTEGER DEFAULT 0,
      replied INTEGER DEFAULT 0,
      bounced INTEGER DEFAULT 0,
      scheduledAt TEXT,
      startedAt TEXT,
      completedAt TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (accountId) REFERENCES email_accounts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS campaign_leads (
      campaignId TEXT NOT NULL,
      leadId TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      sentAt TEXT,
      openedAt TEXT,
      repliedAt TEXT,
      messageId TEXT,
      PRIMARY KEY (campaignId, leadId),
      FOREIGN KEY (campaignId) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS email_sends (
      id TEXT PRIMARY KEY,
      campaignId TEXT,
      leadId TEXT,
      accountId TEXT NOT NULL,
      toEmail TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT,
      messageId TEXT,
      threadId TEXT,
      status TEXT DEFAULT 'pending',
      sentAt TEXT,
      deliveredAt TEXT,
      openedAt TEXT,
      clickedAt TEXT,
      bouncedAt TEXT,
      error TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaignId) REFERENCES campaigns(id) ON DELETE SET NULL,
      FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE SET NULL,
      FOREIGN KEY (accountId) REFERENCES email_accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS email_replies (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      leadId TEXT,
      campaignId TEXT,
      messageId TEXT NOT NULL,
      threadId TEXT,
      fromEmail TEXT,
      toEmail TEXT,
      subject TEXT,
      body TEXT,
      snippet TEXT,
      sentiment TEXT DEFAULT 'neutral',
      receivedAt TEXT,
      processedAt TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (accountId) REFERENCES email_accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE SET NULL,
      FOREIGN KEY (campaignId) REFERENCES campaigns(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT DEFAULT 'reply',
      replyId TEXT,
      accountId TEXT,
      leadId TEXT,
      fromEmail TEXT,
      subject TEXT,
      snippet TEXT,
      read INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (accountId) REFERENCES email_accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (replyId) REFERENCES email_replies(id) ON DELETE CASCADE,
      FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      leadId TEXT,
      campaignId TEXT,
      name TEXT NOT NULL,
      value REAL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      stage TEXT DEFAULT 'lead',
      probability INTEGER DEFAULT 10,
      expectedCloseDate TEXT,
      actualCloseDate TEXT,
      notes TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE SET NULL,
      FOREIGN KEY (campaignId) REFERENCES campaigns(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      leadId TEXT,
      campaignId TEXT,
      dealId TEXT,
      type TEXT DEFAULT 'follow_up',
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      dueDate TEXT,
      completedAt TEXT,
      priority TEXT DEFAULT 'medium',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE SET NULL,
      FOREIGN KEY (campaignId) REFERENCES campaigns(id) ON DELETE SET NULL,
      FOREIGN KEY (dealId) REFERENCES deals(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS email_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT DEFAULT '',
      body TEXT DEFAULT '',
      category TEXT DEFAULT 'custom',
      placeholders TEXT DEFAULT '[]',
      usageCount INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
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
    CREATE INDEX IF NOT EXISTS idx_email_accounts_email ON email_accounts(email);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(createdAt);
    CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
    CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON campaign_leads(campaignId);
    CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead ON campaign_leads(leadId);
    CREATE INDEX IF NOT EXISTS idx_email_sends_campaign ON email_sends(campaignId);
    CREATE INDEX IF NOT EXISTS idx_email_sends_lead ON email_sends(leadId);
    CREATE INDEX IF NOT EXISTS idx_email_sends_account ON email_sends(accountId);
    CREATE INDEX IF NOT EXISTS idx_email_replies_account ON email_replies(accountId);
    CREATE INDEX IF NOT EXISTS idx_email_replies_lead ON email_replies(leadId);
    CREATE INDEX IF NOT EXISTS idx_email_replies_campaign ON email_replies(campaignId);
    CREATE INDEX IF NOT EXISTS idx_deals_lead ON deals(leadId);
    CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
    CREATE INDEX IF NOT EXISTS idx_tasks_lead ON tasks(leadId);
    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(dueDate);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completedAt);
    CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);

    CREATE VIRTUAL TABLE IF NOT EXISTS leads_fts USING fts5(name, company, content='leads', content_rowid='rowid');

    CREATE TRIGGER IF NOT EXISTS leads_ai AFTER INSERT ON leads BEGIN
      INSERT INTO leads_fts(rowid, name, company) VALUES (new.rowid, new.name, new.company);
    END;

    CREATE TRIGGER IF NOT EXISTS leads_ad AFTER DELETE ON leads BEGIN
      INSERT INTO leads_fts(leads_fts, rowid, name, company) VALUES('delete', old.rowid, old.name, old.company);
    END;

    CREATE TRIGGER IF NOT EXISTS leads_au AFTER UPDATE ON leads BEGIN
      INSERT INTO leads_fts(leads_fts, rowid, name, company) VALUES('delete', old.rowid, old.name, old.company);
      INSERT INTO leads_fts(rowid, name, company) VALUES (new.rowid, new.name, new.company);
    END;
  `);

  const migrations = [
    'ALTER TABLE email_replies ADD COLUMN campaignId TEXT',
    'ALTER TABLE email_replies ADD COLUMN processedAt TEXT',
    'ALTER TABLE email_accounts ADD COLUMN displayName TEXT',
    'ALTER TABLE email_accounts ADD COLUMN status TEXT DEFAULT "active"',
    'ALTER TABLE email_accounts ADD COLUMN smtpHost TEXT',
    'ALTER TABLE email_accounts ADD COLUMN smtpPort INTEGER',
    'ALTER TABLE email_accounts ADD COLUMN smtpSecure TEXT',
    'ALTER TABLE email_accounts ADD COLUMN smtpUser TEXT',
    'ALTER TABLE email_accounts ADD COLUMN smtpPass TEXT',
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch (_) {}
  }

  const leadScoreCol = db.prepare("PRAGMA table_info(lead_scores)").all().find(c => c.name === 'companyId');
  if (leadScoreCol && leadScoreCol.notnull === 1) {
    db.exec(`
      ALTER TABLE lead_scores RENAME TO lead_scores_old;
      CREATE TABLE lead_scores (
        id TEXT PRIMARY KEY,
        companyId TEXT,
        totalScore INTEGER DEFAULT 0,
        classification TEXT DEFAULT 'Low Priority',
        breakdown TEXT DEFAULT '{}',
        calculatedAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
      );
      INSERT INTO lead_scores (id, companyId, totalScore, classification, breakdown, calculatedAt)
        SELECT id, companyId, totalScore, classification, breakdown, calculatedAt FROM lead_scores_old;
      DROP TABLE lead_scores_old;
    `);
  }
}

module.exports = { initSchema };
