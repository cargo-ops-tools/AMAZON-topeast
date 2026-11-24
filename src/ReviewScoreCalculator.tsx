import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Beaker,
  Calculator,
  Check,
  Clipboard,
  Download,
  Info,
  RotateCcw,
  Star,
  Target,
} from "lucide-react";
import {
  EMPTY_STAR_COUNTS,
  STARS,
  calculateReviewScore,
  calculateReviewScoreScenario,
  type ReviewScoreInput,
  type Star as ScoreStar,
  type StarCounts,
} from "./lib/reviewScore";
import { numberInputValue } from "./lib/input";
import ListingScorePanel from "./ListingScorePanel";

type ScoreGroup = keyof ReviewScoreInput;

const SAMPLE_INPUT: ReviewScoreInput = {
  review: { 5: 15, 4: 5, 3: 0, 2: 0, 1: 1 },
  rating: { 5: 4, 4: 2, 3: 0, 2: 0, 1: 2 },
};

function emptyInput(): ReviewScoreInput {
  return {
    review: { ...EMPTY_STAR_COUNTS },
    rating: { ...EMPTY_STAR_COUNTS },
  };
}

function cloneCounts(counts: StarCounts): StarCounts {
  return { ...counts };
}

function normalizedInputValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function formatScore(value: number | null, digits = 2): string {
  return value === null ? "--" : value.toFixed(digits);
}

function formatPercent(value: number | null): string {
  return value === null ? "--" : `${(value * 100).toFixed(1)}%`;
}

