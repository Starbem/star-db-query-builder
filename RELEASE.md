# RELEASE.md

Step-by-step for cutting a new release of `@starbemtech/star-db-query-builder`.

## Prerequisites (one-time, verify if unsure)

- Trusted Publisher configured on npmjs.com for this package, pointing at repo `starbem/star-db-query-builder` and workflow file `release.yml`. Without this, `npm publish` in CI fails with 403 — there is no `NPM_TOKEN` fallback.
- Permission to push branches and tags, and to get PRs merged into `main` (protected: PR + required checks + reviews).
- GitHub CLI (`gh`) authenticated, used to open the release PR.

## Why two phases

`main` is protected: it only accepts PRs, with the required CI checks and reviews, so the release commit (version bump + CHANGELOG) goes through a PR like any other change. PRs are squash-merged, so the commit that lands on `main` is not the one created on the release branch. The tag is therefore created only after the merge, on `main`'s HEAD. A tag created before the merge would point at a commit that never lands on `main`.

## Steps

1. **Merge whatever should ship into `main` first.** Feature/fix work goes through its own PRs. The release flow starts once that is merged.

2. **Check the `[Unreleased]` section of `CHANGELOG.md`** and decide the bump:

   - **patch**: bug fixes, no API change.
   - **minor**: new functionality, backward compatible. Also use minor (not patch) for a surface-level breaking change that doesn't change behavior at runtime (e.g. the `insert`/`insertMany` column-quoting change from 2026-09-04 — SQL output changed visibly but was semantically equivalent).
   - **major**: real breaking change to the public API.

   When unsure, compare with the commits since the last tag (`git log <last-tag>..HEAD --no-merges --oneline`).

3. **Open the release PR** from an up-to-date, clean `main`:

   ```bash
   git checkout main
   pnpm run release prepare patch   # or minor / major
   ```

   This:

   - pulls `main` (fast-forward only) and refuses to run with uncommitted changes or from another branch;
   - runs the full local gate: `pnpm install --frozen-lockfile`, `lint`, `format:check`, `type:check`, `build`, `test:ci`;
   - bumps `package.json` (`npm version <bump> --no-git-tag-version`: no commit, no tag);
   - moves the `[Unreleased]` entries under `## [X.Y.Z] - YYYY-MM-DD` (fails if `[Unreleased]` is missing or empty, or the version already exists);
   - commits `docs: update changelog and bump version to X.Y.Z` on `release/X.Y.Z`, pushes it and opens the PR with `gh`.

   It refuses to continue if the `vX.Y.Z` tag or the `release/X.Y.Z` branch already exists, and restores `package.json` when it stops.

4. **Get the release PR reviewed and merged** (squash), like any other PR. If `main` moves in the meantime, update the PR branch and wait for CI again.

5. **Tag `main` and publish:**

   ```bash
   git checkout main
   pnpm run release tag
   ```

   This pulls `main`, checks that `package.json`'s version has not been tagged yet and has a `## [X.Y.Z]` section in the CHANGELOG, shows the commit to be tagged and asks for confirmation. It then creates `vX.Y.Z` on `main`'s HEAD and pushes **only that tag** (never `git push --tags`, which would also push any stray local `v*` tag and trigger an unintended release).

   Pushing the tag is what triggers `.github/workflows/release.yml`. Merging the PR alone does **not** publish anything.

6. **Watch the release workflow:** https://github.com/starbem/star-db-query-builder/actions

   It runs, in order: install → build → test:ci → generates release notes from real `git log` commits since the previous tag → creates the GitHub Release → `npm publish --access public --ignore-scripts` (via OIDC Trusted Publishing, no token). Notes/release are created before publish so the GitHub Release exists even if the publish step itself fails.

7. **Verify after it finishes:**

   ```bash
   npm view @starbemtech/star-db-query-builder version
   ```

   The publish log may say the package "is being processed"; the registry can take a few minutes to show the new version. Also check the GitHub Releases page for the generated notes.

## If something goes wrong after pushing the tag

- **Workflow fails before publish** (install/build/test step): delete the tag, fix the issue through a PR into `main`, then tag again from the fixed `main`:

  ```bash
  git tag -d vX.Y.Z
  git push origin :refs/tags/vX.Y.Z
  # fix through a PR into main, merge it, then:
  git checkout main
  pnpm run release tag
  ```

  If the failure happened after the "Create GitHub Release" step, also delete that release (`gh release delete vX.Y.Z`) before tagging again, or the step fails because the release already exists.

- **Publish step fails with 403**: Trusted Publisher isn't configured correctly on npmjs.com for this repo/workflow — this is not something retrying the workflow fixes. Check the package's Trusted Publishers settings first.

- **Publish succeeded but you need to pull a bad version**: `npm unpublish` has strict time/policy limits on the npm registry — do not assume it's possible. Prefer publishing a corrective patch version instead.
