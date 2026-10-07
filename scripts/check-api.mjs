// Loads each Vercel function the way Vercel runs it (TS compiled file-by-file, native ESM).
// Catches import mistakes (e.g. a missing ".js" extension) that only crash once deployed.
import { execSync } from 'node:child_process'
import { copyFileSync, readdirSync, rmSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const out = 'node_modules/.cache/api-check'
rmSync(out, { recursive: true, force: true })
execSync(`npx tsc -p api --noEmit false --outDir ${out} --rootDir .`, { stdio: 'inherit' })
copyFileSync('package.json', `${out}/package.json`)
let failed = false
for (const f of readdirSync(`${out}/api`).filter((f) => f.endsWith('.js'))) {
  try {
    await import(pathToFileURL(`${out}/api/${f}`).href)
    console.log(`ok   api/${f}`)
  } catch (e) {
    failed = true
    console.error(`FAIL api/${f}: ${e.message.split('\n')[0]}`)
  }
}
process.exit(failed ? 1 : 0)
