/**
 * Scenario: app/components/
 *
 * Next.js / Expo Router style — app/ dir for routes, components/ as a peer
 * (handled by components-root) OR nested under app/components/.
 */

import path from 'node:path';
import { resultFor } from './_helpers.mjs';

export const id = 'app-components';

export function detect(rootDir) {
  return resultFor([path.join(rootDir, 'app', 'components')], rootDir);
}
