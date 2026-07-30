/**
 * Scanned Vendor Agreement pages (uploaded format).
 * Overlay positions = fractions of page image (0–1).
 * Consumer text size matches Second Party print (~9–11px on scan).
 */
export const VENDOR_AGREEMENT_PAGES = [
  "/vendor-agreement/page-1.png",
  "/vendor-agreement/page-2.png",
  "/vendor-agreement/page-3.png",
  "/vendor-agreement/page-4.png",
];

/** Measured against DHATTERWAL SOLAR ENERGY SYSTEM / KALAYAT print height. */
export const VENDOR_PRINT_FONT = 0.0105;

export const VENDOR_AGREEMENT_OVERLAYS = {
  /** Page 1 — Day / Month / Year with 1-tab gaps + First Party name/address */
  page1: {
    // Shift further right so date doesn't sit on "(Day)(Month)(Year)" labels
    day: { x: 0.45, y: 0.209, font: VENDOR_PRINT_FONT, maxW: 0.06, underline: true, bold: true },
    month: { x: 0.54, y: 0.209, font: VENDOR_PRINT_FONT, maxW: 0.06, underline: true, bold: true },
    year: { x: 0.63, y: 0.209, font: VENDOR_PRINT_FONT, maxW: 0.06, underline: true, bold: true },
    // Name — wider for long S/O / W/O lines
    name: { x: 0.165, y: 0.328, font: VENDOR_PRINT_FONT, maxW: 0.68, underline: true },
    address: { x: 0.18, y: 0.352, font: VENDOR_PRINT_FONT, maxW: 0.68, underline: true },
  },
  /** Page 4 — First Party Name / Address; Date only under consumer-side stamp (no vendor date) */
  page4: {
    name: { x: 0.22, y: 0.786, font: VENDOR_PRINT_FONT, maxW: 0.4, underline: true },
    address: { x: 0.22, y: 0.811, font: VENDOR_PRINT_FONT, maxW: 0.4, underline: true },
    /** Below First Party notary stamp (not under vendor) */
    date: { x: 0.2, y: 0.908, font: VENDOR_PRINT_FONT, maxW: 0.22, underline: true },
  },
};

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
