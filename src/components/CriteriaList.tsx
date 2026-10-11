import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CRITERIA, type Criterion, type CriterionId } from '../solvers/criteria';
import './CriteriaList.css';

interface CriteriaListProps {
  selected: ReadonlySet<CriterionId>;
  onToggle: (id: CriterionId) => void;
  disabled?: boolean;
  /** Branches each pruning criterion has cut so far in the run on screen. */
  cuts?: Partial<Record<CriterionId, number>>;
}

interface ItemProps {
  id: string;
  i18nKey: string;
  checked: boolean;
  /** Without it the item is always on (the base search). */
  onToggle?: () => void;
  disabled?: boolean;
  cuts?: number;
}

function CriterionItem({ id, i18nKey, checked, onToggle, disabled, cuts }: ItemProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const detailsId = `criterion-details-${id}`;

  return (
    <li className="criteria-list__item" data-testid={`criterion-${id}`} data-enabled={checked}>
      <div className="criteria-list__row">
        <label className="criteria-list__label">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled || !onToggle}
            onChange={() => onToggle?.()}
          />
          <span className="criteria-list__text">
            <span className="criteria-list__name">{t(`${i18nKey}.name`)}</span>
            <span className="criteria-list__summary">{t(`${i18nKey}.summary`)}</span>
          </span>
        </label>
        {cuts !== undefined && (
          <span className="criteria-list__cuts" data-testid={`criterion-cuts-${id}`}>
            {t('criteria.cuts', { count: cuts })}
          </span>
        )}
        <button
          type="button"
          className="criteria-list__expand"
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={t(expanded ? 'criteria.collapse' : 'criteria.expand', { name: t(`${i18nKey}.name`) })}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? '−' : '+'}
        </button>
      </div>
      {expanded && (
        <p id={detailsId} className="criteria-list__details">
          {t(`${i18nKey}.details`)}
        </p>
      )}
    </li>
  );
}

/** Pruning first: those are the safe ones to switch on (they never add steps). */
const KINDS: readonly Criterion['kind'][] = ['prune', 'order'];

/**
 * The strategy, as a list of criteria added on top of the base search, split
 * the way the "how it works" page explains them: the ones that give up on a
 * branch early, and the ones that change what is tried first. Each can be
 * switched on independently and expanded for an explanation of what it
 * changes; new criteria show up here by being added to CRITERIA.
 */
export function CriteriaList({ selected, onToggle, disabled, cuts }: CriteriaListProps) {
  const { t } = useTranslation();

  return (
    <fieldset className="criteria-list" disabled={disabled}>
      <legend>{t('criteria.label')}</legend>
      <ul>
        <CriterionItem id="base" i18nKey="criteria.base" checked />
      </ul>
      {KINDS.map((kind) => (
        <div key={kind} className="criteria-list__group" data-testid={`criteria-group-${kind}`}>
          <h4>{t(`criteria.groups.${kind}.title`)}</h4>
          <p>{t(`criteria.groups.${kind}.summary`)}</p>
          <ul>
            {CRITERIA.filter((criterion) => criterion.kind === kind).map((criterion) => (
              <CriterionItem
                key={criterion.id}
                id={criterion.id}
                i18nKey={criterion.i18nKey}
                checked={selected.has(criterion.id)}
                onToggle={() => onToggle(criterion.id)}
                disabled={disabled}
                cuts={kind === 'prune' ? cuts?.[criterion.id] : undefined}
              />
            ))}
          </ul>
        </div>
      ))}
    </fieldset>
  );
}
