// Publish the built decoder packages to the local verdaccio registry.
// Run after `bun run build:packages` (the `publish:packages` script chains them).
//
// Each package is published from its self-contained dist/ folder (prepared by
// infra/prepare-dist.ts). Existing versions are unpublished first so the script
// is re-runnable during development.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const REGISTRY = 'http://localhost:4873/'
const root = join(import.meta.dir, '..')
const npmrc = join(import.meta.dir, '.npmrc')

// Dependency order: the kit must exist before the examples that depend on it.
const PACKAGES = ['decoder-kit', 'json-decoder', 'perp-dex-decoder']

function npm(args: string[], cwd: string) {
  const result = spawnSync('npm', [...args, '--registry', REGISTRY, '--userconfig', npmrc], {
    cwd,
    stdio: 'inherit',
  })
  return result.status ?? 1
}

for (const dir of PACKAGES) {
  const distDir = join(root, 'packages', dir, 'dist')
  if (!existsSync(join(distDir, 'package.json'))) {
    console.error(`✗ ${dir}: dist/ not built — run \`bun run build:packages\` first`)
    process.exit(1)
  }
  const { name, version } = JSON.parse(readFileSync(join(distDir, 'package.json'), 'utf8'))

  // Best-effort unpublish so re-runs can republish the same version.
  spawnSync('npm', ['unpublish', `${name}@${version}`, '--force', '--registry', REGISTRY, '--userconfig', npmrc], {
    stdio: 'ignore',
  })

  console.log(`\n→ publishing ${name}@${version}`)
  if (npm(['publish'], distDir) !== 0) {
    console.error(`✗ failed to publish ${name}`)
    process.exit(1)
  }
}

console.log(`\n✓ published ${PACKAGES.length} packages to ${REGISTRY}`)
