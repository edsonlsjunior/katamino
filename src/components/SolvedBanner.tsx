import { useTranslation } from 'react-i18next';
import './SolvedBanner.css';

export function SolvedBanner() {
  const { t } = useTranslation();
  return (
    <div data-testid="solved-banner" role="status" className="solved-banner">
      {t('manualPlay.solved', 'Solved! Every piece fits. Well done.')}
    </div>
  );
}
