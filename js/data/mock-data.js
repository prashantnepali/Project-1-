const STATUSES = {
  new: 'New',
  qualified: 'Qualified',
  contacted: 'Contacted',
  replied: 'Replied',
  human: 'Human',
  interested: 'Interested',
  demo: 'Demo',
  proposal: 'Proposal',
  customer: 'Customer',
  exited: 'Exited',
  doNotContact: 'Do Not Contact',
  responded: 'Responded',
};

const STATUS_CLS = {
  new: 'st-new',
  qualified: 'st-qual',
  contacted: 'st-cont',
  replied: 'st-repl',
  human: 'st-human',
  interested: 'st-int',
  demo: 'st-demo',
  proposal: 'st-prop',
  customer: 'st-cust',
  exited: 'st-exit',
  doNotContact: 'st-dnc',
  responded: 'st-res',
};

const PIPELINE = [
  'new', 'qualified', 'contacted', 'replied', 'interested', 'demo', 'proposal', 'customer'
];

const CAMPAIGN_STATUSES = { active: 'Active', paused: 'Paused', draft: 'Draft' };
const CAMPAIGN_CLS = { active: 'cs-active', paused: 'cs-paused', draft: 'cs-draft' };

const PRIORITY = { high: 'High', medium: 'Medium', low: 'Low' };
const PRIORITY_CLS = { high: 'p-high', medium: 'p-med', low: 'p-low' };

const INDUSTRIES = [
  'SaaS', 'FinTech', 'E-commerce', 'HealthTech', 'EdTech', 'AI/ML',
  'MarTech', 'InsurTech', 'CleanTech', 'Logistics', 'Real Estate', 'Media'
];

const SOURCES = ['LinkedIn', 'Website', 'Referral', 'Cold Email', 'Event', 'Product Hunt', 'Twitter'];

const NAMES = [
  'Aarav Mehta', 'Vivaan Sharma', 'Aditya Patel', 'Arjun Reddy', 'Sai Krishna',
  'Reyansh Gupta', 'Ayaan Khan', 'Krishna Das', 'Ishaan Verma', 'Pranav Sharma',
  'Ananya Singh', 'Diya Patel', 'Myra Joshi', 'Sara Ali', 'Aisha Khan',
  'Priya Nair', 'Neha Kapoor', 'Riya Desai', 'Kavya Menon', 'Pooja Iyer',
  'Rohan Malhotra', 'Vikram Bhat', 'Sanjay Rao', 'Deepak Kumar', 'Rajesh Tiwari',
  'Meera Chatterjee', 'Lakshmi Pillai', 'Sunita Devi', 'Kavita Joshi', 'Aarti Bose',
  'Hrithik Jain', 'Manish Goel', 'Amit Srivastava', 'Nitin Dubey', 'Suresh Pandey',
  'Tanvi Saxena', 'Divya Agarwal', 'Shreya Kulkarni', 'Nisha Bhatt', 'Rachna Sinha'
];

const COMPANIES = [
  'NovaTech Solutions', 'ByteFlow AI', 'CloudPeak Systems', 'DataNest Analytics',
  'FinLeap Capital', 'GreenGrid Energy', 'HealthPulse AI', 'InnoVista Labs',
  'Jobnest Technologies', 'Kinetra Corp', 'LendWise Financial', 'MapleStar Software',
  'NexGen Robotics', 'OmniPay Solutions', 'PixelForge Studios', 'QuantumBridge',
  'ReliCloud Services', 'SwiftLogix', 'TerraSync', 'UrbanStack',
  'VeritasAI', 'Windborne Systems', 'XenoLabs', 'YieldScale', 'ZenithPath',
  'BrightMinds EdTech', 'ClearView Analytics', 'DreamForge Studios', 'EverGreen Tech',
  'FusionWave Labs', 'GearShift Motors', 'HyperLoop Dynamics', 'IndigoHealth',
  'JetStream Media', 'KeyStone Data', 'LunarTide Systems'
];

const TITLES = [
  'CEO', 'CTO', 'VP of Engineering', 'Head of Growth', 'Product Manager',
  'Marketing Director', 'COO', 'Founder', 'Co-founder', 'Head of Sales',
  'VP Marketing', 'Engineering Lead', 'Director of Ops', 'Head of Product',
  'Growth Lead', 'Revenue Lead', 'Chief Revenue Officer', 'Head of Partnerships',
  'VP Business Dev', 'Marketing Manager', 'Sales Manager', 'Tech Lead',
  'Head of AI', 'Chief Data Officer', 'VP Operations'
];

