/**
 * Scenario: components/ at the repo root (no src/)
 *
 * Older create-react-app style or hand-rolled layouts. Often paired with
 * pages/ or routes/ at the same level.
 */

import path from 'node:path';
import fs from 'node:fs';
import { resultFor, isDir } from './_helpers.mjs';

export const id = 'components-root';

export function detect(rootDir) {
  // Only match if there is no src/ — otherwise src-components / src-ui own this layout.
  if (isDir(path.join(rootDir, 'src'))) return { matched: false, roots: [], confidence: 'low' };
  return resultFor([path.join(rootDir, 'components')], rootDir);
}
