---
name: deploy-notes
description: Generate granular deploy notes for the token_migrator program. Default (preview) mode shows what's coming on master since the last successful mainnet deploy. Compare mode generates a release-style writeup between two past mainnet deploys, including buffer address, buffer hash, and Squads/simulation URLs scraped from the deploy workflow logs.
user-invocable: true
argument-hint: "[--compare [<old-run-id> <new-run-id>]] [--md]"
---

# Deploy Notes

Generates a granular changelog for the `token_migrator` program, in the format the team uses for deploy announcements (see end of file for the template).

This is a single-program repo, so there's no program argument — the program is always `token_migrator` (source dir `programs/token-migrator/`). The deploy workflow can target either network; this skill is for **mainnet** announcements and silently ignores devnet runs.

## Modes

- **Preview** (default): `<last-mainnet-deploy-sha>..origin/master` — what's about to ship. No buffer/Squads section.
- **Compare** (`--compare`): between two past successful mainnet deploys (default: last two; or pass two run IDs). Includes buffer/hash/Squads/sim URLs scraped from the newer run's job log.

## Flags

- **`--md`**: also write the output to a markdown file at repo root. Filename: `token-migrator-update.md` for compare mode, `token-migrator-preview.md` for preview mode. Overwrites any existing file with that name. Still prints the notes to the chat.

## Procedure

### 1. Find the mainnet deploy run(s)

```
gh run list --workflow=deploy.yaml --status=success --limit=100 \
  --json databaseId,headSha,createdAt
```

**Always use `--limit=100`** — never shortcut to a lower limit "for a quick check." The deploy workflow also runs devnet deploys, and those share the same workflow and job, so the most recent *mainnet* run can sit several runs back behind devnet runs. A `--limit=5` peek can silently miss it and lead you to mis-classify the program as never-deployed or first-deploy.

Each run has exactly one job, `deploy / build` (the `deploy` job calls the reusable `build` job). The job name no longer tells you the network — you must read the log. The reusable workflow prints a `Using network: <net>` line, so:

```
# job id for a run (single job per run)
gh run view <id> --json jobs --jq '.jobs[0].databaseId'

# network for that run
gh run view --job=<job-id> --log | grep -m1 'Using network:'
```

Walk newest → oldest, keeping only runs whose log shows `Using network: mainnet`.

Preview: stop at the first mainnet run. Compare: collect two such mainnet runs (or use the explicit IDs passed as args — verify each is a mainnet run).

**First-deploy case (compare mode, only one mainnet run exists):** treat it as the first deploy. Use the single run's job log for the buffer/hash/squads section, and the commit range as "everything that touches the source dir up to the deploy commit." Add "(first deploy)" to the heading. The Notes section should briefly describe what the program does (read `programs/token-migrator/src/lib.rs` for the entrypoints + doc comments) plus any notable changes since it was first scaffolded.

**Never-deployed case (no mainnet runs):** fall back to showing every PR merge on `master` touching the source dir and note "never deployed to mainnet via workflow."

### 2. Walk commits and write bullets

**Before bullet-writing, check whether the source dir actually changed between the two refs:**

```
git diff --stat <from-sha>..<to-sha> -- programs/token-migrator/
```

If the output is empty, you're in the **no-source-diff case** (compare mode only — can happen when the workflow is re-run on the same source, producing a byte-identical `.so` and an identical buffer hash). Skip to the no-source-diff output template in step 4. Do **not** invent bullets or speculate about indirect changes — surface the fact that nothing in the program source changed and that the buffer hash matches the previous deploy.

Otherwise:

```
git log --first-parent <from-sha>..<to-sha> -- programs/token-migrator/   # PR-merge list, for Related PRs
git log <from-sha>..<to-sha> -- programs/token-migrator/                  # individual commits, for Notes bullets
```

For each non-trivial individual commit, draft one polished bullet. If the commit message is terse, read the diff for context:

```
git show --stat <sha> -- programs/token-migrator/
git show <sha> -- programs/token-migrator/
```

