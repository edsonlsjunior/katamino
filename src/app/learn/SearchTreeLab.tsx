import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getChallengeById } from '../../data/loadChallenges';
import type { Challenge } from '../../domain/types';
import { CRITERIA, type Criterion, type CriterionId } from '../../solvers/criteria';
import { MiniBoard } from './MiniBoard';
import {
  buildSearchTree,
  isVisibleAt,
  statusAt,
  treeTotals,
  type NodeStatus,
  type SearchNode,
} from './searchTree';

/** Small enough to draw whole, and each one tells a different story:
 * criteria that help a little, a lot, and one that backfires. */
const LAB_CHALLENGE_IDS = [2, 3, 33];

// Tree geometry, in px. The CSS for .tree-node must agree with NODE_PADDING.
const CELL = 8;
const CELL_GAP = 1;
const NODE_PADDING = 5;
const SLOT_GAP = 12;
const LEVEL_GAP = 30;
const MARGIN = 12;

const STATUSES: readonly NodeStatus[] = ['open', 'dead', 'pruned', 'solution'];
const KINDS: readonly Criterion['kind'][] = ['order', 'prune'];

function challengeLabel(challenge: Challenge): string {
  return `${challenge.line} · PENTA ${challenge.boardCols} (${challenge.requiredPieces.join(' ')})`;
}

