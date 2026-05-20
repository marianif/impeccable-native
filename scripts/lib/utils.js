import fs from 'fs';
import path from 'path';

// Per-project artifacts live inside `scripts/` of an installed skill but
// belong to the consuming project, not the distributable skill. The build
// excludes them from dist, and the harness-sync step preserves them across
// the rm+recopy so local state isn't destroyed on every rebuild.
// - config.json: legacy live-mode inject target list for existing projects.
//   New installs write project config at .impeccable/live/config.json instead.
export const PER_PROJECT_SCRIPT_ARTIFACTS = new Set(['config.json']);

// Walk the harness-dir skill tree and return any per-project script
// artifacts found, ready for restoration after a full sync rm+recopy.
// Returns [{ relPath, content: Buffer }], where relPath is relative to
// the passed-in rootDir (typically `<configDir>/skills`).
export function stashPerProjectArtifacts(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      // Only preserve files inside a skill's scripts/ directory.
      if (path.basename(path.dirname(p)) !== 'scripts') continue;
      if (PER_PROJECT_SCRIPT_ARTIFACTS.has(entry.name)) {
        out.push({ relPath: path.relative(rootDir, p), content: fs.readFileSync(p) });
      }
    }
  };
  walk(rootDir);
  return out;
}

export function restorePerProjectArtifacts(rootDir, stashed) {
  for (const { relPath, content } of stashed) {
    const target = path.join(rootDir, relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}

/**
 * Parse frontmatter from markdown content
 * Returns { frontmatter: object, body: string }
 */
export function parseFrontmatter(content) {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const [, frontmatterText, body] = match;
  const frontmatter = {};

  // Simple YAML parser (handles basic key-value and arrays)
  const lines = frontmatterText.split(/\r?\n/);
  let currentKey = null;
  let currentArray = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    // Calculate indent level
    const leadingSpaces = line.length - line.trimStart().length;
    const trimmed = line.trim();

    // Array item at level 2 (nested under a key)
    if (trimmed.startsWith('- ') && leadingSpaces >= 2) {
      if (currentArray) {
        if (trimmed.startsWith('- name:')) {
          // New object in array
          const obj = {};
          obj.name = trimmed.slice(7).trim();
          currentArray.push(obj);
        } else {
          // Simple string item in array
          currentArray.push(trimmed.slice(2));
        }
      }
      continue;
    }

    // Property of array object (indented further)
    if (leadingSpaces >= 4 && currentArray && currentArray.length > 0) {
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.slice(0, colonIndex).trim();
        const value = trimmed.slice(colonIndex + 1).trim();
        const lastObj = currentArray[currentArray.length - 1];
        lastObj[key] = value === 'true' ? true : value === 'false' ? false : value;
      }
      continue;
    }

    // Top-level key-value pair
    if (leadingSpaces === 0) {
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.slice(0, colonIndex).trim();
        const value = trimmed.slice(colonIndex + 1).trim();
        const isQuoted = /^(".*"|'.*')$/.test(value);
        const unquotedValue = isQuoted ? value.slice(1, -1) : value;
        const shouldCoerceBoolean =
          key === 'user-invocable' || key === 'user-invokable' || !isQuoted;

        if (value) {
          frontmatter[key] = shouldCoerceBoolean
            ? unquotedValue === 'true'
              ? true
              : unquotedValue === 'false'
                ? false
                : unquotedValue
            : unquotedValue;
          currentKey = key;
          currentArray = null;
        } else {
          // Start of array
          currentKey = key;
          currentArray = [];
          frontmatter[key] = currentArray;
        }
      }
    }
  }

  return { frontmatter, body: body.trim() };
}

/**
 * Recursively read all .md files from a directory
 */
export function readFilesRecursive(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    return fileList;
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      readFilesRecursive(filePath, fileList);
    } else if (file.endsWith('.md')) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

/**
 * Read and parse the impeccable skill source.
 * After v3.0 the repo holds exactly one user-invocable skill, flat at skill/.
 * Returns { skills: [oneEntry] } so downstream array-shaped consumers stay happy.
 */
