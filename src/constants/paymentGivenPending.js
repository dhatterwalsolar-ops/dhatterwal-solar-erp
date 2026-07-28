/** Referral / commissioner — sale amount ka % (Loan/Cash reference se auto). */
export const REFERRAL_COMMISSION_PERCENT = 2;

export const REFERENCE_SELF_LABELS = new Set([
  "",
  "self",
  "self referral",
  "khud",
  "na",
  "n/a",
  "none",
]);

export const GIVEN_PENDING_SOURCES = {
  PURCHASE: "Purchase Sheet",
  LABOUR: "Labour Details",
  REFERENCE: "Sale / Loan / Cash (Reference)",
};

export function isSelfReference(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  return REFERENCE_SELF_LABELS.has(key);
}