export function SearchTreeLab() {
  const { t } = useTranslation();
  const challenges = useMemo(
    () => LAB_CHALLENGE_IDS.map((id) => getChallengeById(id)).filter((c): c is Challenge => !!c),
    [],
  );
  const [challengeId, setChallengeId] = useState(challenges[0].id);
  const [enabled, setEnabled] = useState<readonly CriterionId[]>([]);
  // null shows the finished run; a number is a moment of the replay.
  const [tick, setTick] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const challenge = challenges.find((c) => c.id === challengeId) ?? challenges[0];
  const tree = useMemo(() => buildSearchTree(challenge, enabled), [challenge, enabled]);
  const baseline = useMemo(() => treeTotals(buildSearchTree(challenge, [])).tried, [challenge]);
  const totals = useMemo(() => treeTotals(tree), [tree]);
  const now = tick ?? tree.ticks;

  function restart() {
    setTick(null);
    setPlaying(false);
    setSelectedId(null);
  }

  // Replay: one solver step per beat, the whole run in about 20 seconds at most.
  useEffect(() => {
    if (!playing) return;
    const beat = Math.max(40, Math.min(350, 20_000 / tree.ticks));
    const timer = window.setInterval(() => {
      setTick((current) => {
        const next = (current ?? 0) + 1;
        if (next >= tree.ticks) {
          setPlaying(false);
          return null;
        }
        return next;
      });
    }, beat);
    return () => window.clearInterval(timer);
  }, [playing, tree.ticks]);

  const nodeWidth = challenge.boardCols * CELL + (challenge.boardCols - 1) * CELL_GAP + NODE_PADDING * 2;
  const nodeHeight = challenge.boardRows * CELL + (challenge.boardRows - 1) * CELL_GAP + NODE_PADDING * 2;
  const slotWidth = nodeWidth + SLOT_GAP;
  const levelHeight = nodeHeight + LEVEL_GAP;
  const width = tree.leafCount * slotWidth - SLOT_GAP + MARGIN * 2;
  const height = (tree.maxDepth + 1) * levelHeight - LEVEL_GAP + MARGIN * 2;
  const left = (node: SearchNode) => MARGIN + node.x * slotWidth;
  const top = (node: SearchNode) => MARGIN + node.depth * levelHeight;

  // Keep the interesting part in view: the newest board during a replay,
  // and where the run ended (between the root and it) once it is over.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let target = tree.nodes[0].x;
    if (tick === null) {
      const last = tree.nodes.reduce((a, b) => (b.closedAt === null && b.depth > a.depth ? b : a));
      target = (target + last.x) / 2;
    } else {
      let newest = tree.nodes[0];
      for (const node of tree.nodes) {
        if (node.placedAt <= tick && node.placedAt >= newest.placedAt) newest = node;
      }
      target = newest.x;
    }
    const centre = MARGIN + target * slotWidth + nodeWidth / 2;
    container.scrollLeft = centre - container.clientWidth / 2;
  }, [tick, tree, slotWidth, nodeWidth]);

  const visible = tree.nodes.filter((node) => isVisibleAt(node, now));
  const selected = selectedId !== null && selectedId < tree.nodes.length ? tree.nodes[selectedId] : null;
  const selectedShown = selected && isVisibleAt(selected, now) ? selected : null;

  function toggleCriterion(id: CriterionId) {
    setEnabled((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
    restart();
  }

  function describe(node: SearchNode): string {
    if (node.typeId === null) return t('learn.lab.detail.root');
    const status = statusAt(tree, node, now);
    const criterion = CRITERIA.find((c) => c.id === node.prunedBy);
    return t(`learn.lab.detail.${status}`, {
      n: node.id,
      piece: node.typeId,
      criterion: criterion ? t(`${criterion.i18nKey}.name`) : '',
    });
  }

  let comparison: string;
  if (enabled.length === 0) comparison = t('learn.lab.stats.baseline');
  else if (totals.tried === baseline) comparison = t('learn.lab.stats.same');
  else {
    const percent = Math.round((Math.abs(baseline - totals.tried) / baseline) * 100);
    comparison = t(totals.tried < baseline ? 'learn.lab.stats.fewer' : 'learn.lab.stats.more', {
      percent,
      base: baseline,
    });
  }

  return (
    <div className="tree-lab" data-testid="tree-lab">
      <h3>{t('learn.lab.title')}</h3>

      <div className="tree-lab__controls">
        <label className="tree-lab__field">
          <span>{t('learn.lab.challenge')}</span>
          <select
            data-testid="tree-lab-challenge"
            value={challengeId}
            onChange={(event) => {
              setChallengeId(Number(event.target.value));
              restart();
            }}
          >
            {challenges.map((c) => (
              <option key={c.id} value={c.id}>
                {challengeLabel(c)}
              </option>
            ))}
          </select>
        </label>
        {KINDS.map((kind) => (
          <fieldset key={kind} className="tree-lab__criteria">
            <legend>{t(`criteria.groups.${kind}.title`)}</legend>
            {CRITERIA.filter((criterion) => criterion.kind === kind).map((criterion) => (
              <label key={criterion.id} className="tree-lab__criterion">
                <input
                  type="checkbox"
                  data-testid={`tree-lab-criterion-${criterion.id}`}
                  checked={enabled.includes(criterion.id)}
                  onChange={() => toggleCriterion(criterion.id)}
                />
                {t(`${criterion.i18nKey}.name`)}
              </label>
            ))}
          </fieldset>
        ))}
      </div>

      <div className="tree-lab__summary">
        <dl className="tree-lab__stats">
        <div>
          <dt>{t('learn.lab.stats.tried')}</dt>
          <dd data-testid="tree-lab-tried">{totals.tried}</dd>
        </div>
        <div>
          <dt>{t('learn.lab.stats.deadEnds')}</dt>
          <dd>{totals.deadEnds}</dd>
        </div>
        <div>
          <dt>{t('learn.lab.stats.cuts')}</dt>
          <dd data-testid="tree-lab-cuts">{totals.cuts}</dd>
        </div>
        </dl>
        <p className="tree-lab__comparison" data-testid="tree-lab-comparison">
          {comparison}
        </p>
      </div>

      <div className="tree-lab__playback">
        <button
          type="button"
          className="btn-primary"
          data-testid="tree-lab-play"
          onClick={() => {
            if (playing) {
              setPlaying(false);
              return;
            }
            if (tick === null) setTick(0);
            setPlaying(true);
          }}
        >
          {playing ? t('learn.lab.pause') : t('learn.lab.play')}
        </button>
        <button type="button" onClick={restart} disabled={tick === null}>
          {t('learn.lab.showAll')}
        </button>
        <input
          type="range"
          aria-label={t('learn.lab.slider')}
          min={0}
          max={tree.ticks}
          value={now}
          onChange={(event) => {
            setPlaying(false);
            setTick(Number(event.target.value));
          }}
        />
        <span className="tree-lab__step" data-testid="tree-lab-step">
          {t('learn.lab.step', { current: now, total: tree.ticks })}
        </span>
      </div>

      <ul className="tree-lab__legend">
        {STATUSES.map((status) => (
          <li key={status}>
            <span className={`tree-lab__swatch tree-lab__swatch--${status}`} />
            {t(`learn.lab.legend.${status}`)}
          </li>
        ))}
      </ul>

      <div className="tree-lab__scroll" ref={scrollRef} role="group" aria-label={t('learn.lab.treeLabel')}>
        <div className="tree-lab__canvas" style={{ width, height }}>
          <svg className="tree-lab__edges" width={width} height={height} aria-hidden="true">
            {visible.map((node) => {
              if (node.parent === null) return null;
              const parent = tree.nodes[node.parent];
              const x1 = left(parent) + nodeWidth / 2;
              const y1 = top(parent) + nodeHeight;
              const x2 = left(node) + nodeWidth / 2;
              const y2 = top(node);
              const midY = (y1 + y2) / 2;
              return (
                <path
                  key={node.id}
                  className={`tree-edge tree-edge--${statusAt(tree, node, now)}`}
                  d={`M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`}
                />
              );
            })}
          </svg>
          {visible.map((node) => {
            const status = statusAt(tree, node, now);
            return (
              <button
                key={node.id}
                type="button"
                className={`tree-node tree-node--${status}${node.id === selectedId ? ' tree-node--selected' : ''}`}
                data-testid={`tree-node-${node.id}`}
                data-status={status}
                style={{ left: left(node), top: top(node) }}
                aria-pressed={node.id === selectedId}
                aria-label={
                  node.typeId === null
                    ? t('learn.lab.node.root')
                    : t('learn.lab.node.label', {
                        n: node.id,
                        piece: node.typeId,
                        status: t(`learn.lab.legend.${status}`),
                      })
                }
                onClick={() => setSelectedId(node.id === selectedId ? null : node.id)}
              >
                <MiniBoard board={node.board} cell={CELL} />
                {status !== 'open' && status !== 'solution' && (
                  <span className="tree-node__badge" aria-hidden="true">
                    {status === 'pruned' ? '✂' : '✕'}
                  </span>
                )}
                {status === 'solution' && node.children.length === 0 && (
                  <span className="tree-node__badge" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="tree-lab__detail" data-testid="tree-lab-detail" aria-live="polite">
        {selectedShown ? (
          <>
            <MiniBoard board={selectedShown.board} cell={18} label={t('learn.boardLabel')} />
            <p>{describe(selectedShown)}</p>
          </>
        ) : (
          <p className="tree-lab__hint">{t('learn.lab.scrollHint')}</p>
        )}
      </div>
    </div>
  );
}
