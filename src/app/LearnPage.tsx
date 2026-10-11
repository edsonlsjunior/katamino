import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getChallengeById, loadChallenges } from '../data/loadChallenges';
import { PIECE_TYPES, PIECE_TYPE_IDS, type PieceTypeId } from '../domain/pentomino';
import type { Challenge } from '../domain/types';
import { countArrangements } from '../solvers/configurableSolver';
import { CRITERIA, CRITERION_IDS, type CriterionId } from '../solvers/criteria';
import { mirrorBoard, placementCount } from './learn/boardAnalysis';
import {
  EXAMPLE_CHALLENGE_ID,
  deadRegionExample,
  mostConstrainedExample,
  strandedCellExample,
  strandedPieceExample,
} from './learn/illustrations';
import { MiniBoard, PieceGlyph } from './learn/MiniBoard';
import { SearchTreeLab } from './learn/SearchTreeLab';
import { buildSearchTree, solutionBoard } from './learn/searchTree';
import './LearnPage.css';

/** The challenge the closing button opens in the real solver. */
const TRY_IT_CHALLENGE_ID = 5;

const SECONDS_PER_YEAR = 31_557_600;
const AGE_OF_UNIVERSE_YEARS = 13.8e9;
const TESTS_PER_SECOND = 1e6;

interface LearnPageProps {
  onOpenSolver: (challengeId: number) => void;
}

function challengeName(challenge: Challenge): string {
  return [challenge.line, `PENTA ${challenge.boardCols}`].filter(Boolean).join(' · ');
}

/** Small numbers in full; huge ones as mantissa × 10ⁿ. */
function BigNumber({ value, locale }: { value: bigint; locale: string }) {
  const approx = Number(value);
  if (approx < 1e9) return <>{approx.toLocaleString(locale)}</>;
  const exponent = Math.floor(Math.log10(approx));
  const mantissa = approx / 10 ** exponent;
  return (
    <>
      {mantissa.toLocaleString(locale, { maximumFractionDigits: 1 })} × 10<sup>{exponent}</sup>
    </>
  );
}

