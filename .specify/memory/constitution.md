<!--
Sync Impact Report
- Version change: [TEMPLATE] → 1.0.0 (initial ratification)
- Modified principles: n/a (first adoption; all principles newly defined)
- Added sections:
  - I. Code Quality
  - II. Testing Standards
  - III. User Experience Consistency
  - IV. Performance Requirements
  - Quality & Performance Constraints
  - Development Workflow & Review Process
  - Governance
- Removed sections: none
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check gate reads this file at plan time; no static edit required)
  - ✅ .specify/templates/spec-template.md (generic structure already compatible; no edit required)
  - ✅ .specify/templates/tasks-template.md (generic task categories already compatible; no edit required)
  - ✅ .claude/skills/speckit-* (no CLAUDE-only or agent-specific references found requiring updates)
- Follow-up TODOs:
  - TODO(RATIFICATION_DATE): Confirm whether 2026-08-09 (constitution authoring date) should instead reflect an earlier project kickoff date.
-->

# Katamino Constitution

## Core Principles

### I. Code Quality

All code merged into the project MUST meet a consistent bar for readability,
maintainability, and correctness before it is considered done.

- Code MUST pass linting and static analysis with zero new warnings before
  merge; suppressions MUST include an inline justification.
- Every change MUST be reviewed by at least one other person (or, for solo
  work, undergo a deliberate self-review pass against this checklist) before
  merging to the main branch.
- Functions and modules MUST have a single, clear responsibility; complexity
  (branching, nesting, parameter count) that harms readability MUST be
  refactored rather than justified away.
- Naming, formatting, and structure MUST be consistent across the codebase;
  automated formatters are the source of truth over personal style.
- No dead code, commented-out blocks, or speculative abstractions MUST be
  merged; YAGNI applies — build for present requirements, not hypothetical
  future ones.

**Rationale**: Katamino's long-term velocity depends on the codebase staying
easy to read and change. Enforcing quality at merge time is far cheaper than
fixing accumulated debt later.

### II. Testing Standards

Untested behavior is unfinished behavior. Every feature and bug fix MUST be
verifiable by automated tests.

- New functionality MUST ship with automated tests (unit and/or integration,
  as appropriate) covering its primary behavior and edge cases.
- Bug fixes MUST include a regression test that fails before the fix and
  passes after.
- Tests MUST be deterministic and independent; flaky or order-dependent tests
  MUST be fixed or removed, not silently ignored.
- The full automated test suite MUST pass before any merge to the main
  branch; a red suite blocks all merges except the fix for the failure
  itself.
- Test-first (write the failing test, then the implementation) is the
  default workflow for non-trivial logic; exceptions are permitted for pure
  exploration/spike code that is discarded or rewritten before merge.

**Rationale**: A trustworthy test suite is what lets the project change code
confidently and catch regressions before players do.

### III. User Experience Consistency

Katamino MUST present a single, coherent experience across all surfaces —
interactions, visuals, feedback, and terminology MUST feel like one product.

- Shared UI components, interaction patterns, and terminology MUST be reused
  rather than re-invented; new patterns require explicit justification over
  the existing one.
- User-facing text, error messages, and feedback MUST be clear, consistent in
  tone, and actionable (state what happened and, where relevant, what to do
  next).
- Every interactive feature MUST define and handle its loading, empty,
  error, and success states — silent failures or undefined states are not
  acceptable.
- Accessibility (keyboard operability, color contrast, readable text sizes)
  MUST be considered for every user-facing change, not retrofitted later.
- Visual or interaction changes to shared components MUST be evaluated for
  their impact on every screen/flow that uses them, not just the one being
  worked on.

**Rationale**: Inconsistent UX erodes trust and increases the cognitive load
on players; consistency is a usability feature, not decoration.

### IV. Performance Requirements

Performance is a feature with explicit budgets, not an afterthought tuned
only when something feels slow.

- Each feature with user-perceptible interaction (moves, animations, board
  updates, solver/search operations) MUST define a target latency/frame
  budget before implementation and MUST be measured against it before merge.
- Solver, search, and other computationally heavy operations MUST have
  documented complexity/performance characteristics and MUST NOT block the
  UI thread; long-running work MUST be asynchronous with visible progress or
  cancellation.
- Performance-sensitive changes MUST be profiled, not guessed at; claims of
  improvement or regression MUST be backed by measurements.
- Regressions that break an established performance budget MUST be fixed or
  explicitly re-budgeted (with rationale) before merge — they MUST NOT be
  silently accepted.
- Premature optimization without a measured problem is discouraged; optimize
  against real, observed bottlenecks tied to a stated budget.

**Rationale**: Explicit budgets keep performance work objective and prevent
both premature optimization and unnoticed degradation over time.

## Quality & Performance Constraints

- CI (or the equivalent local pre-merge check when CI is not yet configured)
  MUST run linting, the full test suite, and any defined performance checks
  on every change before it can merge.
- Dependencies MUST be deliberately chosen and kept up to date; adding a new
  dependency requires a brief justification (why it's needed, why existing
  code/dependencies are insufficient).
- Breaking changes to shared interfaces (APIs, data formats, save files)
  MUST be versioned or migrated, not silently changed underneath existing
  consumers.

## Development Workflow & Review Process

- All work MUST land through a reviewed change (pull request or equivalent);
  direct unreviewed commits to the main branch are not permitted once
  collaborators are active.
- Every review MUST explicitly check the change against Code Quality,
  Testing Standards, UX Consistency, and Performance Requirements above —
  not just "does it work."
- Any deviation from a principle in this constitution MUST be called out
  explicitly in the change description with a reason; silent deviation is
  not acceptable.
- Feature work driven by Spec Kit MUST pass its Constitution Check gate
  (see `.specify/templates/plan-template.md`) before implementation begins,
  and unresolved violations MUST be logged in that plan's Complexity
  Tracking table.

## Governance

This constitution supersedes all other informal practices or ad hoc
conventions for how work is done in this repository. When this document and
another guide (README, comments, prior habit) conflict, this document wins
until formally amended.

- **Amendments**: Any principle, constraint, or workflow rule may be amended
  by editing this file, recording the change in the Sync Impact Report
  comment at the top of the file, and updating the version per the policy
  below.
- **Versioning policy** (semantic versioning applied to governance):
  - MAJOR: Backward-incompatible removal or redefinition of a principle.
  - MINOR: A new principle, section, or materially expanded guidance added.
  - PATCH: Wording clarifications, typo fixes, non-semantic refinements.
- **Compliance review**: Every plan/PR review MUST verify compliance with
  this constitution; unjustified complexity or deviation MUST be resolved
  before merge, not deferred indefinitely.
- Dependent templates (`.specify/templates/*.md`) and installed Spec Kit
  commands/skills MUST be re-checked for alignment whenever this
  constitution is amended, per the propagation checklist in the
  `speckit-constitution` skill.

**Version**: 1.0.0 | **Ratified**: 2026-08-09 | **Last Amended**: 2026-08-09
