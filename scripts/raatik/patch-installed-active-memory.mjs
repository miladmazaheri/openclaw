// Applies this fork's active-memory recall-intent changes (Persian) to an installed
// OpenClaw 2026.10.10 without rebuilding the whole monorepo: the installed build keeps
// extensions/active-memory/escalation.ts as one self-contained chunk with two exports.
//
//   node scripts/raatik/patch-installed-active-memory.mjs --check     build + self-test only
//   node scripts/raatik/patch-installed-active-memory.mjs --apply     back up, then replace
//   node scripts/raatik/patch-installed-active-memory.mjs --restore   put the backup back
//   [--target <openclaw install dir>]   default: $(npm root -g)/openclaw
//
// Restart the gateway after --apply or --restore.
import { execSync } from "node:child_process";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const EXPECTED_VERSION = "2026.10.10";
const CHUNK = "dist/escalation-DGeqPFqJ.mjs";
const EXPORT_LINE = "export { resolveRecallEscalationDecision as n, hasRecallIntent as t };";

const args = process.argv.slice(2);
const mode = args.find((arg) => ["--check", "--apply", "--restore"].includes(arg)) ?? "--check";
const targetFlag = args.indexOf("--target");
const target = targetFlag >= 0 ? args[targetFlag + 1] : path.join(execSync("npm root -g").toString().trim(), "openclaw");
const chunkPath = path.join(target, CHUNK);
const backupPath = `${chunkPath}.orig`;

const version = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8")).version;
if (version !== EXPECTED_VERSION) throw new Error(`installed OpenClaw is ${version}; this patch targets ${EXPECTED_VERSION}`);

if (mode === "--restore") {
  if (!fs.existsSync(backupPath)) throw new Error(`no backup at ${backupPath}`);
  fs.copyFileSync(backupPath, chunkPath);
  console.log(`restored ${chunkPath}`);
  process.exit(0);
}

const original = fs.readFileSync(fs.existsSync(backupPath) ? backupPath : chunkPath, "utf8");
if (!original.trimEnd().endsWith(EXPORT_LINE)) throw new Error(`unexpected exports in ${chunkPath}; refusing to patch`);

const sourcePath = new URL("../../extensions/active-memory/escalation.ts", import.meta.url);
const built = `${stripTypeScriptTypes(fs.readFileSync(sourcePath, "utf8"))}\n${EXPORT_LINE}\n`;

// Self-test the built module before it goes anywhere near the install.
const probe = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "oc-escalation-")), "escalation.mjs");
fs.writeFileSync(probe, built);
const { t: hasRecallIntent, n: decide } = await import(pathToFileURL(probe).href);
const expectations = [
  ["فردا ساعت ده با کی جلسه دارم و دربارهٔ چه؟", true],
  ["یادته دربارهٔ بودجه چی گفتیم؟", true],
  ["What did we discuss last time?", true],
  ["یادم بنداز فردا ساعت ۹ به آقای متولی زنگ بزنم", false],
  ["یک متن دربارهٔ تئاتر بنویس", false],
];
for (const [message, expected] of expectations) {
  if (hasRecallIntent(message) !== expected) throw new Error(`self-test failed for ${JSON.stringify(message)}`);
}
if (decide({ mode: "escalate", message: "دیروز چی تصمیم گرفتیم؟", hasStrongLaneOneHit: false }) !== "recall") {
  throw new Error("self-test failed: escalate decision");
}
console.log(`self-test passed (${expectations.length + 1} checks)`);

if (mode === "--apply") {
  if (!fs.existsSync(backupPath)) fs.copyFileSync(chunkPath, backupPath);
  fs.writeFileSync(chunkPath, built);
  console.log(`patched ${chunkPath} (backup: ${backupPath}); restart the gateway`);
}
