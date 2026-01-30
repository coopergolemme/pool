import { execSync } from "node:child_process";
import { config as loadEnv } from "dotenv";
import path from "node:path";

export default async () => {
  loadEnv({ path: path.resolve(".env.test.local") });
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set for tests. Add it to .env.test.local.");
  }
  execSync("bash scripts/seed-local.sh", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
    },
  });
};
