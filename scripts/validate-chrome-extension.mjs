import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const extensionDir = path.join(repoRoot, "chrome-extension");
const manifestPath = path.join(extensionDir, "manifest.json");

function fail(message) {
  console.error(`chrome-extension validation failed: ${message}`);
  process.exit(1);
}

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) fail(`missing ${label}: ${path.relative(repoRoot, filePath)}`);
}

assertFileExists(extensionDir, "extension folder");
assertFileExists(manifestPath, "manifest.json");

let manifestRaw;
try {
  manifestRaw = fs.readFileSync(manifestPath, "utf8");
} catch (error) {
  fail(`cannot read manifest.json: ${error?.message ?? String(error)}`);
}

let manifest;
try {
  manifest = JSON.parse(manifestRaw);
} catch (error) {
  fail(`manifest.json is not valid JSON: ${error?.message ?? String(error)}`);
}

if (manifest.manifest_version !== 3) fail("manifest_version must be 3");
for (const requiredKey of ["name", "version", "description"]) {
  if (!manifest[requiredKey] || typeof manifest[requiredKey] !== "string") {
    fail(`manifest.json must include a string "${requiredKey}"`);
  }
}

if (manifest.key) fail('manifest.json must not include a "key" field for Web Store publishing');

const icons = manifest.icons ?? {};
for (const size of ["16", "32", "48", "128"]) {
  const iconRelPath = icons[size];
  if (!iconRelPath || typeof iconRelPath !== "string") fail(`manifest.json icons["${size}"] is missing`);
  assertFileExists(path.join(extensionDir, iconRelPath), `icon ${size}x${size}`);
}

const hostPermissions = manifest.host_permissions ?? [];
if (!Array.isArray(hostPermissions)) fail("host_permissions must be an array when present");
for (const permission of hostPermissions) {
  if (typeof permission !== "string") fail("host_permissions entries must be strings");
  if (!permission.startsWith("https://")) {
    fail(`host_permissions should be HTTPS only (found: ${permission})`);
  }
}

const forbiddenTopLevelNames = new Set([
  "node_modules",
  ".env",
  ".git",
  "chrome-extension.pem",
  "chrome-extension.crx",
]);

for (const entry of fs.readdirSync(extensionDir)) {
  if (forbiddenTopLevelNames.has(entry)) {
    fail(`remove forbidden file/folder from chrome-extension/: ${entry}`);
  }
}

console.log("chrome-extension validation OK");