export function readSourceFiles(rootDir) {
  const skillDir = path.join(rootDir, 'skill');
  const skills = [];

  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    return { skills };
  }

  const content = fs.readFileSync(skillMdPath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content);

  const references = [];
  const referenceDir = path.join(skillDir, 'reference');
  if (fs.existsSync(referenceDir)) {
    const refFiles = fs.readdirSync(referenceDir).filter(f => f.endsWith('.md'));
    for (const refFile of refFiles) {
      const refPath = path.join(referenceDir, refFile);
      references.push({
        name: path.basename(refFile, '.md'),
        content: fs.readFileSync(refPath, 'utf-8'),
        filePath: refPath
      });
    }
  }

  // PER_PROJECT_SCRIPT_ARTIFACTS (defined at module top) are excluded from
  // the distributable skill so the build never bundles one project's state
  // into another's.
  const scripts = [];
  const scriptsDir = path.join(skillDir, 'scripts');
  if (fs.existsSync(scriptsDir)) {
    const scriptFiles = fs.readdirSync(scriptsDir).filter(f => {
      if (PER_PROJECT_SCRIPT_ARTIFACTS.has(f)) return false;
      return fs.statSync(path.join(scriptsDir, f)).isFile();
    });
    for (const scriptFile of scriptFiles) {
      const scriptPath = path.join(scriptsDir, scriptFile);
      scripts.push({
        name: scriptFile,
        content: fs.readFileSync(scriptPath, 'utf-8'),
        filePath: scriptPath
      });
    }
  }
  const agents = [];
  const agentsDir = path.join(skillDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    for (const agentFile of agentFiles) {
      const agentPath = path.join(agentsDir, agentFile);
      const agentContent = fs.readFileSync(agentPath, 'utf-8');
      const { frontmatter: agentFrontmatter, body: agentBody } = parseFrontmatter(agentContent);
      const name = agentFrontmatter.name || path.basename(agentFile, '.md');
      const providersRaw = agentFrontmatter.providers;
      let providers = null;
      if (Array.isArray(providersRaw)) {
        providers = providersRaw.map(p => String(p).trim()).filter(Boolean);
      } else if (typeof providersRaw === 'string' && providersRaw.trim()) {
        providers = providersRaw.split(',').map(p => p.trim()).filter(Boolean);
      }
      agents.push({
        name,
        codexName: agentFrontmatter['codex-name'] || name.replace(/-/g, '_'),
        claudeName: agentFrontmatter['claude-name'] || name,
        description: agentFrontmatter.description || '',
        tools: agentFrontmatter.tools || '',
        model: agentFrontmatter.model || '',
        effort: agentFrontmatter.effort || '',
        maxTurns: agentFrontmatter['max-turns'] ? Number(agentFrontmatter['max-turns']) : '',
        nicknameCandidates: agentFrontmatter['nickname-candidates'] || [],
        providers,
        body: agentBody,
        filePath: agentPath,
      });
    }
  }

  skills.push({
    name: frontmatter.name || 'impeccable',
    description: frontmatter.description || '',
    license: frontmatter.license || '',
    compatibility: frontmatter.compatibility || '',
    metadata: frontmatter.metadata || null,
    allowedTools: frontmatter['allowed-tools'] || '',
    userInvocable: frontmatter['user-invocable'] === true || frontmatter['user-invocable'] === 'true',
    argumentHint: frontmatter['argument-hint'] || '',
    context: frontmatter.context || null,
    body,
    filePath: skillMdPath,
    references,
    scripts,
    agents
  });

  return { skills };
}

/**
 * Ensure directory exists, create if needed
 */
export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Clean directory (remove all contents)
 */
export function cleanDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Write file with automatic directory creation
 */
export function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  fs.writeFileSync(filePath, content, 'utf-8');
}


/**
 * Provider-specific placeholders
 */
export const PROVIDER_PLACEHOLDERS = {
  'claude-code': {
    model: 'Claude',
    config_file: 'CLAUDE.md',
    ask_instruction: 'STOP and call the AskUserQuestion tool to clarify.',
    command_prefix: '/'
  },
  'cursor': {
    model: 'the model',
    config_file: '.cursorrules',
    ask_instruction: 'ask the user directly to clarify what you cannot infer.',
    command_prefix: '/'
  },
};

export const PROVIDER_BLOCK_TAGS = new Set([
  'claude',
  'claude-code',
  'cursor',
]);

/**
 * Compile harness-conditional markdown blocks.
 *
 * Known provider blocks must be written as standalone tags:
 *
 * <codex>
 * Codex-only instructions.
 * </codex>
 *
 * Matching blocks keep their body and drop the tags. Non-matching blocks are
 * removed. Unknown tags are preserved so ordinary markdown/HTML is untouched.
 */
