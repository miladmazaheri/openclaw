# RAATIK fork of OpenClaw

Personal fork of [openclaw/openclaw](https://github.com/openclaw/openclaw) for changes we need before upstream ships them — mainly Persian (fa) support.

## Branches

- `fa/v2026.10.10` — based on tag `v2026.10.10`, the version our assistants run. Holds our changes as small, separate commits so they can be rebased onto a newer tag or offered upstream as pull requests.

## Changes

| Commit | What | Why |
|---|---|---|
| `feat(active-memory): recognize Persian recall intent` | Persian patterns in `extensions/active-memory/escalation.ts` (+ tests in `escalation.test.ts`) | In `escalate` mode Active Memory only searches other conversations when it detects recall intent; upstream has no Persian patterns, so Persian questions never triggered it. Without this, `mode: "always"` was needed, adding ~14 s to every reply. |
| `feat(auto-reply): accept Persian stop words` | Persian whole-message stop requests («بس کن»، «بسه»، «صبر کن»، «وایسا»، «توقف کن»، «دست نگه دار») and Persian trailing punctuation in `src/auto-reply/reply/abort-trigger-text.ts` (+ cases in `abort.test.ts`) | Upstream only knew «توقف», so «بس کن» during a long reply was sent to the agent as a normal message instead of stopping the run. |

## Deploying to an installed OpenClaw (no full rebuild)

The active-memory change lives in one self-contained chunk of the installed build, so it can be swapped in place:

```bash
node scripts/raatik/patch-installed-active-memory.mjs --check     # build + self-test, changes nothing
node scripts/raatik/patch-installed-active-memory.mjs --apply     # backs up the original chunk, then replaces it
node scripts/raatik/patch-installed-active-memory.mjs --restore   # puts the original back
```

The script refuses to run unless the installed OpenClaw is exactly `2026.10.10` and the chunk has the expected exports. Restart the gateway afterwards, then set `plugins.entries.active-memory.config.mode` back to `"escalate"`.

The Persian stop words are patched the same way, in the core chunk and the Control UI chat bundle (the script reads the words from the source file and self-tests the patched chunk):

```bash
node scripts/raatik/patch-installed-abort-triggers.mjs --check | --apply | --restore
```

Running the tests for a changed extension file without installing the monorepo: copy the `.ts` and `.test.ts` files next to any `node_modules` that has `vitest`, and run `vitest run`.

## Updating to a newer OpenClaw

1. `git fetch upstream --tags --depth 1` for the new tag (this clone is shallow).
2. Create `fa/v<new-tag>` from the new tag and cherry-pick our commits.
3. Re-run the tests; the patch script's chunk name and export line change with every build, so update `CHUNK` / `EXPORT_LINE` or build the package instead.
