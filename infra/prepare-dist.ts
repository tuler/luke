// Generate a publish-ready dist/package.json for the package in the current
// working directory. Run by each publishable package's `build` script after it
// has emitted dist/. It rewrites `exports` to point at the built files and
// resolves any `workspace:*` dependencies to concrete versions, so the dist/
// folder is a self-contained package that `npm publish` can ship to verdaccio.

import { existsSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

const pkgDir = process.cwd()
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
const distDir = join(pkgDir, 'dist')

// Map of every workspace package name → its version, to resolve workspace deps.
const packagesDir = join(import.meta.dir, '..', 'packages')
const workspaceVersions: Record<string, string> = {}
for (const dir of readdirSync(packagesDir)) {
  const manifest = join(packagesDir, dir, 'package.json')
  if (existsSync(manifest)) {
    const m = JSON.parse(readFileSync(manifest, 'utf8'))
    if (m.name && m.version) workspaceVersions[m.name] = m.version
  }
}

/** Replace `workspace:*` / `workspace:^` style ranges with a concrete `^version`. */
function resolveDeps(deps: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!deps) return undefined
  const out: Record<string, string> = {}
  for (const [name, range] of Object.entries(deps)) {
    if (range.startsWith('workspace:')) {
      const version = workspaceVersions[name]
      if (!version) throw new Error(`No workspace version known for ${name}`)
      const suffix = range.slice('workspace:'.length)
      out[name] = suffix === '*' || suffix === '' ? `^${version}` : suffix.replace(/^[\^~]?/, '^')
    } else {
      out[name] = range
    }
  }
  return out
}

const hasTypes = existsSync(join(distDir, 'index.d.ts'))

const distPkg: Record<string, unknown> = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  license: pkg.license,
  type: 'module',
  module: './index.js',
  main: './index.js',
  exports: {
    '.': {
      ...(hasTypes ? { types: './index.d.ts' } : {}),
      default: './index.js',
    },
  },
}
const deps = resolveDeps(pkg.dependencies)
if (deps) distPkg.dependencies = deps

writeFileSync(join(distDir, 'package.json'), JSON.stringify(distPkg, null, 2) + '\n')

// Ship the README alongside the package when present.
if (existsSync(join(pkgDir, 'README.md'))) {
  copyFileSync(join(pkgDir, 'README.md'), join(distDir, 'README.md'))
}

console.log(`prepared ${pkg.name}@${pkg.version} → dist/`)