const LOCATIONS = [
  'Bangalore, India', 'Mumbai, India', 'Delhi, India', 'Hyderabad, India',
  'Pune, India', 'Chennai, India', 'San Francisco, USA', 'New York, USA',
  'London, UK', 'Berlin, Germany', 'Singapore', 'Dubai, UAE',
  'Toronto, Canada', 'Amsterdam, Netherlands', 'Sydney, Australia', 'Tokyo, Japan'
];

const CAMPAIGN_NAMES = [
  'Q1 Product Launch Outreach', 'Series A Founder Follow-up', 'Event Attendee Re-engagement',
  'Free Trial Activation', 'Churned User Win-back', 'Partner Referral Program',
  'Content Upgrade Nurture', 'Webinar Attendee Outreach', 'New Feature Announcement',
  'Enterprise Demo Request', 'Startup Accelerator Leads', 'Holiday Season Campaign'
];

const EMAIL_TEMPLATES = [
  { name: 'Initial Outreach', subject: 'Quick question about {{company}}', body: 'Hi {{firstName}},\n\nI noticed {{company}} is doing great work in {{industry}}. We help companies like yours streamline their lead management.\n\nWould you be open to a quick 15-min chat?\n\nBest,\nSamparka Team' },
  { name: 'Follow-up #1', subject: 'Re: Quick question about {{company}}', body: 'Hi {{firstName}},\n\nJust following up on my earlier email. We recently helped a similar {{industry}} company increase their conversion by 40%.\n\nWould Tuesday or Thursday work for a quick call?\n\nBest,\nSamparka Team' },
  { name: 'Case Study Share', subject: 'How {{industry}} companies are scaling', body: 'Hi {{firstName}},\n\nI thought you might find this interesting — we published a case study on how leading {{industry}} companies are using AI-driven outreach to 3x their pipeline.\n\nHappy to share more details.\n\nBest,\nSamparka Team' },
  { name: 'Breakup Email', subject: 'Should I close your file?', body: 'Hi {{firstName}},\n\nI reached out a few times but haven\'t heard back. I completely understand if now isn\'t the right time.\n\nI\'ll close this for now, but feel free to reach out if anything changes.\n\nBest,\nSamparka Team' },
];

function genId() { return Math.random().toString(36).slice(2, 10); }

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateLeads(count) {
  const leads = [];
  const statusKeys = Object.keys(STATUSES);
  for (let i = 0; i < count; i++) {
    const name = pick(NAMES);
    const company = pick(COMPANIES);
    const status = pick(statusKeys);
    const priority = pick(['high', 'medium', 'low']);
    leads.push({
      id: genId(),
      name,
      firstName: name.split(' ')[0],
      lastName: name.split(' ').slice(1).join(' '),
      email: name.toLowerCase().replace(/ /g, '.') + '@' + company.toLowerCase().replace(/[^a-z]/g, '') + '.com',
      phone: '+91 ' + (7000000000 + Math.floor(Math.random() * 3000000000)),
      company,
      title: pick(TITLES),
      industry: pick(INDUSTRIES),
      location: pick(LOCATIONS),
      source: pick(SOURCES),
      status,
      priority,
      score: Math.floor(Math.random() * 100),
      tags: [pick(INDUSTRIES), pick(SOURCES)],
      notes: '',
      createdAt: randomDate(new Date(2025, 8, 1), new Date(2026, 7, 1)),
      lastActivity: randomDate(new Date(2026, 5, 1), new Date(2026, 7, 25)),
    });
  }
  return leads;
}

