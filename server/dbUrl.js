export function getDatabaseUrl() {
  return String(process.env.DATABASE_URL || "").trim();
}

/** Docker ke bina local: USE_PGLITE=true ya DATABASE_URL=pglite */
export function usePglite() {
  const url = getDatabaseUrl().toLowerCase();
  if (process.env.USE_PGLITE === "true" || process.env.USE_PGLITE === "1") return true;
  if (url === "pglite" || url.startsWith("pglite:")) return true;
  return false;
}

export function usePrismaPostgres() {
  const url = getDatabaseUrl();
  if (!url) return false;
  if (usePglite()) return false;
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}
