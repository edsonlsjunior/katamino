/**
 * The criteria a solving strategy can be built from. A strategy is the plain
 * "try, undo, try again" search plus any subset of these: each one either
 * changes the order things are tried in or recognizes a dead end earlier, and
 * they all combine freely. Adding a criterion means adding an id here, its
 * texts under `criteria.<id>` in the locale files, and its logic in
 * configurableSolver.ts.
 */

export const CRITERION_IDS = [
  'scarce-pieces-first',
  'most-constrained-cell',
  'dead-regions',
  'stranded-cells',
  'stranded-pieces',
] as const;

export type CriterionId = (typeof CRITERION_IDS)[number];

export interface Criterion {
  id: CriterionId;
  /** 'order' criteria change what is tried first; 'prune' criteria give up on a branch early. */
  kind: 'order' | 'prune';
  /** i18n key prefix: `<i18nKey>.name`, `.summary` and `.details`. */
  i18nKey: string;
}

export const CRITERIA: readonly Criterion[] = [
  { id: 'scarce-pieces-first', kind: 'order', i18nKey: 'criteria.scarcePiecesFirst' },
  { id: 'most-constrained-cell', kind: 'order', i18nKey: 'criteria.mostConstrainedCell' },
  { id: 'dead-regions', kind: 'prune', i18nKey: 'criteria.deadRegions' },
  { id: 'stranded-cells', kind: 'prune', i18nKey: 'criteria.strandedCells' },
  { id: 'stranded-pieces', kind: 'prune', i18nKey: 'criteria.strandedPieces' },
];

export const PRUNE_CRITERION_IDS: readonly CriterionId[] = CRITERIA.filter((c) => c.kind === 'prune').map(
  (c) => c.id,
);

/**
 * What the solver panel starts with: a set that solves every bundled
 * challenge well within the step limit (weaker sets run out of steps on some
 * of the larger boards — which is the point of letting the player try them).
 */
export const DEFAULT_CRITERIA: readonly CriterionId[] = ['most-constrained-cell', 'dead-regions'];

export function isCriterionId(value: string): value is CriterionId {
  return (CRITERION_IDS as readonly string[]).includes(value);
}

/** Same set of criteria -> same key, whatever order they were ticked in. */
export function criteriaKey(criteria: Iterable<CriterionId>): string {
  const enabled = new Set(criteria);
  return CRITERION_IDS.filter((id) => enabled.has(id)).join('+') || 'none';
}
