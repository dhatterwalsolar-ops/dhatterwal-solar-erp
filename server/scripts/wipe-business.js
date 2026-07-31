/**
 * One-shot: clear all ERP business keys (keep login users).
 * Usage (from server/): CONFIRM_WIPE=YES node scripts/wipe-business.js
 */
import { loadEnvFile } from "../loadEnv.js";
import { ensureSeededLoginUsers } from "../auth.js";
import { closeStore, initStore, wipeBusinessData } from "../store.js";

loadEnvFile();

async function main() {
  if (String(process.env.CONFIRM_WIPE || "") !== "YES") {
    console.error('Set CONFIRM_WIPE=YES to wipe business data (login users kept).');
    process.exit(1);
  }
  await initStore();
  const result = await wipeBusinessData({ keepLoginUsers: true });
  await ensureSeededLoginUsers();
  console.log("Wipe complete:", result);
  await closeStore();
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