function generateCampaigns(leads) {
  return CAMPAIGN_NAMES.map((name, i) => {
    const assigned = leads.filter(() => Math.random() < 0.3);
    const status = i < 3 ? 'active' : i < 7 ? 'paused' : 'draft';
    return {
      id: genId(),
      name,
      status,
      subject: pick(EMAIL_TEMPLATES).subject,
      template: pick(EMAIL_TEMPLATES).name,
      sent: status === 'active' ? Math.floor(Math.random() * 500) + 50 : 0,
      delivered: status === 'active' ? Math.floor(Math.random() * 450) + 40 : 0,
      opened: status === 'active' ? Math.floor(Math.random() * 200) + 20 : 0,
      clicked: status === 'active' ? Math.floor(Math.random() * 80) + 5 : 0,
      replied: status === 'active' ? Math.floor(Math.random() * 40) + 2 : 0,
      bounced: Math.floor(Math.random() * 20),
      leads: assigned.map(l => l.id),
      createdAt: randomDate(new Date(2026, 4, 1), new Date(2026, 7, 1)),
    };
  });
}

function generateActivities(leads) {
  const types = ['email_sent', 'email_opened', 'email_replied', 'status_changed', 'note_added', 'call_made', 'linkedin_connect'];
  const activities = [];
  for (let i = 0; i < 60; i++) {
    const lead = pick(leads);
    const type = pick(types);
    activities.push({
      id: genId(),
      leadId: lead.id,
      leadName: lead.name,
      type,
      description: getActivityDesc(type, lead),
      timestamp: randomDate(new Date(2026, 6, 1), new Date(2026, 7, 25)),
    });
  }
  return activities.sort((a, b) => b.timestamp - a.timestamp);
}

function getActivityDesc(type, lead) {
  const descs = {
    email_sent: `Sent outreach email to ${lead.name}`,
    email_opened: `${lead.name} opened the email`,
    email_replied: `${lead.name} replied to the campaign`,
    status_changed: `Changed ${lead.name}'s status to ${pick(Object.values(STATUSES))}`,
    note_added: `Added note to ${lead.name}'s profile`,
    call_made: `Scheduled call with ${lead.name}`,
    linkedin_connect: `Connected with ${lead.name} on LinkedIn`,
  };
  return descs[type];
}

function generateReplies(leads) {
  const replyTexts = [
    { sentiment: 'positive', text: 'Thanks for reaching out! I\'d love to learn more about what you offer. Can we schedule a call this week?' },
    { sentiment: 'positive', text: 'Interesting! We\'ve been looking for a solution like this. What\'s the pricing like?' },
    { sentiment: 'neutral', text: 'Got your email. Can you send me more details about the product?' },
    { sentiment: 'neutral', text: 'Who referred you to me? Just curious about the connection.' },
    { sentiment: 'negative', text: 'Not interested at this time. Please remove me from your list.' },
    { sentiment: 'positive', text: 'This is exactly what we need! Let me loop in my CTO.' },
    { sentiment: 'neutral', text: 'I\'m quite busy right now. Can you follow up next month?' },
    { sentiment: 'negative', text: 'We already have a solution in place. Thanks anyway.' },
    { sentiment: 'positive', text: 'Great timing! We\'re actually evaluating new tools for Q3. Let\'s chat.' },
    { sentiment: 'positive', text: 'Love the case study you shared. Our team faces similar challenges.' },
  ];
  return leads
    .filter(() => Math.random() < 0.25)
    .map(lead => {
      const reply = pick(replyTexts);
      return {
        id: genId(),
        leadId: lead.id,
        leadName: lead.name,
        leadEmail: lead.email,
        company: lead.company,
        subject: `Re: Quick question about ${lead.company}`,
        body: reply.text,
        sentiment: reply.sentiment,
        receivedAt: randomDate(new Date(2026, 6, 15), new Date(2026, 7, 25)),
        campaignId: null,
        read: Math.random() > 0.3,
      };
    })
    .sort((a, b) => b.receivedAt - a.receivedAt);
}

function generateDiscoverLeads() {
  return Array.from({ length: 25 }, () => ({
    id: genId(),
    name: pick(NAMES),
    company: pick(COMPANIES),
    title: pick(TITLES),
    industry: pick(INDUSTRIES),
    location: pick(LOCATIONS),
    source: pick(SOURCES),
    score: Math.floor(Math.random() * 100),
    added: false,
  }));
}

const MOCK_LEADS = generateLeads(80);
const MOCK_CAMPAIGNS = generateCampaigns(MOCK_LEADS);
const MOCK_ACTIVITIES = generateActivities(MOCK_LEADS);
const MOCK_REPLIES = generateReplies(MOCK_LEADS);
const MOCK_DISCOVER = generateDiscoverLeads();
