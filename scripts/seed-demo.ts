/**
 * Evenum Demo Seed Script
 * Run: pnpm --filter @workspace/scripts run seed
 *
 * Creates a fully-enriched demo environment:
 *   - 4 realistic organizations with branding
 *   - 12 users across roles (admin, organizers, members, attendees)
 *   - 3 active elections with positions, candidates, votes
 *   - 5 events with ticket types and registrations
 *   - 5 campaigns with submissions and financial data
 */

import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  usersTable, organizationsTable, organizationMembersTable,
  electionsTable, positionsTable, candidatesTable, votesTable, voteSelectionsTable,
  eventsTable, ticketTypesTable, ticketsTable,
  campaignsTable, campaignResponsesTable,
} from "@workspace/db/schema";
import { eq, inArray, notInArray, sql } from "drizzle-orm";

const { Pool } = pg;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const DEMO_PASSWORD = "Evenum2025!";

// ─── Image helpers ────────────────────────────────────────────────────────────
const avatar = (seed: string) =>
  `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&backgroundType=gradientLinear`;

const picsum = (seed: string, w = 1200, h = 630) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

const logo = (seed: string, bg = "1E3A5F", color = "FFFFFF") =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(seed)}&size=256&background=${bg}&color=${color}&bold=true&format=svg`;

async function main() {
  console.log("🌱 Starting Evenum demo seed...\n");

  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // ── 1. CLEAN UP POOR-QUALITY DATA ─────────────────────────────────────────
  console.log("🧹 Cleaning up poor-quality demo data...");

  // Delete by cascade: deleting org also removes its elections/events/campaigns
  const orgsToDelete = [4, 5, 6, 7];
  for (const orgId of orgsToDelete) {
    await db.delete(organizationsTable).where(eq(organizationsTable.id, orgId));
  }

  // Remove poor elections/events/campaigns that aren't covered by org cascade
  await db.delete(electionsTable).where(inArray(electionsTable.id, [4, 5, 6]));
  await db.delete(eventsTable).where(inArray(eventsTable.id, [5, 6, 7]));
  await db.delete(campaignsTable).where(inArray(campaignsTable.id, [4, 5, 6]));

  // Remove poor users (keep 1,2,3 = organizers, keep 9 = platform admin)
  await db.delete(usersTable).where(inArray(usersTable.id, [4, 5, 6, 7, 8]));

  // Idempotency: remove any previously-seeded new users/orgs so we can re-insert cleanly
  // Must handle FK order manually: vote_selections → votes → (then org cascade handles the rest)
  const newUserEmails = [
    "priya.sharma@meridianarts.org", "marcus.johnson@citycouncil.org",
    "elena.vasquez@greentech.io", "david.okonkwo@alumni.edu",
    "sarah.kim@example.com", "michael.torres@example.com",
    "aisha.patel@example.com", "james.wilson@meridianarts.org",
  ];
  // Find meridian-arts org elections so we can safely delete their vote data
  const meridianOrg = await db.select({ id: organizationsTable.id }).from(organizationsTable).where(eq(organizationsTable.slug, "meridian-arts")).limit(1);
  if (meridianOrg.length > 0) {
    const meridianElections = await db.select({ id: electionsTable.id }).from(electionsTable).where(eq(electionsTable.orgId, meridianOrg[0].id));
    for (const el of meridianElections) {
      const existingVotes = await db.select({ id: votesTable.id }).from(votesTable).where(eq(votesTable.electionId, el.id));
      if (existingVotes.length > 0) {
        await db.delete(voteSelectionsTable).where(inArray(voteSelectionsTable.voteId, existingVotes.map(v => v.id)));
        await db.delete(votesTable).where(eq(votesTable.electionId, el.id));
      }
    }
    await db.delete(organizationsTable).where(eq(organizationsTable.id, meridianOrg[0].id));
  }
  for (const email of newUserEmails) {
    await db.delete(usersTable).where(eq(usersTable.email, email));
  }

  console.log("  ✓ Removed placeholder orgs 4–7 and test users\n");

  // ── 2. ENRICH / ENSURE BASELINE USERS ──────────────────────────────────────
  console.log("👤 Ensuring baseline users...");

  const upsertUser = async (user: { id: number; name: string; email: string; avatarUrl: string; passwordHash: string }) => {
    await pool.query(
      `INSERT INTO users (id, name, email, avatar_url, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url, password_hash = EXCLUDED.password_hash`,
      [user.id, user.name, user.email, user.avatarUrl, user.passwordHash]
    );
  };

  await upsertUser({
    id: 9,
    name: "Admin",
    email: "admin@evenum.com",
    avatarUrl: avatar("Admin Evenum"),
    passwordHash: hash,
  });

  await upsertUser({
    id: 1,
    name: "Alex Rivera",
    email: "alex.rivera@citycouncil.org",
    avatarUrl: avatar("Alex Rivera"),
    passwordHash: hash,
  });

  await upsertUser({
    id: 2,
    name: "Jordan Lee",
    email: "jordan.lee@greentech.io",
    avatarUrl: avatar("Jordan Lee"),
    passwordHash: hash,
  });

  await upsertUser({
    id: 3,
    name: "Sam Chen",
    email: "sam.chen@alumni.edu",
    avatarUrl: avatar("Sam Chen"),
    passwordHash: hash,
  });

  await pool.query(`SELECT setval(pg_get_serial_sequence('users', 'id'), coalesce(max(id), 1)) FROM users`);
  console.log("  ✓ Configured baseline users (Admin, Alex, Jordan, Sam)\n");

  // ── 3. ENRICH / ENSURE BASELINE ORGANIZATIONS ─────────────────────────────
  console.log("🏛  Ensuring baseline organizations...");

  const upsertOrg = async (org: { id: number; name: string; slug: string; description: string; logoUrl: string; website: string; ownerId: number }) => {
    await pool.query(
      `INSERT INTO organizations (id, name, slug, description, logo_url, website, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, description = EXCLUDED.description, logo_url = EXCLUDED.logo_url, website = EXCLUDED.website, owner_id = EXCLUDED.owner_id`,
      [org.id, org.name, org.slug, org.description, org.logoUrl, org.website, org.ownerId]
    );
  };

  await upsertOrg({
    id: 1,
    name: "City Council District 7",
    slug: "city-council-d7",
    description: "Official civic participation hub for District 7 residents. We run transparent elections, host town halls, and collect community feedback to shape local policy.",
    logoUrl: logo("D7", "1E3A5F"),
    website: "https://district7.gov",
    ownerId: 1,
  });

  await upsertOrg({
    id: 2,
    name: "GreenTech Innovation Hub",
    slug: "greentech-hub",
    description: "A community of 3,000+ sustainable technology professionals driving the future of clean energy, circular economy, and climate solutions.",
    logoUrl: logo("GT", "1B7A4C"),
    website: "https://greentechhub.io",
    ownerId: 2,
  });

  await upsertOrg({
    id: 3,
    name: "Alumni Association Network",
    slug: "alumni-network",
    description: "Connecting 45,000 graduates across 80 countries. We celebrate achievements, support career development, and fund the next generation of scholars.",
    logoUrl: logo("AA", "8B1A1A"),
    website: "https://alumninetwork.edu",
    ownerId: 3,
  });

  await pool.query(`SELECT setval(pg_get_serial_sequence('organizations', 'id'), coalesce(max(id), 1)) FROM organizations`);
  console.log("  ✓ Configured baseline organizations (City Council, GreenTech, Alumni)\n");

  // ── 4. CREATE NEW USERS ───────────────────────────────────────────────────
  console.log("👥 Creating new users...");

  const [priya] = await db.insert(usersTable).values({
    email: "priya.sharma@meridianarts.org",
    passwordHash: hash,
    name: "Priya Sharma",
    avatarUrl: avatar("Priya Sharma"),
  }).returning();

  const [marcus] = await db.insert(usersTable).values({
    email: "marcus.johnson@citycouncil.org",
    passwordHash: hash,
    name: "Marcus Johnson",
    avatarUrl: avatar("Marcus Johnson"),
  }).returning();

  const [elena] = await db.insert(usersTable).values({
    email: "elena.vasquez@greentech.io",
    passwordHash: hash,
    name: "Elena Vasquez",
    avatarUrl: avatar("Elena Vasquez"),
  }).returning();

  const [david] = await db.insert(usersTable).values({
    email: "david.okonkwo@alumni.edu",
    passwordHash: hash,
    name: "David Okonkwo",
    avatarUrl: avatar("David Okonkwo"),
  }).returning();

  const [sarah] = await db.insert(usersTable).values({
    email: "sarah.kim@example.com",
    passwordHash: hash,
    name: "Sarah Kim",
    avatarUrl: avatar("Sarah Kim"),
  }).returning();

  const [michael] = await db.insert(usersTable).values({
    email: "michael.torres@example.com",
    passwordHash: hash,
    name: "Michael Torres",
    avatarUrl: avatar("Michael Torres"),
  }).returning();

  const [aisha] = await db.insert(usersTable).values({
    email: "aisha.patel@example.com",
    passwordHash: hash,
    name: "Aisha Patel",
    avatarUrl: avatar("Aisha Patel"),
  }).returning();

  const [james] = await db.insert(usersTable).values({
    email: "james.wilson@meridianarts.org",
    passwordHash: hash,
    name: "James Wilson",
    avatarUrl: avatar("James Wilson"),
  }).returning();

  console.log(`  ✓ Created 8 new users (IDs: ${priya.id}, ${marcus.id}, ${elena.id}, ${david.id}, ${sarah.id}, ${michael.id}, ${aisha.id}, ${james.id})\n`);

  // ── 5. CREATE MERIDIAN ARTS COUNCIL ──────────────────────────────────────
  console.log("🎭 Creating Meridian Arts Council...");

  const [meridian] = await db.insert(organizationsTable).values({
    name: "Meridian Arts Council",
    slug: "meridian-arts",
    description: "Championing arts and culture in the metropolitan region since 1987. We fund artists, run the city's premier cultural events, and connect communities through creative expression.",
    logoUrl: logo("MA", "6B21A8"),
    website: "https://meridianarts.org",
    ownerId: priya.id,
  }).returning();

  console.log(`  ✓ Created Meridian Arts Council (ID: ${meridian.id})\n`);

  // ── 6. ORGANIZATION MEMBERSHIPS ───────────────────────────────────────────
  console.log("🔗 Setting up organization memberships...");

  // City Council — Marcus as admin member
  await db.insert(organizationMembersTable).values([
    { orgId: 1, userId: marcus.id, role: "admin" },
    { orgId: 1, userId: sarah.id, role: "member" },
    { orgId: 1, userId: michael.id, role: "member" },
  ]).onConflictDoNothing();

  // GreenTech — Elena as admin, Aisha as member
  await db.insert(organizationMembersTable).values([
    { orgId: 2, userId: elena.id, role: "admin" },
    { orgId: 2, userId: david.id, role: "member" },
    { orgId: 2, userId: aisha.id, role: "member" },
  ]).onConflictDoNothing();

  // Alumni — David as admin, Sarah and Michael as members
  await db.insert(organizationMembersTable).values([
    { orgId: 3, userId: david.id, role: "admin" },
    { orgId: 3, userId: sarah.id, role: "member" },
    { orgId: 3, userId: aisha.id, role: "member" },
  ]).onConflictDoNothing();

  // Meridian — James as admin, others as members
  await db.insert(organizationMembersTable).values([
    { orgId: meridian.id, userId: james.id, role: "admin" },
    { orgId: meridian.id, userId: michael.id, role: "member" },
  ]).onConflictDoNothing();

  console.log("  ✓ Memberships configured\n");

  // ── 7. ENRICH ELECTIONS ───────────────────────────────────────────────────
  console.log("🗳️  Enriching elections...");

  // Election 1: District 7 Board of Directors (active) — enrich it
  await db.update(electionsTable).set({
    title: "District 7 Board of Directors Election 2026",
    description: "Elect three members to serve on the District 7 Board of Directors. Board members set policy, approve the annual budget, and represent resident interests at City Hall. All verified District 7 residents are eligible to vote.",
    status: "active",
    visibility: "public",
    requiresAuth: false,
    eligibilityMode: "open",
    startsAt: new Date("2026-07-10T08:00:00Z"),
    endsAt: new Date("2026-07-25T23:59:59Z"),
    requiresPayment: true,
    paymentAmount: "200.00",
    currency: "XAF",
  }).where(eq(electionsTable.id, 1));

  // Clean up existing votes/positions for election 1 to rebuild properly
  // Must delete in FK-safe order: vote_selections → votes → positions (candidates cascade from positions)
  const existingVotes1 = await db.select({ id: votesTable.id }).from(votesTable).where(eq(votesTable.electionId, 1));
  if (existingVotes1.length > 0) {
    await db.delete(voteSelectionsTable).where(inArray(voteSelectionsTable.voteId, existingVotes1.map(v => v.id)));
    await db.delete(votesTable).where(eq(votesTable.electionId, 1));
  }
  await db.delete(positionsTable).where(eq(positionsTable.electionId, 1));

  // Election 1 positions
  const [pos1a] = await db.insert(positionsTable).values({
    electionId: 1,
    title: "Board Chair",
    description: "Leads board meetings, sets the strategic agenda, and serves as the primary spokesperson for the District 7 community.",
    maxSelections: 1,
    sortOrder: 1,
  }).returning();

  const [pos1b] = await db.insert(positionsTable).values({
    electionId: 1,
    title: "Finance Director",
    description: "Oversees the district budget, approves expenditures, and ensures fiscal accountability to all residents.",
    maxSelections: 1,
    sortOrder: 2,
  }).returning();

  const [pos1c] = await db.insert(positionsTable).values({
    electionId: 1,
    title: "Community Liaison",
    description: "Bridges communication between residents and the board. Manages community outreach and public engagement programs.",
    maxSelections: 1,
    sortOrder: 3,
  }).returning();

  // Election 1 candidates
  const [cand1] = await db.insert(candidatesTable).values({
    electionId: 1, positionId: pos1a.id,
    name: "Patricia Morales",
    bio: "20-year District 7 resident and former PTA president. Advocates for transparent governance and neighborhood-level decision making.",
    photoUrl: picsum("patricia-morales", 400, 400),
    platform: "Transparent governance, resident-first policy, and fiscal responsibility. I will hold monthly open office hours and publish full board meeting transcripts.",
  }).returning();

  const [cand2] = await db.insert(candidatesTable).values({
    electionId: 1, positionId: pos1a.id,
    name: "Robert Kim",
    bio: "City planner with 15 years of urban development experience. Focused on sustainable growth and affordable housing.",
    photoUrl: picsum("robert-kim", 400, 400),
    platform: "Smart, sustainable growth. My district plan will add 500 affordable units while protecting the neighborhood character we all love.",
  }).returning();

  const [cand3] = await db.insert(candidatesTable).values({
    electionId: 1, positionId: pos1b.id,
    name: "Diane Okafor",
    bio: "CPA and small business owner. Former city budget auditor. Believes every dollar of public money must be justified.",
    photoUrl: picsum("diane-okafor", 400, 400),
    platform: "Zero-based budgeting for District 7. I will audit all recurring contracts and redirect savings to parks and infrastructure.",
  }).returning();

  const [cand4] = await db.insert(candidatesTable).values({
    electionId: 1, positionId: pos1b.id,
    name: "Thomas Reyes",
    bio: "Financial analyst and community volunteer. Member of the District 7 Economic Development Committee since 2021.",
    photoUrl: picsum("thomas-reyes", 400, 400),
    platform: "Grow the tax base, not the tax rate. My economic development plan will attract 200 new businesses to District 7 within two years.",
  }).returning();

  const [cand5] = await db.insert(candidatesTable).values({
    electionId: 1, positionId: pos1c.id,
    name: "Maria Gonzalez",
    bio: "Bilingual community organizer, immigrant rights advocate, and longtime District 7 resident. Fluent in English and Spanish.",
    photoUrl: picsum("maria-gonzalez", 400, 400),
    platform: "Every voice deserves to be heard. I will establish multilingual community councils and ensure no resident is left out of the conversation.",
  }).returning();

  const [cand6] = await db.insert(candidatesTable).values({
    electionId: 1, positionId: pos1c.id,
    name: "Kevin Park",
    bio: "High school civics teacher and youth program director. Passionate about civic education and next-generation leadership.",
    photoUrl: picsum("kevin-park", 400, 400),
    platform: "Invest in our youth, secure our future. I'll launch a District 7 Youth Advisory Council with real budget input and binding recommendations.",
  }).returning();

  // Election 1 votes — generate realistic voting data
  const voters1 = ["voter-anon-001", "voter-anon-002", "voter-anon-003", "voter-anon-004", "voter-anon-005",
    "voter-anon-006", "voter-anon-007", "voter-anon-008", "voter-anon-009", "voter-anon-010",
    "voter-anon-011", "voter-anon-012", "voter-anon-013", "voter-anon-014", "voter-anon-015",
    String(sarah.id), String(michael.id), String(aisha.id)];

  // Candidate vote distribution: Patricia 11, Robert 7; Diane 10, Thomas 8; Maria 13, Kevin 5
  const election1Ballots: Array<[string, number, number, number]> = [
    // [voterId, chair choice, finance choice, liaison choice]
    ["voter-anon-001", cand1.id, cand3.id, cand5.id],
    ["voter-anon-002", cand1.id, cand3.id, cand5.id],
    ["voter-anon-003", cand1.id, cand3.id, cand5.id],
    ["voter-anon-004", cand1.id, cand4.id, cand5.id],
    ["voter-anon-005", cand1.id, cand3.id, cand6.id],
    ["voter-anon-006", cand2.id, cand3.id, cand5.id],
    ["voter-anon-007", cand2.id, cand4.id, cand5.id],
    ["voter-anon-008", cand2.id, cand3.id, cand6.id],
    ["voter-anon-009", cand1.id, cand4.id, cand5.id],
    ["voter-anon-010", cand2.id, cand4.id, cand5.id],
    ["voter-anon-011", cand1.id, cand3.id, cand5.id],
    ["voter-anon-012", cand1.id, cand3.id, cand5.id],
    ["voter-anon-013", cand2.id, cand4.id, cand6.id],
    ["voter-anon-014", cand1.id, cand3.id, cand5.id],
    ["voter-anon-015", cand2.id, cand4.id, cand5.id],
    [String(sarah.id), cand1.id, cand3.id, cand5.id],
    [String(michael.id), cand2.id, cand4.id, cand6.id],
    [String(aisha.id), cand1.id, cand3.id, cand5.id],
  ];

  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000);

  for (let i = 0; i < election1Ballots.length; i++) {
    const [voterId, chairChoice, finChoice, liaisonChoice] = election1Ballots[i];
    const [vote] = await db.insert(votesTable).values({
      electionId: 1,
      voterIdentifier: voterId,
      votedAt: hoursAgo(180 - i * 8),
    }).returning();
    await db.insert(voteSelectionsTable).values([
      { voteId: vote.id, positionId: pos1a.id, candidateId: chairChoice },
      { voteId: vote.id, positionId: pos1b.id, candidateId: finChoice },
      { voteId: vote.id, positionId: pos1c.id, candidateId: liaisonChoice },
    ]);
  }

  console.log("  ✓ Election 1 (District 7 Board) — 3 positions, 6 candidates, 18 votes");

  // Election 2: GreenTech Innovation Award (active)
  await db.update(electionsTable).set({
    title: "GreenTech Innovation Award 2026",
    description: "Vote for this year's most impactful clean technology innovation. Winners receive a $25,000 grant and a featured speaking slot at our annual summit.",
    status: "active",
    visibility: "public",
    requiresAuth: false,
    eligibilityMode: "open",
    startsAt: new Date("2026-07-15T00:00:00Z"),
    endsAt: new Date("2026-07-31T23:59:59Z"),
  }).where(eq(electionsTable.id, 2));

  const existingVotes2 = await db.select({ id: votesTable.id }).from(votesTable).where(eq(votesTable.electionId, 2));
  if (existingVotes2.length > 0) {
    await db.delete(voteSelectionsTable).where(inArray(voteSelectionsTable.voteId, existingVotes2.map(v => v.id)));
    await db.delete(votesTable).where(eq(votesTable.electionId, 2));
  }
  await db.delete(positionsTable).where(eq(positionsTable.electionId, 2));

  const [pos2a] = await db.insert(positionsTable).values({
    electionId: 2,
    title: "Innovation of the Year",
    description: "Select the single most impactful clean-tech innovation of 2026 from the nominated finalists.",
    maxSelections: 1,
    sortOrder: 1,
  }).returning();

  const [pos2b] = await db.insert(positionsTable).values({
    electionId: 2,
    title: "Rising Startup Award",
    description: "Recognizing a company founded in the last 24 months with exceptional growth and environmental impact.",
    maxSelections: 1,
    sortOrder: 2,
  }).returning();

  const [cand7] = await db.insert(candidatesTable).values({
    electionId: 2, positionId: pos2a.id,
    name: "SolarDrive Grid Storage",
    bio: "Modular battery storage system that reduces grid dependency by 60% for residential neighborhoods.",
    photoUrl: picsum("solar-drive", 400, 400),
    platform: "Our patent-pending lithium-iron-phosphate cells operate at 97.3% efficiency and are manufactured with zero-waste processes.",
  }).returning();

  const [cand8] = await db.insert(candidatesTable).values({
    electionId: 2, positionId: pos2a.id,
    name: "AquaRenew Desalination",
    bio: "Scalable solar-powered desalination units providing clean water to drought-affected communities.",
    photoUrl: picsum("aqua-renew", 400, 400),
    platform: "Deployed in 14 countries. Each unit processes 50,000 liters per day using 80% less energy than conventional systems.",
  }).returning();

  const [cand9] = await db.insert(candidatesTable).values({
    electionId: 2, positionId: pos2a.id,
    name: "CarbonCycle AI Platform",
    bio: "Machine learning platform that optimizes carbon capture across industrial supply chains.",
    photoUrl: picsum("carbon-cycle", 400, 400),
    platform: "Reduced Scope 3 emissions for Fortune 500 clients by an average of 34% in year one.",
  }).returning();

  const [cand10] = await db.insert(candidatesTable).values({
    electionId: 2, positionId: pos2b.id,
    name: "Verdant Packaging Co.",
    bio: "Founded 2025. Produces 100% compostable packaging from agricultural waste that biodegrades in 30 days.",
    photoUrl: picsum("verdant-packaging", 400, 400),
    platform: "Shipped 2 million units in Q1 2026. Partners include three major grocery chains. Landfill diversion rate: 99.7%.",
  }).returning();

  const [cand11] = await db.insert(candidatesTable).values({
    electionId: 2, positionId: pos2b.id,
    name: "Hive Mobility",
    bio: "Founded 2024. Electric shared micro-mobility network reducing urban car trips by 18% in pilot cities.",
    photoUrl: picsum("hive-mobility", 400, 400),
    platform: "Operating in 6 cities. 450,000 rides served. Each bike diverts an estimated 2.4 kg of CO₂ per trip.",
  }).returning();

  // GreenTech election votes
  const election2Ballots: Array<[string, number, number]> = [
    ["gt-voter-001", cand7.id, cand10.id],
    ["gt-voter-002", cand9.id, cand11.id],
    ["gt-voter-003", cand7.id, cand11.id],
    ["gt-voter-004", cand8.id, cand10.id],
    ["gt-voter-005", cand9.id, cand10.id],
    ["gt-voter-006", cand7.id, cand10.id],
    ["gt-voter-007", cand9.id, cand11.id],
    ["gt-voter-008", cand7.id, cand10.id],
    ["gt-voter-009", cand8.id, cand11.id],
    ["gt-voter-010", cand9.id, cand10.id],
    ["gt-voter-011", cand7.id, cand11.id],
    ["gt-voter-012", cand9.id, cand10.id],
    [String(elena.id), cand7.id, cand10.id],
    [String(david.id), cand9.id, cand11.id],
  ];

  for (let i = 0; i < election2Ballots.length; i++) {
    const [voterId, innChoice, startupChoice] = election2Ballots[i];
    const [vote] = await db.insert(votesTable).values({
      electionId: 2,
      voterIdentifier: voterId,
      votedAt: hoursAgo(72 - i * 4),
    }).returning();
    await db.insert(voteSelectionsTable).values([
      { voteId: vote.id, positionId: pos2a.id, candidateId: innChoice },
      { voteId: vote.id, positionId: pos2b.id, candidateId: startupChoice },
    ]);
  }

  console.log("  ✓ Election 2 (GreenTech Innovation Award) — 2 positions, 5 candidates, 14 votes");

  // Election 3: Alumni Council Leadership (make it active)
  await db.update(electionsTable).set({
    title: "Alumni Council Leadership Election 2026",
    description: "Shape the future of our global alumni network. Elect the executive committee who will lead programs, partnerships, and community initiatives for the next two years.",
    status: "active",
    visibility: "public",
    requiresAuth: false,
    eligibilityMode: "open",
    startsAt: new Date("2026-07-20T00:00:00Z"),
    endsAt: new Date("2026-08-05T23:59:59Z"),
  }).where(eq(electionsTable.id, 3));

  const existingVotes3 = await db.select({ id: votesTable.id }).from(votesTable).where(eq(votesTable.electionId, 3));
  if (existingVotes3.length > 0) {
    await db.delete(voteSelectionsTable).where(inArray(voteSelectionsTable.voteId, existingVotes3.map(v => v.id)));
    await db.delete(votesTable).where(eq(votesTable.electionId, 3));
  }
  await db.delete(positionsTable).where(eq(positionsTable.electionId, 3));

  const [pos3a] = await db.insert(positionsTable).values({
    electionId: 3,
    title: "Council President",
    description: "Leads the Alumni Council, chairs quarterly meetings, and represents alumni interests to the university administration.",
    maxSelections: 1,
    sortOrder: 1,
  }).returning();

  const [pos3b] = await db.insert(positionsTable).values({
    electionId: 3,
    title: "Career Development Chair",
    description: "Oversees mentorship programs, job boards, and industry partnership initiatives.",
    maxSelections: 1,
    sortOrder: 2,
  }).returning();

  const [cand12] = await db.insert(candidatesTable).values({
    electionId: 3, positionId: pos3a.id,
    name: "Linda Nakamura",
    bio: "Class of 2002. Senior Partner at Harrison & Bloom LLP. Board member of three nonprofit organizations.",
    photoUrl: picsum("linda-nakamura", 400, 400),
    platform: "I will modernize our mentorship infrastructure with a digital matching platform connecting 5,000 alumni pairs globally.",
  }).returning();

  const [cand13] = await db.insert(candidatesTable).values({
    electionId: 3, positionId: pos3a.id,
    name: "Dr. Emmanuel Boateng",
    bio: "Class of 1998. Professor of Economics at Georgetown. Author of three books on emerging market development.",
    photoUrl: picsum("emmanuel-boateng", 400, 400),
    platform: "Academic excellence must meet real-world impact. My council will fund scholarships for first-generation students and create a global internship exchange.",
  }).returning();

  const [cand14] = await db.insert(candidatesTable).values({
    electionId: 3, positionId: pos3b.id,
    name: "Rachel Obi",
    bio: "Class of 2015. Head of Talent at a Series B fintech startup. Built mentorship programs serving 800 alumni.",
    photoUrl: picsum("rachel-obi", 400, 400),
    platform: "Career development should be a lifelong benefit, not a one-time service. I'll build a curated job board and quarterly alumni hiring events in 12 cities.",
  }).returning();

  const [cand15] = await db.insert(candidatesTable).values({
    electionId: 3, positionId: pos3b.id,
    name: "Carlos Mendez",
    bio: "Class of 2011. Founder of two startups. Angel investor with a portfolio of 18 companies.",
    photoUrl: picsum("carlos-mendez", 400, 400),
    platform: "Entrepreneurship is the most powerful career path. I will create an alumni venture fund and run monthly pitch events for alumni-founded companies.",
  }).returning();

  const election3Ballots: Array<[string, number, number]> = [
    ["alum-v-001", cand12.id, cand14.id],
    ["alum-v-002", cand13.id, cand15.id],
    ["alum-v-003", cand12.id, cand14.id],
    ["alum-v-004", cand12.id, cand15.id],
    ["alum-v-005", cand13.id, cand14.id],
    ["alum-v-006", cand12.id, cand14.id],
    ["alum-v-007", cand13.id, cand15.id],
    ["alum-v-008", cand12.id, cand14.id],
    [String(sarah.id), cand12.id, cand14.id],
  ];

  for (let i = 0; i < election3Ballots.length; i++) {
    const [voterId, presChoice, cdChoice] = election3Ballots[i];
    const [vote] = await db.insert(votesTable).values({
      electionId: 3,
      voterIdentifier: voterId,
      votedAt: hoursAgo(48 - i * 5),
    }).returning();
    await db.insert(voteSelectionsTable).values([
      { voteId: vote.id, positionId: pos3a.id, candidateId: presChoice },
      { voteId: vote.id, positionId: pos3b.id, candidateId: cdChoice },
    ]);
  }

  console.log("  ✓ Election 3 (Alumni Council) — 2 positions, 4 candidates, 9 votes");

  // Election 4: Meridian Arts Council — Grant Committee (ended, with results)
  const [election4] = await db.insert(electionsTable).values({
    orgId: meridian.id,
    title: "Arts Grant Review Committee 2026",
    description: "Select two community representatives to join the professional panel reviewing grant applications totaling $180,000. Elected members serve a one-year term.",
    status: "ended",
    visibility: "public",
    requiresAuth: false,
    eligibilityMode: "open",
    startsAt: new Date("2026-06-01T00:00:00Z"),
    endsAt: new Date("2026-06-30T23:59:59Z"),
  }).returning();

  const [pos4a] = await db.insert(positionsTable).values({
    electionId: election4.id,
    title: "Community Representative (2 seats)",
    description: "Two community members selected to represent diverse artistic disciplines and neighborhood perspectives.",
    maxSelections: 2,
    sortOrder: 1,
  }).returning();

  const [cand16] = await db.insert(candidatesTable).values({
    electionId: election4.id, positionId: pos4a.id,
    name: "Yuki Tanaka",
    bio: "Muralist and public art advocate. Has facilitated grant applications for 30+ local artists.",
    photoUrl: picsum("yuki-tanaka", 400, 400),
    platform: "Ensure visual arts and community muralism receive equitable representation in grant allocations.",
  }).returning();

  const [cand17] = await db.insert(candidatesTable).values({
    electionId: election4.id, positionId: pos4a.id,
    name: "Dr. Femi Adeyemi",
    bio: "Music professor and founder of the city's youth symphony program. Advocates for arts education funding.",
    photoUrl: picsum("femi-adeyemi", 400, 400),
    platform: "Prioritize grants that have measurable educational impact on youth aged 12–18.",
  }).returning();

  const [cand18] = await db.insert(candidatesTable).values({
    electionId: election4.id, positionId: pos4a.id,
    name: "Anastasia Volkov",
    bio: "Theater director and playwright. Runs an annual fringe festival with 40 independent productions.",
    photoUrl: picsum("anastasia-volkov", 400, 400),
    platform: "Champion under-resourced performing arts groups and first-time applicants who lack institutional support.",
  }).returning();

  // Election 4 votes (ended)
  const election4Ballots: Array<[string, number[]]> = [
    ["arts-v-001", [cand16.id, cand17.id]],
    ["arts-v-002", [cand17.id, cand18.id]],
    ["arts-v-003", [cand16.id, cand18.id]],
    ["arts-v-004", [cand16.id, cand17.id]],
    ["arts-v-005", [cand17.id, cand18.id]],
    ["arts-v-006", [cand16.id, cand17.id]],
    ["arts-v-007", [cand16.id, cand18.id]],
    ["arts-v-008", [cand17.id, cand18.id]],
    ["arts-v-009", [cand16.id, cand17.id]],
    ["arts-v-010", [cand16.id, cand18.id]],
    ["arts-v-011", [cand17.id, cand18.id]],
    ["arts-v-012", [cand16.id, cand17.id]],
    [String(james.id), [cand16.id, cand17.id]],
    [String(michael.id), [cand17.id, cand18.id]],
    [String(aisha.id), [cand16.id, cand17.id]],
  ];

  for (let i = 0; i < election4Ballots.length; i++) {
    const [voterId, choices] = election4Ballots[i];
    const [vote] = await db.insert(votesTable).values({
      electionId: election4.id,
      voterIdentifier: voterId,
      votedAt: new Date(Date.now() - (20 + i) * 24 * 3600000),
    }).returning();
    await db.insert(voteSelectionsTable).values(
      choices.map((candidateId) => ({ voteId: vote.id, positionId: pos4a.id, candidateId }))
    );
  }

  console.log("  ✓ Election 4 (Meridian Arts Grant Committee) — 1 position, 3 candidates, 15 votes (ended)\n");

  // ── 8. ENRICH EVENTS ──────────────────────────────────────────────────────
  console.log("📅 Enriching events...");

  // Event 1: Town Hall (org 1, City Council)
  await db.update(eventsTable).set({
    title: "Town Hall: District 7 Master Plan 2030",
    description: "Join your board representatives for an interactive presentation and open Q&A on the District 7 Master Plan 2030. Hear directly from city planners, ask questions, and submit written comments. Light refreshments will be served. Childcare provided on request.",
    coverImageUrl: picsum("town-hall-civic", 1200, 630),
    location: "District 7 Community Center, 1401 Maple Avenue, Hall B",
    isOnline: false,
    status: "published",
    visibility: "public",
    capacity: 200,
    startsAt: new Date("2026-07-23T18:00:00Z"),
    endsAt: new Date("2026-07-23T21:00:00Z"),
  }).where(eq(eventsTable.id, 1));

  await db.delete(ticketsTable).where(eq(ticketsTable.eventId, 1));
  await db.delete(ticketTypesTable).where(eq(ticketTypesTable.eventId, 1));
  const [tt1a] = await db.insert(ticketTypesTable).values({
    eventId: 1,
    name: "General Admission",
    description: "Open to all District 7 residents. Free entry.",
    price: "0.00",
    currency: "XAF",
    quantity: 150,
    sold: 0,
  }).returning();
  const [tt1b] = await db.insert(ticketTypesTable).values({
    eventId: 1,
    name: "VIP Front Row",
    description: "Reserved front-row seating and priority question time. Includes pre-event meet & greet with board members.",
    price: "0.00",
    currency: "XAF",
    quantity: 20,
    sold: 0,
  }).returning();

  // Registrations for event 1
  const e1attendees = [
    { name: "Sarah Kim", email: "sarah.kim@example.com" },
    { name: "Michael Torres", email: "michael.torres@example.com" },
    { name: "Aisha Patel", email: "aisha.patel@example.com" },
    { name: "Nancy Ostrowski", email: "nancy.o@district7.org" },
    { name: "Gregory Holt", email: "g.holt@gmail.com" },
    { name: "Carmen Delgado", email: "carmen.delgado@gmail.com" },
    { name: "Bernard Kowalski", email: "bkowalski@outlook.com" },
    { name: "Yvonne Fletcher", email: "yfletcher@yahoo.com" },
  ];
  let e1SoldGeneral = 0, e1SoldVIP = 0;
  for (let i = 0; i < e1attendees.length; i++) {
    const isVIP = i < 2;
    const ttId = isVIP ? tt1b.id : tt1a.id;
    const ticketCode = `D7TH${String(i + 1).padStart(4, "0")}`;
    await db.insert(ticketsTable).values({
      eventId: 1, ticketTypeId: ttId,
      attendeeName: e1attendees[i].name,
      attendeeEmail: e1attendees[i].email,
      ticketCode, status: "valid",
      checkedInAt: i < 3 ? new Date("2026-07-23T18:15:00Z") : null,
    });
    if (isVIP) e1SoldVIP++; else e1SoldGeneral++;
  }
  await db.update(ticketTypesTable).set({ sold: e1SoldGeneral }).where(eq(ticketTypesTable.id, tt1a.id));
  await db.update(ticketTypesTable).set({ sold: e1SoldVIP }).where(eq(ticketTypesTable.id, tt1b.id));

  console.log("  ✓ Event 1 (Town Hall) — 2 ticket types, 8 registrations");

  // Event 2: GreenTech Summit 2026
  await db.update(eventsTable).set({
    title: "GreenTech Summit 2026: Scaling Clean Tech",
    description: "The region's premier gathering for clean technology professionals. Two days of keynotes, workshops, panel discussions, and networking. Join 800+ innovators, investors, and policymakers shaping the sustainable economy. Topics include solar storage, EV infrastructure, carbon markets, and circular supply chains.",
    coverImageUrl: picsum("greentech-summit-conf", 1200, 630),
    location: "Metropolitan Convention Center, Hall 5, 200 Harbor Blvd",
    isOnline: false,
    status: "published",
    visibility: "public",
    capacity: 800,
    startsAt: new Date("2026-08-12T08:00:00Z"),
    endsAt: new Date("2026-08-13T18:00:00Z"),
  }).where(eq(eventsTable.id, 2));

  await db.delete(ticketsTable).where(eq(ticketsTable.eventId, 2));
  await db.delete(ticketTypesTable).where(eq(ticketTypesTable.eventId, 2));
  const [tt2a] = await db.insert(ticketTypesTable).values({
    eventId: 2,
    name: "General Pass",
    description: "Access to all keynotes, exhibition floor, and evening networking reception.",
    price: "299.00",
    currency: "XAF",
    quantity: 600,
    sold: 0,
  }).returning();
  const [tt2b] = await db.insert(ticketTypesTable).values({
    eventId: 2,
    name: "VIP All-Access",
    description: "Priority seating, all workshop tracks, private investor lunch, and a signed copy of the GreenTech State of the Industry Report.",
    price: "799.00",
    currency: "XAF",
    quantity: 100,
    sold: 0,
  }).returning();
  const [tt2c] = await db.insert(ticketTypesTable).values({
    eventId: 2,
    name: "Student / Nonprofit",
    description: "Discounted admission for full-time students and nonprofit staff. Valid ID required at check-in.",
    price: "49.00",
    currency: "XAF",
    quantity: 100,
    sold: 0,
  }).returning();

  const e2attendees = [
    { name: "Elena Vasquez", email: "elena.vasquez@greentech.io", tt: tt2b.id },
    { name: "David Okonkwo", email: "david.okonkwo@alumni.edu", tt: tt2a.id },
    { name: "Sarah Kim", email: "sarah.kim@example.com", tt: tt2a.id },
    { name: "Michael Torres", email: "michael.torres@example.com", tt: tt2a.id },
    { name: "Priya Sharma", email: "priya.sharma@meridianarts.org", tt: tt2a.id },
    { name: "Aisha Patel", email: "aisha.patel@example.com", tt: tt2c.id },
    { name: "James Wilson", email: "james.wilson@meridianarts.org", tt: tt2c.id },
    { name: "Carlos Ibarra", email: "c.ibarra@solarcorp.com", tt: tt2b.id },
    { name: "Nora Blackwood", email: "nblackwood@cleanvc.com", tt: tt2b.id },
    { name: "Trevor Mills", email: "t.mills@greenbuild.org", tt: tt2a.id },
    { name: "Yuki Tanaka", email: "yuki.tanaka@meridianarts.org", tt: tt2c.id },
    { name: "Keiko Matsuda", email: "keiko@sustainlab.io", tt: tt2a.id },
  ];
  const e2SoldMap: Record<number, number> = { [tt2a.id]: 0, [tt2b.id]: 0, [tt2c.id]: 0 };
  for (let i = 0; i < e2attendees.length; i++) {
    const { name, email, tt } = e2attendees[i];
    const ticketCode = `GT26${String(i + 1).padStart(4, "0")}`;
    await db.insert(ticketsTable).values({
      eventId: 2, ticketTypeId: tt,
      attendeeName: name, attendeeEmail: email,
      ticketCode, status: "valid",
    });
    e2SoldMap[tt]++;
  }
  await db.update(ticketTypesTable).set({ sold: e2SoldMap[tt2a.id] }).where(eq(ticketTypesTable.id, tt2a.id));
  await db.update(ticketTypesTable).set({ sold: e2SoldMap[tt2b.id] }).where(eq(ticketTypesTable.id, tt2b.id));
  await db.update(ticketTypesTable).set({ sold: e2SoldMap[tt2c.id] }).where(eq(ticketTypesTable.id, tt2c.id));

  console.log("  ✓ Event 2 (GreenTech Summit) — 3 ticket types, 12 registrations");

  // Event 3: Alumni Gala
  await db.update(eventsTable).set({
    title: "Annual Alumni Gala & Awards Night 2026",
    description: "An evening of celebration, connection, and recognition. The Alumni Gala brings together graduates across generations for a formal dinner, the Distinguished Alumni Awards ceremony, and a live auction benefiting the university scholarship fund. Black tie optional.",
    coverImageUrl: picsum("gala-formal-event", 1200, 630),
    location: "Grand Ballroom, The Harrington Hotel, 55 Park Street",
    isOnline: false,
    status: "published",
    visibility: "public",
    capacity: 300,
    startsAt: new Date("2026-09-11T18:30:00Z"),
    endsAt: new Date("2026-09-11T23:00:00Z"),
  }).where(eq(eventsTable.id, 3));

  await db.delete(ticketsTable).where(eq(ticketsTable.eventId, 3));
  await db.delete(ticketTypesTable).where(eq(ticketTypesTable.eventId, 3));
  const [tt3a] = await db.insert(ticketTypesTable).values({
    eventId: 3,
    name: "Individual Seat",
    description: "One seat at the gala dinner, including the awards ceremony and networking reception.",
    price: "185.00",
    currency: "XAF",
    quantity: 250,
    sold: 0,
  }).returning();
  const [tt3b] = await db.insert(ticketTypesTable).values({
    eventId: 3,
    name: "Table of 8",
    description: "Reserved table for 8 guests with premium seating. Ideal for corporate sponsors or class reunion groups.",
    price: "1200.00",
    currency: "XAF",
    quantity: 30,
    sold: 0,
  }).returning();
  const [tt3c] = await db.insert(ticketTypesTable).values({
    eventId: 3,
    name: "Recent Graduate (Class of 2020–2025)",
    description: "Discounted ticket for alumni who graduated in the last 5 years.",
    price: "85.00",
    currency: "XAF",
    quantity: 50,
    sold: 0,
  }).returning();

  const e3attendees = [
    { name: "Sam Chen", email: "sam.chen@alumni.edu", tt: tt3a.id },
    { name: "David Okonkwo", email: "david.okonkwo@alumni.edu", tt: tt3a.id },
    { name: "Sarah Kim", email: "sarah.kim@example.com", tt: tt3c.id },
    { name: "Aisha Patel", email: "aisha.patel@example.com", tt: tt3c.id },
    { name: "Linda Nakamura", email: "linda.nakamura@harrisonbloom.com", tt: tt3b.id },
    { name: "Dr. Emmanuel Boateng", email: "e.boateng@georgetown.edu", tt: tt3a.id },
    { name: "Rachel Obi", email: "rachel.obi@fintech.com", tt: tt3c.id },
    { name: "Carlos Mendez", email: "carlos.mendez@ventures.com", tt: tt3a.id },
    { name: "Pauline Adeyemi", email: "p.adeyemi@law.edu", tt: tt3a.id },
    { name: "Raj Kapoor", email: "raj.kapoor@techfund.io", tt: tt3b.id },
  ];
  const e3SoldMap: Record<number, number> = { [tt3a.id]: 0, [tt3b.id]: 0, [tt3c.id]: 0 };
  for (let i = 0; i < e3attendees.length; i++) {
    const { name, email, tt } = e3attendees[i];
    const ticketCode = `GALA26${String(i + 1).padStart(3, "0")}`;
    await db.insert(ticketsTable).values({
      eventId: 3, ticketTypeId: tt,
      attendeeName: name, attendeeEmail: email,
      ticketCode, status: "valid",
    });
    e3SoldMap[tt]++;
  }
  await db.update(ticketTypesTable).set({ sold: e3SoldMap[tt3a.id] }).where(eq(ticketTypesTable.id, tt3a.id));
  await db.update(ticketTypesTable).set({ sold: e3SoldMap[tt3b.id] }).where(eq(ticketTypesTable.id, tt3b.id));
  await db.update(ticketTypesTable).set({ sold: e3SoldMap[tt3c.id] }).where(eq(ticketTypesTable.id, tt3c.id));

  console.log("  ✓ Event 3 (Alumni Gala) — 3 ticket types, 10 registrations");

  // Event 4: Clean Energy Workshop (already exists, enrich it)
  await db.update(eventsTable).set({
    title: "Clean Energy Workshop: Solar Installation Basics",
    description: "A hands-on, three-hour workshop covering the fundamentals of residential solar panel installation, battery storage sizing, and grid connection permits. Taught by certified solar engineers. Participants receive a 24-page reference guide and a $50 discount voucher for GreenTech partner installers.",
    coverImageUrl: picsum("solar-workshop-tech", 1200, 630),
    location: "GreenTech Innovation Hub, Workshop Room 2, 88 Innovation Drive",
    isOnline: false,
    status: "published",
    visibility: "public",
    capacity: 30,
    startsAt: new Date("2026-07-20T09:00:00Z"),
    endsAt: new Date("2026-07-20T12:00:00Z"),
  }).where(eq(eventsTable.id, 4));

  await db.delete(ticketsTable).where(eq(ticketsTable.eventId, 4));
  await db.delete(ticketTypesTable).where(eq(ticketTypesTable.eventId, 4));
  const [tt4a] = await db.insert(ticketTypesTable).values({
    eventId: 4,
    name: "Workshop Seat",
    description: "Includes printed materials, refreshments, and the $50 partner voucher.",
    price: "75.00",
    currency: "XAF",
    quantity: 30,
    sold: 0,
  }).returning();

  const e4attendees = [
    { name: "Elena Vasquez", email: "elena.vasquez@greentech.io" },
    { name: "Marcus Johnson", email: "marcus.johnson@citycouncil.org" },
    { name: "Aisha Patel", email: "aisha.patel@example.com" },
    { name: "Fernando Cruz", email: "f.cruz@homebuilders.com" },
    { name: "Sandra Nguyen", email: "s.nguyen@gmail.com" },
    { name: "Brian Osei", email: "b.osei@greenrenew.org" },
  ];
  for (let i = 0; i < e4attendees.length; i++) {
    const ticketCode = `SEW26${String(i + 1).padStart(4, "0")}`;
    await db.insert(ticketsTable).values({
      eventId: 4, ticketTypeId: tt4a.id,
      attendeeName: e4attendees[i].name,
      attendeeEmail: e4attendees[i].email,
      ticketCode, status: i < 4 ? "used" : "valid",
      checkedInAt: i < 4 ? new Date("2026-07-20T09:10:00Z") : null,
    });
  }
  await db.update(ticketTypesTable).set({ sold: e4attendees.length }).where(eq(ticketTypesTable.id, tt4a.id));

  console.log("  ✓ Event 4 (Solar Workshop) — 1 ticket type, 6 registrations (4 checked in)");

  // Event 5: Meridian Arts — Annual Cultural Gala (NEW)
  const [event5] = await db.insert(eventsTable).values({
    orgId: meridian.id,
    title: "Meridian Annual Cultural Gala 2026",
    description: "Our signature evening celebrating the arts. The 2026 gala features live performances by four resident artists, the announcement of this year's $180,000 grant recipients, a silent auction of donated artworks, and a champagne reception. All proceeds benefit the Meridian Artist Residency Fund.",
    coverImageUrl: picsum("cultural-gala-arts", 1200, 630),
    location: "Meridian Arts Center, Grand Gallery, 310 Arts District Blvd",
    isOnline: false,
    status: "published",
    visibility: "public",
    capacity: 250,
    startsAt: new Date("2026-10-03T19:00:00Z"),
    endsAt: new Date("2026-10-03T23:30:00Z"),
  }).returning();

  const [tt5a] = await db.insert(ticketTypesTable).values({
    eventId: event5.id,
    name: "General Admission",
    description: "Entry to the gala, live performances, and networking reception.",
    price: "125.00",
    currency: "XAF",
    quantity: 180,
    sold: 0,
  }).returning();
  const [tt5b] = await db.insert(ticketTypesTable).values({
    eventId: event5.id,
    name: "Patron Circle",
    description: "Premium seating, invitation to the private artist studio tour at 6pm, and name recognition in the program.",
    price: "450.00",
    currency: "XAF",
    quantity: 40,
    sold: 0,
  }).returning();

  const e5attendees = [
    { name: "Priya Sharma", email: "priya.sharma@meridianarts.org", tt: tt5b.id },
    { name: "James Wilson", email: "james.wilson@meridianarts.org", tt: tt5b.id },
    { name: "Sarah Kim", email: "sarah.kim@example.com", tt: tt5a.id },
    { name: "Michael Torres", email: "michael.torres@example.com", tt: tt5a.id },
    { name: "Aisha Patel", email: "aisha.patel@example.com", tt: tt5a.id },
    { name: "Yuki Tanaka", email: "yuki.tanaka@art.com", tt: tt5a.id },
    { name: "Oliver Chen", email: "o.chen@artsfund.org", tt: tt5b.id },
    { name: "Beatrice Osei", email: "b.osei@culturalboard.org", tt: tt5b.id },
  ];
  const e5SoldMap: Record<number, number> = { [tt5a.id]: 0, [tt5b.id]: 0 };
  for (let i = 0; i < e5attendees.length; i++) {
    const { name, email, tt } = e5attendees[i];
    const ticketCode = `MAC26${String(i + 1).padStart(4, "0")}`;
    await db.insert(ticketsTable).values({
      eventId: event5.id, ticketTypeId: tt,
      attendeeName: name, attendeeEmail: email,
      ticketCode, status: "valid",
    });
    e5SoldMap[tt]++;
  }
  await db.update(ticketTypesTable).set({ sold: e5SoldMap[tt5a.id] }).where(eq(ticketTypesTable.id, tt5a.id));
  await db.update(ticketTypesTable).set({ sold: e5SoldMap[tt5b.id] }).where(eq(ticketTypesTable.id, tt5b.id));

  console.log("  ✓ Event 5 (Meridian Arts Gala) — 2 ticket types, 8 registrations\n");

  // ── 9. ENRICH CAMPAIGNS ───────────────────────────────────────────────────
  console.log("📣 Enriching campaigns...");

  // Campaign 1: District 7 Master Plan Feedback (registration type)
  await db.update(campaignsTable).set({
    title: "District 7 Master Plan 2030 — Community Input",
    description: "Help shape the future of District 7. Share your priorities, concerns, and ideas for the Master Plan 2030 covering housing, transportation, parks, and public services. Every submission is reviewed by the planning committee and published in the public record.",
    coverImageUrl: picsum("community-planning-urban", 1200, 630),
    type: "registration",
    status: "active",
    visibility: "public",
    fields: JSON.stringify([
      { id: "neighborhood", label: "Your Neighborhood / Block", type: "text", required: true },
      { id: "top_priority", label: "What is your top priority for District 7?", type: "select", required: true,
        options: ["Affordable Housing", "Public Transportation", "Parks & Green Space", "Road Infrastructure", "Public Safety", "Schools & Youth Programs", "Small Business Support"] },
      { id: "feedback", label: "Detailed Feedback", type: "textarea", required: true },
      { id: "attend_meeting", label: "Would you attend a follow-up community meeting?", type: "select", required: false,
        options: ["Yes, I'd attend in person", "Yes, I'd attend virtually", "No, but keep me informed", "No preference"] },
    ]),
  }).where(eq(campaignsTable.id, 1));

  // Campaign 1 responses
  await db.delete(campaignResponsesTable).where(eq(campaignResponsesTable.campaignId, 1));
  const campaign1Responses = [
    { name: "Sarah Kim", email: "sarah.kim@example.com", neighborhood: "Maple Heights", priority: "Public Transportation", feedback: "We urgently need a bus route connecting Maple Heights to the downtown transit hub. Currently it takes 45 minutes by bus vs. 12 by car.", attend: "Yes, I'd attend in person" },
    { name: "Michael Torres", email: "michael.torres@example.com", neighborhood: "Riverside", priority: "Parks & Green Space", feedback: "The Riverside Community Garden has been underfunded for three years. We need irrigation repair and new raised beds for the senior gardening program.", attend: "Yes, I'd attend virtually" },
    { name: "Marcus Johnson", email: "marcus.johnson@citycouncil.org", neighborhood: "Eastbrook", priority: "Affordable Housing", feedback: "At least 30% of new residential construction should be designated affordable. The current inclusionary rate of 15% is insufficient given rising land costs.", attend: "Yes, I'd attend in person" },
    { name: "Nancy Ostrowski", email: "nancy.o@district7.org", neighborhood: "Central District", priority: "Public Safety", feedback: "Improved street lighting on Commerce Street would reduce evening crime. Residents have requested this for two years with no action.", attend: "Yes, I'd attend in person" },
    { name: "Gregory Holt", email: "g.holt@gmail.com", neighborhood: "Westfield", priority: "Small Business Support", feedback: "The permitting process for small businesses is too slow. Our restaurant waited 8 months for a certificate of occupancy. Streamline it.", attend: "No, but keep me informed" },
    { name: "Carmen Delgado", email: "carmen.delgado@gmail.com", neighborhood: "Northgate", priority: "Schools & Youth Programs", feedback: "We need after-school programs at Northgate Elementary. Many working families have no childcare after 3pm. This is a safety issue, not just a convenience.", attend: "Yes, I'd attend in person" },
    { name: "Bernard Kowalski", email: "bkowalski@outlook.com", neighborhood: "Southend", priority: "Road Infrastructure", feedback: "Pothole conditions on Industrial Avenue are dangerous. A delivery truck lost a tire last month. The last resurfacing was 2018.", attend: "No preference" },
  ];
  for (const r of campaign1Responses) {
    await db.insert(campaignResponsesTable).values({
      campaignId: 1,
      submitterName: r.name,
      submitterEmail: r.email,
      data: { neighborhood: r.neighborhood, top_priority: r.priority, feedback: r.feedback, attend_meeting: r.attend },
      status: "confirmed",
    });
  }
  console.log("  ✓ Campaign 1 (Master Plan Feedback) — 7 submissions");

  // Campaign 2: GreenTech Scholarship Fund (donation)
  await db.update(campaignsTable).set({
    title: "GreenTech Scholarship Fund 2026",
    description: "Support the next generation of clean technology leaders. Every donation funds partial or full scholarships for university students studying renewable energy, environmental engineering, or sustainable business. Last year's fund supported 12 students across 6 universities.",
    coverImageUrl: picsum("scholarship-education-green", 1200, 630),
    type: "donation",
    status: "active",
    visibility: "public",
    goalAmount: "50000.00",
    currentAmount: "31250.00",
    requiresPayment: true,
    paymentAmount: "0",
    currency: "XAF",
    fields: JSON.stringify([
      { id: "dedication", label: "Dedicate this gift (optional)", type: "text", required: false },
      { id: "message", label: "Message to scholars", type: "textarea", required: false },
      { id: "anonymous", label: "Make this donation anonymous", type: "checkbox", required: false },
    ]),
  }).where(eq(campaignsTable.id, 2));

  await db.delete(campaignResponsesTable).where(eq(campaignResponsesTable.campaignId, 2));
  const scholarship_donations = [
    { name: "Elena Vasquez", email: "elena.vasquez@greentech.io", amount: "2500.00", msg: "For the solar engineering students — you are the future." },
    { name: "David Okonkwo", email: "david.okonkwo@alumni.edu", amount: "1000.00", msg: "Paying it forward. I received support during my graduate studies." },
    { name: "Carlos Ibarra", email: "c.ibarra@solarcorp.com", amount: "5000.00", msg: "SolarCorp proudly sponsors clean energy education." },
    { name: "Nora Blackwood", email: "nblackwood@cleanvc.com", amount: "10000.00", msg: "Dedicated to Dr. Patricia Hill, who inspired me to pursue clean tech." },
    { name: "Sarah Kim", email: "sarah.kim@example.com", amount: "250.00", msg: "" },
    { name: "Michael Torres", email: "michael.torres@example.com", amount: "500.00", msg: "Best investment I can make." },
    { name: "Aisha Patel", email: "aisha.patel@example.com", amount: "250.00", msg: "" },
    { name: "Keiko Matsuda", email: "keiko@sustainlab.io", amount: "3000.00", msg: "For the next generation of environmental innovators." },
    { name: "Trevor Mills", email: "t.mills@greenbuild.org", amount: "1500.00", msg: "GreenBuild is proud to support this initiative." },
    { name: "Anonymous Donor", email: "anon-001@greentech.io", amount: "7250.00", msg: "" },
  ];
  for (const d of scholarship_donations) {
    await db.insert(campaignResponsesTable).values({
      campaignId: 2,
      submitterName: d.name,
      submitterEmail: d.email,
      data: { message: d.msg, anonymous: d.name.startsWith("Anonymous") },
      amountPaid: d.amount,
      status: "confirmed",
    });
  }
  console.log("  ✓ Campaign 2 (Scholarship Fund) — 10 donations, $31,250 raised");

  // Campaign 3: Alumni Network Membership 2026 (membership)
  await db.update(campaignsTable).set({
    title: "Alumni Network Membership 2026",
    description: "Renew or join the Alumni Network for 2026. Your membership funds scholarships, career programs, mentorship matching, and the annual gala. Members receive early event access, a digital alumni directory, and invitations to exclusive regional meetups.",
    coverImageUrl: picsum("alumni-network-professional", 1200, 630),
    type: "membership",
    status: "active",
    visibility: "public",
    requiresPayment: true,
    paymentAmount: "75.00",
    goalAmount: "15000.00",
    currentAmount: "8550.00",
    currency: "XAF",
    fields: JSON.stringify([
      { id: "graduation_year", label: "Year of Graduation", type: "text", required: true },
      { id: "degree", label: "Degree & Major", type: "text", required: true },
      { id: "current_role", label: "Current Role / Company", type: "text", required: false },
      { id: "linkedin", label: "LinkedIn Profile URL", type: "text", required: false },
      { id: "interests", label: "Areas of Interest", type: "select", required: false,
        options: ["Mentorship (as mentor)", "Mentorship (as mentee)", "Career Networking", "Entrepreneurship", "Academic Research", "Community Service", "Regional Meetups"] },
    ]),
  }).where(eq(campaignsTable.id, 3));

  await db.delete(campaignResponsesTable).where(eq(campaignResponsesTable.campaignId, 3));
  const alumni_members = [
    { name: "Sam Chen", email: "sam.chen@alumni.edu", year: "2005", degree: "MBA, Strategic Management", role: "Director of Alumni Affairs", interests: "Mentorship (as mentor)" },
    { name: "David Okonkwo", email: "david.okonkwo@alumni.edu", year: "2016", degree: "BS, Computer Science", role: "Senior Software Engineer, Meta", interests: "Career Networking" },
    { name: "Sarah Kim", email: "sarah.kim@example.com", year: "2021", degree: "BFA, Graphic Design", role: "UX Designer, Startup", interests: "Mentorship (as mentee)" },
    { name: "Aisha Patel", email: "aisha.patel@example.com", year: "2023", degree: "MS, Environmental Science", role: "Research Associate, EPA", interests: "Academic Research" },
    { name: "Rachel Obi", email: "rachel.obi@fintech.com", year: "2015", degree: "BS, Business Administration", role: "Head of Talent, Fintech", interests: "Mentorship (as mentor)" },
    { name: "Carlos Mendez", email: "carlos.mendez@ventures.com", year: "2011", degree: "BS, Electrical Engineering", role: "Founder & CEO, Voltex AI", interests: "Entrepreneurship" },
    { name: "Dr. Emmanuel Boateng", email: "e.boateng@georgetown.edu", year: "1998", degree: "PhD, Economics", role: "Professor, Georgetown University", interests: "Academic Research" },
    { name: "Linda Nakamura", email: "linda.nakamura@harrisonbloom.com", year: "2002", degree: "JD, Corporate Law", role: "Senior Partner, Harrison & Bloom LLP", interests: "Mentorship (as mentor)" },
    { name: "Marcus Johnson", email: "marcus.johnson@citycouncil.org", year: "2010", degree: "BA, Political Science", role: "Policy Analyst, City Council", interests: "Community Service" },
    { name: "Pauline Adeyemi", email: "p.adeyemi@law.edu", year: "2008", degree: "JD, International Law", role: "Associate Professor", interests: "Mentorship (as mentor)" },
    { name: "Michael Torres", email: "michael.torres@example.com", year: "2020", degree: "BA, Communications", role: "Content Strategist", interests: "Career Networking" },
    { name: "Raj Kapoor", email: "raj.kapoor@techfund.io", year: "2007", degree: "BS, Finance", role: "Managing Director, TechFund Partners", interests: "Entrepreneurship" },
  ];
  for (const m of alumni_members) {
    await db.insert(campaignResponsesTable).values({
      campaignId: 3,
      submitterName: m.name,
      submitterEmail: m.email,
      data: { graduation_year: m.year, degree: m.degree, current_role: m.role, interests: m.interests },
      amountPaid: "75.00",
      status: "confirmed",
    });
  }
  console.log("  ✓ Campaign 3 (Alumni Membership) — 12 memberships, $900 collected");

  // Campaign 4: Meridian — Artist Grant Application (application)
  const [campaign4] = await db.insert(campaignsTable).values({
    orgId: meridian.id,
    title: "2026 Meridian Artist Grant Application",
    description: "Apply for a Meridian Arts Council grant ranging from $5,000 to $25,000. We fund individual artists, ensembles, and arts organizations working in visual arts, performance, music, literature, or interdisciplinary practice. Priority given to projects with direct community engagement.",
    coverImageUrl: picsum("artist-studio-creative", 1200, 630),
    type: "application",
    status: "active",
    visibility: "public",
    goalAmount: "180000.00",
    currentAmount: "0.00",
    requiresPayment: false,
    currency: "XAF",
    fields: JSON.stringify([
      { id: "discipline", label: "Artistic Discipline", type: "select", required: true,
        options: ["Visual Arts", "Music", "Theater / Performance", "Literature / Poetry", "Dance", "Film / Video", "Interdisciplinary"] },
      { id: "project_title", label: "Project Title", type: "text", required: true },
      { id: "project_description", label: "Project Description (500 words max)", type: "textarea", required: true },
      { id: "amount_requested", label: "Amount Requested ($5,000–$25,000)", type: "text", required: true },
      { id: "community_impact", label: "Describe the Community Impact", type: "textarea", required: true },
      { id: "portfolio_url", label: "Portfolio / Work Sample URL", type: "text", required: false },
    ]),
  }).returning();

  const grant_applications = [
    { name: "Yuki Tanaka", email: "yuki.tanaka@art.com", discipline: "Visual Arts", project: "Urban Roots Mural Series", desc: "A series of 8 large-scale community murals across underserved neighborhoods documenting the history of immigrant communities.", amount: "$18,000", impact: "Direct engagement with 500+ youth through co-design workshops; murals will serve as permanent public landmarks." },
    { name: "Dr. Femi Adeyemi", email: "femi.adeyemi@music.edu", discipline: "Music", project: "Youth Symphony Expansion", desc: "Expand the city youth symphony program to three additional schools, adding 120 student musicians.", amount: "$22,000", impact: "120 new student participants, 6 public performances, partnership with 3 Title I schools." },
    { name: "Anastasia Volkov", email: "anastasia.volkov@theater.com", discipline: "Theater / Performance", project: "Fringe Voices 2027", desc: "Commission 10 original one-act plays from emerging playwrights aged 18–30 for premiere at the Fringe Festival.", amount: "$15,000", impact: "10 commissioned artists, 12 performances, 1,200 audience members, post-show community discussions." },
    { name: "Marcus Delray", email: "marcus.delray@dancecompany.org", discipline: "Dance", project: "Roots & Routes Dance Residency", desc: "A 6-month residency bringing together traditional dance forms from three cultural communities for a collaborative performance.", amount: "$25,000", impact: "3 cultural communities, 40 performers, 4 public workshops, 2 ticketed performances." },
    { name: "Laila Osei", email: "l.osei@writershouse.org", discipline: "Literature / Poetry", project: "City Voices Anthology", desc: "Collect and publish an anthology of original poetry by 50 first-generation American writers from the metropolitan area.", amount: "$12,000", impact: "50 published authors, 1,000 copies distributed to schools and libraries, 3 reading events." },
  ];
  for (const g of grant_applications) {
    await db.insert(campaignResponsesTable).values({
      campaignId: campaign4.id,
      submitterName: g.name,
      submitterEmail: g.email,
      data: { discipline: g.discipline, project_title: g.project, project_description: g.desc, amount_requested: g.amount, community_impact: g.impact },
      status: "pending",
    });
  }
  console.log("  ✓ Campaign 4 (Artist Grant Applications) — 5 applications");

  // Campaign 5: Meridian Season Tickets (registration with payment)
  const [campaign5] = await db.insert(campaignsTable).values({
    orgId: meridian.id,
    title: "2026–2027 Season Ticket Packages",
    description: "Secure your seat for the full Meridian Arts Season. Season ticket holders receive guaranteed seating, 20% off additional tickets, invitations to artist talkbacks, and early access to special exhibitions. Packages available for individuals, couples, and families.",
    coverImageUrl: picsum("theater-season-performance", 1200, 630),
    type: "registration",
    status: "active",
    visibility: "public",
    requiresPayment: true,
    paymentAmount: "250.00",
    goalAmount: "75000.00",
    currentAmount: "14750.00",
    currency: "XAF",
    fields: JSON.stringify([
      { id: "package", label: "Package Type", type: "select", required: true,
        options: ["Individual Season Pass ($250)", "Couple Season Pass ($450)", "Family Season Pass ($600)", "Student Season Pass ($99)"] },
      { id: "seating_preference", label: "Seating Preference", type: "select", required: false,
        options: ["Orchestra Center", "Orchestra Side", "Mezzanine", "No preference"] },
      { id: "accessibility", label: "Accessibility Requirements", type: "text", required: false },
    ]),
  }).returning();

  const season_ticket_buyers = [
    { name: "Priya Sharma", email: "priya.sharma@meridianarts.org", pkg: "Individual Season Pass ($250)", seat: "Orchestra Center", amount: "250.00" },
    { name: "James Wilson", email: "james.wilson@meridianarts.org", pkg: "Couple Season Pass ($450)", seat: "Orchestra Center", amount: "450.00" },
    { name: "Oliver Chen", email: "o.chen@artsfund.org", pkg: "Individual Season Pass ($250)", seat: "Mezzanine", amount: "250.00" },
    { name: "Beatrice Osei", email: "b.osei@culturalboard.org", pkg: "Couple Season Pass ($450)", seat: "Orchestra Side", amount: "450.00" },
    { name: "Sarah Kim", email: "sarah.kim@example.com", pkg: "Student Season Pass ($99)", seat: "No preference", amount: "99.00" },
    { name: "Yuki Tanaka", email: "yuki.tanaka@art.com", pkg: "Individual Season Pass ($250)", seat: "Orchestra Side", amount: "250.00" },
    { name: "Michael Torres", email: "michael.torres@example.com", pkg: "Student Season Pass ($99)", seat: "No preference", amount: "99.00" },
    { name: "Raj Kapoor", email: "raj.kapoor@techfund.io", pkg: "Family Season Pass ($600)", seat: "Orchestra Center", amount: "600.00" },
    { name: "Pauline Adeyemi", email: "p.adeyemi@law.edu", pkg: "Individual Season Pass ($250)", seat: "Mezzanine", amount: "250.00" },
    { name: "Marcus Johnson", email: "marcus.johnson@citycouncil.org", pkg: "Couple Season Pass ($450)", seat: "Orchestra Center", amount: "450.00" },
    { name: "David Okonkwo", email: "david.okonkwo@alumni.edu", pkg: "Individual Season Pass ($250)", seat: "No preference", amount: "250.00" },
    { name: "Elena Vasquez", email: "elena.vasquez@greentech.io", pkg: "Individual Season Pass ($250)", seat: "Orchestra Side", amount: "250.00" },
    { name: "Aisha Patel", email: "aisha.patel@example.com", pkg: "Student Season Pass ($99)", seat: "No preference", amount: "99.00" },
    { name: "Anastasia Volkov", email: "anastasia.volkov@theater.com", pkg: "Individual Season Pass ($250)", seat: "Orchestra Center", amount: "250.00" },
    { name: "Fernando Cruz", email: "f.cruz@homebuilders.com", pkg: "Family Season Pass ($600)", seat: "Mezzanine", amount: "600.00" },
    { name: "Nancy Ostrowski", email: "nancy.o@district7.org", pkg: "Couple Season Pass ($450)", seat: "Orchestra Side", amount: "450.00" },
    { name: "Carmen Delgado", email: "carmen.delgado@gmail.com", pkg: "Student Season Pass ($99)", seat: "No preference", amount: "99.00" },
    { name: "Trevor Mills", email: "t.mills@greenbuild.org", pkg: "Individual Season Pass ($250)", seat: "Mezzanine", amount: "250.00" },
    { name: "Keiko Matsuda", email: "keiko@sustainlab.io", pkg: "Individual Season Pass ($250)", seat: "Orchestra Center", amount: "250.00" },
    { name: "Bernard Kowalski", email: "bkowalski@outlook.com", pkg: "Couple Season Pass ($450)", seat: "No preference", amount: "450.00" },
  ];
  for (const s of season_ticket_buyers) {
    await db.insert(campaignResponsesTable).values({
      campaignId: campaign5.id,
      submitterName: s.name,
      submitterEmail: s.email,
      data: { package: s.pkg, seating_preference: s.seat },
      amountPaid: s.amount,
      status: "confirmed",
    });
  }
  console.log("  ✓ Campaign 5 (Season Tickets) — 20 purchases, $14,750 collected\n");

  // ── 10. FINAL COUNTS ──────────────────────────────────────────────────────
  console.log("📊 Final database counts:");
  const pool2 = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool2.query(`
    SELECT 'users' as tbl, count(*)::int as n FROM users
    UNION ALL SELECT 'organizations', count(*)::int FROM organizations
    UNION ALL SELECT 'elections', count(*)::int FROM elections
    UNION ALL SELECT 'positions', count(*)::int FROM positions
    UNION ALL SELECT 'candidates', count(*)::int FROM candidates
    UNION ALL SELECT 'votes', count(*)::int FROM votes
    UNION ALL SELECT 'vote_selections', count(*)::int FROM vote_selections
    UNION ALL SELECT 'events', count(*)::int FROM events
    UNION ALL SELECT 'ticket_types', count(*)::int FROM ticket_types
    UNION ALL SELECT 'tickets', count(*)::int FROM tickets
    UNION ALL SELECT 'campaigns', count(*)::int FROM campaigns
    UNION ALL SELECT 'campaign_responses', count(*)::int FROM campaign_responses
    UNION ALL SELECT 'org_members', count(*)::int FROM organization_members
  `);
  rows.forEach((r: any) => console.log(`  ${r.tbl.padEnd(20)} ${r.n}`));
  await pool2.end();

  console.log("\n✅ Demo seed complete!");
  console.log("\n🔑 Login Credentials (all passwords: Evenum2025!)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("PLATFORM ADMIN");
  console.log("  admin@evenum.com         / Evenum2025!   (Platform Admin)");
  console.log("\nORGANIZATION OWNERS");
  console.log("  alex.rivera@citycouncil.org   / Evenum2025!   (City Council D7 owner)");
  console.log("  jordan.lee@greentech.io        / Evenum2025!   (GreenTech Hub owner)");
  console.log("  sam.chen@alumni.edu            / Evenum2025!   (Alumni Network owner)");
  console.log("  priya.sharma@meridianarts.org  / Evenum2025!   (Meridian Arts owner)");
  console.log("\nORGANIZATION ADMINS / MEMBERS");
  console.log("  marcus.johnson@citycouncil.org / Evenum2025!   (City Council admin)");
  console.log("  elena.vasquez@greentech.io     / Evenum2025!   (GreenTech admin)");
  console.log("  david.okonkwo@alumni.edu       / Evenum2025!   (Alumni admin)");
  console.log("  james.wilson@meridianarts.org  / Evenum2025!   (Meridian admin)");
  console.log("\nGENERAL USERS / ATTENDEES / VOTERS");
  console.log("  sarah.kim@example.com          / Evenum2025!   (active across all orgs)");
  console.log("  michael.torres@example.com     / Evenum2025!   (attendee / voter)");
  console.log("  aisha.patel@example.com        / Evenum2025!   (attendee / voter)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
