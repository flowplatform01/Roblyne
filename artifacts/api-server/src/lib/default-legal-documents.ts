import { and, desc, eq, lte } from "drizzle-orm";
import { db, legalDocumentsTable } from "@workspace/db";

export const legalDocumentTypes = ["terms", "privacy"] as const;
export type LegalDocumentType = (typeof legalDocumentTypes)[number];

const MINIMUM_USABLE_CONTENT_LENGTH = 20;

type DefaultLegalDocument = {
  documentType: LegalDocumentType;
  title: string;
  content: string;
};

export const defaultLegalDocuments: readonly DefaultLegalDocument[] = [
  {
    documentType: "terms",
    title: "ROBLYNE Terms of Service",
    content: `ROBLYNE TERMS OF SERVICE

Effective date: the date this version is first published in ROBLYNE.

1. ABOUT THESE TERMS
These Terms govern access to and use of ROBLYNE, including its websites, applications, elections, voting, event registration, campaign, fundraising, payment and organization-management features (the "Service"). By creating an account, creating or joining an organization, or using the Service, you agree to these Terms. If you use the Service for an organization, you confirm that you are authorized to bind that organization.

These initial Terms are operational starter terms. The Platform Operator must confirm its legal name, contact details, governing-law and dispute-resolution provisions with qualified legal counsel before relying on them for a particular jurisdiction or regulated use.

2. ACCOUNTS AND ORGANIZATIONS
You must provide accurate account information, keep your credentials confidential, and promptly report suspected unauthorized use. You are responsible for activity performed through your account to the extent permitted by law. Organization owners and administrators are responsible for selecting appropriate members, roles, settings, event rules, election eligibility, campaign terms, and communications for their organizations.

3. ELECTIONS, EVENTS AND CAMPAIGNS
ROBLYNE provides tools for organizations to create and administer elections, voting experiences, events, registrations, campaigns, petitions, surveys, applications and collections. The organization that creates a resource is responsible for its purpose, rules, eligibility, notices, records, prizes, fulfilment, accessibility, and compliance with applicable law. ROBLYNE does not certify an election result, verify every participant's identity, or guarantee that a particular process satisfies a legal, constitutional, regulatory, union, corporate or academic requirement. Organizers must independently determine whether the Service is suitable for their use case.

4. PAYMENTS, FEES AND WITHDRAWALS
Some campaigns and events may accept payments, and eligible organizations may request withdrawals. Payment processing, identity checks, payout destinations and settlement timing may involve third-party providers, including FlowPay. Applicable fees, amounts, eligibility conditions and transaction status are shown in the Service where available. Organizers are responsible for the accuracy of the purpose they present to participants, for any goods, services, benefits or refunds they promise, and for all taxes, reporting and legal obligations connected with funds they receive. A withdrawal may be delayed, rejected, reversed or investigated where verification, fraud prevention, provider rules, disputes, law or these Terms require it. ROBLYNE is not a bank, money transmitter or investment adviser unless it expressly states otherwise in writing.

5. ACCEPTABLE USE
You must not use the Service to violate law; impersonate another person or organization; submit false election, event, campaign or payment information; interfere with voting or registrations; solicit unlawful payments; upload malware; bypass security controls; scrape the Service without permission; infringe rights; harass, discriminate against or deceive others; or use the Service for fraudulent, abusive or harmful activity. You must use only content and data you have the right to use.

6. CONTENT AND INTELLECTUAL PROPERTY
You retain ownership of content you submit, including organization information, event details, campaign materials and images. You grant ROBLYNE the limited rights needed to host, process, display and transmit that content to operate and improve the Service. You are responsible for obtaining permissions for participant data, images, names, trademarks and other material you submit. ROBLYNE and its software, branding and service materials remain protected by applicable intellectual-property laws.

7. PRIVACY AND THIRD PARTIES
Our collection and use of personal information is described in the ROBLYNE Privacy Policy. Organizations may have their own privacy duties toward participants and remain responsible for notices and instructions they provide. The Service may rely on hosting, email, storage, payment, identity, analytics and other third-party services. Their services and terms may apply in addition to these Terms.

8. SUSPENSION AND TERMINATION
ROBLYNE may investigate, limit, suspend or terminate access where reasonably necessary to protect users, organizations, the Service, payment integrity, legal compliance or security, including for a suspected breach of these Terms. You may stop using the Service at any time. Ending access does not remove obligations that by their nature continue, including payment, dispute, recordkeeping, intellectual-property and legal obligations.

9. DISCLAIMERS AND LIABILITY
The Service is provided on an "as available" basis. To the maximum extent permitted by law, ROBLYNE does not guarantee uninterrupted availability, error-free operation, legal validity of an organizer's workflow, a voting outcome, participant conduct, payment-provider performance or fundraising success. Nothing in these Terms excludes liability that cannot lawfully be excluded. Any remaining liability must be determined under the law applicable to the Platform Operator and the relevant user relationship.

10. CHANGES, DISPUTES AND CONTACT
ROBLYNE may update these Terms when the Service, law or risk profile changes. Material changes may require renewed acceptance when indicated in the Service. Questions, complaints and disputes should first be sent through the platform support contact published by the Platform Operator. The Platform Operator must complete this section with the governing law, dispute forum and formal legal contact applicable to its launch jurisdiction before relying on these Terms as final legal terms.`,
  },
  {
    documentType: "privacy",
    title: "ROBLYNE Privacy Policy",
    content: `ROBLYNE PRIVACY POLICY

Effective date: the date this version is first published in ROBLYNE.

1. PURPOSE AND IMPORTANT NOTICE
This Privacy Policy explains how ROBLYNE handles personal information when people use the Service to create accounts, manage organizations, run elections, register for events, participate in campaigns, make payments or request withdrawals. For a specific organization resource, that organization may determine why participant information is collected and how it is used. The Platform Operator and each organization must determine their respective legal roles and obligations for their jurisdiction.

These initial policy terms are an operational starter policy. The Platform Operator must confirm the legal entity, privacy contact, lawful bases, retention periods, international-transfer safeguards and jurisdiction-specific disclosures with qualified legal counsel before relying on this policy for a particular launch.

2. INFORMATION WE COLLECT
We may collect account and profile information such as name, email address, password hash and avatar; organization and administrative information; event registration and attendance details; campaign submissions; election eligibility and participation records; candidate information; support communications; device, browser, IP-address, log and security information; and transaction, payment, payout-destination or verification information supplied to us or our payment providers. Voting data is handled to operate the relevant election and should be configured by organizers with appropriate access controls and notices.

3. HOW WE USE INFORMATION
We use information to provide, secure, personalize and support the Service; authenticate accounts; create and manage organizations; administer elections, events and campaigns; process registrations, payments, settlements and withdrawals; prevent fraud and abuse; communicate important service, security and legal notices; comply with legal obligations; and improve reliability and usability. We use only the information reasonably necessary for these purposes and according to the settings, instructions and permissions that apply.

4. WHEN WE SHARE INFORMATION
We may share information with the relevant organization and its authorized administrators; service providers that host, secure, email, store or support the Service; payment and payout providers such as FlowPay; professional advisers; and authorities or other parties where required by law, to enforce rights, or to protect users and the Service. We do not sell personal information in exchange for money. Sharing with an organization is necessary for the election, event or campaign that a participant chooses to join.

5. DATA SECURITY AND RETENTION
We use reasonable technical and organizational measures intended to protect information, including access controls, encrypted transport and security monitoring. No online system can guarantee absolute security. We retain information for as long as needed to provide the Service, meet organizer instructions, resolve disputes, prevent abuse, satisfy accounting and legal obligations, and enforce agreements. Organizers should use the Service's settings and their own procedures to avoid retaining participant information longer than necessary.

6. YOUR CHOICES AND RIGHTS
Depending on applicable law, you may have rights to access, correct, delete, restrict or object to certain processing of your personal information, receive portable information, withdraw consent where processing relies on consent, or complain to a supervisory authority. Account holders can update certain profile information in the Service. For information controlled by an organization, contact that organization first. For information handled by ROBLYNE, use the support contact published by the Platform Operator. We may need to verify a request before acting on it.

7. INTERNATIONAL USE, COOKIES AND CHILDREN
Information may be processed in countries where ROBLYNE or its service providers operate. The Platform Operator must implement transfer safeguards required by applicable law. The Service uses essential session and security technologies and may use limited storage necessary for preferences and operation. Organizations must not use the Service to collect children's information unless they have the authority, notices and safeguards required by applicable law.

8. THIRD-PARTY SERVICES
Third-party providers may collect or process information under their own terms and privacy notices, including identity providers used for social sign-in, payment providers, email providers and object-storage or hosting providers. Review their notices when you use those services. ROBLYNE is not responsible for third-party privacy practices outside the Service.

9. CHANGES AND CONTACT
We may update this Policy to reflect changes in the Service, law or our practices. Material changes may require renewed acceptance when indicated in the Service. Privacy questions, requests and complaints should be sent through the platform support contact published by the Platform Operator. Before launch, the Platform Operator must complete this section with its legal name, physical or electronic privacy contact, and jurisdiction-specific complaint information.`,
  },
];

