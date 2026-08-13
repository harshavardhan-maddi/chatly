import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getGitCommitSha() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  }
  if (process.env.COMMIT_REF) {
    return process.env.COMMIT_REF.slice(0, 7);
  }
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev-" + Math.random().toString(36).substring(2, 8);
  }
}

const commitSha = getGitCommitSha();
const buildTime = new Date().toISOString();

const versionInfo = {
  version: commitSha,
  buildTime: buildTime,
};

const publicDir = path.resolve(__dirname, "../public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const versionFilePath = path.join(publicDir, "version.json");
fs.writeFileSync(versionFilePath, JSON.stringify(versionInfo, null, 2), "utf-8");

console.log(`[Version Generator] Generated public/version.json: ${commitSha} at ${buildTime}`);
