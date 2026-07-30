import { loadEnvFile } from "../loadEnv.js";
import { testDatabaseConnection } from "../dbTest.js";
import { closeDb } from "../db.js";

loadEnvFile();

const result = await testDatabaseConnection();
console.log(JSON.stringify(result, null, 2));
await closeDb().catch(() => {});
process.exit(result.ok ? 0 : 1);