export function missingDefaultLegalDocuments(current: Iterable<{ documentType: string }>): readonly DefaultLegalDocument[] {
  const availableTypes = new Set(Array.from(current, (document) => document.documentType));
  return defaultLegalDocuments.filter((document) => !availableTypes.has(document.documentType));
}

function hasUsableContent(document: typeof legalDocumentsTable.$inferSelect): boolean {
  return document.content.trim().length >= MINIMUM_USABLE_CONTENT_LENGTH;
}

export async function currentLegalDocuments() {
  const documents = await db.select().from(legalDocumentsTable).where(and(
    eq(legalDocumentsTable.status, "published"),
    lte(legalDocumentsTable.effectiveAt, new Date()),
  )).orderBy(desc(legalDocumentsTable.version));
  const current = new Map<LegalDocumentType, typeof documents[number]>();
  for (const document of documents) {
    if (legalDocumentTypes.includes(document.documentType as LegalDocumentType) && !current.has(document.documentType as LegalDocumentType) && hasUsableContent(document)) {
      current.set(document.documentType as LegalDocumentType, document);
    }
  }
  return legalDocumentTypes.map((documentType) => current.get(documentType)).filter((document): document is typeof documents[number] => Boolean(document));
}

export async function ensureDefaultLegalDocuments(): Promise<void> {
  const current = await currentLegalDocuments();
  const missingDefaults = missingDefaultLegalDocuments(current);
  if (!missingDefaults.length) return;

  await db.transaction(async (tx) => {
    for (const document of missingDefaults) {
      const [latest] = await tx.select({ version: legalDocumentsTable.version })
        .from(legalDocumentsTable)
        .where(eq(legalDocumentsTable.documentType, document.documentType))
        .orderBy(desc(legalDocumentsTable.version))
        .limit(1);
      const version = (latest?.version ?? 0) + 1;
      const now = new Date();
      await tx.insert(legalDocumentsTable).values({
        ...document,
        version,
        status: "published",
        effectiveAt: now,
        publishedAt: now,
        requiresReacceptance: false,
      }).onConflictDoNothing();
    }
  });
}

export async function currentLegalDocumentsWithDefaults() {
  const current = await currentLegalDocuments();
  if (current.length === legalDocumentTypes.length) return current;
  await ensureDefaultLegalDocuments();
  return currentLegalDocuments();
}
