/**
 * Scenario: src/ui/
 *
 * The "design-system-aware" variant — components live under src/ui/ and
 * are usually accompanied by src/screens/ or src/features/. Common in
 * apps that have already separated low-level primitives from feature code.
 */

import path from 'node:path';
import { resultFor } from './_helpers.mjs';

export const id = 'src-ui';

export function detect(rootDir) {
  return resultFor([path.join(rootDir, 'src', 'ui')], rootDir);
}
