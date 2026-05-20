#!/usr/bin/env node

/**
 * Build system for impeccable-native skill.
 *
 * Compiles skill/ into provider-specific formats under dist/, then syncs to:
 *   .claude/skills/   (Claude Code)
 *   .cursor/skills/   (Cursor)
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { readSourceFiles, stashPerProjectArtifacts, restorePerProjectArtifacts } from './lib/utils.js';
import { createTransformer, PROVIDERS } from './lib/transformers/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function validateSkillFrontmatter(skills) {
  let errors = 0;
  for (const skill of skills) {
    if (!skill.name) {
      console.error(`  ❌ Skill missing name: ${skill.filePath}`);
      errors++;
    }
    if (!skill.description) {
      console.error(`  ❌ Skill missing description: ${skill.name || skill.filePath}`);
      errors++;
    }
  }
  return errors;
}

async function build() {
  const clean = process.argv.includes('--clean');
  if (clean && fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
    console.log('🧹 Cleaned dist/\n');
  }

  console.log('🔨 Building impeccable-native skill...\n');

  const { skills } = readSourceFiles(ROOT_DIR);
  const userInvocableCount = skills.filter(s => s.userInvocable).length;
  console.log(`📖 Read ${skills.length} skill(s) (${userInvocableCount} user-invocable)\n`);

  const frontmatterErrors = validateSkillFrontmatter(skills);
  if (frontmatterErrors > 0) process.exit(1);

  const pluginJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, '.claude-plugin/plugin.json'), 'utf-8'));
  const skillsVersion = pluginJson.version;

  // Transform for each provider
  for (const config of Object.values(PROVIDERS)) {
    const transform = createTransformer(config);
    transform(skills, DIST_DIR, { skillsVersion });
  }

  // Sync to harness dirs (.claude/ and .cursor/)
  const syncProviders = ['claude-code', 'cursor'];
  for (const providerKey of syncProviders) {
    const config = PROVIDERS[providerKey];
    const { configDir, agentFormat } = config;

    const skillsSrc = path.join(DIST_DIR, providerKey, configDir, 'skills');
    const skillsDest = path.join(ROOT_DIR, configDir, 'skills');

    if (fs.existsSync(skillsSrc)) {
      const stashed = stashPerProjectArtifacts(skillsDest);
      if (fs.existsSync(skillsDest)) fs.rmSync(skillsDest, { recursive: true });
      copyDirSync(skillsSrc, skillsDest);
      restorePerProjectArtifacts(skillsDest, stashed);
    }

    if (agentFormat) {
      const agentsSrc = path.join(DIST_DIR, providerKey, configDir, 'agents');
      const agentsDest = path.join(ROOT_DIR, configDir, 'agents');
      if (fs.existsSync(agentsDest)) fs.rmSync(agentsDest, { recursive: true, force: true });
      if (fs.existsSync(agentsSrc)) copyDirSync(agentsSrc, agentsDest);
    }
  }

  console.log(`📋 Synced to: ${syncProviders.map(k => PROVIDERS[k].configDir).join(', ')}`);
  console.log('\n✨ Build complete!');
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
