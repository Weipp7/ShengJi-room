import type { RoomStateView } from '@shengji/shared';
import CardFace from './CardFace';
import { rankText } from '../lib/format';

type Props = {
  view: RoomStateView;
  onNextRound: () => void;
  onDismiss: () => void;
};

// 结算弹窗：闲家得分 / 底牌明细 / 扣底 / 升级结果 / 下局庄家
export default function ResultModal({ view, onNextRound, onDismiss }: Props) {
  const r = view.roundResult;
  if (!r) return null;
  const winnerText = r.winnerTeam === 0 ? '蓝队（0/2 号位）' : '红队（1/3 号位）';
  const nextDealer = view.seats[r.nextDealerSeat];
  return (
    <div className="modal-mask">
      <div className="modal">
        <h3>本局结算</h3>
        <div className="result-row">
          <span>闲家总分</span>
          <b className="points">{r.defenderPoints}</b>
        </div>
        {r.kittyBonus > 0 && (
          <div className="result-row">
            <span>其中扣底</span>
            <b className="points">+{r.kittyBonus}</b>
          </div>
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
          <b>
            {winnerText} 升 {r.levelDelta} 级
          </b>
        </div>
        <div className="result-row">
          <span>下局级牌</span>
          <b>
            <span className="team-0-text">{rankText(r.nextLevels[0])}</span>/
            <span className="team-1-text">{rankText(r.nextLevels[1])}</span>
          </b>
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
      </div>
    </div>
  );
}
