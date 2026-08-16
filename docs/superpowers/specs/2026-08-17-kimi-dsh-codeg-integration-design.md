# Codeg 0.26.0 + Kimi Code + DSH Integration Design

## Status

Proposed for local deployment. The in-chat design was approved on 2026-08-17;
implementation starts after review of this written record.

## Goals

- Run the verified Codeg Server 0.26.0 release locally on this Apple Silicon
  Mac.
- Keep Kimi Code as the primary coding agent and preserve its existing
  provider, model, OAuth, and user-level MCP configuration.
- Make Codeg's built-in DeepSeek Harness use the customized
  `/Users/suzuhashimizu/.dsh-coding` home.
- Give both Kimi Code and DeepSeek Harness the seven existing local MCP
  services, then verify discovery and harmless tool calls end to end.
- Avoid a private source mirror unless live compatibility testing proves that
  a source change is necessary.

## Confirmed Baseline

- Host: macOS arm64.
- Release artifact:
  `/Applications/codeg-server-darwin-arm64.tar.gz`.
- Artifact SHA-256:
  `b96498bf3f646fc751353678dee552f02877ae681e1c5b5c6e6f1ec9eed6164b`,
  matching the GitHub 0.26.0 release asset.
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
- Kimi's seven MCP entries converge with the `macos-shared-mcp` source, but
  the supervisor manifest is stale. Only Safari and Fetch
  `runtimeTreeDigest` values differ; the installed runtimes pass integrity
  checks. This is manifest publication drift, not a Kimi configuration error.
- `~/.dsh-coding/mcp.json` does not yet exist.

## Deployment Layout

- Source and any future patch work:
  `/Users/suzuhashimizu/code/xintaofei-codeg`.
- Release runtime:
  `/Users/suzuhashimizu/code/xintaofei-codeg/local/codeg-server-0.26.0`.
- Small command links:
  `/Users/suzuhashimizu/.local/bin/codeg-server` and
  `/Users/suzuhashimizu/.local/bin/codeg-mcp`.
- Persistent server data:
  `/Users/suzuhashimizu/Library/Application Support/codeg-server`.
- LaunchAgent:
  `/Users/suzuhashimizu/Library/LaunchAgents/io.github.xintaofei.codeg-server.local.plist`.
- Listen address: `127.0.0.1:3090`. This avoids DSH's 3080, 3081, and 3082
  profiles and does not expose Codeg to the LAN.
- Codeg process environment pins:
  - `DSH_HOME=/Users/suzuhashimizu/.dsh-coding`
  - `KIMI_CODE_HOME=/Users/suzuhashimizu/.kimi-code`
  - `CODEG_HOST=127.0.0.1`
  - `CODEG_PORT=3090`
  - `CODEG_DATA_DIR` and `CODEG_STATIC_DIR` to the paths above

The extracted runtime directory is excluded through `.git/info/exclude`, not
through a tracked project change. Removing the LaunchAgent, two command links,
the runtime directory, and the Codeg data directory fully removes this local
deployment.

## Agent and MCP Data Flow

```text
macos-shared-mcp source
        |
        +--> ~/.kimi-code/mcp.json --> Kimi Code 0.36.1
        |
        +--> Codeg canonical MCP import
                 |
                 +--> ~/.dsh-coding/mcp.json
                          |
                          +--> session/new.mcpServers
                                   |
                                   +--> deepseek-acp 0.3.0
```

Kimi reads its user-level MCP file natively. `deepseek-acp` does not read a
native MCP file, so Codeg uses `$DSH_HOME/mcp.json` as its own canonical store
and forwards those entries over ACP for every new DeepSeek session.

The initial DeepSeek entries mirror the already-managed Kimi stdio routes.
They connect to the same supervised local service sockets and preserve the
existing proxy, runtime integrity, and credential handling. A future change to
Kimi's MCP routes or runtime mode requires re-importing the affected entry into
DeepSeek; automatic cross-client synchronization is intentionally out of scope
for the first deployment.

## DSH Customization Boundary

Pinning `DSH_HOME` to `~/.dsh-coding` shares its credentials, settings, skills,
session storage, and Codeg-managed MCP store with the built-in DeepSeek agent.
The packages listed only in `~/.dsh-coding/profiles/web/package.json` are DSH
Web UI bundles. They continue to work in `dsh-coding`, but they are not loaded
by `deepseek-acp` inside Codeg. This is expected and is not an MCP failure.

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
- Keep Codeg data, the DSH MCP store, and generated manifests owner-only where
  supported.
- Never embed GitHub, Bocha, proxy, Kimi, or DeepSeek credentials in MCP URLs,
  arguments, logs, or tracked source.

## Implementation Sequence

1. Publish the current `macos-shared-mcp` runtime manifest for the Kimi target
   and verify convergence without changing the seven Kimi entries.
2. Extract the verified Codeg 0.26.0 runtime into the visible local runtime
   directory and create stable command links.
3. Install and load the loopback-only LaunchAgent with the pinned Kimi and DSH
   homes.
4. Confirm Codeg reports version 0.26.0 and serves its health/UI endpoint on
   port 3090.
5. Install or select Codeg's managed Kimi Code 0.36.1 and DeepSeek Harness
   (`deepseek-acp 0.3.0`). Preserve the existing Kimi provider configuration.
6. Import the seven converged Kimi MCP specifications into DeepSeek's
   `$DSH_HOME/mcp.json` through Codeg's canonical MCP path.
7. Run the acceptance checks below.

## Acceptance Checks

- Release checksum matches the official 0.26.0 digest.
- `codeg-server --version` reports 0.26.0 and `codeg-mcp` is its matching
  sibling.
- Codeg listens only on `127.0.0.1:3090` and restarts through launchd.
- `mcp-sync verify --targets kimi` passes with no manifest drift.
- Kimi Code 0.36.1 starts with the existing `kimi-code/k3-256k` default and
  sees all seven MCP servers.
- A neutral-directory Kimi session completes a harmless MCP call.
- Codeg starts a DeepSeek session using `~/.dsh-coding`, forwards all seven
  MCP servers, and completes the same class of harmless call.
- No secret value appears in generated config diffs, process arguments, or
  logs inspected during verification.
- `dsh-coding` Web UI still starts with its existing custom bundles after the
  Codeg deployment.

## Failure Handling and Rollback

- Back up every existing file before replacing or merging it; keep the
  backups.
- If Kimi MCP verification fails, do not continue to DeepSeek import.
- If Codeg cannot load a mirrored supervised socket, remove only the DeepSeek
  MCP entry under test and diagnose the protocol boundary before trying a
  different transport.
- If the LaunchAgent fails, unload it and run the same binary once in the
  foreground with the identical non-secret environment to isolate startup
  errors.
- Rollback does not remove Kimi, DSH, or shared MCP state. It unloads Codeg,
  restores changed MCP/config files from their new backups, and removes only
  the local Codeg deployment artifacts.

## Fork Decision

Do not fork Codeg for the single-profile design: 0.26.0 already honors
process-level `DSH_HOME` and forwards DeepSeek MCP over ACP.

Create a source patch only if one of these is proven by a reproducible test:

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
runtime manifest, and supervisor matrix. The mirrored, live-tested Codeg store
is smaller and reversible for the initial deployment.

### Use `~/.dsh` instead of `~/.dsh-coding`

Rejected. It would ignore the user's preferred customized environment and make
the Codeg and DSH Web UI state diverge.
