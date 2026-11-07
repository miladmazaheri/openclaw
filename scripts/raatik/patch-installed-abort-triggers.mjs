// Applies this fork's Persian stop words (src/auto-reply/reply/abort-trigger-text.ts) to an
// installed OpenClaw 2026.11.1 without rebuilding: the core chunk (used by channels such as
// Bale) and the Control UI chat bundle each hold a copy of the stop-word set.
//
//   node scripts/raatik/patch-installed-abort-triggers.mjs --check     self-test only
//   node scripts/raatik/patch-installed-abort-triggers.mjs --apply     back up, then replace
//   node scripts/raatik/patch-installed-abort-triggers.mjs --restore   put the backups back
//   [--target <openclaw install dir>]   default: $(npm root -g)/openclaw
//
// Restart the gateway after --apply or --restore.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const EXPECTED_VERSION = "2026.11.1";
const CORE_CHUNK = "dist/abort-trigger-text-D3imtBrD.mjs";
const UI_CHUNK = "dist/control-ui/assets/control-ui-boot-chat-DR-fPZCj.js";
const OLD_PUNCTUATION = `/[.!?！？…,，。;；:：'"’”)\\]}]+$/u`;

const args = process.argv.slice(2);
const mode = args.find((arg) => ["--check", "--apply", "--restore"].includes(arg)) ?? "--check";
const targetFlag = args.indexOf("--target");
const target = targetFlag >= 0 ? args[targetFlag + 1] : path.join(execSync("npm root -g").toString().trim(), "openclaw");

const version = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8")).version;
if (version !== EXPECTED_VERSION) throw new Error(`installed OpenClaw is ${version}; this patch targets ${EXPECTED_VERSION}`);

const files = [CORE_CHUNK, UI_CHUNK].map((rel) => {
  const file = path.join(target, rel);
  return { file, backup: `${file}.orig` };
});

if (mode === "--restore") {
  for (const { file, backup } of files) {
    if (!fs.existsSync(backup)) throw new Error(`no backup at ${backup}`);
    fs.copyFileSync(backup, file);
    console.log(`restored ${file}`);
  }
  process.exit(0);
}

// The Persian words and the punctuation class come from the fork's source, so there is one list.
const source = fs.readFileSync(new URL("../../src/auto-reply/reply/abort-trigger-text.ts", import.meta.url), "utf8");
const block = /\/\/ Persian:[^\n]*\n((?:\s*"[^"]+",\n)+)/.exec(source)?.[1];
if (!block) throw new Error("Persian block not found in abort-trigger-text.ts");
// The block runs into the next languages' lines, so keep only words in Arabic script.
const persian = [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]).filter((word) => /^[؀-ۿ\s]+$/.test(word));
const newPunctuation = /const TRAILING_ABORT_PUNCTUATION_RE = (\/.+\/u);/.exec(source)?.[1];
if (!newPunctuation) throw new Error("punctuation pattern not found in abort-trigger-text.ts");

function replaceOnce(text, from, to, where) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`expected one ${JSON.stringify(from)} in ${where}, found ${count}; refusing to patch`);
  return text.replace(from, () => to);
}

const read = ({ file, backup }) => fs.readFileSync(fs.existsSync(backup) ? backup : file, "utf8");
const core = replaceOnce(
  replaceOnce(read(files[0]), `\t"توقف",\n`, `\t"توقف",\n${persian.map((word) => `\t"${word}",\n`).join("")}`, CORE_CHUNK),
  OLD_PUNCTUATION,
  newPunctuation,
  CORE_CHUNK,
);
const ui = replaceOnce(
  replaceOnce(read(files[1]), "توقف.стоп", `توقف.${persian.join(".")}.стоп`, UI_CHUNK),
  OLD_PUNCTUATION,
  newPunctuation,
  UI_CHUNK,
);

// Self-test the patched core chunk in place (it imports a sibling chunk), then remove the probe.
const probe = files[0].file.replace(/\.mjs$/, ".raatik-check.mjs");
fs.writeFileSync(probe, core);
try {
  const { t: isAbortTrigger } = await import(pathToFileURL(probe).href);
  const expectations = [
    ...persian.map((word) => [word, true]),
    ["بس کن!", true],
    ["صبر کن؟", true],
    ["توقف", true],
    ["stop", true],
    ["بس کن دیگه این‌قدر توضیح نده", false],
    ["صبر کن تا فردا", false],
  ];
  for (const [message, expected] of expectations) {
    if (isAbortTrigger(message) !== expected) throw new Error(`self-test failed for ${JSON.stringify(message)}`);
  }
  console.log(`self-test passed (${expectations.length} checks; Persian words: ${persian.join("، ")})`);
} finally {
  fs.rmSync(probe, { force: true });
}

if (mode === "--apply") {
  for (const [{ file, backup }, text] of [
    [files[0], core],
    [files[1], ui],
  ]) {
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
    fs.writeFileSync(file, text);
    console.log(`patched ${file} (backup: ${backup})`);
  }
  console.log("restart the gateway");
}
