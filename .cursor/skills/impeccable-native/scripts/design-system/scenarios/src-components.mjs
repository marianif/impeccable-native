/**
 * Scenario: src/components/
 *
 * The most common React/RN layout — a single src/ dir with a components/
 * peer at the top level.
 */

import path from 'node:path';
import { resultFor } from './_helpers.mjs';

export const id = 'src-components';

export function detect(rootDir) {
  return resultFor([path.join(rootDir, 'src', 'components')], rootDir);
}
