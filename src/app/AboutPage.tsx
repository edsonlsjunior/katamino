import { useTranslation } from 'react-i18next';
import { loadChallenges } from '../data/loadChallenges';
import { CRITERIA } from '../solvers/criteria';
import './AboutPage.css';

const REPOSITORY_URL = 'https://github.com/edsonlsjunior/katamino';

interface AboutPageProps {
  onBrowseChallenges: () => void;
}

export function AboutPage({ onBrowseChallenges }: AboutPageProps) {
  const { t } = useTranslation();
  const challengeCount = loadChallenges().length;

  return (
    <article className="about-page">
      <header className="about-page__intro">
        <h2>{t('about.title')}</h2>
        <p>{t('about.lead', { count: challengeCount })}</p>
        <button type="button" className="btn-primary" onClick={onBrowseChallenges}>
          {t('about.browse')}
        </button>
      </header>

      <div className="about-page__grid">
        <section className="about-card">
          <h3>{t('about.game.title')}</h3>
          <p>{t('about.game.body')}</p>
        </section>

        <section className="about-card">
          <h3>{t('about.play.title')}</h3>
          <ul>
            <li>{t('about.play.pick')}</li>
            <li>{t('about.play.rotate')}</li>
            <li>{t('about.play.mirror')}</li>
            <li>{t('about.play.progress')}</li>
          </ul>
        </section>

        <section className="about-card about-card--wide">
          <h3>{t('about.solver.title')}</h3>
          <p>{t('about.solver.body')}</p>
          <dl className="about-criteria">
            {CRITERIA.map((criterion) => (
              <div key={criterion.id}>
                <dt>{t(`${criterion.i18nKey}.name`)}</dt>
                <dd>{t(`${criterion.i18nKey}.summary`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="about-card">
          <h3>{t('about.tech.title')}</h3>
          <p>{t('about.tech.body')}</p>
          <p>
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
              {t('about.tech.source')}
            </a>
          </p>
        </section>

        <section className="about-card">
          <h3>{t('about.disclaimer.title')}</h3>
          <p>{t('about.disclaimer.body')}</p>
        </section>
      </div>
    </article>
  );
}
