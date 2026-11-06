#!/usr/bin/env bash

# Release helper for @starbemtech/star-db-query-builder.
#
# `main` is protected (PR + required checks + reviews), so a release happens in
# two phases instead of committing and tagging locally:
#
#   pnpm run release prepare <patch|minor|major>
#     Runs the full local gate, bumps package.json, moves the CHANGELOG
#     [Unreleased] entries under the new version on a release/X.Y.Z branch,
#     pushes it and opens the PR.
#
#   pnpm run release tag
#     After that PR is merged: tags main's HEAD with vX.Y.Z and pushes only that
#     tag, which triggers .github/workflows/release.yml (npm publish).
#
# The tag is created only after the merge because the PR is squash-merged: a
# tag created on the release branch would point at a commit that never lands
# on main.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_message() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }
die() {
    print_error "$1"
    exit 1
}

usage() {
    cat <<USAGE
Uso:
  pnpm run release prepare <patch|minor|major>   abre a PR de release
  pnpm run release tag                           cria e envia a tag após o merge da PR
USAGE
}

package_version() {
    node -p "require('./package.json').version"
}

confirm() {
    local answer
    read -r -p "$1 (y/N): " answer
    [[ $answer =~ ^[Yy]$ ]]
}

# Fails unless we're on an up-to-date, clean main.
require_clean_main() {
    [ "$(git branch --show-current)" = "main" ] || die "Execute a partir da branch main (git checkout main)"
    [ -z "$(git status --porcelain)" ] || die "Há mudanças não commitadas; faça commit ou stash antes de continuar"
    print_message "Atualizando main..."
    git pull --ff-only origin main
}

tag_exists() {
    git rev-parse -q --verify "refs/tags/$1" >/dev/null ||
        git ls-remote --exit-code --tags origin "refs/tags/$1" >/dev/null 2>&1
}

branch_exists() {
    git rev-parse -q --verify "refs/heads/$1" >/dev/null ||
        git ls-remote --exit-code --heads origin "$1" >/dev/null 2>&1
}

# Same checks CI runs (see RELEASE.md, step 3).
run_gate() {
    print_message "Executando o gate local (install, lint, format, type-check, build, testes)..."
    pnpm install --frozen-lockfile
    pnpm run lint
    pnpm run format:check
    pnpm run type:check
    pnpm run build
    pnpm run test:ci
}

# Moves the [Unreleased] entries under a new "## [version] - date" heading.
# Done in Node rather than sed: BSD sed (macOS) and GNU sed disagree on
# newlines in the replacement, which once collapsed both headings into one line.
update_changelog() {
    node - "$1" "$2" <<'NODE'
const fs = require('fs')
const [version, date] = process.argv.slice(2)
const file = 'CHANGELOG.md'
const text = fs.readFileSync(file, 'utf8')
const marker = '## [Unreleased]\n'
const start = text.indexOf(marker)

if (start === -1) {
  console.error(`${file}: seção "## [Unreleased]" não encontrada`)
  process.exit(1)
}
if (text.includes(`## [${version}]`)) {
  console.error(`${file}: a versão ${version} já existe`)
  process.exit(1)
}

const bodyStart = start + marker.length
const next = text.indexOf('\n## [', bodyStart)
const unreleased = text.slice(bodyStart, next === -1 ? undefined : next)
if (!unreleased.trim()) {
  console.error(`${file}: a seção [Unreleased] está vazia; nada a lançar`)
  process.exit(1)
}

fs.writeFileSync(
  file,
  text.slice(0, bodyStart) + `\n## [${version}] - ${date}\n` + text.slice(bodyStart)
)
NODE
}

prepare() {
    local bump=${1:-}
    case $bump in
        patch | minor | major) ;;
        *)
            usage
            exit 1
            ;;
    esac

    command -v gh >/dev/null || die "GitHub CLI (gh) não encontrado; necessário para abrir a PR"
    require_clean_main

    if [ "$bump" = "major" ]; then
        print_warning "Você está criando uma versão major. Isso pode quebrar compatibilidade!"
        confirm "Tem certeza?" || {
            print_message "Release cancelado"
            exit 0
        }
    fi

    run_gate

    local current new_version branch title
    current=$(package_version)
    # Bumps package.json only: no commit and no tag (the tag comes after the merge).
    npm version "$bump" --no-git-tag-version >/dev/null
    new_version=$(package_version)
    branch="release/$new_version"
    title="docs: update changelog and bump version to $new_version"

    if tag_exists "v$new_version"; then
        git checkout -- package.json
        die "A tag v$new_version já existe"
    fi
    if branch_exists "$branch"; then
        git checkout -- package.json
        die "A branch $branch já existe; já há uma PR de release aberta?"
    fi

    if ! update_changelog "$new_version" "$(date +%Y-%m-%d)"; then
        git checkout -- package.json CHANGELOG.md
        die "Falha ao atualizar o CHANGELOG"
    fi

    print_message "Versão: $current → $new_version"
    git checkout -b "$branch"
    git add package.json CHANGELOG.md
    git commit -m "$title"
    git push -u origin "$branch"

    gh pr create --base main --head "$branch" --title "$title" --body "$(
        cat <<BODY
Release $new_version: moves the \`[Unreleased]\` CHANGELOG entries to \`[$new_version]\` and bumps \`package.json\` to $new_version.

After merge, run \`pnpm run release tag\` on an up-to-date \`main\` to tag \`v$new_version\` and trigger \`release.yml\`.
BODY
    )"

    print_message "PR de release aberta. Depois do merge, execute: git checkout main && pnpm run release tag"
}

tag() {
    require_clean_main

    local version tag_name head
    version=$(package_version)
    tag_name="v$version"
    head=$(git log -1 --format='%h %s')

    if tag_exists "$tag_name"; then
        die "A versão do package.json ($version) já foi lançada como $tag_name; a PR de release já foi mergeada em main?"
    fi
    grep -q "^## \[$version\] - " CHANGELOG.md ||
        die "CHANGELOG.md não tem a seção [$version]"

    print_message "Versão do package.json: $version"
    print_message "Commit: $head"
    confirm "Criar e enviar a tag $tag_name? Isso publica no npm" || {
        print_message "Release cancelado"
        exit 0
    }

    git tag "$tag_name"
    # Push only this tag: --tags would also push any stray local v* tag and
    # trigger an unintended release.
    git push origin "$tag_name"

    print_message "Tag $tag_name enviada. O release.yml vai publicar no npm."
    print_message "Acompanhe em: https://github.com/starbem/star-db-query-builder/actions"
    print_message "Depois confira: npm view @starbemtech/star-db-query-builder version"
}

main() {
    case ${1:-} in
        prepare) prepare "${2:-}" ;;
        tag) tag ;;
        *)
            usage
            exit 1
            ;;
    esac
}

# Only run when executed, so the functions can be sourced on their own.
if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
    main "$@"
fi
