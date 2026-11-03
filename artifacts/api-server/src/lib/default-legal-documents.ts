import { and, desc, eq, lte } from "drizzle-orm";
import { db, legalDocumentsTable } from "@workspace/db";

export const legalDocumentTypes = ["terms", "privacy"] as const;
export type LegalDocumentType = (typeof legalDocumentTypes)[number];

export const legalDocumentLanguages = ["en", "fr"] as const;
export type LegalDocumentLanguage = (typeof legalDocumentLanguages)[number];
export const defaultLegalLanguage: LegalDocumentLanguage = "en";

const MINIMUM_USABLE_CONTENT_LENGTH = 20;

export type PublishedLegalDocument = typeof legalDocumentsTable.$inferSelect;

type DefaultLegalDocument = {
  documentType: LegalDocumentType;
  language: LegalDocumentLanguage;
  title: string;
  content: string;
};

export function normalizeLegalLanguage(value: unknown): LegalDocumentLanguage | null {
  if (typeof value !== "string") return null;
  const primary = value.trim().toLowerCase().split(/[-_]/)[0];
  return (legalDocumentLanguages as readonly string[]).includes(primary) ? primary as LegalDocumentLanguage : null;
}

function documentKey(documentType: string, language: string): string {
  return `${documentType}:${language}`;
}

