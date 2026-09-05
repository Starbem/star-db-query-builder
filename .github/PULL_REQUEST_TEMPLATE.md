## Summary

<!-- What changed and why. Link the issue this closes, if any: "Closes #123". -->

## Type of change

- [ ] `fix` — bug fix (no API change)
- [ ] `feat` — new functionality (backward compatible)
- [ ] `refactor` — no behavior change
- [ ] `docs` — documentation only
- [ ] `test` — tests only
- [ ] `chore` / `ci` — tooling, dependencies, CI/CD
- [ ] Breaking change (needs a **major** version bump — explain the migration below)

## How was this tested?

<!-- New/updated tests? Manual verification steps? -->

## Checklist

- [ ] `pnpm run type:check` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run format:check` passes
- [ ] `pnpm run test:ci` passes, and a bug fix includes a regression test
- [ ] `pnpm run build` passes
- [ ] Any new/changed public method is documented in `docs/methods/*.md`, `docs/INDEX.md`, and `README.md` (see [AGENTS.md](../AGENTS.md#documentation-rules))
- [ ] `CHANGELOG.md`'s `[Unreleased]` section is updated
- [ ] If this changes SQL identifier/value handling, it goes through `assertValidIdentifier`/`assertSafeSqlFragment`/parameterized values — see [AGENTS.md](../AGENTS.md#critical-security-rule)

## Related issue(s)

<!-- e.g. Closes #21 -->