**Bullet style** (matches the team's existing deploy notes — granular, per-commit, polished):

- Lead with what changed in concrete terms: function/instruction/field/account name.
- Brief why in parentheses when not obvious from the what.
- Drop program-name prefixes from commit messages (`token-migrator - X` → `X`) — the heading says the program.
- Combine commits that are part of the same logical change.
- Skip pure plumbing (renames of private helpers, comment-only edits, Cargo.toml exact-pin from a repo-guard PR, lockfile bumps) unless it's the only commit in range.

Examples of the target style (from real deploys in the programs repo — style reference only):

- Re-apply DAO's current `seconds_per_proposal` to proposal's `duration_in_seconds` at launch time (ensures updated durations take effect)
- Use `wrapping_mul` instead of `saturating_mul` for TWAP aggregator calculations and projections
- Remove `#[event_cpi]` from `ExecuteSpendingLimitChange` (no events emitted)
- `unstake_from_proposal` — add `init_if_needed` to staker's ATA

### 3. Compare mode only — scrape the newer run's log

```
gh run view --job=<job-id> --log
```

Extract:

| Field | Pattern |
|---|---|
| Buffer address | `^Program Buffer: <base58>$` (or first `^Buffer: <base58>$`) |
| Buffer hash | a 64-char hex line, immediately after the `Docker image Solana version: v...` line — this is `solana-verify get-executable-hash` output |
| Squads creation tx signature | `^Transaction Created - Signature: <base58>$` |
| Squads transaction index | `With transaction index: <N>n` (appears 1–2 lines after the signature) |

**Compute the Squads vault-transaction PDA via on-chain lookup.**

Read the user's RPC URL from `solana config get` (line `RPC URL: ...`). Use this URL — do NOT fall back to `api.mainnet-beta.solana.com`, it's rate-limited and will fail. If the configured URL is `api.mainnet-beta.solana.com`, ask the user to point solana at their preferred RPC first.

Then:
```
curl -s -X POST <rpc-url> -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getTransaction","params":["<sig>",{"encoding":"jsonParsed","maxSupportedTransactionVersion":0,"commitment":"confirmed"}]}'
```

In the response, find the new `MultisigTransaction` account in the tx's account keys (writable, non-signer, owned by the Squads v4 program). The Squads v4 program ID is the constant `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` (this repo's SDK does not export it — hardcode it).

### 4. Output

**Preview mode**:

```
`token_migrator` preview (since last deploy):

Last deploy: <gh-run-url> (commit `<short-sha>`, <date>)
master HEAD: commit `<short-sha>`
Commits in range: <N>

Notes:

- bullet
- bullet
...

Related PRs:
- #NNN <title>
- #MMM <title>
```

**Compare mode** (matches the team's template exactly):

````
`token_migrator` update:

Buffer: `<buffer-addr>`
Buffer Hash: `<hash>`
Squads Transaction: https://app.squads.so/squads/6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf/transactions/<vault-tx-pda>
Instruction Simulation: https://explorer.solana.com/tx/inspector?squadsTx=<vault-tx-pda>
GH Build: https://github.com/metaDAOproject/token-migrator/actions/runs/<run-id>/job/<job-id>
GH Related:
- https://github.com/metaDAOproject/token-migrator/pull/NNN
- https://github.com/metaDAOproject/token-migrator/pull/MMM

Notes:

- bullet
- bullet
...
````

**Compare mode, no-source-diff case** (re-deploy of byte-identical `.so`):

Confirm the buffer hash is genuinely unchanged: `solana-verify get-program-hash gr8tqq2ripsM6N46gLWpSDXtdrH6J9jaXoyya1ELC9t -u <rpc-url>` should match the buffer hash from the new run's log.

````
`token_migrator` update (re-deploy, no source changes):

Buffer: `<new-buffer-addr>`
Buffer Hash: `<hash>`
Squads Transaction: https://app.squads.so/squads/6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf/transactions/<vault-tx-pda>
Instruction Simulation: https://explorer.solana.com/tx/inspector?squadsTx=<vault-tx-pda>
GH Build: https://github.com/metaDAOproject/token-migrator/actions/runs/<new-run-id>/job/<new-job-id>
GH Related:
- _(none — no commits touch `programs/token-migrator/` between the two deploys)_

Previous deploy for reference: <prev-gh-run-job-url> (commit `<prev-sha>`, <prev-date>)
This deploy: commit `<new-sha>`, <new-date>

Notes:

This is a re-deploy of `token_migrator` (program ID `gr8tqq2ripsM6N46gLWpSDXtdrH6J9jaXoyya1ELC9t`) with **no on-chain behaviour change**:

- `git diff <prev-sha> <new-sha> -- programs/token-migrator/` is empty
- The buffer hash (`<hash-prefix>…`) is byte-for-byte identical to the previously deployed program (verified via `solana-verify get-program-hash`)
- Approving the Squads transaction will set the program buffer to bytes equal to what's already on-chain — effectively a no-op upgrade

If this was an intentional re-deploy (e.g. a smoke test of the deploy pipeline, or a buffer refresh), no other action is needed once the Squads tx is approved. If it was unintentional, the Squads tx can be cancelled without loss.
````

## Constants

- Program: cargo/lib name `token_migrator`, source dir `programs/token-migrator/`, program ID `gr8tqq2ripsM6N46gLWpSDXtdrH6J9jaXoyya1ELC9t`
- Mainnet Squads vault: `6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf` (same Squads as the programs repo; confirm against the repo's `MAINNET_MULTISIG_VAULT` secret if in doubt)
- Squads v4 program ID: `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`
- Repo: `metaDAOproject/token-migrator`
- Workflow: `.github/workflows/deploy.yaml`
- Deploy convention: always from `master`; this skill only considers `mainnet` runs (devnet runs ignored)
