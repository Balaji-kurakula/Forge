# Security Policy

## Project status

Forge is a **pre-release architecture and orchestration skeleton** (Phase 1, see
[`docs/ROADMAP.md`](docs/ROADMAP.md)). It is not deployed anywhere, has no users, and much of
`src/` is intentionally stubbed. There is no released version and therefore no supported-version
matrix yet.

Because of that, the highest-value reports here are **design** flaws rather than exploitable bugs —
for example a hole in the tenancy wall, the anonymizer, the Executor-only write gate, or the L5
policy engine. Those are the parts meant to be load-bearing, and they are documented in
[`docs/architecture/09-tenancy-security.md`](docs/architecture/09-tenancy-security.md) and
[`docs/architecture/12-anonymizer.md`](docs/architecture/12-anonymizer.md).

## Reporting a vulnerability

Please **do not open a public issue** for a security report.

Use GitHub's private vulnerability reporting: go to the **Security** tab → **Report a
vulnerability**. That opens a private advisory visible only to the maintainer.

Include, where you can:

- what the flaw is and which component it lives in (file path or architecture doc section),
- how to reproduce or a sketch of the attack path,
- what an attacker gains — data crossing the tenancy wall, an unauthorized write, sandbox escape.

Expect an acknowledgement within about a week. This is a solo side project, so please calibrate
response-time expectations accordingly.

## Scope

**In scope** — anything in this repository: the policy gate, the role/write invariant, the
anonymizer and tenancy design, the indexer, the local `docker-compose.yml` dev stack, and the
CI workflow.

**Out of scope**

- The dev credentials in `.env.example`, `docker-compose.yml`, and `infra/init/`. These are
  deliberately plaintext, local-only, and bound to `localhost` — they guard nothing.
- Vulnerabilities in third-party dependencies with no Forge-specific exploit path. Report those
  upstream; Dependabot tracks them here.
- Anything requiring an already-compromised developer machine.
