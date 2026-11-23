// Sunset Shores — the entry program for make.fun's "Make GTA 6" bounty
// (competition gta6-01). It copies game/ and screenshots/ from this
// repository into the output directory and writes /output/dossier.json
// with the kit's buildDossier library.
//
// Run it locally as:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The grader runs it with /output as the output directory.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const screenshotsDir = join(repoRoot, 'screenshots');

if (!existsSync(gameDir)) {
  console.error(`main.ts: game/ is missing from the repository (${gameDir})`);
  process.exit(1);
}
if (!existsSync(screenshotsDir)) {
  console.error(`main.ts: screenshots/ is missing from the repository (${screenshotsDir})`);
  process.exit(1);
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
cpSync(screenshotsDir, join(outputDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`main.ts: wrote ${outputDir}/dossier.json (${dossier.length} bytes)`);