function ReviewScoreCalculator() {
  const [input, setInput] = useState<ReviewScoreInput>(() => emptyInput());
  const [targetDisplayScore, setTargetDisplayScore] = useState(4.5);
  const [copied, setCopied] = useState(false);
  const [isSample, setIsSample] = useState(false);
  const result = useMemo(() => calculateReviewScore(input), [input]);
  const scenario = useMemo(
    () => calculateReviewScoreScenario(result, targetDisplayScore),
    [result, targetDisplayScore],
  );

  const updateCount = (group: ScoreGroup, star: ScoreStar, value: string) => {
    setInput((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [star]: normalizedInputValue(value),
      },
    }));
  };

  const applySample = () => {
    setInput({
      review: cloneCounts(SAMPLE_INPUT.review),
      rating: cloneCounts(SAMPLE_INPUT.rating),
    });
    setIsSample(true);
  };

  const clear = () => {
    setInput(emptyInput());
    setIsSample(false);
  };

  const copyResult = async () => {
    const text = [
      "【Review / Rating 星级推演】",
      `数据性质：${isSample ? "演示数据，不可用于决策" : "用户录入数据"}`,
      `经验显示分：${result.displayScore === null ? "—" : result.displayScore.toFixed(1)}`,
      `原始均分：${formatScore(result.rawScore, 4)}`,
      `总评分数：${result.totalCount}`,
      `5 星占比：${formatPercent(result.fiveStarShare)}`,
      `1–3 星占比：${formatPercent(result.lowStarShare)}`,
      `达到 ${scenario.targetDisplayScore.toFixed(1)} 分所需新增 5 星：${scenario.additionalFiveStarsNeeded ?? "—"}`,
      `掉档前可承受新增 1 星：${scenario.oneStarCapacityBeforeDrop ?? "—"}`,
      `超过承压数后的显示分：${scenario.nextLowerDisplayScore === null ? "—" : scenario.nextLowerDisplayScore.toFixed(1)}`,
      "说明：经验估算，不等同于 Amazon 官方评分算法。",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ["项目", "结果"],
      ["数据性质", isSample ? "演示数据，不可用于决策" : "用户录入数据"],
      ["经验显示分", result.displayScore ?? ""],
      ["原始均分", result.rawScore ?? ""],
      ["总评分数", result.totalCount],
      ["Review 数", result.review.count],
      ["仅点星 Rating 数", result.rating.count],
      ["5 星占比", result.fiveStarShare === null ? "" : `${(result.fiveStarShare * 100).toFixed(1)}%`],
      ["1-3 星占比", result.lowStarShare === null ? "" : `${(result.lowStarShare * 100).toFixed(1)}%`],
      [`达到 ${scenario.targetDisplayScore.toFixed(1)} 所需新增 5 星`, scenario.additionalFiveStarsNeeded ?? ""],
      ["掉档前可承受新增 1 星", scenario.oneStarCapacityBeforeDrop ?? ""],
      ["超过承压数后的显示分", scenario.nextLowerDisplayScore ?? ""],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "review-rating-scenario.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="review-score-main">
      <header className="topbar review-score-topbar">
        <div>
          <div className="eyebrow">板块六 · LISTING BUSINESS SCORE</div>
          <h1>链接经营评分</h1>
          <p>六维 100 分经营评分、S/A/B/C 链接规划与 Review/Rating 情景推演</p>
        </div>
        <div className="review-score-top-actions">
          <button className="rule-link" type="button" onClick={() => document.getElementById("listing-health")?.scrollIntoView({ behavior: "smooth" })}><Target size={15} /> 经营评分</button>
          <button className="rule-link" type="button" onClick={() => document.getElementById("review-rating")?.scrollIntoView({ behavior: "smooth" })}><Star size={15} /> Review 推演</button>
        </div>
      </header>

      <div className="review-score-page">
        <ListingScorePanel />

        <div className="review-tool-divider" id="review-rating">
          <div><span>REVIEW / RATING SCENARIO</span><h2>评价星级推演</h2><p>计算当前经验分、升档所需 5 星数与低星承压空间</p></div>
          <div><button type="button" onClick={applySample}><Beaker size={16} /> 填入示例</button><button type="button" onClick={clear}><RotateCcw size={16} /> 清空</button></div>
        </div>

        {isSample && (
          <div className="listing-sample-banner" role="status">
            <Info size={17} /> 当前 Review/Rating 区域包含演示数据；即使局部修改也不可用于真实链接判断，请清空后录入同一 ASIN 的可拆分数据。
          </div>
        )}

        <section className="review-score-hero" aria-live="polite">
          <div className="review-score-primary">
            <span>预计亚马逊前台显示</span>
            <strong>{result.displayScore === null ? "--" : result.displayScore.toFixed(1)}<small> / 5.0</small></strong>
            <p>运营经验估算值，非 Amazon 官方计算结果</p>
          </div>
          <div className="review-score-hero-grid">
            <div><small>原始加权均分</small><b>{formatScore(result.rawScore, 4)}</b></div>
            <div><small>总评分数</small><b>{result.totalCount || "--"}</b></div>
            <div><small>Review 数量</small><b>{result.review.count || "--"}</b></div>
            <div><small>Rating 数量</small><b>{result.rating.count || "--"}</b></div>
          </div>
        </section>

        <div className="review-score-workspace">
          <section className="review-score-panel review-score-input" aria-labelledby="review-score-input-title">
            <div className="review-score-heading">
              <Calculator size={18} />
              <div>
                <h2 id="review-score-input-title">星级数量录入</h2>
                <p>Review 为文字评论；Rating 仅填“不含文字 Review”的点星记录，避免重复计算</p>
              </div>
            </div>

            <div className="score-input-table">
              <div className="score-input-head">
                <span>星级</span>
                <span>Review</span>
                <span>仅点星 Rating</span>
              </div>
              {STARS.map((star) => (
                <div className="score-input-row" key={star}>
                  <span className="score-star-label"><Star size={14} fill="currentColor" /> {star} 星</span>
                  <label>
                    <span className="sr-only">{star} 星 Review 数量</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={numberInputValue(input.review[star])}
                      onChange={(event) => updateCount("review", star, event.target.value)}
                      placeholder="0"
                    />
                  </label>
                  <label>
                    <span className="sr-only">{star} 星仅点星 Rating 数量</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={numberInputValue(input.rating[star])}
                      onChange={(event) => updateCount("rating", star, event.target.value)}
                      placeholder="0"
                    />
                  </label>
                </div>
              ))}
            </div>

            <div className="score-input-actions">
              <button type="button" onClick={applySample}><Beaker size={15} /> 示例：29 个评分 / 4.3</button>
              <button type="button" onClick={clear}><RotateCcw size={15} /> 清空</button>
            </div>
          </section>

          <div className="review-score-results">
            <section className="review-score-panel" aria-labelledby="score-overview-title">
              <div className="review-score-heading review-result-heading">
                <BarChart3 size={18} />
                <div>
                  <h2 id="score-overview-title">计算结果</h2>
                  <p>每条星级记录等权合并，不额外放大 Review 权重</p>
                </div>
                <div className="review-result-actions" aria-live="polite">
                  <button type="button" onClick={copyResult} disabled={!result.totalCount}>{copied ? <Check size={15} /> : <Clipboard size={15} />}{copied ? "已复制" : "复制"}</button>
                  <button type="button" onClick={exportCsv} disabled={!result.totalCount}><Download size={15} /> CSV</button>
                </div>
              </div>

              <div className="review-score-metrics">
                <div><span>总评分数</span><strong>{result.totalCount || "--"}</strong></div>
                <div><span>总星分</span><strong>{result.totalCount ? result.totalPoints : "--"}</strong></div>
                <div><span>Review 平均</span><strong>{formatScore(result.review.average)}</strong></div>
                <div><span>Rating 平均</span><strong>{formatScore(result.rating.average)}</strong></div>
                <div><span>5 星占比</span><strong>{formatPercent(result.fiveStarShare)}</strong></div>
                <div><span>1-3 星占比</span><strong>{formatPercent(result.lowStarShare)}</strong></div>
              </div>

              <div className="review-score-formula">
                <div>
                  <span>基础公式</span>
                  <b>(Review 总星分 + Rating 总星分) ÷ (Review 数量 + Rating 数量)</b>
                </div>
                <strong>{result.totalCount ? `${result.totalPoints} ÷ ${result.totalCount} = ${formatScore(result.rawScore, 4)}` : "等待录入数据"}</strong>
              </div>

              <div className="review-scenario-block">
                <div className="review-scenario-heading">
                  <div><span>情景目标</span><strong>升档与低星承压</strong></div>
                  <label>
                    <span>目标显示分</span>
                    <select value={targetDisplayScore} onChange={(event) => setTargetDisplayScore(Number(event.target.value))}>
                      {[4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5].map((score) => <option key={score} value={score}>{score.toFixed(1)}</option>)}
                    </select>
                  </label>
                </div>
                <div className="review-scenario-metrics">
                  <div><span>达到 {scenario.targetDisplayScore.toFixed(1)} 需新增 5 星</span><strong>{scenario.additionalFiveStarsNeeded ?? "—"}<small> 个</small></strong></div>
                  <div><span>当前分数掉档前可承受 1 星</span><strong>{scenario.oneStarCapacityBeforeDrop ?? "—"}<small> 个</small></strong></div>
                  <div><span>超过承压数后的显示分</span><strong>{scenario.nextLowerDisplayScore === null ? "—" : scenario.nextLowerDisplayScore.toFixed(1)}</strong></div>
                </div>
              </div>
            </section>

            <section className="review-score-panel" aria-labelledby="score-distribution-title">
              <div className="review-score-heading compact">
                <Star size={18} />
                <div>
                  <h2 id="score-distribution-title">合并星级分布</h2>
                  <p>Review 与 Rating 合并后的结构占比</p>
                </div>
              </div>
              <div className="review-score-distribution">
                {STARS.map((star) => {
                  const count = result.combinedCounts[star];
                  const share = result.totalCount > 0 ? count / result.totalCount : 0;
                  return (
                    <div className="distribution-row" key={star}>
                      <span>{star} 星</span>
                      <div><i style={{ width: `${share * 100}%` }} /></div>
                      <b>{count}</b>
                      <small>{(share * 100).toFixed(1)}%</small>
                    </div>
                  );
                })}
              </div>
            </section>

            {result.isBoundary && result.rawScore !== null && (
              <div className="review-score-alert boundary">
                <AlertTriangle size={17} />
                <div><b>当前结果接近一位小数临界点</b><span>少量新增评分可能改变前台显示分，建议结合未来评价结构做情景测算。</span></div>
              </div>
            )}

            <div className="review-score-alert">
              <Info size={17} />
              <div>
                <b>估算口径说明</b>
                <span>Amazon 未公开完整评分权重。前台总 Rating 可能已包含文字 Review，只有能拆分两组数据时才分别录入。结果还可能受可信度、时间衰减、异常评价过滤、变体合并及同步延迟影响，本工具适合运营预判，不用于反推官方精确算法。</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default ReviewScoreCalculator;
