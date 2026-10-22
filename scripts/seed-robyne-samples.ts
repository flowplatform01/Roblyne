/**
 * Additive, repeatable ROBYNE preview fixtures.
 *
 * Run only against the development database:
 * ROBYNE_SEED_TARGET=development ROBYNE_SEED_SAMPLES=1 pnpm --filter @workspace/scripts run seed:robyne-samples
 *
 * This script never deletes or updates existing records and never creates
 * users, payment records, external provider calls, or real voter identities.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import pg from "pg";
import {
  campaignsTable,
  campaignResponsesTable,
  candidatesTable,
  electionsTable,
  eventsTable,
  organizationsTable,
  positionsTable,
  ticketTypesTable,
  voteSelectionsTable,
  votesTable,
} from "@workspace/db/schema";

const { Pool } = pg;
const sampleDisclosure =
  "DEVELOPMENT SAMPLE — fictional preview data only. No real event, election, applicant, or payment.";
const images = {
  bueaForum: "/attached_assets/generated_images/robyne-sample-buea-forum.jpg",
  limbeWorkshop: "/attached_assets/generated_images/robyne-sample-limbe-workshop.jpg",
  youthLearning: "/attached_assets/generated_images/robyne-sample-youth-learning.jpg",
};
const candidateAvatars = {
  nadia: "/attached_assets/generated_images/robyne-candidate-nadia.svg",
  paul: "/attached_assets/generated_images/robyne-candidate-paul.svg",
  eden: "/attached_assets/generated_images/robyne-candidate-eden.svg",
  samuel: "/attached_assets/generated_images/robyne-candidate-samuel.svg",
  mina: "/attached_assets/generated_images/robyne-candidate-mina.svg",
  jonas: "/attached_assets/generated_images/robyne-candidate-jonas.svg",
  arielle: "/attached_assets/generated_images/robyne-candidate-arielle.svg",
  joel: "/attached_assets/generated_images/robyne-candidate-joel.svg",
  ruth: "/attached_assets/generated_images/robyne-candidate-ruth.svg",
  felix: "/attached_assets/generated_images/robyne-candidate-felix.svg",
};

if (process.env.ROBYNE_SEED_TARGET !== "development" || process.env.ROBYNE_SEED_SAMPLES !== "1") {
  throw new Error(
    "Refusing to seed. Explicitly target the development database with ROBYNE_SEED_TARGET=development and ROBYNE_SEED_SAMPLES=1.",
  );
}
if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
  throw new Error("ROBYNE sample fixtures are disabled in production deployments.");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured for this development workspace.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function getSampleOrganizations() {
  const requiredSlugs = ["greentech-hub", "alumni-network", "city-council-d7"];
  const rows = await db
    .select({ id: organizationsTable.id, slug: organizationsTable.slug, name: organizationsTable.name })
    .from(organizationsTable)
    .where(eq(organizationsTable.slug, requiredSlugs[0]));
  const orgs = new Map(rows.map((row) => [row.slug, row]));

  for (const slug of requiredSlugs.slice(1)) {
    const [row] = await db
      .select({ id: organizationsTable.id, slug: organizationsTable.slug, name: organizationsTable.name })
      .from(organizationsTable)
      .where(eq(organizationsTable.slug, slug))
      .limit(1);
    if (row) orgs.set(row.slug, row);
  }

  const missing = requiredSlugs.filter((slug) => !orgs.has(slug));
  if (missing.length) {
    throw new Error(
      `Missing existing development organizations: ${missing.join(", ")}. No organizations or users were created.`,
    );
  }
  return orgs;
}

async function seedEvents(orgs: Awaited<ReturnType<typeof getSampleOrganizations>>) {
  const eventScenarios = [
    {
      orgId: orgs.get("greentech-hub")!.id,
      title: "Buea Civic Technology Forum · ROBYNE sample",
      description: `${sampleDisclosure} A one-day forum for local teams exploring accessible public-service technology. In-person in Buea, with general admission and a limited workshop tier.`,
      image: images.bueaForum,
      location: "Buea, South-West Region",
      isOnline: false,
      onlineUrl: null,
      startsAt: daysFromNow(14),
      endsAt: new Date(daysFromNow(14).getTime() + 6 * 60 * 60 * 1000),
      capacity: 160,
      tickets: [
        { name: "General admission", description: "Forum access (development sample)", price: "0.00", quantity: 120 },
        { name: "Workshop pass", description: "Hands-on workshop access (development sample)", price: "5000.00", quantity: 40 },
      ],
    },
    {
      orgId: orgs.get("city-council-d7")!.id,
      title: "Limbe Coastal Skills Workshop · ROBYNE sample",
      description: `${sampleDisclosure} A small-group skills workshop for community and climate projects. This fictional preview is scheduled online; the example meeting link is intentionally non-routable.`,
      image: images.limbeWorkshop,
      location: "Online · Limbe community cohort",
      isOnline: true,
      onlineUrl: "https://meeting.example.invalid/robyne-coastal-workshop",
      startsAt: daysFromNow(9),
      endsAt: new Date(daysFromNow(9).getTime() + 3 * 60 * 60 * 1000),
      capacity: 48,
      tickets: [
        { name: "Community seat", description: "Online workshop access (development sample)", price: "2500.00", quantity: 48 },
      ],
    },
  ];

  for (const scenario of eventScenarios) {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: eventsTable.id })
        .from(eventsTable)
        .where(and(eq(eventsTable.orgId, scenario.orgId), eq(eventsTable.title, scenario.title)))
        .limit(1);
      if (existing) {
        console.log(`Skipped existing event sample: ${scenario.title} (#${existing.id})`);
        return;
      }

      const [event] = await tx
        .insert(eventsTable)
        .values({
          orgId: scenario.orgId,
          title: scenario.title,
          description: scenario.description,
          coverImageUrl: scenario.image,
          heroImageUrl: scenario.image,
          theme: "evenum",
          accentColor: "#62D9B8",
          location: scenario.location,
          isOnline: scenario.isOnline,
          onlineUrl: scenario.onlineUrl,
          status: "published",
          visibility: "public",
          startsAt: scenario.startsAt,
          endsAt: scenario.endsAt,
          capacity: scenario.capacity,
        })
        .returning({ id: eventsTable.id });
      await tx.insert(ticketTypesTable).values(
        scenario.tickets.map((ticket) => ({
          eventId: event.id,
          name: ticket.name,
          description: ticket.description,
          price: ticket.price,
          currency: "XAF",
          quantity: ticket.quantity,
          saleStartsAt: daysAgo(1),
          saleEndsAt: scenario.startsAt,
        })),
      );
      console.log(`Added event sample: ${scenario.title} (#${event.id})`);
    });
  }
}

async function seedElections(orgs: Awaited<ReturnType<typeof getSampleOrganizations>>) {
  let upcomingElectionId: number | null = null;
  let activeElectionId: number | null = null;
  const upcomingTitle = "South-West Youth Council · ROBYNE sample";
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: electionsTable.id })
      .from(electionsTable)
      .where(and(eq(electionsTable.orgId, orgs.get("alumni-network")!.id), eq(electionsTable.title, upcomingTitle)))
      .limit(1);
    if (existing) {
      upcomingElectionId = existing.id;
      console.log(`Skipped existing upcoming election sample (#${existing.id})`);
      return;
    }

    const startsAt = daysFromNow(12);
    const [election] = await tx
      .insert(electionsTable)
      .values({
        orgId: orgs.get("alumni-network")!.id,
        title: upcomingTitle,
        description: `${sampleDisclosure} A public, open-ballot preview election with two positions. It opens in 12 days; no votes are preloaded.`,
        coverImageUrl: images.youthLearning,
        heroImageUrl: images.youthLearning,
        accentColor: "#62D9B8",
        status: "active",
        visibility: "public",
        requiresAuth: false,
        eligibilityMode: "open",
        startsAt,
        endsAt: new Date(startsAt.getTime() + 5 * 24 * 60 * 60 * 1000),
        requiresPayment: false,
        currency: "XAF",
      })
      .returning({ id: electionsTable.id });
    upcomingElectionId = election.id;

    const positions = await tx
      .insert(positionsTable)
      .values([
        { electionId: election.id, title: "Community Chair", description: "Development sample position", maxSelections: 1, sortOrder: 0 },
        { electionId: election.id, title: "Youth Programs Lead", description: "Development sample position", maxSelections: 1, sortOrder: 1 },
      ])
      .returning({ id: positionsTable.id, title: positionsTable.title });

    await tx.insert(candidatesTable).values([
      { electionId: election.id, positionId: positions[0].id, name: "Nadia Nkwenti · sample candidate", bio: "Fictional candidate for preview testing.", platform: "Youth voice, transparent meetings, and practical skills programs.", photoUrl: candidateAvatars.nadia },
      { electionId: election.id, positionId: positions[0].id, name: "Paul Mbida · sample candidate", bio: "Fictional candidate for preview testing.", platform: "Open planning, accessible events, and clear progress reporting.", photoUrl: candidateAvatars.paul },
      { electionId: election.id, positionId: positions[1].id, name: "Eden Muna · sample candidate", bio: "Fictional candidate for preview testing.", platform: "Peer-led learning and community mentorship.", photoUrl: candidateAvatars.eden },
      { electionId: election.id, positionId: positions[1].id, name: "Samuel Aja · sample candidate", bio: "Fictional candidate for preview testing.", platform: "Hands-on workshops and locally led projects.", photoUrl: candidateAvatars.samuel },
    ]);
    console.log(`Added upcoming election sample: ${upcomingTitle} (#${election.id})`);
  });

  const activeTitle = "Buea Community Energy Committee · ROBYNE sample";
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: electionsTable.id })
      .from(electionsTable)
      .where(and(eq(electionsTable.orgId, orgs.get("greentech-hub")!.id), eq(electionsTable.title, activeTitle)))
      .limit(1);
    if (existing) {
      activeElectionId = existing.id;
      console.log(`Skipped existing active election sample (#${existing.id})`);
      return;
    }

    const startsAt = daysAgo(1);
    const [election] = await tx
      .insert(electionsTable)
      .values({
        orgId: orgs.get("greentech-hub")!.id,
        title: activeTitle,
        description: `${sampleDisclosure} A fictional open-ballot community committee election currently in progress. The poll closes in four days and starts with no preloaded votes.`,
        coverImageUrl: images.limbeWorkshop,
        heroImageUrl: images.limbeWorkshop,
        accentColor: "#62D9B8",
        status: "active",
        visibility: "public",
        requiresAuth: false,
        eligibilityMode: "open",
        startsAt,
        endsAt: daysFromNow(4),
        requiresPayment: false,
        currency: "XAF",
      })
      .returning({ id: electionsTable.id });
    activeElectionId = election.id;
    const [position] = await tx
      .insert(positionsTable)
      .values({
        electionId: election.id,
        title: "Community Energy Coordinator",
        description: "Development sample position",
        maxSelections: 1,
        sortOrder: 0,
      })
      .returning({ id: positionsTable.id });
    await tx.insert(candidatesTable).values([
      {
        electionId: election.id,
        positionId: position.id,
        name: "Ruth Neba · sample candidate",
        bio: "Fictional candidate for preview testing.",
        platform: "Clear project updates, safe community spaces, and practical energy education.",
        photoUrl: candidateAvatars.ruth,
      },
      {
        electionId: election.id,
        positionId: position.id,
        name: "Felix Nchami · sample candidate",
        bio: "Fictional candidate for preview testing.",
        platform: "Member-led planning and accessible skills workshops.",
        photoUrl: candidateAvatars.felix,
      },
    ]);
    console.log(`Added active election sample: ${activeTitle} (#${election.id})`);
  });

  const resultsTitle = "Community Leadership Poll · ROBYNE sample results";
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: electionsTable.id })
      .from(electionsTable)
      .where(and(eq(electionsTable.orgId, orgs.get("city-council-d7")!.id), eq(electionsTable.title, resultsTitle)))
      .limit(1);
    if (existing) {
      console.log(`Skipped existing completed election sample (#${existing.id})`);
      return;
    }

    const [election] = await tx
      .insert(electionsTable)
      .values({
        orgId: orgs.get("city-council-d7")!.id,
        title: resultsTitle,
        description: `${sampleDisclosure} This concluded preview election contains synthetic ballots for exercising the public results page. Results do not represent real people or a real vote.`,
        coverImageUrl: images.bueaForum,
        heroImageUrl: images.bueaForum,
        accentColor: "#62D9B8",
        status: "ended",
        visibility: "public",
        requiresAuth: false,
        eligibilityMode: "open",
        startsAt: daysAgo(30),
        endsAt: daysAgo(29),
        requiresPayment: false,
        currency: "XAF",
      })
      .returning({ id: electionsTable.id });
    const positions = await tx
      .insert(positionsTable)
      .values([
        { electionId: election.id, title: "Community Chair", description: "Synthetic results sample", maxSelections: 1, sortOrder: 0 },
        { electionId: election.id, title: "Finance Secretary", description: "Synthetic results sample", maxSelections: 1, sortOrder: 1 },
      ])
      .returning({ id: positionsTable.id });
    const candidates = await tx
      .insert(candidatesTable)
      .values([
        { electionId: election.id, positionId: positions[0].id, name: "Mina Ekomo · sample candidate", bio: "Fictional candidate; synthetic results fixture.", platform: "Clear community reporting and accessible programs.", photoUrl: candidateAvatars.mina },
        { electionId: election.id, positionId: positions[0].id, name: "Jonas Tabe · sample candidate", bio: "Fictional candidate; synthetic results fixture.", platform: "Local skills, transparent priorities, and open meetings.", photoUrl: candidateAvatars.jonas },
        { electionId: election.id, positionId: positions[1].id, name: "Arielle Fongang · sample candidate", bio: "Fictional candidate; synthetic results fixture.", platform: "Simple budgets and public progress updates.", photoUrl: candidateAvatars.arielle },
        { electionId: election.id, positionId: positions[1].id, name: "Joel Manka · sample candidate", bio: "Fictional candidate; synthetic results fixture.", platform: "Practical funding for member-led projects.", photoUrl: candidateAvatars.joel },
      ])
      .returning({ id: candidatesTable.id, positionId: candidatesTable.positionId });
    const chairCandidates = candidates.filter((candidate) => candidate.positionId === positions[0].id);
    const financeCandidates = candidates.filter((candidate) => candidate.positionId === positions[1].id);

    for (let voter = 0; voter < 12; voter += 1) {
      const [vote] = await tx
        .insert(votesTable)
        .values({
          electionId: election.id,
          voterIdentifier: `robyne-sample-voter-${String(voter + 1).padStart(2, "0")}`,
          quantity: 1,
          paymentStatus: "not_required",
        })
        .returning({ id: votesTable.id });
      await tx.insert(voteSelectionsTable).values([
        {
          voteId: vote.id,
          positionId: positions[0].id,
          candidateId: chairCandidates[voter < 8 ? 0 : 1].id,
        },
        {
          voteId: vote.id,
          positionId: positions[1].id,
          candidateId: financeCandidates[voter < 5 ? 0 : 1].id,
        },
      ]);
    }
    console.log(`Added completed election sample: ${resultsTitle} (#${election.id})`);
  });

  return { upcomingElectionId, upcomingTitle, activeElectionId, activeTitle, resultsTitle };
}

async function seedCampaigns(orgs: Awaited<ReturnType<typeof getSampleOrganizations>>) {
  const applicationTitle = "Community Skills Grant Applications · ROBYNE sample";
  await db.transaction(async (tx) => {
    let [campaign] = await tx
      .select({ id: campaignsTable.id })
      .from(campaignsTable)
      .where(and(eq(campaignsTable.orgId, orgs.get("greentech-hub")!.id), eq(campaignsTable.title, applicationTitle)))
      .limit(1);
    if (!campaign) {
      [campaign] = await tx
        .insert(campaignsTable)
        .values({
          orgId: orgs.get("greentech-hub")!.id,
          title: applicationTitle,
          description: `${sampleDisclosure} A fictional application workflow for a community skills grant. The example accepts interest submissions only; it does not promise or pay a grant.`,
          coverImageUrl: images.youthLearning,
          heroImageUrl: images.youthLearning,
          accentColor: "#62D9B8",
          type: "application",
          status: "active",
          visibility: "public",
          requiresPayment: false,
          currency: "XAF",
          fields: [
            { id: "project-area", label: "Project area", type: "select", options: ["Digital skills", "Community learning", "Climate resilience"], required: true },
            { id: "short-plan", label: "Short project plan", type: "textarea", required: true },
          ],
          startsAt: daysAgo(1),
          endsAt: daysFromNow(60),
        })
        .returning({ id: campaignsTable.id });
      console.log(`Added application campaign sample: ${applicationTitle} (#${campaign.id})`);
    } else {
      console.log(`Skipped existing application campaign sample (#${campaign.id})`);
    }

    const sampleEmail = "community-applicant-01@robyne-sample.example";
    const [existingResponse] = await tx
      .select({ id: campaignResponsesTable.id })
      .from(campaignResponsesTable)
      .where(and(
        eq(campaignResponsesTable.campaignId, campaign.id),
        eq(campaignResponsesTable.submitterEmail, sampleEmail),
      ))
      .limit(1);
    if (!existingResponse) {
      await tx.insert(campaignResponsesTable).values({
        campaignId: campaign.id,
        submitterName: "DEMO SAMPLE · Community Learning Team",
        submitterEmail: sampleEmail,
        data: {
          "project-area": "Community learning",
          "short-plan": "A fictional example application for testing review workflows.",
        },
        amountPaid: null,
        status: "pending",
        paymentStatus: "not_required",
      });
      console.log("Added one clearly labeled, non-payment sample application response.");
    }
  });

  const contributionTitle = "Buea Learning Lab · ROBYNE sample contribution";
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: campaignsTable.id })
      .from(campaignsTable)
      .where(and(eq(campaignsTable.orgId, orgs.get("alumni-network")!.id), eq(campaignsTable.title, contributionTitle)))
      .limit(1);
    if (existing) {
      console.log(`Skipped existing contribution campaign sample (#${existing.id})`);
      return;
    }
    const [campaign] = await tx
      .insert(campaignsTable)
      .values({
        orgId: orgs.get("alumni-network")!.id,
        title: contributionTitle,
        description: `${sampleDisclosure} A fictional contribution page showing a target and a fixed test amount. The campaign starts at zero; no donations or payment records are seeded.`,
        coverImageUrl: images.youthLearning,
        heroImageUrl: images.youthLearning,
        accentColor: "#62D9B8",
        type: "contribution",
        status: "active",
        visibility: "public",
        goalAmount: "250000.00",
        currentAmount: "0.00",
        requiresPayment: true,
        paymentAmount: "2500.00",
        currency: "XAF",
        fields: [],
        startsAt: daysAgo(1),
        endsAt: daysFromNow(90),
      })
      .returning({ id: campaignsTable.id });
    console.log(`Added contribution campaign sample: ${contributionTitle} (#${campaign.id})`);
  });
}

async function main() {
  try {
    const orgs = await getSampleOrganizations();
    console.log("Adding ROBYNE sample fixtures to existing development organizations.");
    await seedEvents(orgs);
    const electionRoutes = await seedElections(orgs);
    await seedCampaigns(orgs);
    console.log("\nDevelopment fixture route patterns:");
    console.log("  Events: /events/:id");
    console.log(`  Upcoming election: /elections/${electionRoutes.upcomingElectionId}/vote`);
    console.log(`  Active election: /elections/${electionRoutes.activeElectionId}/vote`);
    console.log("  Election results: /elections/:id/results (including the ended sample)");
    console.log("  Campaigns: /campaigns/:id and /campaigns/:id/participate");
    console.log("No existing records were deleted or modified. No real payments were made.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("ROBYNE sample seeding failed:", error);
  process.exitCode = 1;
});
