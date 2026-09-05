# Security Policy

## Supported versions

Only the latest published version of `@starbemtech/star-db-query-builder` receives security fixes. There is no maintained LTS branch — always upgrade to latest rather than requesting a backport.

## Reporting a vulnerability

**Do not open a public issue for a security vulnerability.** This library builds raw SQL and interpolates identifiers directly into query strings (see [AGENTS.md](./AGENTS.md#critical-security-rule)), so a sanitization gap here can be a real SQL injection vector in every consuming service — treat it as sensitive until fixed.

Instead, use GitHub's private vulnerability reporting for this repository:

**[Report a vulnerability](https://github.com/starbem/star-db-query-builder/security/advisories/new)**

Include, if possible:

- The affected function (`insert`, `update`, `createWhereClause`, etc.) and the exact input shape that triggers the issue.
- Whether it's a SQL injection vector (via an unsanitized identifier or unparameterized value), a denial-of-service (e.g. unbounded parameter list), or something else.
- A minimal reproduction.

## Scope

In scope: this repository's own code (`src/`) — identifier/value sanitization, connection/pool handling, and the published npm package's contents (`files` allowlist).

Out of scope: vulnerabilities in `pg`, `mysql2`, or other dependencies — report those upstream. Dependabot alerts for this repo are tracked separately; open a normal issue (not a security advisory) if you want to flag one that isn't already being addressed.
