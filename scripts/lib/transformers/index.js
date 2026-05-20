import { createTransformer } from './factory.js';
import { PROVIDERS } from './providers.js';

// Named exports kept as stable spy targets for the test suite.
export const transformCursor = createTransformer(PROVIDERS.cursor);
export const transformClaudeCode = createTransformer(PROVIDERS['claude-code']);

export { createTransformer, PROVIDERS };
