/** Generate Files — Discom docs for Loan / Cash (PDF, no Joint Inspection). */

export const GENERATE_FILE_DISCOMS = [
  { value: "UHBVN", label: "UHBVN — Uttar Haryana Bijli Vitran Nigam" },
  { value: "DHBVN", label: "DHBVN — Dakshin Haryana Bijli Vitran Nigam" },
];

/** Common subdivision suggestions (user can also type custom). */
export const GENERATE_FILE_SUBDIVISIONS = [
  "X53 - PUNDRI",
  "X54 - KAITHAL",
  "X55 - KALAYAT",
  "X56 - NILOKHERI",
  "X57 - PEHOWA",
  "X58 - GUHLA",
];

export const GENERATE_FILE_TABS = [
  {
    id: "setup",
    label: "Discom / Sub Division",
    description: "Pehle Discom aur Sub Division fill karein, phir Generate All.",
  },
  {
    id: "wcr",
    key: "wcr",
    label: "Work Completion",
    templateUrl: "/generate-templates/work-completion-report.docx",
    templateName: "work-completion-report.docx",
    filePrefix: "Work-Completion-Report-VIII",
    category: "work-completion-report",
  },
  {
    id: "vendorCert",
    key: "vendorCert",
    label: "Vendor Completion",
    templateUrl: "/generate-templates/work-complete-by-vendor.docx",
    templateName: "work-complete-by-vendor.docx",
    filePrefix: "Work-Complete-By-Vendor",
    category: "work-complete-by-vendor",
  },
  {
    id: "safety",
    key: "safety",
    label: "Safety Certificate",
    templateUrl: "/generate-templates/safety-dhatterwal-solar.docx",
    templateName: "safety-dhatterwal-solar.docx",
    filePrefix: "Safety-Certificate",
    category: "safety-dhatterwal",
  },
];

export const COMPANY_LETTERHEAD = {
  name: "DHATTERWAL SOLAR ENERGY SYSTEM",
  address: "WARD NO. 13, DHATTERWAL BHAWAN, KALAYAT (KAITHAL)",
  gstin: "06JKPPK6453K1ZE",
  mobile: "9992891023, 9992891723",
};
