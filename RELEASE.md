# RELEASE.md

Step-by-step for cutting a new release of `@starbemtech/star-db-query-builder`.

## Prerequisites (one-time, verify if unsure)

- Trusted Publisher configured on npmjs.com for this package, pointing at repo `starbem/star-db-query-builder` and workflow file `release.yml`. Without this, `npm publish` in CI fails with 403 — there is no `NPM_TOKEN` fallback.
- You have push access to `main` and permission to create tags.

## Steps

1. **Be on an up-to-date `main` with a clean working tree.**

   ```bash
   git checkout main
   git pull origin main
   git status   # must be clean
   ```

2. **Merge in whatever should ship.** All the actual feature/fix work happens on branches via PR into `main` beforehand — this flow starts once that's already merged. Do not develop the release itself on `main`.

3. **Run the full local gate** (same checks CI runs):

   ```bash
   pnpm install --frozen-lockfile
   pnpm run lint
   pnpm run format:check
   pnpm run type:check
   pnpm run build
   pnpm run test:ci
   ```

   Fix anything that fails before continuing. Don't rely on CI to catch it after the tag is pushed — by then the release workflow is already running.

4. **Decide the version bump.**

   - **patch** — bug fixes, no API change.
   - **minor** — new functionality, backward compatible. Also use minor (not patch) for a surface-level breaking change that doesn't change behavior at runtime (e.g. the `insert`/`insertMany` column-quoting change from 2026-09-04 — SQL output changed visibly but was semantically equivalent).
   - **major** — real breaking change to the public API.

   When unsure, check `CHANGELOG.md`'s `[Unreleased]` section and the merged PRs since the last tag (`git log <last-tag>..HEAD --no-merges --oneline`) to judge the right bump.

5. **Update `CHANGELOG.md`.** Move the relevant `[Unreleased]` entries under a new `## [X.Y.Z] - YYYY-MM-DD` heading, following the existing Keep a Changelog format already in the file. Commit this on its own:

   ```bash
   git add CHANGELOG.md
   git commit -m "docs: update changelog for version X.Y.Z"
   ```

6. **Bump the version and create the tag.**

   Check `package.json`'s current `version` first — if the merged PR already bumped it by hand (as opposed to leaving it untouched for this step to bump), **do not** run `pnpm run version:*` again; that would bump a second time (e.g. an already-set `1.4.0` becoming `1.5.0` instead of being tagged as `1.4.0`). In that case just create and push the tag matching the version already in `package.json`:

   ```bash
   git tag vX.Y.Z   # X.Y.Z = the version already in package.json
   ```

   Otherwise, if `package.json` still has the previous release's version, bump it normally — this updates `package.json`'s `version` field, commits it, and creates a local `vX.Y.Z` tag:

   ```bash
   pnpm run version:patch   # or version:minor / version:major
   ```

   (Equivalent to `npm version <patch|minor|major>`.)

7. **Push the branch and the tag:**

   ```bash
   git push origin main
   git push origin --tags
   ```

   Pushing the tag is what triggers `.github/workflows/release.yml`. Pushing commits to `main` alone does **not** publish anything — only a tag matching `v*.*.*` does.

8. **Watch the release workflow:** https://github.com/starbem/star-db-query-builder/actions

   It runs, in order: install → build → test:ci → generates release notes from real `git log` commits since the previous tag → creates the GitHub Release → `npm publish --access public --ignore-scripts` (via OIDC Trusted Publishing, no token). Notes/release are created before publish so the GitHub Release exists even if the publish step itself fails.

9. **Verify after it finishes:**

   ```bash
   npm view @starbemtech/star-db-query-builder version
   ```

   Confirm it matches the tag, and check the GitHub Releases page for the generated notes.

## Alternative: interactive script

`scripts/release.sh` wraps steps 3–7 into one interactive prompt (runs tests/lint/build, updates the changelog, asks for patch/minor/major, asks whether to push the tag). It still requires you to be on a clean `main`. Prefer it for a routine release; prefer the manual steps above when you need finer control (e.g. curating the changelog entry by hand first).

```bash
pnpm run release
```

## If something goes wrong after pushing the tag

- **Workflow fails before publish** (lint/test/build step): fix the issue on `main`, then delete and recreate the tag pointing at the fixed commit:

  ```bash
  git tag -d vX.Y.Z
  git push origin :refs/tags/vX.Y.Z
  # fix, commit, push to main
  git tag vX.Y.Z
  git push origin vX.Y.Z
  ```

- **Publish step fails with 403**: Trusted Publisher isn't configured correctly on npmjs.com for this repo/workflow — this is not something retrying the workflow fixes. Check the package's Trusted Publishers settings first.

- **Publish succeeded but you need to pull a bad version**: `npm unpublish` has strict time/policy limits on the npm registry — do not assume it's possible. Prefer publishing a corrective patch version instead.
