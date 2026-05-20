/**
 * Provider configurations for the transformer factory.
 */
export const PROVIDERS = {
  cursor: {
    provider: 'cursor',
    providerTags: ['cursor'],
    configDir: '.cursor',
    displayName: 'Cursor',
    frontmatterFields: ['license', 'compatibility', 'metadata'],
  },
  'claude-code': {
    provider: 'claude-code',
    providerTags: ['claude-code', 'claude'],
    configDir: '.claude',
    displayName: 'Claude Code',
    frontmatterFields: ['user-invocable', 'argument-hint', 'license', 'compatibility', 'metadata', 'allowed-tools'],
    agentFormat: 'claude-md',
  },
};
