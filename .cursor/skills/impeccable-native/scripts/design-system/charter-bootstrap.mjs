#!/usr/bin/env node

/**
 * charter-bootstrap.mjs
 *
 * Writes a DESIGN-SYSTEM.md skeleton next to PRODUCT.md, stamped with the
 * current hash of PRODUCT.md's contents. The skill turn then fills in the
 * slots via interview — this script only produces the empty scaffold.
 *
 * Refuses to overwrite an existing charter; use --force to replace.
 *
 * Usage:
 *   node charter-bootstrap.mjs --product-md=PRODUCT.md --out=DESIGN-SYSTEM.md [--force]
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

function flag(name) {
  const f = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
}
function hasFlag(name) {
  return process.argv.slice(2).includes(`--${name}`);
}

const productMdPath = path.resolve(flag('product-md') ?? 'PRODUCT.md');
const outPath = path.resolve(flag('out') ?? 'DESIGN-SYSTEM.md');
const force = hasFlag('force');

if (!fs.existsSync(productMdPath)) {
  process.stderr.write(`charter-bootstrap.mjs: PRODUCT.md not found at ${productMdPath}\n`);
  process.exit(2);
}
if (fs.existsSync(outPath) && !force) {
  process.stderr.write(`charter-bootstrap.mjs: ${outPath} already exists. Pass --force to replace.\n`);
  process.exit(3);
}

const productContents = fs.readFileSync(productMdPath, 'utf8');
const hash = createHash('sha256').update(productContents).digest('hex');

const skeleton = `---
derived_from_product_md_hash: ${hash}
derived_from_product_md_path: ${path.relative(path.dirname(outPath), productMdPath)}
generated_at: ${new Date().toISOString()}
---

# Design System Charter

This charter is the contract every component in the system is judged against.
It is derived from PRODUCT.md and answers the question: *what do we need our
component layer to make possible?*

If you change PRODUCT.md materially (new journey phase, new success metric,
new high-stakes interaction), run \`/impeccable-native design-system\` and
choose **refresh-charter** so the slots stay aligned with the product.

## Slots

Each slot is a row that defines one purpose the component layer must serve.
Components are then evaluated against this table: do they fill a slot well,
fill it poorly, fill no slot, or compete redundantly for the same one?

The five interaction kinds are deliberately small. If a slot does not fit
one of them, the slot is probably two slots.

| id | interaction_kind | journey_phase | purpose | success_criteria | notes |
|---|---|---|---|---|---|
| _example-commit-confirm_ | confirm | commit | _Make the user pause and re-read before committing an irreversible action._ | _One-tap dismiss; visible until acknowledged; survives orientation change._ | _Used by checkout, account-delete, and unsubscribe flows._ |

<!-- The skill will replace the example row with real slots derived from PRODUCT.md. -->

## Interaction-kind vocabulary

- **action** — the user does something that changes state (submit, toggle, save).
- **inform** — the system communicates state to the user (status, progress, error).
- **navigate** — the user moves through the product (link, tab, back).
- **confirm** — high-stakes moment that requires explicit acknowledgement.
- **capture** — the system gathers input from the user (form, picker, scanner).
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, skeleton);

process.stdout.write(JSON.stringify({
  status: 'written',
  path: path.relative(process.cwd(), outPath),
  product_md_hash: hash,
}));
