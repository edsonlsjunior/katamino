import { useTranslation } from 'react-i18next';
import { SOLVING_STRATEGIES, type SolvingStrategyId } from '../domain/types';
import './StrategySelector.css';

interface StrategySelectorProps {
  selected: SolvingStrategyId;
  onChange: (strategyId: SolvingStrategyId) => void;
  disabled?: boolean;
}

export function StrategySelector({ selected, onChange, disabled }: StrategySelectorProps) {
  const { t } = useTranslation();

  return (
    <fieldset className="strategy-selector" disabled={disabled}>
      <legend>{t('strategy.label', 'Solving strategy')}</legend>
      {SOLVING_STRATEGIES.map((strategy) => (
        <label key={strategy.id} className="strategy-selector__option">
          <span className="strategy-selector__row">
            <input
              type="radio"
              name="strategy"
              value={strategy.id}
              checked={selected === strategy.id}
              onChange={() => onChange(strategy.id)}
            />
            {t(`strategy.${strategy.id === 'backtracking' ? 'backtracking' : 'constraintGuided'}.name`)}
          </span>
          <span className="strategy-selector__description">{t(strategy.descriptionKey)}</span>
        </label>
      ))}
    </fieldset>
  );
}