function Section({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="learn-section">
      <h2>
        <span className="learn-section__number" aria-hidden="true">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Figure({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="learn-figure">
      <div className="learn-figure__art">{children}</div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function criterionKey(id: CriterionId): string {
  return CRITERIA.find((c) => c.id === id)!.i18nKey;
}

function CriterionCard({ id, children }: { id: CriterionId; children: ReactNode }) {
  const { t } = useTranslation();
  const key = criterionKey(id);
  return (
    <article className="criterion-card" data-testid={`learn-criterion-${id}`}>
      <h4>{t(`${key}.name`)}</h4>
      <p>{t(`${key}.details`)}</p>
      {children}
    </article>
  );
}

export function LearnPage({ onOpenSolver }: LearnPageProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [selectedPiece, setSelectedPiece] = useState<PieceTypeId>('F');

  const example = getChallengeById(EXAMPLE_CHALLENGE_ID)!;
  const tryIt = getChallengeById(TRY_IT_CHALLENGE_ID)!;
  const exampleLabel = challengeName(example);

  const solved = useMemo(() => solutionBoard(buildSearchTree(example, CRITERION_IDS)), [example]);
  const product = useMemo(
    () =>
      example.requiredPieces.map((typeId) => ({
        typeId,
        count: placementCount(typeId, example.boardRows, example.boardCols),
      })),
    [example],
  );
  // One challenge per board size, from the smallest to the 12-piece bonus.
  const haystacks = useMemo(() => {
    const bySize = new Map<number, Challenge>();
    for (const challenge of loadChallenges()) {
      if (!bySize.has(challenge.boardCols)) bySize.set(challenge.boardCols, challenge);
    }
    return [...bySize.values()]
      .sort((a, b) => a.boardCols - b.boardCols)
      .map((challenge) => ({ challenge, count: countArrangements(challenge) }));
  }, []);
  const biggest = haystacks[haystacks.length - 1];
  const maxLog = Math.log10(Number(biggest.count));
  const years = Number(biggest.count) / TESTS_PER_SECOND / SECONDS_PER_YEAR;

  const piecesByFreedom = useMemo(
    () =>
      [...PIECE_TYPE_IDS].sort(
        (a, b) => PIECE_TYPES[a].orientations.length - PIECE_TYPES[b].orientations.length,
      ),
    [],
  );
  const mostConstrained = useMemo(() => mostConstrainedExample(example), [example]);
  const deadRegion = useMemo(() => deadRegionExample(example), [example]);
  const strandedCell = useMemo(() => strandedCellExample(example), [example]);
  const strandedPiece = useMemo(() => strandedPieceExample(example), [example]);
  const boardLabel = t('learn.boardLabel');

  return (
    <article className="learn-page">
      <header className="learn-page__intro">
        <h2>{t('learn.title')}</h2>
        <p>{t('learn.lead')}</p>
      </header>

      <Section number={1} title={t('learn.problem.title')}>
        <p>{t('learn.problem.body')}</p>
        <div className="learn-split">
          <div>
            <h3>{t('learn.problem.rulesTitle')}</h3>
            <ol className="learn-rules">
              <li>{t('learn.problem.rule1')}</li>
              <li>{t('learn.problem.rule2')}</li>
              <li>{t('learn.problem.rule3')}</li>
            </ol>
          </div>
          {solved && (
            <Figure caption={t('learn.problem.solutionsCaption', { label: exampleLabel })}>
              <MiniBoard board={solved} cell={26} label={boardLabel} />
              <span className="learn-figure__sign" aria-hidden="true">
                =
              </span>
              <MiniBoard board={mirrorBoard(solved)} cell={26} label={boardLabel} />
            </Figure>
          )}
        </div>
      </Section>

      <Section number={2} title={t('learn.pieces.title')}>
        <p>{t('learn.pieces.body')}</p>
        <div className="piece-gallery" role="group" aria-label={t('learn.pieces.galleryLabel')}>
          {PIECE_TYPE_IDS.map((typeId) => {
            const count = PIECE_TYPES[typeId].orientations.length;
            return (
              <button
                key={typeId}
                type="button"
                className="piece-gallery__item"
                data-testid={`learn-piece-${typeId}`}
                aria-pressed={typeId === selectedPiece}
                aria-label={t('learn.pieces.pieceLabel', { piece: typeId, count })}
                onClick={() => setSelectedPiece(typeId)}
              >
                <span className="piece-gallery__shape">
                  <PieceGlyph typeId={typeId} cell={13} />
                </span>
                <span className="piece-gallery__name">{typeId}</span>
                <span className="piece-gallery__count">×{count}</span>
              </button>
            );
          })}
        </div>
        <div className="piece-orientations" data-testid="learn-orientations">
          <h3>
            {t('learn.pieces.orientations', {
              piece: selectedPiece,
              count: PIECE_TYPES[selectedPiece].orientations.length,
            })}
          </h3>
          <div className="piece-orientations__list">
            {PIECE_TYPES[selectedPiece].orientations.map((_, orientationIndex) => (
              <span key={orientationIndex} className="piece-orientations__item">
                <PieceGlyph typeId={selectedPiece} orientationIndex={orientationIndex} cell={15} />
              </span>
            ))}
          </div>
        </div>
        <p className="learn-note">{t('learn.pieces.hint')}</p>
      </Section>

      <Section number={3} title={t('learn.hard.title')}>
        <p>{t('learn.hard.body')}</p>
        <div className="product-strip">
          <p className="product-strip__caption">
            {t('learn.hard.productCaption', { label: exampleLabel, count: product.length })}
          </p>
          <div className="product-strip__terms">
            {product.map(({ typeId, count }, index) => (
              <span key={typeId} className="product-strip__group">
                {index > 0 && (
                  <span className="product-strip__sign" aria-hidden="true">
                    ×
                  </span>
                )}
                <span className="product-strip__term">
                  <PieceGlyph typeId={typeId} cell={10} />
                  <strong>{count}</strong>
                  <small>{t('learn.hard.productPositions')}</small>
                </span>
              </span>
            ))}
            <span className="product-strip__group">
              <span className="product-strip__sign" aria-hidden="true">
                =
              </span>
              <span className="product-strip__term product-strip__term--total">
                <strong data-testid="learn-product-total">
                  <BigNumber value={countArrangements(example)} locale={locale} />
                </strong>
                <small>{t('learn.hard.productTotal')}</small>
              </span>
            </span>
          </div>
          <p className="learn-note">{t('learn.hard.productNote')}</p>
        </div>

        <h3>{t('learn.hard.chartTitle')}</h3>
        <ul className="haystack-chart">
          {haystacks.map(({ challenge, count }) => (
            <li key={challenge.id}>
              <span className="haystack-chart__label">
                {t('learn.hard.chartRow', { count: challenge.boardCols })}
              </span>
              <span className="haystack-chart__track">
                <span
                  className="haystack-chart__bar"
                  style={{ width: `${(Math.log10(Number(count)) / maxLog) * 100}%` }}
                />
              </span>
              <span className="haystack-chart__value">
                <BigNumber value={count} locale={locale} />
              </span>
            </li>
          ))}
        </ul>
        <p className="learn-note">{t('learn.hard.chartNote')}</p>
        <p className="learn-callout">
          {t('learn.hard.time', {
            years: new Intl.NumberFormat(locale, {
              notation: 'compact',
              compactDisplay: 'long',
              maximumSignificantDigits: 2,
            }).format(years),
            times: Math.round(years / AGE_OF_UNIVERSE_YEARS).toLocaleString(locale),
          })}
        </p>
      </Section>

      <Section number={4} title={t('learn.algorithm.title')}>
        <p>{t('learn.algorithm.body')}</p>
        <ol className="learn-steps">
          <li>{t('learn.algorithm.step1')}</li>
          <li>{t('learn.algorithm.step2')}</li>
          <li>{t('learn.algorithm.step3')}</li>
          <li className="learn-steps__back">{t('learn.algorithm.step4')}</li>
          <li>{t('learn.algorithm.step5')}</li>
        </ol>
        <h3>{t('learn.algorithm.treeTitle')}</h3>
        <p>{t('learn.algorithm.treeBody')}</p>
        <SearchTreeLab />
      </Section>

      <Section number={5} title={t('learn.criteria.title')}>
        <p>{t('learn.criteria.body')}</p>
        <table className="kinds-table" data-testid="learn-kinds">
          <caption>{t('learn.criteria.compare.title')}</caption>
          <thead>
            <tr>
              <td />
              <th scope="col">{t('learn.criteria.compare.order')}</th>
              <th scope="col">{t('learn.criteria.compare.prune')}</th>
            </tr>
          </thead>
          <tbody>
            {(['does', 'effect', 'price'] as const).map((row) => (
              <tr key={row}>
                <th scope="row">{t(`learn.criteria.compare.${row}`)}</th>
                <td>{t(`learn.criteria.compare.${row}Order`)}</td>
                <td>{t(`learn.criteria.compare.${row}Prune`)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>{t('learn.criteria.orderTitle')}</h3>
        <p>{t('learn.criteria.orderBody')}</p>
        <div className="criterion-grid">
          <CriterionCard id="scarce-pieces-first">
            <Figure caption={t('learn.criteria.scarceCaption')}>
              <span className="freedom-row">
                {piecesByFreedom.map((typeId) => (
                  <span key={typeId} className="freedom-row__item">
                    <PieceGlyph typeId={typeId} cell={9} />
                    <strong>{PIECE_TYPES[typeId].orientations.length}</strong>
                  </span>
                ))}
              </span>
            </Figure>
          </CriterionCard>
          <CriterionCard id="most-constrained-cell">
            <Figure
              caption={t('learn.criteria.mccCaption', {
                first: mostConstrained.first,
                min: mostConstrained.min,
              })}
            >
              <MiniBoard
                board={mostConstrained.board}
                cell={30}
                labels={mostConstrained.labels}
                marks={mostConstrained.marks}
                label={boardLabel}
              />
            </Figure>
          </CriterionCard>
        </div>
        <p className="learn-note">{t('learn.criteria.orderBooks')}</p>
        <aside className="learn-aside">
          <h3>{t('learn.criteria.orderCaveatTitle')}</h3>
          <p>
            {t('learn.criteria.orderCaveatBody', {
              criterion: t(`${criterionKey('scarce-pieces-first')}.name`),
            })}
          </p>
        </aside>

        <h3>{t('learn.criteria.pruneTitle')}</h3>
        <p>{t('learn.criteria.pruneBody')}</p>
        <div className="criterion-grid criterion-grid--three">
          <CriterionCard id="dead-regions">
            <Figure caption={t('learn.criteria.deadCaption', { size: deadRegion.size })}>
              <MiniBoard board={deadRegion.board} cell={30} marks={deadRegion.marks} label={boardLabel} />
            </Figure>
          </CriterionCard>
          <CriterionCard id="stranded-cells">
            <Figure
              caption={t('learn.criteria.strandedCellCaption', {
                pieces: strandedCell.remaining.join(', '),
              })}
            >
              <MiniBoard
                board={strandedCell.board}
                cell={30}
                marks={strandedCell.marks}
                labels={strandedCell.labels}
                label={boardLabel}
              />
            </Figure>
          </CriterionCard>
          <CriterionCard id="stranded-pieces">
            <Figure
              caption={t('learn.criteria.strandedPieceCaption', {
                piece: strandedPiece.stranded.join(', '),
              })}
            >
              <MiniBoard board={strandedPiece.board} cell={30} label={boardLabel} />
              <span className="leftover-pieces">
                {strandedPiece.remaining.map((typeId) => {
                  const stranded = strandedPiece.stranded.includes(typeId);
                  return (
                    <span
                      key={typeId}
                      className={`leftover-pieces__item${stranded ? ' leftover-pieces__item--stranded' : ''}`}
                    >
                      <PieceGlyph typeId={typeId} cell={11} />
                      {stranded && <small>{t('learn.criteria.doesNotFit')}</small>}
                    </span>
                  );
                })}
              </span>
            </Figure>
          </CriterionCard>
        </div>
        <p className="learn-note">{t('learn.criteria.pruneBooks')}</p>

        <aside className="learn-aside">
          <h3>{t('learn.criteria.pruneCaveatTitle')}</h3>
          <p>{t('learn.criteria.pruneCaveatBody')}</p>
        </aside>
      </Section>

      <section className="learn-cta">
        <h2>{t('learn.cta.title')}</h2>
        <p>{t('learn.cta.body')}</p>
        <button
          type="button"
          className="btn-primary"
          data-testid="learn-open-solver"
          onClick={() => onOpenSolver(tryIt.id)}
        >
          {t('learn.cta.button', { count: tryIt.boardCols })}
        </button>
      </section>
    </article>
  );
}
