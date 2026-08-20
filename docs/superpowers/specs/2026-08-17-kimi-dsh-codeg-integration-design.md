# Codeg 0.26.0 + Kimi Code + DSH Integration Design

## Status

Implemented and verified locally on 2026-08-17. The phase-one deployment
defers all ordinary DeepSeek MCP configuration, keeps the currently running
standalone DSH profile on port 3082 untouched, and validates the base DeepSeek
ACP path inside Codeg. A local 0.26.0 source patch makes Codeg's bundled central
Skills store honor `CODEG_HOME`; without it, the release binary hard-codes
`~/.codeg/skills` and violates the project-local deployment boundary.

## Goals

- Run the verified Codeg Server 0.26.0 release locally on this Apple Silicon
  Mac.
- Keep Kimi Code as the primary coding agent and preserve its existing
  provider, model, OAuth, user-level MCP configuration, and native skills.
  Codeg is Kimi's platform host, not the source of truth for Kimi MCP or
  skills.
- Make Codeg's built-in DeepSeek Harness use the customized
  `/Users/suzuhashimizu/.dsh-coding` home.
- Keep standalone DSH runtime-pure: it continues to load its own Web UI plugins
  and skills, with no ordinary MCP supplied by this deployment.
- Leave ordinary MCP for DeepSeek sessions inside Codeg unconfigured in phase
  one. A later phase may add it through Codeg after the base ACP path is proven.
- Preserve Codeg's per-session `codeg-mcp` platform bridge for both Kimi and
  DeepSeek; this is distinct from their ordinary MCP services.
- Avoid a private source mirror unless live compatibility testing proves that
  a source change is necessary.

## Confirmed Baseline

- Host: macOS arm64.
- Release artifact:
  `/Applications/codeg-server-darwin-arm64.tar.gz`.
- Artifact SHA-256:
  `b96498bf3f646fc751353678dee552f02877ae681e1c5b5c6e6f1ec9eed6164b`,
  matching the GitHub 0.26.0 release asset.
- The deployed server and MCP companion are locally rebuilt from the 0.26.0
  source plus the `CODEG_HOME` central-Skills fix. The untouched release
  binaries remain recoverable under
  `local/backups/release-binaries.original-0.26.0`.
- Node.js: 26.6.0, satisfying the Node 22 minimum for Kimi Code and
  `deepseek-acp`.
- Standalone Kimi Code: 0.36.0. Codeg 0.26.0 manages Kimi Code 0.36.1.
- Kimi's existing configuration uses `managed:kimi-code`, keeps OAuth in file
  storage, and defaults to `kimi-code/k3-256k`. Secret values must be
  preserved and never printed.
- Customized DSH: `@deepseek-ai/dsh 0.1.0-rc.6`, with isolated homes
  `~/.dsh-coding`, `~/.dsh-minimal`, and `~/.dsh`.
- Codeg's built-in DeepSeek agent uses `deepseek-acp 0.3.0`, whose DSH
  dependencies are also 0.1.0-rc.6.
- Kimi's seven MCP entries converge with the `macos-shared-mcp` source. The
  previously stale supervisor manifest was republished atomically for all
  detected clients after a dry-run showed every client configuration was
  unchanged.
- `~/.dsh-coding/mcp.json` remains absent.
- The currently running standalone DSH instance is `~/.dsh-minimal` on
  `127.0.0.1:3082`; `~/.dsh-coding` is reserved for Codeg's DeepSeek Harness.

## Deployment Layout

- Source and any future patch work:
  `/Users/suzuhashimizu/code/xintaofei-codeg`.
- Release runtime:
  `/Users/suzuhashimizu/code/xintaofei-codeg/local/codeg-server-0.26.0`.
- Small command links:
  `/Users/suzuhashimizu/.local/bin/codeg-server` and
  `/Users/suzuhashimizu/.local/bin/codeg-mcp`.
- Persistent server data, the access-token file, and Codeg's own bundled skill
  store:
  `/Users/suzuhashimizu/code/xintaofei-codeg/local/data`.
- Codeg-only npm prefix:
  `/Users/suzuhashimizu/code/xintaofei-codeg/local/npm-global`.
- LaunchAgent:
  `/Users/suzuhashimizu/Library/LaunchAgents/io.github.xintaofei.codeg-server.local.plist`.
- Listen address: `127.0.0.1:3090`. This avoids DSH's 3080, 3081, and 3082
  profiles and does not expose Codeg to the LAN.
- Codeg process environment pins:
  - `DSH_HOME=/Users/suzuhashimizu/.dsh-coding`
  - `KIMI_CODE_HOME=/Users/suzuhashimizu/.kimi-code`
  - `CODEG_HOST=127.0.0.1`
  - `CODEG_PORT=3090`
  - `CODEG_HOME` and `CODEG_DATA_DIR` to the same project-local data path,
    preventing Codeg's bundled skills from falling back to `~/.codeg`
  - `CODEG_STATIC_DIR` to the release runtime's `web` directory
  - `npm_config_prefix` to the Codeg-only npm prefix

