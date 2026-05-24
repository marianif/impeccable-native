# impeccable-native Roadmap

## Command Reorganization & Scope

### Migration → Rebrand

- **Current**: `/migration` audits and executes design system migrations
- **Rename to**: `/rebrand` to better reflect the semantic action of switching design systems wholesale
- **Rationale**: "migrate" implies moving data; "rebrand" clarifies we're replacing tokens, components, and design language

### Flow Command Redesign

- **Current state**: `/flow` performs app structure reconnaissance; shows navigation graph
- **New direction**: Enable creating or updating flows, not just reading them
- **Scope**: Rethink navigation paths; propose new screens, flows, or IA changes
- **Distinction from rethink**: rethink is for design system overhauls; flow is for navigation/IA architecture

## Command Organization by Context

Organize skill commands into two categories that map to project lifecycle:

### New Project Commands (setup/bootstrap)

Commands that make sense when scaffolding a fresh app:

- Design system setup
- Navigation skeleton
- Component library initialization
- Atomic design scaffolding

### Existing Project Commands (evolution/maintenance)

Commands for improving or auditing established codebases:

- Design system audit (`/rethink`)
- Design system replacement (`/rebrand` formerly migration)
- Navigation redesign (`/flow`)
- Code quality audits (`/utils`)
- Component refactoring
