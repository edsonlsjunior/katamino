import { useTranslation } from 'react-i18next';

export function SolvedBanner() {
  const { t } = useTranslation();
  return (
    <div data-testid="solved-banner" role="status" className="solved-banner">
      {t('manualPlay.solved', 'Solved! Every piece fits — well done.')}
    </div>
  );
}
