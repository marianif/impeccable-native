/**
 * Scenario: packages/<name>/src/ (monorepo)
 *
 * Common pnpm/yarn workspaces layout. Detects any packages/*\/src/components
 * or packages/*\/src/ui directories as roots. Confidence drops if there are
 * many packages and we can't tell which one is "the" UI package.
 */

import path from 'node:path';
import fs from 'node:fs';
import { resultFor, isDir } from './_helpers.mjs';

export const id = 'packages-ui';

export function detect(rootDir) {
  const packagesDir = path.join(rootDir, 'packages');
  if (!isDir(packagesDir)) return { matched: false, roots: [], confidence: 'low' };

  let pkgs;
  try {
    pkgs = fs.readdirSync(packagesDir, { withFileTypes: true });
  } catch {
    return { matched: false, roots: [], confidence: 'low' };
  }

  const candidates = [];
  for (const d of pkgs) {
    if (!d.isDirectory()) continue;
    const base = path.join(packagesDir, d.name);
    const components = path.join(base, 'src', 'components');
    const ui = path.join(base, 'src', 'ui');
    if (isDir(components)) candidates.push(components);
    if (isDir(ui)) candidates.push(ui);
  }
  if (candidates.length === 0) return { matched: false, roots: [], confidence: 'low' };

  // Confidence drops when there are many candidates — the user may need to pick.
  const result = resultFor(candidates, rootDir);
  if (candidates.length > 2 && result.matched) {
    return { ...result, confidence: 'medium' };
  }
  return result;
}