The complete `local/` deployment tree, including Codeg's central bundled
Skills store, is excluded through the tracked
`.gitignore`, so runtime binaries, logs, databases, backups, npm packages, and
the access token cannot enter Git. Removing the LaunchAgent, two command links,
and `local/` fully removes this local deployment; no `~/.codeg` runtime tree is
required.

## Agent, MCP, and Skill Ownership

```text
macos-shared-mcp source
        |
        +--> ~/.kimi-code/mcp.json --> native Kimi Code MCP

standalone dsh-minimal (127.0.0.1:3082)
        +--> ~/.dsh-minimal            --> existing independent runtime

Codeg sessions
        +--> Kimi Code     --> native Kimi MCP + native Kimi skills
        +--> DeepSeek ACP  --> ~/.dsh-coding + no ordinary MCP in phase one
        +--> codeg-mcp     --> per-session Codeg platform tools
```

Kimi reads its user-level MCP file natively. In phase one no Codeg MCP write
endpoint is called for DeepSeek, `$DSH_HOME/mcp.json` remains absent, and
DeepSeek receives an empty ordinary-MCP list. Codeg's bundled `codeg-mcp`
companion remains a separate platform bridge.

Kimi remains the source of truth for both `~/.kimi-code/mcp.json` and
`~/.kimi-code/skills`. The deployment may read and verify them, but it does not
install, remove, relink, or rewrite Kimi skills and does not use Codeg's MCP UI
to rewrite Kimi's ordinary MCP entries. Codeg may still inject its bundled
`codeg-mcp` companion because that companion is the platform control bridge,
not part of Kimi's ordinary MCP ownership.

DeepSeek remains the source of truth for its native skill roots, principally
`~/.dsh-coding/skills` and the shared `~/.agents/skills`. This deployment does
not copy Kimi skills into DSH or use Codeg's skill manager to alter either
agent's existing native skill stores.

Designing and importing DeepSeek ordinary MCP entries is explicitly deferred.
No phase-one operation creates, imports, mirrors, or synchronizes those entries.

## DSH Customization Boundary

Pinning `DSH_HOME` to `~/.dsh-coding` gives Codeg's built-in DeepSeek agent that
profile's credentials, settings, skills, and session storage. It does not
create `~/.dsh-coding/mcp.json` in phase one. The active standalone DSH remains
the separate `~/.dsh-minimal` profile on port 3082.

The packages listed only in `~/.dsh-coding/profiles/web/package.json` are DSH
Web UI bundles. They are not loaded by `deepseek-acp` inside Codeg. A future
DSH plugin may implement its own MCP behavior; that plugin-owned path remains
separate from Codeg's ACP injection path.

Codeg 0.26.0 exposes one built-in DeepSeek Harness identity. Simultaneous
Codeg identities for coding, minimal, and vanilla homes would require a source
change and are not part of this deployment.

## Security and Secret Handling

- Bind only to loopback.
- Let Codeg generate and persist its access token; do not put it in the
  LaunchAgent or command transcript.
- Keep the DeepSeek API key in `~/.dsh-coding/.credentials.yaml`; leave
  Codeg's per-agent key field empty so it does not override the credential
  file.
- Preserve Kimi OAuth and managed provider blocks without printing their
  stored values.
- Keep Codeg data, access tokens, npm prefix, and generated manifests
  owner-only where supported.
- Never embed GitHub, Bocha, proxy, Kimi, or DeepSeek credentials in MCP URLs,
  arguments, logs, or tracked source.

## Implementation Sequence

1. Publish the current `macos-shared-mcp` runtime manifest atomically for all
   detected targets after confirming every rendered client config is unchanged;
   then verify convergence and preserve the Kimi file digest.
2. Extract the verified Codeg 0.26.0 runtime into the visible local runtime
   directory, apply the tested central-Skills path fix, build the server and MCP
   companion from that source, and create stable command links.
3. Install and load the loopback-only LaunchAgent with the pinned Kimi and DSH
   homes.
4. Confirm Codeg reports version 0.26.0 and serves its health/UI endpoint on
   port 3090.
5. Install or select Codeg's managed Kimi Code 0.36.1 and DeepSeek Harness
   (`deepseek-acp 0.3.0`). Preserve the existing Kimi provider configuration,
   native MCP file, and native skill directories.
6. Wait for the Codeg DeepSeek ACP snapshot to report selectors ready, then
   start a session without ordinary MCP and complete a harmless base
   conversation using `~/.dsh-coding`.
7. Confirm the existing standalone `~/.dsh-minimal` service remains on port
   3082 with the same PID and healthy Web UI.
8. Run the remaining acceptance checks below without invoking any Codeg MCP
   write endpoint.

## Acceptance Checks

- Release checksum matches the official 0.26.0 digest.
- Codeg environment diagnostics report app version 0.26.0, resolve Kimi to the
  project-local 0.36.1 package, and resolve DeepSeek to the project-local 0.3.0
  package; `codeg-mcp` is the matching sibling of `codeg-server`.
