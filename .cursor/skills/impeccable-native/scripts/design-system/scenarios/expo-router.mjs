/**
 * Scenario: Expo Router
 *
 * Expo Router uses file-based routing under app/ and conventionally keeps
 * shared components under components/ at the repo root (peer of app/).
 * Detected by the presence of both directories.
 */

import path from 'node:path';
import { resultFor, isDir } from './_helpers.mjs';

export const id = 'expo-router';

export function detect(rootDir) {
  const appDir = path.join(rootDir, 'app');
  const componentsDir = path.join(rootDir, 'components');
  if (!isDir(appDir) || !isDir(componentsDir)) {
    return { matched: false, roots: [], confidence: 'low' };
  }
  return resultFor([componentsDir], rootDir);
}
