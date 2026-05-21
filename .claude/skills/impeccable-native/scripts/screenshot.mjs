#!/usr/bin/env node

/**
 * screenshot.mjs
 *
 * Captures screenshots from iOS Simulator and/or Android Emulator so Claude
 * can iterate visually without a browser overlay. Partial replacement for
 * the web skill's live mode.
 *
 * Usage:
 *   node screenshot.mjs [--platform=ios|android|both] [--out=dir] [--name=label]
 *
 * Flags:
 *   --platform=ios|android|both   Which platform to capture (default: both)
 *   --out=dir                     Output directory (default: .impeccable/screenshots)
 *   --name=label                  Label prefix for filenames (default: screenshot)
 *
 * Output (stdout, JSON):
 *   {
 *     "screenshots": [
 *       { "platform": "ios"|"android", "path": string, "timestamp": string }
 *     ],
 *     "errors": [
 *       { "platform": "ios"|"android", "message": string, "hint": string }
 *     ],
 *     "summary": { "captured": number, "failed": number }
 *   }
 *
 * Prerequisites:
 *   iOS:     Xcode + xcrun in PATH, at least one simulator booted
 *   Android: Android SDK + adb in PATH, at least one emulator running
 *
 * The script never throws on a missing tool or no-device condition — it
 * collects the error with an actionable hint and continues to the other
 * platform if possible.
 */

import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';

// ── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

const platform = (() => {
  const flag = args.find(a => a.startsWith('--platform='));
  const val = flag ? flag.split('=')[1] : 'both';
  if (!['ios', 'android', 'both'].includes(val)) {
    process.stderr.write(`screenshot: unknown --platform value "${val}". Use ios, android, or both.\n`);
    process.exit(1);
  }
  return val;
})();

const outDir = (() => {
  const flag = args.find(a => a.startsWith('--out='));
  return flag ? path.resolve(flag.split('=')[1]) : path.resolve(process.cwd(), '.impeccable', 'screenshots');
})();

const label = (() => {
  const flag = args.find(a => a.startsWith('--name='));
  return flag ? flag.split('=')[1].replace(/[^a-zA-Z0-9_-]/g, '_') : 'screenshot';
})();

// ── helpers ────────────────────────────────────────────────────────────────

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Check whether a CLI tool is on PATH without throwing.
 * Returns true if found, false otherwise.
 */