- Codeg listens only on `127.0.0.1:3090` and restarts through launchd.
- `mcp-sync verify --targets detected` and the complete `mcp-self-test` pass
  with no manifest drift.
- Standalone Kimi 0.36.0 and Codeg's Kimi 0.36.1 both complete a harmless call
  through Kimi's native Filesystem MCP without Codeg rewriting its MCP file.
- The before/after digests of Kimi's native MCP file and existing skill entries
  are unchanged by Codeg deployment, apart from the separately authorized
  `macos-shared-mcp` manifest repair outside those files.
- A neutral-directory Kimi session completes a harmless MCP call.
- Codeg starts a DeepSeek session using `~/.dsh-coding` with no ordinary MCP
  configured and completes a harmless base conversation.
- `~/.dsh-coding/mcp.json` remains absent.
- The standalone `~/.dsh-minimal` Web UI remains healthy at
  `127.0.0.1:3082` and is not restarted or reconfigured.
- Kimi and DeepSeek Codeg sessions receive the bundled `codeg-mcp` companion
  required for enabled platform features without treating it as a user-owned
  MCP entry.
- No secret value appears in generated config diffs, process arguments, or
  logs inspected during verification.
- Existing Kimi and DSH skill trees are not rewritten by the deployment.
- The focused Rust regression test proves the central store resolves to
  `$CODEG_HOME/skills`; after launch, `local/data/skills` contains both bundled
  manifests and `~/.codeg` remains absent.

## Failure Handling and Rollback

- Back up every existing file before replacing or merging it; keep the
  backups.
- If Kimi MCP verification fails, stop before Codeg agent validation.
- If any operation creates `~/.dsh-coding/mcp.json`, stop and remove only that
  newly created file after preserving diagnostic metadata; phase one does not
  authorize DeepSeek MCP configuration.
- If the LaunchAgent fails, unload it and run the same binary once in the
  foreground with the identical non-secret environment to isolate startup
  errors.
- Rollback does not remove Kimi, DSH, or shared MCP state. It unloads Codeg,
  restores changed MCP/config files from their new backups, and removes only
  the local Codeg deployment artifacts.

## Fork Decision

The phase-one agent integration itself does not need a fork: 0.26.0 already
honors process-level `DSH_HOME`, provides the Codeg session bridge, and leaves
the separately running standalone DSH profile outside that path. However, the
release has one reproducible deployment-boundary defect: its expert/science
central store bypasses the existing `CODEG_HOME` resolver and hard-codes
`~/.codeg/skills`.

The minimal fix lives on `codex/kimi-dsh-integration`: route
`central_experts_dir()` through `paths::codeg_home_dir()` and retain the
existing `skills` suffix. A failing-before/passing-after unit test covers the
behavior, and both `codeg-server` and `codeg-mcp` are rebuilt from the same
source. Keep any private publication as a standalone mirror with the public
repository retained as read-only `upstream`; do not present it as a GitHub fork
relationship.

After final validation, the patch was published to the private standalone
mirror `Miint-Sunny/xintaofei-codeg` on branch
`codex/kimi-dsh-integration`. The local `origin` points to that private mirror;
the public `xintaofei/codeg` repository is retained as `upstream` with its push
URL disabled. The private mirror's `main` remains the unmodified 0.26.0 release
commit.

Further source patches require one of these reproducible cases:

- Codeg needs simultaneous named DSH homes.
- DeepSeek MCP forwarding loses or corrupts a valid Kimi-compatible stdio
  entry.
- Codeg cannot preserve the existing Kimi managed provider while using its
  0.36.1 adapter.

If a patch is required, keep it on the local integration branch first. Because
GitHub normally does not permit a private fork relationship from a public
repository for a personal account, publish it as a private standalone mirror
with `xintaofei/codeg` retained as the read-only `upstream` remote.

## Alternatives Considered

### Fork Codeg immediately

Rejected for the first deployment. The required single-profile hooks already
exist in 0.26.0, so a fork would add maintenance before a failing compatibility
case exists.

### Add DeepSeek as a formal `macos-shared-mcp` target immediately

Deferred. It would provide automatic synchronization and a dedicated socket
identity, but it expands the fixed thirteen-client schema, renderer tests,
runtime manifest, and supervisor matrix. Phase one defers both a formal target
and a Codeg-owned DeepSeek MCP store until ordinary DeepSeek MCP is requested.

### Use `~/.dsh` instead of `~/.dsh-coding`

Rejected. It would ignore the user's preferred customized environment and make
the Codeg and DSH Web UI state diverge.

### Give Codeg a separate `~/.dsh-codeg` home

Rejected for the initial deployment. It provides strict filesystem isolation,
but duplicates or symlinks credentials, skills, settings, and session state.
Current DSH does not read Codeg's `$DSH_HOME/mcp.json`, so runtime isolation in
the shared `~/.dsh-coding` home meets the requirement with less state drift.

### Let Codeg manage Kimi's MCP and skills

Rejected. Kimi is the primary agent and remains authoritative for its native
MCP and skill stores. Codeg is the platform host and may inspect those stores,
but this deployment does not use Codeg to mutate them.
