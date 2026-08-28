/**
 * Registers Tier-1 sources (official pages of the funding/SETA organisation).
 * Idempotent — upserts on name. Deactivates known-broken sources so the
 * collector skips them without losing the audit record.
 *
 * Each source carries opportunityType (bursary | learnership | …) which the
 * collector reads at run time — no code rebuild needed to add a new vertical.
 */
import { db, pool, sourcesTable } from "@workspace/db";

const SOURCES = [
  // ── Phase 1 originals — bursaries ────────────────────────────────────────
  {
    name: "sasol-foundation-2027",
    organisation: "Sasol Foundation",
    url: "https://www.sasol.com/media-centre/media-releases/sasol-foundation-invites-applications-2027-bursaries",
    kind: "html",
    notes: "Official Sasol media release, 2027 Foundation bursary intake",
  },
  {
    name: "sarb-external-bursary-2027",
    organisation: "South African Reserve Bank",
    url: "https://www.resbank.co.za/content/dam/sarb/publications/bursary/2026/external-application-2027.pdf",
    kind: "pdf",
    notes: "Official SARB external bursary application PDF (tests PDF extraction)",
  },
  {
    name: "nsfas-home",
    organisation: "NSFAS",
    url: "https://www.nsfas.org.za/content/bursary-scheme.html",
    kind: "html",
    notes: "NSFAS main content page",
  },
  {
    name: "eskom-bursaries",
    organisation: "Eskom",
    url: "https://www.eskom.co.za/careers/bursaries/",
    kind: "html",
    notes: "Eskom official bursaries page",
  },
  {
    name: "transnet-careers-bursaries",
    organisation: "Transnet",
    url: "https://www.transnet.net/careers/Pages/Bursaries.aspx",
    kind: "html",
    notes: "Transnet official bursary page",
  },
  {
    name: "anglo-american-bursaries",
    organisation: "Anglo American",
    url: "https://www.angloamerican.com/careers/early-careers/bursaries",
    kind: "html",
    notes: "Anglo American early-careers bursaries page",
  },
  {
    name: "capitec-external-bursary-2027",
    organisation: "Capitec Bank",
    url: "https://capitecbursary.auraams.app/Home/Index?applicationTypeId=314",
    kind: "html",
    notes: "Capitec external bursary application portal (official)",
  },
  {
    name: "santam-bursary",
    organisation: "Santam",
    url: "https://www.santam.co.za/en/personal/about-santam/corporate-social-investment/bursaries/",
    kind: "html",
    notes: "Santam official bursary page",
  },
  {
    name: "idc-bursary-scheme",
    organisation: "Industrial Development Corporation",
    url: "https://www.idc.co.za/bursaries/",
    kind: "html",
    active: true,
    notes: "IDC official bursary scheme page",
  },
  {
    name: "wits-bursaries",
    organisation: "University of the Witwatersrand",
    url: "https://www.wits.ac.za/study-at-wits/fees-and-funding/",
    kind: "html",
    notes: "Wits fees & funding page (university financial-aid source)",
  },
  {
    name: "csir-bursaries",
    organisation: "CSIR",
    url: "https://www.csir.co.za/careers/students-graduates/bursaries",
    kind: "html",
    notes: "CSIR official bursaries page",
  },
  {
    name: "idc-bursaries",
    organisation: "Industrial Development Corporation",
    url: "https://www.idc.co.za/bursaries/",
    kind: "html",
    notes: "IDC official bursaries page",
  },
  {
    name: "rbh-bursary-2027",
    organisation: "Royal Bafokeng Holdings",
    url: "https://www.bafokengholdings.com/downloads/vacancies/2026/RBH-2027-Bursary-Programme-Application-Form-22-Apr-2026.pdf",
    kind: "pdf",
    notes: "RBH official 2027 bursary application form PDF",
  },
  {
    name: "capitec-quants-bursary-2027",
    organisation: "Capitec Bank",
    url: "https://capitecbursary.auraams.app/Home/Index?applicationTypeId=320",
    kind: "html",
    notes: "Capitec quantitative bursary portal (official)",
  },
  {
    name: "coronation-bursary",
    organisation: "Coronation Fund Managers",
    url: "https://www.coronation.com/en-za/personal/bursary-scheme/",
    kind: "html",
    notes: "Coronation official bursary scheme page",
  },
  {
    name: "hollywood-foundation-bursary",
    organisation: "Hollywood Foundation",
    url: "https://hollywoodfoundation.co.za/bursary-recipients/future-is-bright-bursary-campaign/",
    kind: "html",
    notes: "Hollywood Foundation official bursary campaign page",
  },
  {
    name: "hortgro-bursary",
    organisation: "Hortgro",
    url: "https://www.hortgro.co.za/inclusive-growth/bursary-program/",
    kind: "html",
    notes: "Hortgro official bursary programme page",
  },

  // ── Phase 2 additions — high search-demand bursaries ────────────────────
  {
    name: "absa-bursary",
    organisation: "ABSA Group",
    url: "https://www.absa.co.za/about-absa/absa-in-the-community/education/absa-bursaries/",
    kind: "html",
    notes: "ABSA official bursary page — high search volume",
  },
  {
    name: "standard-bank-bursary",
    organisation: "Standard Bank Group",
    url: "https://www.standardbank.com/campaigns/standard-bank-group-bursary",
    kind: "html",
    notes: "Standard Bank official bursary page (not via StudyTrust)",
  },
  {
    name: "thuthuka-saica-bursary",
    organisation: "SAICA",
    url: "https://www.thuthukabursaryfund.co.za",
    kind: "html",
    notes: "Thuthuka Bursary Fund (SAICA CA pathway) — very high search demand",
  },
  {
    name: "old-mutual-bursary",
    organisation: "Old Mutual Foundation",
    url: "https://www.oldmutual.com/corporate-social-investment/education",
    kind: "html",
    notes: "Old Mutual CSI / bursary page",
  },
  {
    name: "murray-roberts-bursary",
    organisation: "Murray & Roberts",
    url: "https://www.murrob.com/careers/bursaries/",
    kind: "html",
    notes: "Murray & Roberts engineering bursary page",
  },
  {
    name: "south32-bursary",
    organisation: "South32",
    url: "https://www.south32.net/careers-in-south-africa",
    kind: "html",
    notes: "South32 careers and bursary page",
  },
  {
    name: "sibanye-stillwater-bursary",
    organisation: "Sibanye-Stillwater",
    url: "https://www.sibanyestillwater.com/careers/learning-and-development/bursaries/",
    kind: "html",
    notes: "Sibanye-Stillwater bursary page — mining engineering",
  },
  {
    name: "implats-bursary",
    organisation: "Impala Platinum (Implats)",
    url: "https://www.implats.co.za/implats/Human-Resources.asp",
    kind: "html",
    notes: "Implats HR/bursary page — mining and engineering",
  },
  {
    name: "nedbank-bursary",
    organisation: "Nedbank Group",
    url: "https://www.nedbank.co.za/content/nedbank/desktop/gt/en/aboutus/corporate-social-investment/education/bursaries.html",
    kind: "html",
    notes: "Nedbank official bursary page",
  },
  {
    name: "fnb-bursary",
    organisation: "First National Bank (FNB)",
    url: "https://www.fnb.co.za/about-fnb/corporate-social-investment/bursaries.html",
    kind: "html",
    notes: "FNB official bursary page",
  },
  {
    name: "dhet-bursaries",
    organisation: "Department of Higher Education and Training",
    url: "https://www.dhet.gov.za/Bursaries%20and%20Loans/Forms/AllItems.aspx",
    kind: "html",
    notes: "DHET official bursary and loans page",
  },
  {
    name: "nrf-bursary",
    organisation: "National Research Foundation",
    url: "https://www.nrf.ac.za/funding/nrf-grants-for-students/",
    kind: "html",
    notes: "NRF postgraduate funding and bursaries",
  },

  // ── Phase 3 — learnership sources ────────────────────────────────────────
  // SETA sites: government-run, can be PDF-heavy or inconsistently structured.
  // Starting with 3 high-volume SETAs + 3 stable employer learnership pages.
  // Employer pages are more reliable than SETA portals — lean on them first.
  {
    name: "merseta-learnerships",
    organisation: "MERSETA",
    url: "https://www.merseta.org.za/learnerships/",
    kind: "html",
    opportunityType: "learnership",
    notes: "Manufacturing, Engineering and Related Services SETA — high learnership volume",
  },
  {
    name: "sasseta-learnerships",
    organisation: "SASSETA",
    url: "https://www.sasseta.org.za/skill-development/learnerships/",
    kind: "html",
    opportunityType: "learnership",
    notes: "Safety and Security SETA learnership listings",
  },
  {
    name: "teta-learnerships",
    organisation: "TETA",
    url: "https://www.teta.org.za/learnerships/",
    kind: "html",
    opportunityType: "learnership",
    notes: "Transport Education Training Authority learnership page",
  },
  {
    name: "vodacom-learnership",
    organisation: "Vodacom",
    url: "https://www.vodacom.co.za/vodacom/about-us/corporate/empowerment/skills-development",
    kind: "html",
    opportunityType: "learnership",
    notes: "Vodacom skills development / learnership page (employer; more stable than SETAs)",
  },
  {
    name: "transnet-learnerships",
    organisation: "Transnet",
    url: "https://www.transnet.net/careers/Pages/Learnerships.aspx",
    kind: "html",
    opportunityType: "learnership",
    notes: "Transnet official learnership page — engineering/logistics",
  },
  {
    name: "eskom-learnerships",
    organisation: "Eskom",
    url: "https://www.eskom.co.za/careers/",
    kind: "html",
    opportunityType: "learnership",
    notes: "Eskom official careers page — recruitment site currently unavailable",
  },

  // ── First-party employer learnership sources ──────────────────────────────
  {
    name: "sasol-learnerships",
    organisation: "Sasol",
    url: "https://www.sasol.com/careers/learnerships",
    kind: "html",
    opportunityType: "learnership",
    notes: "Sasol official learnership programme page — current vacancies are advertised separately",
  },
  {
    name: "sasol-chemical-plant-operator-learnership-2026",
    organisation: "Sasol",
    url: "https://jobs.sasol.com/job/Secunda-Learnership-Artisan-Chemical-Plant-Operator-%28Secunda-and-Sasolburg%29/1389867833/",
    kind: "html",
    opportunityType: "learnership",
    notes: "Sasol official careers vacancy — Chemical Plant Operator learnership",
  },
  {
    name: "sanlam-learnerships",
    organisation: "Sanlam",
    url: "https://www.sanlamonline.co.za/careers/sanlam-learnerships",
    kind: "html",
    opportunityType: "learnership",
    notes: "Sanlam official learnership programme page — specific intakes are advertised separately",
  },

  // ── Phase 4 — expanded Tier 1 sources from source-registry CSV ───────────

  // Government / development finance — bursaries
  {
    name: "funza-lushaka-bursary",
    organisation: "Funza Lushaka",
    url: "https://www.funzalushaka.doe.gov.za",
    kind: "html",
    notes: "Department of Education teaching bursary — confirm current live domain",
  },
  {
    name: "land-bank-bursary",
    organisation: "Land Bank",
    url: "https://www.landbank.co.za/careers",
    kind: "html",
    notes: "Agriculture bursary administered in-house by Land Bank",
  },

  // Financial services — bursaries
  {
    name: "investec-bursary",
    organisation: "Investec",
    url: "https://www.investec.com/en_za/about-investec/corporate-social-investment.html",
    kind: "html",
    notes: "Investec bursary/CSI section",
  },
  {
    name: "sanlam-bursary",
    organisation: "Sanlam",
    url: "https://www.sanlam.co.za/aboutsanlam/socialsustainability/Bursaries/Pages/default.aspx",
    kind: "html",
    notes: "Sanlam actuarial bursary",
  },
  {
    name: "momentum-bursary",
    organisation: "Momentum",
    url: "https://www.momentum.co.za/momentum/about-us/corporate-social-investment",
    kind: "html",
    notes: "Momentum investments bursary",
  },
  {
    name: "ninety-one-bursary",
    organisation: "Ninety One",
    url: "https://ninetyone.com/en/south-africa/about-us/our-purpose/changeblazer-bursary",
    kind: "html",
    notes: "Ninety One Changeblazer bursary",
  },

  // Retail / consumer — bursaries
  {
    name: "shoprite-bursary",
    organisation: "Shoprite Group",
    url: "https://www.shopriteholdings.co.za/investors/bursaries.html",
    kind: "html",
    notes: "Shoprite Group bursary — accounting, agri, retail, supply chain",
  },

  // Foundations / development — bursaries
  {
    name: "allan-gray-orbis-bursary",
    organisation: "Allan Gray Orbis Foundation",
    url: "https://allangrayorbis.org/programmes/scholarship/",
    kind: "html",
    notes: "Allan Gray Orbis Fellowship at partner universities — high search demand",
  },
  {
    name: "mastercard-foundation-scholars",
    organisation: "Mastercard Foundation",
    url: "https://mastercardfdn.org/all-programs/scholars-program/",
    kind: "html",
    notes: "Mastercard Foundation Scholars Program",
  },
  {
    name: "pps-foundation-bursary",
    organisation: "PPS Foundation",
    url: "https://ppsfoundation.org.za/bursaries/",
    kind: "html",
    notes: "PPS Foundation bursary — confirm foundation/bursary page",
  },
  {
    name: "genesis-analytics-bursary",
    organisation: "Genesis Analytics",
    url: "https://www.genesis-analytics.com/about/genesis-education-fund",
    kind: "html",
    notes: "Genesis Education Fund (GEFT) postgraduate bursary",
  },
  {
    name: "telkom-foundation-bursary",
    organisation: "Telkom Foundation",
    url: "https://www.telkom.co.za/about-telkom/foundation/bursary-programme.html",
    kind: "html",
    notes: "Telkom Foundation bursary — confirm page",
  },
  {
    name: "studytrust-bursaries",
    organisation: "StudyTrust",
    url: "https://www.studytrust.org.za/index.php/bursaries",
    kind: "html",
    notes: "StudyTrust administers many corporate programmes — one source, many opportunities; high value",
  },
  {
    name: "mandela-rhodes-scholarship",
    organisation: "Mandela Rhodes Foundation",
    url: "https://www.mandelarhodes.org/scholarship/apply/",
    kind: "html",
    notes: "Mandela Rhodes Scholarship — high prestige, high search demand",
  },

  // Professional accounting — bursaries
  {
    name: "saipa-bursary",
    organisation: "SAIPA",
    url: "https://www.saipa.co.za/saipa-bursary/",
    kind: "html",
    notes: "SAIPA accounting scholarship",
  },
  {
    name: "deloitte-bursary",
    organisation: "Deloitte",
    url: "https://www2.deloitte.com/za/en/pages/careers/articles/bursary.html",
    kind: "html",
    notes: "Deloitte CA bursary — ZA careers page",
  },
  {
    name: "pwc-bursary",
    organisation: "PwC",
    url: "https://www.pwc.co.za/en/careers/student-careers/bursaries.html",
    kind: "html",
    notes: "PwC CA bursary",
  },
  {
    name: "kpmg-bursary",
    organisation: "KPMG",
    url: "https://kpmg.com/za/en/home/careers/students-and-graduates/bursaries.html",
    kind: "html",
    notes: "KPMG CA bursary — ZA page",
  },
  {
    name: "ey-bursary",
    organisation: "EY",
    url: "https://www.ey.com/en_za/careers/students/bursaries",
    kind: "html",
    notes: "EY CA bursary — ZA page",
  },
  {
    name: "bdo-bursary",
    organisation: "BDO",
    url: "https://www.bdo.co.za/en-za/careers/bursaries",
    kind: "html",
    notes: "BDO CA bursary",
  },

  // Mining subsidiaries — bursaries
  {
    name: "kumba-iron-ore-bursary",
    organisation: "Kumba Iron Ore",
    url: "https://www.angloamericankumba.com/careers/bursaries.aspx",
    kind: "html",
    notes: "Kumba Iron Ore (Anglo subsidiary) bursary — confirm page",
  },

  // Universities — bursaries / financial aid
  {
    name: "university-of-pretoria-bursaries",
    organisation: "University of Pretoria",
    url: "https://www.up.ac.za/student-affairs/article/2749687/bursaries",
    kind: "html",
    notes: "University of Pretoria financial aid and bursary page",
  },
  {
    name: "university-of-johannesburg-bursaries",
    organisation: "University of Johannesburg",
    url: "https://www.uj.ac.za/student-life/financial-aid/",
    kind: "html",
    notes: "University of Johannesburg financial aid page",
  },
  {
    name: "university-of-western-cape-bursaries",
    organisation: "University of the Western Cape",
    url: "https://www.uwc.ac.za/admission-and-financial-aid/fees-and-financial-aid/bursaries-and-opportunities",
    kind: "html",
    notes: "UWC financial aid page",
  },
  {
    name: "ukzn-bursaries",
    organisation: "University of KwaZulu-Natal",
    url: "https://financialaid.ukzn.ac.za/",
    kind: "html",
    notes: "UKZN financial aid and bursary page",
  },
  {
    name: "uct-bursaries",
    organisation: "University of Cape Town",
    url: "https://www.uct.ac.za/study/postgraduate/financial-aid",
    kind: "html",
    notes: "UCT postgraduate financial aid and bursary page",
  },
  {
    name: "stellenbosch-bursaries",
    organisation: "Stellenbosch University",
    url: "https://financialaid.sun.ac.za/",
    kind: "html",
    notes: "Stellenbosch University bursaries and loans page",
  },
  {
    name: "north-west-university-bursaries",
    organisation: "North-West University",
    url: "https://www.nwu.ac.za/financial-aid",
    kind: "html",
    notes: "NWU financial support page",
  },
  {
    name: "university-of-free-state-bursaries",
    organisation: "University of the Free State",
    url: "https://www.ufs.ac.za/student-affairs/departments-and-divisions/financial-aid-office-home",
    kind: "html",
    notes: "UFS bursaries and financial aid page",
  },
  {
    name: "rhodes-university-bursaries",
    organisation: "Rhodes University",
    url: "https://www.ru.ac.za/financialaid/",
    kind: "html",
    notes: "Rhodes University financial aid page",
  },

  // ── Phase 4 — additional SETA learnership sources ────────────────────────
  {
    name: "services-seta-learnerships",
    organisation: "Services SETA",
    url: "https://www.servicesseta.org.za/learnership",
    kind: "html",
    opportunityType: "learnership",
    notes: "Services SETA — largest SETA; office-based careers learnership listings",
  },
  {
    name: "ceta-learnerships",
    organisation: "CETA",
    url: "https://www.ceta.org.za/learnerships/",
    kind: "html",
    opportunityType: "learnership",
    notes: "Construction Education and Training Authority learnership page",
  },
  {
    name: "mict-seta-learnerships",
    organisation: "MICT SETA",
    url: "https://www.mict.org.za/learnerships/",
    kind: "html",
    opportunityType: "learnership",
    notes: "Media, Information and Communication Technologies SETA — IT/telecoms learnerships",
  },
  {
    name: "hwseta-learnerships",
    organisation: "HWSETA",
    url: "https://www.hwseta.org.za/learnerships/",
    kind: "html",
    opportunityType: "learnership",
    notes: "Health and Welfare SETA — health and social development learnerships",
  },
  {
    name: "bankseta-learnerships",
    organisation: "BANKSETA",
    url: "https://www.bankseta.org.za/learnerships/",
    kind: "html",
    opportunityType: "learnership",
    notes: "Banking SETA — Kuyasa and Letsema learnership programmes",
  },
  {
    name: "agriseta-learnerships",
    organisation: "AGRISETA",
    url: "https://www.agriseta.co.za/learnerships/",
    kind: "html",
    opportunityType: "learnership",
    notes: "Agricultural Sector Education and Training Authority learnership page",
  },
];