export function compileProviderBlocks(content, activeTags = []) {
  const activeTagSet = new Set(activeTags);
  const providerBlockPattern = /(^|\r?\n)[ \t]*<([a-z][a-z0-9-]*)>[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*<\/\2>[ \t]*(?=\r?\n|$)/g;
  let didCompileBlock = false;

  const compiled = content.replace(providerBlockPattern, (match, prefix, tag, body) => {
    if (!PROVIDER_BLOCK_TAGS.has(tag)) return match;
    didCompileBlock = true;
    return activeTagSet.has(tag) ? `${prefix}${body}` : prefix;
  });

  return didCompileBlock ? compiled.replace(/(?:\r?\n){3,}/g, '\n\n') : compiled;
}

/**
 * Replace all {{placeholder}} tokens with provider-specific values
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const EXCLUDED_FROM_SUGGESTIONS = new Set([
  'impeccable',               // foundational skill, not a steering command
  'teach-impeccable',         // deprecated shim
  'frontend-design',          // deprecated shim
]);

// Sub-commands of /impeccable-native that appear in {{available_commands}}.
const IMPECCABLE_SUB_COMMANDS = [
  'adapt', 'animate', 'audit', 'bolder', 'clarify', 'colorize',
  'craft', 'critique', 'delight', 'distill', 'document', 'extract',
  'harden', 'layout', 'onboard', 'optimize', 'overdrive', 'polish',
  'quieter', 'shape', 'teach', 'typeset',
];

export function replacePlaceholders(content, provider, commandNames = [], allSkillNames = []) {
  const placeholders = PROVIDER_PLACEHOLDERS[provider] || PROVIDER_PLACEHOLDERS['cursor'];
  const cmdPrefix = placeholders.command_prefix || '/';

  // Build the available_commands list.
  // After the v3.0 consolidation, commands are sub-commands of /impeccable.
  // If there's only one user-invocable skill (impeccable), generate sub-command references.
  // Otherwise fall back to listing skill names (backwards compat for forks).
  const nonExcluded = commandNames.filter(n => !EXCLUDED_FROM_SUGGESTIONS.has(n));
  let commandList;
  if (nonExcluded.length === 0) {
    // Single-skill architecture: list sub-commands as /impeccable <sub>
    commandList = IMPECCABLE_SUB_COMMANDS
      .map(n => `${cmdPrefix}impeccable ${n}`)
      .join(', ');
  } else {
    // Multi-skill architecture (backwards compat)
    commandList = nonExcluded.map(n => `${cmdPrefix}${n}`).join(', ');
  }

  let result = content
    .replace(/\{\{model\}\}/g, placeholders.model)
    .replace(/\{\{config_file\}\}/g, placeholders.config_file)
    .replace(/\{\{ask_instruction\}\}/g, placeholders.ask_instruction)
    .replace(/\{\{command_prefix\}\}/g, cmdPrefix)
    .replace(/\{\{available_commands\}\}/g, commandList);

  // Replace `/skillname` invocations with the correct command prefix for this provider
  // (e.g., `/normalize` → `$normalize` for Codex)
  if (cmdPrefix !== '/' && allSkillNames.length > 0) {
    const sorted = [...allSkillNames].sort((a, b) => b.length - a.length);
    for (const name of sorted) {
      result = result.replace(
        new RegExp(`\\/(?=${escapeRegex(name)}(?:[^a-zA-Z0-9_-]|$))`, 'g'),
        cmdPrefix
      );
    }
  }

  return result;
}

/**
 * Decide whether a YAML scalar string value must be quoted to survive parsing.
 *
 * Plain (unquoted) YAML scalars cannot contain `: ` or ` #`, cannot start with
 * a YAML indicator character, cannot look like a boolean/null/number, and
 * cannot carry leading/trailing whitespace. parseFrontmatter strips surrounding
 * quotes on input, so we must re-detect the need to quote on output — otherwise
 * descriptions like "Handles: critique/review..." round-trip into invalid YAML.
 */
function yamlNeedsQuoting(value) {
  if (typeof value !== 'string') return false;
  if (value === '') return true;
  // Leading or trailing whitespace
  if (/^\s|\s$/.test(value)) return true;
  // Starts with a YAML flow/indicator character
  if (/^[\[\]{},&*!|>'"%@`#]/.test(value)) return true;
  // Starts with `?`, `:`, or `-` followed by space or end of string
  if (/^[?:-](\s|$)/.test(value)) return true;
  // Contains `: ` (ends plain scalar) or ` #` (starts comment), or ends with `:`
  if (/: |\s#|:$/.test(value)) return true;
  // Reserved keywords that YAML 1.1 parsers coerce to boolean/null
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(value)) return true;
  // Looks like a number
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value)) return true;
  return false;
}

function formatYamlScalar(value) {
  if (typeof value !== 'string') return String(value);
  if (yamlNeedsQuoting(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}

function appendYamlObject(lines, data, indent = 0) {
  const space = ' '.repeat(indent);

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      lines.push(`${space}${key}:`);
      for (const item of value) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          lines.push(`${space}  -`);
          appendYamlObject(lines, item, indent + 4);
        } else {
          lines.push(`${space}  - ${formatYamlScalar(item)}`);
        }
      }
    } else if (value && typeof value === 'object') {
      lines.push(`${space}${key}:`);
      appendYamlObject(lines, value, indent + 2);
    } else if (typeof value === 'boolean') {
      lines.push(`${space}${key}: ${value}`);
    } else {
      lines.push(`${space}${key}: ${formatYamlScalar(value)}`);
    }
  }
}

/**
 * Generate YAML frontmatter string
 */
export function generateYamlFrontmatter(data) {
  const lines = ['---'];

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        if (typeof item === 'object') {
          lines.push(`  - name: ${formatYamlScalar(item.name)}`);
          if (item.description) lines.push(`    description: ${formatYamlScalar(item.description)}`);
          if (item.required !== undefined) lines.push(`    required: ${item.required}`);
        } else {
          lines.push(`  - ${formatYamlScalar(item)}`);
        }
      }
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: ${formatYamlScalar(value)}`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

/**
 * Generate a plain YAML document string.
 */
export function generateYamlDocument(data) {
  const lines = [];
  appendYamlObject(lines, data);
  return lines.join('\n');
}