function toolExists(name) {
  const result = spawnSync('which', [name], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim().length > 0;
}

/**
 * Run a command, return { stdout, stderr, status }.
 * Never throws — captures errors into the return value.
 */
function run(cmd, args = [], opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    timeout: 15000,
    ...opts,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status ?? 1,
    error: result.error || null,
  };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// ── iOS capture ────────────────────────────────────────────────────────────

function captureIos(outPath) {
  // 1. Check xcrun is available
  if (!toolExists('xcrun')) {
    return {
      ok: false,
      message: 'xcrun not found.',
      hint: 'Install Xcode from the App Store, then re-run. xcrun ships with Xcode Command Line Tools.',
    };
  }

  // 2. Check at least one simulator is booted
  const listResult = run('xcrun', ['simctl', 'list', 'devices', '--json']);
  if (listResult.status !== 0 || listResult.error) {
    return {
      ok: false,
      message: 'xcrun simctl list failed: ' + (listResult.stderr || listResult.error?.message || 'unknown error'),
      hint: 'Make sure Xcode is fully installed and you have accepted the Xcode license (sudo xcodebuild -license accept).',
    };
  }

  let devices;
  try {
    const parsed = JSON.parse(listResult.stdout);
    devices = Object.values(parsed.devices || {}).flat();
  } catch {
    return {
      ok: false,
      message: 'Could not parse xcrun simctl list output.',
      hint: 'Try running `xcrun simctl list devices --json` manually to diagnose.',
    };
  }

  const booted = devices.find(d => d.state === 'Booted');
  if (!booted) {
    return {
      ok: false,
      message: 'No iOS Simulator is currently booted.',
      hint: 'Open Xcode → Simulator, or run: open -a Simulator. Wait for it to finish booting, then re-run.',
    };
  }

  // 3. Capture
  const result = run('xcrun', ['simctl', 'io', 'booted', 'screenshot', outPath]);
  if (result.status !== 0 || result.error) {
    return {
      ok: false,
      message: 'xcrun simctl io screenshot failed: ' + (result.stderr || result.error?.message || 'unknown error'),
      hint: 'The simulator may be in a transient state. Try locking/unlocking it, then re-run.',
    };
  }

  return { ok: true };
}

// ── Android capture ────────────────────────────────────────────────────────

function captureAndroid(outPath) {
  // 1. Check adb is available
  if (!toolExists('adb')) {
    return {
      ok: false,
      message: 'adb not found in PATH.',
      hint: 'Install Android Studio and add its SDK platform-tools to your PATH:\n  export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"',
    };
  }

  // 2. Check at least one device/emulator is online
  const devicesResult = run('adb', ['devices']);
  if (devicesResult.status !== 0 || devicesResult.error) {
    return {
      ok: false,
      message: 'adb devices failed: ' + (devicesResult.stderr || devicesResult.error?.message || 'unknown error'),
      hint: 'Make sure the Android SDK is installed and adb is functional.',
    };
  }

  const deviceLines = devicesResult.stdout
    .split('\n')
    .slice(1) // skip "List of devices attached" header
    .filter(line => line.trim() && line.includes('\tdevice'));

  if (deviceLines.length === 0) {
    return {
      ok: false,
      message: 'No Android device or emulator is currently running.',
      hint: 'Start an Android Virtual Device in Android Studio (Device Manager → Play), or connect a physical device with USB debugging enabled.',
    };
  }

  // 3. Capture via screencap piped to local file
  // adb exec-out screencap -p writes raw PNG bytes to stdout
  const result = spawnSync('adb', ['exec-out', 'screencap', '-p'], {
    timeout: 15000,
    encoding: 'buffer',
  });

  if (result.status !== 0 || result.error) {
    const msg = result.stderr?.toString() || result.error?.message || 'unknown error';
    return {
      ok: false,
      message: 'adb exec-out screencap failed: ' + msg,
      hint: 'Make sure the emulator is fully booted and the home screen is visible, then re-run.',
    };
  }

  if (!result.stdout || result.stdout.length < 100) {
    return {
      ok: false,
      message: 'adb screencap returned empty output.',
      hint: 'The emulator may still be booting or the screen may be locked. Unlock it and re-run.',
    };
  }

  try {
    fs.writeFileSync(outPath, result.stdout);
  } catch (err) {
    return {
      ok: false,
      message: 'Failed to write Android screenshot to disk: ' + err.message,
      hint: `Check that the output directory is writable: ${path.dirname(outPath)}`,
    };
  }

  return { ok: true };
}

// ── main ───────────────────────────────────────────────────────────────────

function run_() {
  ensureDir(outDir);

  const ts = timestamp();
  const screenshots = [];
  const errors = [];

  if (platform === 'ios' || platform === 'both') {
    const outPath = path.join(outDir, `${label}-ios-${ts}.png`);
    const result = captureIos(outPath);
    if (result.ok) {
      screenshots.push({ platform: 'ios', path: outPath, timestamp: ts });
    } else {
      errors.push({ platform: 'ios', message: result.message, hint: result.hint });
    }
  }

  if (platform === 'android' || platform === 'both') {
    const outPath = path.join(outDir, `${label}-android-${ts}.png`);
    const result = captureAndroid(outPath);
    if (result.ok) {
      screenshots.push({ platform: 'android', path: outPath, timestamp: ts });
    } else {
      errors.push({ platform: 'android', message: result.message, hint: result.hint });
    }
  }

  const output = {
    screenshots,
    errors,
    summary: {
      captured: screenshots.length,
      failed: errors.length,
    },
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');

  // Exit 1 only if nothing was captured at all
  process.exit(screenshots.length === 0 ? 1 : 0);
}

try {
  run_();
} catch (err) {
  process.stderr.write(`screenshot: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
