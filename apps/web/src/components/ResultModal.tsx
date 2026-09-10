import { teamOfSeat, type RoomStateView } from '@shengji/shared';
import CardFace from './CardFace';
import { rankText } from '../lib/format';

type Props = {
  view: RoomStateView;
  autoContinueSeconds?: number | null;
  onNextRound: () => void;
  onDismiss: () => void;
};

// 结算弹窗：闲家得分 / 底牌明细 / 扣底 / 升级结果 / 下局庄家
export default function ResultModal({ view, autoContinueSeconds = null, onNextRound, onDismiss }: Props) {
  const r = view.roundResult;
  if (!r) return null;
  const winnerText = r.winnerTeam === 0 ? '蓝队（0/2 号位）' : '红队（1/3 号位）';
  const nextDealer = view.seats[r.nextDealerSeat];
  const throwDelta = r.throwPenaltyDelta ?? 0;
  const throwPenaltyPoints = r.throwPenaltyPoints ?? [0, 0];
  const hasThrowPenaltyLedger = throwPenaltyPoints.some((points) => points > 0);
  const defenderPointsBeforeThrow = r.baseDefenderPoints ?? r.defenderPoints - throwDelta;
  const trickDefenderPoints = Math.max(0, defenderPointsBeforeThrow - r.kittyBonus);
  const dealerTeam = view.dealerSeat === null ? 0 : teamOfSeat(view.dealerSeat);
  const outcomeText =
    r.defenderPoints <= 0
      ? '大光，庄家方升 3 级'
      : r.defenderPoints < 40
        ? '小光，庄家方升 2 级'
        : r.defenderPoints < 80
          ? '庄家方升 1 级'
          : r.defenderPoints < 120
            ? '闲家上台'
            : r.defenderPoints < 160
              ? '闲家上台并升 1 级'
              : r.defenderPoints < 200
                ? '闲家上台并升 2 级'
                : '闲家升 3 级';
  const defenderWonLastTrick =
    view.lastTrickWinnerSeat !== null && view.dealerSeat !== null && teamOfSeat(view.lastTrickWinnerSeat) !== dealerTeam;
  const kittyExplanation =
    r.kittyBonus > 0
      ? `闲家扣底 +${r.kittyBonus}`
      : defenderWonLastTrick
        ? '闲家扣底成功，但底牌无分'
        : '庄家守住底牌 (无扣底)';
  const levelChangeText = ([0, 1] as const)
    .map((team) => {
      const teamName = team === 0 ? '蓝队' : '红队';
      const before = rankText(view.teamLevels[team]);
      const after = rankText(r.nextLevels[team]);
      return before === after ? `${teamName} ${before}` : `${teamName} ${before} → ${after}`;
    })
    .join(' / ');
  return (
    <div className="modal-mask">
      <div className="modal">
        <h3>本局结算</h3>
        <div className="result-outcome">{outcomeText}</div>
        <div className="result-row">
          <span>闲家基础得分</span>
          <b className="points">{trickDefenderPoints}</b>
        </div>
        <div className="result-row">
          <span>扣底说明</span>
          <b className="points">{kittyExplanation}</b>
        </div>
        <div className="result-row">
          <span>闲家总分</span>
          <b className="points">{r.defenderPoints}</b>
        </div>
        {(hasThrowPenaltyLedger || throwDelta !== 0 || defenderPointsBeforeThrow !== r.defenderPoints) && (
          <>
            <div className="result-row">
              <span>甩牌惩罚</span>
              <b className="points">
                蓝队 {throwPenaltyPoints[0]} / 红队 {throwPenaltyPoints[1]}，净 {throwDelta > 0 ? '+' : ''}
                {throwDelta}
              </b>
            </div>
          </>
        )}
        <div className="result-row kitty-row">
          <span>底牌</span>
          <div className="kitty-cards">
            {r.kittyCards.map((card) => (
              <CardFace key={card.id} card={card} small />
            ))}
          </div>
        </div>
        <div className="result-row">
          <span>获胜方</span>
          <b>{r.levelDelta === 0 ? `${winnerText} 换庄，不升级` : `${winnerText} 升 ${r.levelDelta} 级`}</b>
        </div>
        <div className="result-row">
          <span>队伍升级</span>
          <b>{levelChangeText}</b>
        </div>
        <div className="result-row">
          <span>下局庄家</span>
          <b>{nextDealer?.nickname ?? `座位 ${r.nextDealerSeat}`}</b>
        </div>
        <div className="modal-actions">
          <button onClick={onDismiss}>查看牌桌</button>
          {view.yourSeat !== null && (
            <button className="primary" onClick={onNextRound}>
              下一局
            </button>
          )}
        </div>
        {autoContinueSeconds !== null && (
          <div className="auto-continue-status" role="status" aria-live="polite">
            {autoContinueSeconds} 秒后自动继续
          </div>
        )}
      </div>
    </div>
  );
}