export const defaultLegalDocuments: readonly DefaultLegalDocument[] = [
  {
    documentType: "terms",
    language: "en",
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
    language: "en",
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
  {
    documentType: "terms",
    language: "fr",
    title: "Conditions d'utilisation de ROBLYNE",
    content: `CONDITIONS D'UTILISATION DE ROBLYNE

Date d'entrée en vigueur : la date de première publication de cette version dans ROBLYNE.

1. À PROPOS DE CES CONDITIONS
Les présentes Conditions régissent l'accès à ROBLYNE et son utilisation, y compris ses sites web, applications, élections, votes, inscriptions à des événements, campagnes, collectes de fonds, paiements et fonctions de gestion d'organisation (le « Service »). En créant un compte, en créant ou en rejoignant une organisation, ou en utilisant le Service, vous acceptez ces Conditions. Si vous utilisez le Service pour une organisation, vous confirmez être habilité à engager cette organisation.

Ces Conditions initiales sont des conditions de démarrage opérationnelles. L'Exploitant de la plateforme doit faire confirmer sa dénomination légale, ses coordonnées, ainsi que ses clauses de droit applicable et de règlement des litiges par un conseil juridique qualifié avant de s'y fier pour une juridiction particulière ou un usage réglementé.

2. COMPTES ET ORGANISATIONS
Vous devez fournir des informations de compte exactes, garder vos identifiants confidentiels et signaler rapidement toute utilisation non autorisée suspectée. Vous êtes responsable de l'activité effectuée via votre compte dans la mesure permise par la loi. Les propriétaires et administrateurs d'organisation sont responsables du choix des membres, des rôles, des paramètres, des règles d'événement, de l'éligibilité des élections, des conditions de campagne et des communications de leur organisation.

3. ÉLECTIONS, ÉVÉNEMENTS ET CAMPAGNES
ROBLYNE fournit aux organisations des outils pour créer et administrer des élections, des expériences de vote, des événements, des inscriptions, des campagnes, des pétitions, des sondages, des candidatures et des collectes. L'organisation qui crée une ressource est responsable de son objet, de ses règles, de son éligibilité, de ses notifications, de ses archives, de ses prix, de leur exécution, de son accessibilité et du respect de la loi applicable. ROBLYNE ne certifie pas un résultat d'élection, ne vérifie pas l'identité de chaque participant et ne garantit pas qu'un processus donné satisfait une exigence légale, constitutionnelle, réglementaire, syndicale, d'entreprise ou académique. Les organisateurs doivent déterminer eux-mêmes si le Service convient à leur cas d'usage.

4. PAIEMENTS, FRAIS ET RETRAITS
Certaines campagnes et certains événements peuvent accepter des paiements, et les organisations éligibles peuvent demander des retraits. Le traitement des paiements, les vérifications d'identité, les destinations de versement et les délais de règlement peuvent impliquer des prestataires tiers, notamment FlowPay. Les frais applicables, les montants, les conditions d'éligibilité et l'état des transactions sont affichés dans le Service lorsqu'ils sont disponibles. Les organisateurs sont responsables de l'exactitude de l'objet présenté aux participants, des biens, services, avantages ou remboursements promis, ainsi que de toutes les taxes, déclarations et obligations légales liées aux fonds reçus. Un retrait peut être retardé, refusé, annulé ou faire l'objet d'une enquête lorsque la vérification, la prévention de la fraude, les règles du prestataire, les litiges, la loi ou les présentes Conditions l'exigent. ROBLYNE n'est pas une banque, un transmetteur de fonds ni un conseiller en investissement, sauf mention écrite expresse contraire.

5. UTILISATION ACCEPTABLE
Vous ne devez pas utiliser le Service pour enfreindre la loi ; usurper l'identité d'une personne ou d'une organisation ; soumettre de fausses informations d'élection, d'événement, de campagne ou de paiement ; perturber un vote ou des inscriptions ; solliciter des paiements illégaux ; diffuser des logiciels malveillants ; contourner les contrôles de sécurité ; extraire le Service sans autorisation ; porter atteinte à des droits ; harceler, discriminer ou tromper autrui ; ni utiliser le Service à des fins frauduleuses, abusives ou préjudiciables. Vous ne devez utiliser que des contenus et des données que vous avez le droit d'utiliser.

6. CONTENUS ET PROPRIÉTÉ INTELLECTUELLE
Vous conservez la propriété des contenus que vous soumettez, notamment les informations d'organisation, les détails d'événement, les supports de campagne et les images. Vous accordez à ROBLYNE les droits limités nécessaires pour héberger, traiter, afficher et transmettre ces contenus afin d'exploiter et d'améliorer le Service. Il vous appartient d'obtenir les autorisations relatives aux données des participants, aux images, aux noms, aux marques et aux autres éléments que vous soumettez. ROBLYNE ainsi que ses logiciels, son identité de marque et ses supports de service restent protégés par les lois applicables en matière de propriété intellectuelle.

7. CONFIDENTIALITÉ ET TIERS
Notre collecte et notre utilisation des informations personnelles sont décrites dans la Politique de confidentialité de ROBLYNE. Les organisations peuvent avoir leurs propres obligations de confidentialité envers les participants et restent responsables des notifications et instructions qu'elles fournissent. Le Service peut s'appuyer sur des services tiers d'hébergement, de messagerie, de stockage, de paiement, d'identité, d'analyse et autres. Leurs services et conditions peuvent s'appliquer en plus des présentes Conditions.

8. SUSPENSION ET RÉSILIATION
ROBLYNE peut enquêter, limiter, suspendre ou résilier l'accès lorsqu'il est raisonnablement nécessaire de protéger les utilisateurs, les organisations, le Service, l'intégrité des paiements, la conformité légale ou la sécurité, y compris en cas de violation présumée des présentes Conditions. Vous pouvez cesser d'utiliser le Service à tout moment. La fin de l'accès ne supprime pas les obligations qui, par leur nature, subsistent, notamment les obligations de paiement, de litige, de conservation des archives, de propriété intellectuelle et les obligations légales.

9. AVERTISSEMENTS ET RESPONSABILITÉ
Le Service est fourni « en l'état de disponibilité ». Dans toute la mesure permise par la loi, ROBLYNE ne garantit pas une disponibilité ininterrompue, un fonctionnement sans erreur, la validité juridique du processus d'un organisateur, un résultat de vote, la conduite des participants, la performance d'un prestataire de paiement ou le succès d'une collecte de fonds. Aucune disposition des présentes Conditions n'exclut une responsabilité qui ne peut légalement être exclue. Toute responsabilité résiduelle doit être déterminée selon le droit applicable à l'Exploitant de la plateforme et à la relation utilisateur concernée.

10. MODIFICATIONS, LITIGES ET CONTACT
ROBLYNE peut mettre à jour ces Conditions lorsque le Service, la loi ou le profil de risque évolue. Les modifications importantes peuvent exiger une nouvelle acceptation lorsque le Service l'indique. Les questions, réclamations et litiges doivent d'abord être adressés au contact d'assistance publié par l'Exploitant de la plateforme. L'Exploitant de la plateforme doit compléter cette section avec le droit applicable, l'instance de règlement des litiges et le contact juridique formel applicables à sa juridiction de lancement avant de considérer ces Conditions comme définitives.`,
  },
  {
    documentType: "privacy",
    language: "fr",
    title: "Politique de confidentialité de ROBLYNE",
    content: `POLITIQUE DE CONFIDENTIALITÉ DE ROBLYNE

Date d'entrée en vigueur : la date de première publication de cette version dans ROBLYNE.

1. OBJET ET AVIS IMPORTANT
La présente Politique de confidentialité explique comment ROBLYNE traite les informations personnelles lorsque des personnes utilisent le Service pour créer des comptes, gérer des organisations, organiser des élections, s'inscrire à des événements, participer à des campagnes, effectuer des paiements ou demander des retraits. Pour une ressource d'organisation donnée, cette organisation peut déterminer pourquoi les informations des participants sont collectées et comment elles sont utilisées. L'Exploitant de la plateforme et chaque organisation doivent déterminer leurs rôles et obligations légaux respectifs pour leur juridiction.

Ces clauses initiales constituent une politique de démarrage opérationnelle. L'Exploitant de la plateforme doit faire confirmer l'entité juridique, le contact vie privée, les bases légales, les durées de conservation, les garanties de transfert international et les mentions propres à chaque juridiction par un conseil juridique qualifié avant de s'y fier pour un lancement particulier.

2. INFORMATIONS QUE NOUS COLLECTONS
Nous pouvons collecter des informations de compte et de profil telles que le nom, l'adresse e-mail, l'empreinte du mot de passe et l'avatar ; des informations d'organisation et d'administration ; des détails d'inscription et de présence à un événement ; des soumissions de campagne ; des données d'éligibilité et de participation à une élection ; des informations sur les candidats ; des échanges avec l'assistance ; des informations sur l'appareil, le navigateur, l'adresse IP, les journaux et la sécurité ; ainsi que des informations de transaction, de paiement, de destination de versement ou de vérification qui nous sont fournies ou le sont à nos prestataires de paiement. Les données de vote sont traitées pour exploiter l'élection concernée et doivent être configurées par les organisateurs avec des contrôles d'accès et des notifications appropriés.

3. COMMENT NOUS UTILISONS LES INFORMATIONS
Nous utilisons les informations pour fournir, sécuriser, personnaliser et prendre en charge le Service ; authentifier les comptes ; créer et gérer des organisations ; administrer les élections, les événements et les campagnes ; traiter les inscriptions, les paiements, les règlements et les retraits ; prévenir la fraude et les abus ; communiquer les avis importants de service, de sécurité et juridiques ; respecter les obligations légales ; et améliorer la fiabilité et la facilité d'utilisation. Nous n'utilisons que les informations raisonnablement nécessaires à ces finalités et conformément aux paramètres, instructions et autorisations applicables.

4. QUAND NOUS PARTAGEONS DES INFORMATIONS
Nous pouvons partager des informations avec l'organisation concernée et ses administrateurs autorisés ; les prestataires qui hébergent, sécurisent, envoient des e-mails, stockent ou prennent en charge le Service ; les prestataires de paiement et de versement tels que FlowPay ; les conseils professionnels ; ainsi que les autorités ou d'autres parties lorsque la loi l'exige, pour faire valoir des droits ou pour protéger les utilisateurs et le Service. Nous ne vendons pas d'informations personnelles contre de l'argent. Le partage avec une organisation est nécessaire pour l'élection, l'événement ou la campagne qu'un participant choisit de rejoindre.

5. SÉCURITÉ ET CONSERVATION DES DONNÉES
Nous appliquons des mesures techniques et organisationnelles raisonnables destinées à protéger les informations, notamment des contrôles d'accès, un transport chiffré et une surveillance de sécurité. Aucun système en ligne ne peut garantir une sécurité absolue. Nous conservons les informations aussi longtemps que nécessaire pour fournir le Service, respecter les instructions des organisateurs, résoudre les litiges, prévenir les abus, satisfaire les obligations comptables et légales et faire appliquer les accords. Les organisateurs doivent utiliser les paramètres du Service et leurs propres procédures pour éviter de conserver les informations des participants plus longtemps que nécessaire.

6. VOS CHOIX ET VOS DROITS
Selon la loi applicable, vous pouvez disposer de droits d'accès, de rectification, d'effacement, de limitation ou d'opposition à certains traitements de vos informations personnelles, de réception d'informations portables, de retrait du consentement lorsque le traitement repose sur le consentement, ou de réclamation auprès d'une autorité de contrôle. Les titulaires de compte peuvent mettre à jour certaines informations de profil dans le Service. Pour les informations contrôlées par une organisation, contactez d'abord cette organisation. Pour les informations traitées par ROBLYNE, utilisez le contact d'assistance publié par l'Exploitant de la plateforme. Nous pouvons avoir besoin de vérifier une demande avant d'y donner suite.

7. UTILISATION INTERNATIONALE, COOKIES ET ENFANTS
Les informations peuvent être traitées dans les pays où ROBLYNE ou ses prestataires opèrent. L'Exploitant de la plateforme doit mettre en œuvre les garanties de transfert exigées par la loi applicable. Le Service utilise des technologies essentielles de session et de sécurité et peut recourir à un stockage limité nécessaire aux préférences et au fonctionnement. Les organisations ne doivent pas utiliser le Service pour collecter des informations concernant des enfants sans disposer de l'autorité, des notifications et des garanties exigées par la loi applicable.

8. SERVICES TIERS
Les prestataires tiers peuvent collecter ou traiter des informations selon leurs propres conditions et politiques de confidentialité, notamment les fournisseurs d'identité utilisés pour la connexion sociale, les prestataires de paiement, les prestataires de messagerie et les prestataires de stockage ou d'hébergement. Consultez leurs politiques lorsque vous utilisez ces services. ROBLYNE n'est pas responsable des pratiques de confidentialité de tiers en dehors du Service.

9. MODIFICATIONS ET CONTACT
Nous pouvons mettre à jour la présente Politique pour refléter des changements dans le Service, la loi ou nos pratiques. Les modifications importantes peuvent exiger une nouvelle acceptation lorsque le Service l'indique. Les questions, demandes et réclamations relatives à la vie privée doivent être adressées au contact d'assistance publié par l'Exploitant de la plateforme. Avant le lancement, l'Exploitant de la plateforme doit compléter cette section avec sa dénomination légale, un contact vie privée physique ou électronique et les informations de réclamation propres à sa juridiction.`,
  },
];

export function missingDefaultLegalDocuments(current: Iterable<{ documentType: string; language: string }>): readonly DefaultLegalDocument[] {
  const available = new Set(Array.from(current, (document) => documentKey(document.documentType, document.language)));
  return defaultLegalDocuments.filter((document) => !available.has(documentKey(document.documentType, document.language)));
}

function hasUsableContent(document: PublishedLegalDocument): boolean {
  return document.content.trim().length >= MINIMUM_USABLE_CONTENT_LENGTH;
}

function isLegalDocumentType(value: string): value is LegalDocumentType {
  return legalDocumentTypes.includes(value as LegalDocumentType);
}

/** Newest usable published version of every (document type, language) pair. */
export async function publishedLegalDocuments(): Promise<PublishedLegalDocument[]> {
  const documents = await db.select().from(legalDocumentsTable).where(and(
    eq(legalDocumentsTable.status, "published"),
    lte(legalDocumentsTable.effectiveAt, new Date()),
  )).orderBy(desc(legalDocumentsTable.version));
  const latest = new Map<string, PublishedLegalDocument>();
  for (const document of documents) {
    if (!isLegalDocumentType(document.documentType) || !hasUsableContent(document)) continue;
    const key = documentKey(document.documentType, document.language);
    if (!latest.has(key)) latest.set(key, document);
  }
  return [...latest.values()];
}

export type ResolvedLegalDocument = {
  document: PublishedLegalDocument;
  language: LegalDocumentLanguage;
  languageFallback: boolean;
};

export function resolveLegalDocument(
  documents: readonly PublishedLegalDocument[],
  documentType: LegalDocumentType,
  language: LegalDocumentLanguage,
): ResolvedLegalDocument | null {
  const candidates = documents.filter((document) => document.documentType === documentType);
  if (!candidates.length) return null;
  const preferred = candidates.find((document) => document.language === language);
  if (preferred) return { document: preferred, language, languageFallback: false };
  const fallback = candidates.find((document) => document.language === defaultLegalLanguage) ?? candidates[0];
  return {
    document: fallback,
    language: normalizeLegalLanguage(fallback.language) ?? defaultLegalLanguage,
    languageFallback: true,
  };
}

/** The single current document of each type, in the requested language or a clearly flagged fallback. */
export async function resolvedLegalDocuments(language: LegalDocumentLanguage = defaultLegalLanguage): Promise<ResolvedLegalDocument[]> {
  const documents = await publishedLegalDocuments();
  return legalDocumentTypes
    .map((documentType) => resolveLegalDocument(documents, documentType, language))
    .filter((resolved): resolved is ResolvedLegalDocument => Boolean(resolved));
}

export function publishedDocumentTypes(documents: readonly PublishedLegalDocument[]): Set<LegalDocumentType> {
  return new Set(documents.map((document) => document.documentType).filter(isLegalDocumentType));
}

/** Document types with no published version in any language. Registration stays closed for these. */
export function unpublishedDocumentTypes(documents: readonly PublishedLegalDocument[]): LegalDocumentType[] {
  const published = publishedDocumentTypes(documents);
  return legalDocumentTypes.filter((documentType) => !published.has(documentType));
}

/**
 * Document types the account still has to accept. Accepting the current version of any language
 * satisfies the type; an earlier acceptance only stays valid while no current version requires
 * renewed acceptance.
 */
export function unacceptedDocumentTypes(
  documents: readonly PublishedLegalDocument[],
  acceptedDocumentIds: Iterable<number>,
  acceptedDocumentTypes: Iterable<string> = [],
): LegalDocumentType[] {
  const acceptedIds = new Set(acceptedDocumentIds);
  const acceptedTypes = new Set(acceptedDocumentTypes);
  const currentByType = new Map<LegalDocumentType, PublishedLegalDocument[]>();
  for (const document of documents) {
    if (!isLegalDocumentType(document.documentType)) continue;
    currentByType.set(document.documentType, [...(currentByType.get(document.documentType) ?? []), document]);
  }
  return legalDocumentTypes.filter((documentType) => {
    const current = currentByType.get(documentType);
    if (!current?.length) return false;
    if (current.some((document) => acceptedIds.has(document.id))) return false;
    return !(acceptedTypes.has(documentType) && !current.some((document) => document.requiresReacceptance));
  });
}

export async function ensureDefaultLegalDocuments(): Promise<void> {
  const current = await publishedLegalDocuments();
  const missingDefaults = missingDefaultLegalDocuments(current);
  if (!missingDefaults.length) return;

  await db.transaction(async (tx) => {
    for (const document of missingDefaults) {
      const [latest] = await tx.select({ version: legalDocumentsTable.version })
        .from(legalDocumentsTable)
        .where(and(
          eq(legalDocumentsTable.documentType, document.documentType),
          eq(legalDocumentsTable.language, document.language),
        ))
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

export async function publishedLegalDocumentsWithDefaults(): Promise<PublishedLegalDocument[]> {
  const current = await publishedLegalDocuments();
  if (!missingDefaultLegalDocuments(current).length) return current;
  await ensureDefaultLegalDocuments();
  return publishedLegalDocuments();
}