/**
 * Sources kept in the registry for manual discovery but excluded from
 * automated collection. Reasons are part of the source notes for auditability.
 */
const DISCOVERY_ONLY_REASONS: Record<string, string> = {
  "old-mutual-bursary": "HTTP 403: automated access refused; do not bypass.",
  "absa-bursary": "HTTP 404 and no valid bursary page found from the official root domain.",
  "standard-bank-bursary": "HTTP 403: automated access refused; do not bypass.",
  "murray-roberts-bursary": "HTTP 404 and no valid bursary page found from the official root domain.",
  "thuthuka-saica-bursary": "No valid bursary page found from the official root domain.",
  "sarb-external-bursary-2027": "robots.txt disallows automated collection; do not bypass.",
  "anglo-american-bursaries": "HTTP 403: automated access refused; do not bypass.",
  "eskom-bursaries": "HTTP 404 and no valid bursary page found from the official root domain.",
  "santam-bursary": "HTTP 404 and no valid bursary page found from the official root domain.",
  "wits-bursaries": "HTTP 403: automated access refused; do not bypass.",
  "land-bank-bursary": "HTTP 404 and no valid bursary page found from the official root domain.",
  "south32-bursary": "HTTP 403: automated access refused; do not bypass.",
  "sanlam-bursary": "HTTP 403: automated access refused; do not bypass.",
  "implats-bursary": "HTTP 404 and no valid bursary page found from the official root domain.",
  "nedbank-bursary": "HTTP 404 and no valid bursary page found from the official root domain.",
  "fnb-bursary": "HTTP 404 and no valid bursary page found from the official root domain.",
  "dhet-bursaries": "No valid current bursary page found from the official root; the resolved PDF was a generic statement.",
  "nrf-bursary": "Fetch failed and no valid bursary page was resolved from the official root domain.",
  "investec-bursary": "HTTP 403: automated access refused; do not bypass.",
  "ninety-one-bursary": "HTTP 403: automated access refused; do not bypass.",
  "momentum-bursary": "HTTP 404 and no valid bursary page found from the official root domain.",
  "deloitte-bursary": "HTTP 404 and no valid bursary page found from the official root domain.",
  "shoprite-bursary": "HTTP 403: automated access refused; do not bypass.",
  "mastercard-foundation-scholars": "HTTP 404 and no valid bursary page found from the official root domain.",
  "pps-foundation-bursary": "Unsafe or unresolvable source URL; no valid bursary page resolved.",
  "telkom-foundation-bursary": "HTTP 404 and no valid bursary page found from the official root domain.",
  "saipa-bursary": "HTTP 404 and no valid bursary page found from the official root domain.",
  "pwc-bursary": "HTTP 403: automated access refused; do not bypass.",
  "kpmg-bursary": "HTTP 404 and no valid bursary page found from the official root domain.",
  "ey-bursary": "HTTP 404 and no valid bursary page found from the official root domain.",
  "bdo-bursary": "HTTP 404 and no valid bursary page found from the official root domain.",
  "kumba-iron-ore-bursary": "HTTP 403: automated access refused; do not bypass.",
  "university-of-pretoria-bursaries": "HTTP 403: automated access refused; do not bypass.",
  "ukzn-bursaries": "Unsafe or unresolvable source URL; no valid bursary page resolved.",
  "university-of-johannesburg-bursaries": "HTTP 403: automated access refused; do not bypass.",
  "stellenbosch-bursaries": "Unsafe or unresolvable source URL; no valid bursary page resolved.",
  "uct-bursaries": "HTTP 404 and no valid bursary page found from the official root domain.",
  "north-west-university-bursaries": "HTTP 404 and no valid bursary page found from the official root domain.",
  "university-of-free-state-bursaries": "HTTP 404 and no valid bursary page found from the official root domain.",
  // Learnership sources: keep official registry entries for manual discovery,
  // but do not collect generic, dead, unrelated, or blocked pages.
  "agriseta-learnerships": "Official page is generic guidance with no current specific learnership advert or application deadline.",
  "bankseta-learnerships": "Official youth-programmes page is reachable but has no current open learnership window.",
  "ceta-learnerships": "Original page returned HTTP 404; official learner portal provides generic guidance, not a current specific intake.",
  "eskom-learnerships": "Official careers page says recruitment is temporarily unavailable; no current learnership advert can be verified.",
  "hwseta-learnerships": "HTTP 404 and no verified current learnership advert found on the official domain.",
  "merseta-learnerships": "Official page is generic learnership guidance with no current specific opportunity or closing date.",
  "mict-seta-learnerships": "Official page is generic guidance with no current specific learnership advert, application link, or closing date.",
  "sasseta-learnerships": "HTTP 403: automated access refused; do not bypass.",
  "services-seta-learnerships": "HTTP 404 and no verified current learnership advert found on the official domain.",
  "teta-learnerships": "Official page timed out and no current learnership advert could be verified.",
  "transnet-learnerships": "Original URL resolved to an unrelated advert; official Youth Development page is general programme information without a current intake.",
  "vodacom-learnership": "Original URL returned HTTP 404; official early-careers pages provide general guidance, not a current specific learnership advert.",
  "sasol-learnerships": "Official programme page provides general requirements and directs applicants to separate vacancies; no current specific intake on this page.",
  "sasol-chemical-plant-operator-learnership-2026": "Official vacancy is marked filled and provides no current closing date or working application link.",
  "sanlam-learnerships": "Official page provides general learnership guidance and offered-programme information, not a current specific intake with a closing date.",
};

async function main() {
  for (const s of SOURCES) {
    const discoveryReason = DISCOVERY_ONLY_REASONS[s.name];
    const values = discoveryReason
      ? {
          ...s,
          active: true,
          discoveryOnly: true,
          notes: `${s.notes} Discovery-only: ${discoveryReason}`,
        }
      : s.name === "idc-bursary-scheme" ||
          s.name === "allan-gray-orbis-bursary" ||
          s.name === "mandela-rhodes-scholarship" ||
          s.name === "university-of-western-cape-bursaries"
        ? { ...s, active: true, discoveryOnly: false }
        : s;
    await db
      .insert(sourcesTable)
      .values(values)
      .onConflictDoUpdate({ target: sourcesTable.name, set: values });
  }
  console.log(
    `[sources-seed] upserted ${SOURCES.length} sources (${SOURCES.filter(s => s.opportunityType === "learnership").length} learnership); discovery-only bursary policy applied`,
  );
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
