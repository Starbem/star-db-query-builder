#!/usr/bin/env node

// Copies this package's bundled Claude Code skill into the consuming repo's
// .claude/skills/ so agents get correct star-db-query-builder usage guidance
// without a manual copy-paste. Run from the consuming repo's root:
//
//   npx star-db-query-builder-install-skill
//
// Safe to re-run after upgrading the package — it always overwrites with the
// version bundled in the currently installed package.

const fs = require('fs')
const path = require('path')

const SKILL_NAME = 'star-db-query-builder'
const SOURCE = path.join(__dirname, '..', '.claude', 'skills', SKILL_NAME, 'SKILL.md')
const TARGET_DIR = path.join(process.cwd(), '.claude', 'skills', SKILL_NAME)
const TARGET = path.join(TARGET_DIR, 'SKILL.md')

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(
      `[star-db-query-builder] Could not find bundled skill at ${SOURCE}. ` +
        'Is @starbemtech/star-db-query-builder installed correctly?'
    )
    process.exitCode = 1
    return
  }

  const alreadyExists = fs.existsSync(TARGET)
  const previous = alreadyExists ? fs.readFileSync(TARGET, 'utf8') : null
  const next = fs.readFileSync(SOURCE, 'utf8')

  if (previous === next) {
    console.log(`[star-db-query-builder] Skill already up to date at ${path.relative(process.cwd(), TARGET)}`)
    return
  }

  fs.mkdirSync(TARGET_DIR, { recursive: true })
  fs.writeFileSync(TARGET, next)

  console.log(
    `[star-db-query-builder] ${alreadyExists ? 'Updated' : 'Installed'} skill at ${path.relative(
      process.cwd(),
      TARGET
    )}`
  )
  if (!alreadyExists) {
    console.log('[star-db-query-builder] Commit this file so the rest of the team gets it too.')
  }
}

main()
