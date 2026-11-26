import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Check,
  Clipboard,
  Download,
  Info,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";
import {
  EMPTY_LISTING_SCORE_INPUT,
  calculateListingScore,
  type IpTroRisk,
  type ListingScoreDimensionKey,
  type ListingScoreInput,
} from "./lib/listingScore";

const SAMPLE_INPUT: ListingScoreInput = {
  content: {
    titleKeywordCoverage: 86,
    bulletCompleteness: 90,
    imageCount: 7,
    hasVideo: true,
    hasAPlus: true,
  },
  traffic: {
    ctr: 0.42,
    categoryCtr: 0.38,
    organicTop10Keywords: 22,
    competitorMedianOrganicTop10Keywords: 30,
    bsrChange30d: -8,
  },
  conversion: {
    cvr: 12.5,
    categoryCvr: 11,
    returnRate: 7,
    categoryReturnRate: 6,
  },
  review: {
    reviewCount: 286,
    competitorMedianReviewCount: 350,
    rating: 4.4,
    categoryRating: 4.35,
    lowStarRate: 10,
  },
  profitAds: {
    monthlyProfit: 2800,
    profitMargin: 18,
    actualTacos: 12,
    breakEvenTacos: 18,
    actualCpc: 1.05,
    maxSafeCpc: 1.28,
  },
  risk: {
    stockCoverageDays: 55,
    listingSuppressed: false,
    ipTroRisk: "low",
  },
};

const DIMENSION_ORDER: ListingScoreDimensionKey[] = [
  "content",
  "traffic",
  "conversion",
  "review",
  "profitAds",
  "risk",
];

const GRADE_PLAN = {
  S: "规模化增长：保护核心 Keyword 与自然排名，在利润安全线内扩大预算。",
  A: "重点优化：先补 1–2 个短板，再逐步放量并监控 TACoS。",
  B: "修复后放量：优先改善内容、转化或 Review，再增加广告预算。",
  C: "暂停扩量：先处理红线、负利润、合规或核心数据缺口。",
} as const;

const GRADE_GUIDE = [
  {
    grade: "S",
    title: "核心增长链接",
    rule: "总分 ≥ 85；数据完整度 ≥ 90%；链接抑制与 IP/TRO 风险均已确认；无红线。",
    action: GRADE_PLAN.S,
  },
  {
    grade: "A",
    title: "重点运营链接",
    rule: "总分 ≥ 75；数据完整度 ≥ 80%；无红线。",
    action: GRADE_PLAN.A,
  },
  {
    grade: "B",
    title: "修复观察链接",
    rule: "总分 ≥ 60；无红线。数据完整度不足时，即使分数较高也可能暂定为 B。",
    action: GRADE_PLAN.B,
  },
  {
    grade: "C",
    title: "暂停扩量链接",
    rule: "总分 < 60，或触发利润为负、链接抑制、高 IP/TRO 风险任一红线。",
    action: GRADE_PLAN.C,
  },
] as const;

function cloneEmptyInput(): ListingScoreInput {
  return {
    content: { ...EMPTY_LISTING_SCORE_INPUT.content },
    traffic: { ...EMPTY_LISTING_SCORE_INPUT.traffic },
    conversion: { ...EMPTY_LISTING_SCORE_INPUT.conversion },
    review: { ...EMPTY_LISTING_SCORE_INPUT.review },
    profitAds: { ...EMPTY_LISTING_SCORE_INPUT.profitAds },
    risk: { ...EMPTY_LISTING_SCORE_INPUT.risk },
  };
}

function cloneInput(input: ListingScoreInput): ListingScoreInput {
  return {
    content: { ...input.content },
    traffic: { ...input.traffic },
    conversion: { ...input.conversion },
    review: { ...input.review },
    profitAds: { ...input.profitAds },
    risk: { ...input.risk },
  };
}

function optionalNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatScore(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

function NumericField({
  label,
  value,
  onChange,
  hint,
  min,
  max,
  step = "any",
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  hint?: string;
  min?: number;
  max?: number;
  step?: number | "any";
}) {
  return (
    <label className="listing-score-field">
      <span>{label}</span>
      <input
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(optionalNumber(event.target.value))}
        placeholder="待录入"
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}

function BooleanField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  hint?: string;
}) {
  return (
    <label className="listing-score-field">
      <span>{label}</span>
      <select
        value={value === null ? "" : value ? "yes" : "no"}
        onChange={(event) => onChange(event.target.value === "" ? null : event.target.value === "yes")}
      >
        <option value="">待确认</option>
        <option value="yes">是</option>
        <option value="no">否</option>
      </select>
      {hint && <small>{hint}</small>}
    </label>
  );
}

function ListingScorePanel() {
  const [asin, setAsin] = useState("");
  const [input, setInput] = useState<ListingScoreInput>(cloneEmptyInput);
  const [copied, setCopied] = useState(false);
  const [isSample, setIsSample] = useState(false);
  const result = useMemo(() => calculateListingScore(input), [input]);
  const hasData = result.dataCompleteness > 0;

  const updateField = <
    Group extends keyof ListingScoreInput,
    Field extends keyof ListingScoreInput[Group],
  >(group: Group, field: Field, value: ListingScoreInput[Group][Field]) => {
    setInput((current) => ({
      ...current,
      [group]: { ...current[group], [field]: value },
    }));
  };

  const loadSample = () => {
    setAsin("示例 ASIN");
    setInput(cloneInput(SAMPLE_INPUT));
    setIsSample(true);
  };

  const clear = () => {
    setAsin("");
    setInput(cloneEmptyInput());
    setIsSample(false);
  };

  const resultText = () => [
    "【链接经营评分】",
    `ASIN/备注：${asin || "未填写"}`,
    `数据性质：${isSample ? "演示数据，不可用于决策" : "用户录入数据"}`,
    `综合得分：${hasData ? result.totalScore.toFixed(1) : "—"}/100`,
    `链接等级：${hasData ? result.grade : "—"}`,
    `数据完整度：${result.dataCompleteness.toFixed(1)}%`,
    ...DIMENSION_ORDER.map((key) => `${result.dimensions[key].label}：${formatScore(result.dimensions[key].score)} / 100`),
    `红线：${result.redlines.length ? result.redlines.map((item) => item.message).join("；") : "未发现已录入数据中的红线"}`,
    "优先动作：",
    ...result.priorityActions.map((action, index) => `${index + 1}. ${action}`),
    "说明：得分基于已完成字段标准化，必须结合数据完整度判断；缺失数据不按 0 分处理。",
  ].join("\n");

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(resultText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ["项目", "结果", "权重/说明"],
      ["ASIN/备注", asin || "未填写", ""],
      ["数据性质", isSample ? "演示数据，不可用于决策" : "用户录入数据", ""],
      ["综合得分", hasData ? result.totalScore.toFixed(1) : "", "100"],
      ["等级", hasData ? result.grade : "", GRADE_PLAN[result.grade]],
      ["数据完整度", result.dataCompleteness.toFixed(1), "%"],
      ...DIMENSION_ORDER.map((key) => [
        result.dimensions[key].label,
        result.dimensions[key].score === null ? "" : result.dimensions[key].score.toFixed(1),
        String(result.dimensions[key].weight),
      ]),
      ...result.redlines.map((item) => ["红线", item.message, item.code]),
      ...result.priorityActions.map((action, index) => [`优先动作 ${index + 1}`, action, ""]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `listing-score-${asin.trim() || "result"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="listing-score-section" id="listing-health" aria-labelledby="listing-score-title">
      <div className="listing-score-toolbar">
        <div>
          <span>LINK BUSINESS SCORE · V1</span>
          <h2 id="listing-score-title">链接经营评分</h2>
          <p>用相对类目/竞品基准评估内容、流量、转化、Review、利润广告和风险</p>
        </div>
        <div>
          <button type="button" onClick={loadSample}><Sparkles size={16} /> 填入示例</button>
          <button type="button" onClick={clear}><RotateCcw size={16} /> 清空</button>
        </div>
      </div>

      <details className="listing-grade-guide">
        <summary>
          <span className="listing-grade-guide-title">
            <Info size={18} />
            <span><b>S/A/B/C 评级说明</b><small>查看等级门槛、经营含义与强制降级红线</small></span>
          </span>
          <span className="listing-grade-guide-toggle"><span className="when-closed">展开说明</span><span className="when-open">收起说明</span></span>
        </summary>
        <div className="listing-grade-guide-body">
          <p className="listing-grade-guide-intro">总分按已填写指标加权标准化；空白字段不按 0 分处理，但会降低数据完整度。评级顺序为：先检查红线，再看完整度，最后看总分。</p>
          <div className="listing-grade-guide-grid">
            {GRADE_GUIDE.map((item) => (
              <article className={`listing-grade-guide-card guide-grade-${item.grade.toLowerCase()}`} key={item.grade}>
                <div><strong>{item.grade}</strong><span>{item.title}</span></div>
                <p><b>评级条件</b>{item.rule}</p>
                <p><b>经营动作</b>{item.action}</p>
              </article>
            ))}
          </div>
          <div className="listing-grade-redline-note">
            <ShieldAlert size={18} />
            <div><strong>强制降为 C 的红线</strong><p>月利润或利润率为负、Listing 被抑制，或侵权 / TRO 风险为“高”。即使综合得分达到 S/A，也优先按 C 处理。</p></div>
          </div>
        </div>
      </details>

      {isSample && (
        <div className="listing-sample-banner" role="status">
          <Info size={17} /> 当前包含演示数据；即使局部修改也不可直接用于决策。请清空后录入同一 ASIN、同一观察窗口的真实数据。
        </div>
      )}

      <section className="listing-score-hero" aria-live="polite">
        <div className="listing-score-primary">
          <span>综合经营评分</span>
          <strong>{hasData ? result.totalScore.toFixed(1) : "—"}<small> / 100</small></strong>
          <div className={`listing-grade grade-${hasData ? result.grade.toLowerCase() : "empty"}`}>
            {hasData ? `${result.grade} 级链接` : "等待录入"}
          </div>
          <p>{hasData ? GRADE_PLAN[result.grade] : "至少录入一个有效指标后生成初步结果。"}</p>
        </div>
        <div className="listing-dimension-grid">
          {DIMENSION_ORDER.map((key) => {
            const dimension = result.dimensions[key];
            return (
              <div key={key}>
                <span>{dimension.label}<b>{dimension.weight} 分</b></span>
                <strong>{formatScore(dimension.score)}</strong>
                <div><i style={{ width: `${dimension.score ?? 0}%` }} /></div>
                <small>完整度 {dimension.completeness.toFixed(0)}%</small>
              </div>
            );
          })}
        </div>
        <div className="listing-completeness">
          <span>数据完整度</span>
          <strong>{result.dataCompleteness.toFixed(1)}%</strong>
          <div><i style={{ width: `${result.dataCompleteness}%` }} /></div>
          <small>缺失字段不按 0 分；S 级还要求链接抑制与 IP/TRO 风险均已确认。</small>
        </div>
      </section>

      <div className="listing-score-workspace">
        <section className="listing-input-card" aria-label="链接评分输入">
          <div className="listing-card-heading">
            <Target size={19} />
            <div><h3>数据录入</h3><p>百分比字段按页面标注录入，成对基准必须同单位、同窗口。</p></div>
          </div>
          <div className="listing-input-body">
            <label className="listing-score-field listing-asin-field">
              <span>ASIN 或备注</span>
              <input value={asin} onChange={(event) => setAsin(event.target.value)} placeholder="例如 B0XXXXXXX" />
            </label>

            <details open>
              <summary>内容完整度 <b>20 分</b></summary>
              <div className="listing-field-grid">
                <NumericField label="Title Keyword 覆盖率 %" value={input.content.titleKeywordCoverage} onChange={(value) => updateField("content", "titleKeywordCoverage", value)} min={0} max={100} />
                <NumericField label="Bullet 完整度 %" value={input.content.bulletCompleteness} onChange={(value) => updateField("content", "bulletCompleteness", value)} min={0} max={100} />
                <NumericField label="有效图片数" value={input.content.imageCount} onChange={(value) => updateField("content", "imageCount", value)} min={0} step={1} hint="7 张及以上得满分" />
                <BooleanField label="是否有 Video" value={input.content.hasVideo} onChange={(value) => updateField("content", "hasVideo", value)} />
                <BooleanField label="是否有 A+" value={input.content.hasAPlus} onChange={(value) => updateField("content", "hasAPlus", value)} />
              </div>
            </details>

            <details>
              <summary>流量与 Keyword <b>20 分</b></summary>
              <div className="listing-field-grid">
                <NumericField label="CTR %" value={input.traffic.ctr} onChange={(value) => updateField("traffic", "ctr", value)} min={0} max={100} hint="例：0.42 表示 0.42%" />
                <NumericField label="类目 CTR 基准 %" value={input.traffic.categoryCtr} onChange={(value) => updateField("traffic", "categoryCtr", value)} min={0} max={100} />
                <NumericField label="Organic Top 10 Keyword 数" value={input.traffic.organicTop10Keywords} onChange={(value) => updateField("traffic", "organicTop10Keywords", value)} min={0} step={1} />
                <NumericField label="竞品中位 Top 10 数" value={input.traffic.competitorMedianOrganicTop10Keywords} onChange={(value) => updateField("traffic", "competitorMedianOrganicTop10Keywords", value)} min={0} step={1} />
                <NumericField label="BSR 30 天变化 %" value={input.traffic.bsrChange30d} onChange={(value) => updateField("traffic", "bsrChange30d", value)} hint="负数代表排名改善" />
              </div>
            </details>

            <details>
              <summary>转化竞争力 <b>20 分</b></summary>
              <div className="listing-field-grid">
                <NumericField label="CVR / Unit Session %" value={input.conversion.cvr} onChange={(value) => updateField("conversion", "cvr", value)} min={0} max={100} />
                <NumericField label="类目 CVR 基准 %" value={input.conversion.categoryCvr} onChange={(value) => updateField("conversion", "categoryCvr", value)} min={0} max={100} />
                <NumericField label="退货率 %" value={input.conversion.returnRate} onChange={(value) => updateField("conversion", "returnRate", value)} min={0} max={100} />
                <NumericField label="类目退货率基准 %" value={input.conversion.categoryReturnRate} onChange={(value) => updateField("conversion", "categoryReturnRate", value)} min={0} max={100} />
              </div>
            </details>

            <details>
              <summary>Review 健康度 <b>20 分</b></summary>
              <div className="listing-field-grid">
                <NumericField label="Review 数" value={input.review.reviewCount} onChange={(value) => updateField("review", "reviewCount", value)} min={0} step={1} />
                <NumericField label="竞品中位 Review 数" value={input.review.competitorMedianReviewCount} onChange={(value) => updateField("review", "competitorMedianReviewCount", value)} min={0} step={1} />
                <NumericField label="前台 Rating" value={input.review.rating} onChange={(value) => updateField("review", "rating", value)} min={1} max={5} step={0.1} />
                <NumericField label="类目 Rating 基准" value={input.review.categoryRating} onChange={(value) => updateField("review", "categoryRating", value)} min={1} max={5} step={0.1} />
                <NumericField label="1–3 星占比 %" value={input.review.lowStarRate} onChange={(value) => updateField("review", "lowStarRate", value)} min={0} max={100} />
              </div>
            </details>

            <details>
              <summary>利润与广告承载力 <b>15 分</b></summary>
              <div className="listing-field-grid">
                <NumericField label="月利润" value={input.profitAds.monthlyProfit} onChange={(value) => updateField("profitAds", "monthlyProfit", value)} hint="仅用于负利润红线" />
                <NumericField label="利润率 %" value={input.profitAds.profitMargin} onChange={(value) => updateField("profitAds", "profitMargin", value)} />
                <NumericField label="实际 TACoS %" value={input.profitAds.actualTacos} onChange={(value) => updateField("profitAds", "actualTacos", value)} min={0} />
                <NumericField label="Break-even TACoS %" value={input.profitAds.breakEvenTacos} onChange={(value) => updateField("profitAds", "breakEvenTacos", value)} min={0} />
                <NumericField label="实际 CPC" value={input.profitAds.actualCpc} onChange={(value) => updateField("profitAds", "actualCpc", value)} min={0} />
                <NumericField label="最大安全 CPC" value={input.profitAds.maxSafeCpc} onChange={(value) => updateField("profitAds", "maxSafeCpc", value)} min={0} />
              </div>
            </details>

            <details>
              <summary>风险与合规 <b>5 分</b></summary>
              <div className="listing-field-grid">
                <NumericField label="库存覆盖天数" value={input.risk.stockCoverageDays} onChange={(value) => updateField("risk", "stockCoverageDays", value)} min={0} />
                <BooleanField label="链接是否被抑制" value={input.risk.listingSuppressed} onChange={(value) => updateField("risk", "listingSuppressed", value)} />
                <label className="listing-score-field">
                  <span>侵权 / TRO 风险</span>
                  <select value={input.risk.ipTroRisk ?? ""} onChange={(event) => updateField("risk", "ipTroRisk", (event.target.value || null) as IpTroRisk | null)}>
                    <option value="">待排查</option>
                    <option value="none">无已知风险</option>
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                  </select>
                </label>
              </div>
            </details>
          </div>
        </section>

        <section className="listing-result-card" aria-label="链接评分结果">
          <div className="listing-card-heading listing-result-heading">
            <BarChart3 size={19} />
            <div><h3>经营判断与动作</h3><p>先看红线，再看完整度和主要扣分项。</p></div>
            <div className="listing-result-actions" aria-live="polite">
              <button type="button" onClick={copyResult} disabled={!hasData}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? "已复制" : "复制"}</button>
              <button type="button" onClick={exportCsv} disabled={!hasData}><Download size={16} /> CSV</button>
            </div>
          </div>

          {result.redlines.length > 0 && (
            <div className="listing-redlines">
              <strong><ShieldAlert size={18} /> 触发经营红线</strong>
              {result.redlines.map((item) => <p key={item.code}>{item.message}</p>)}
            </div>
          )}

          {result.invalidFields.length > 0 && (
            <div className="listing-invalid-alert">
              <AlertTriangle size={17} /> 有 {result.invalidFields.length} 个字段超出可计算范围，已按缺失处理：{result.invalidFields.join("、")}
            </div>
          )}

          <div className="listing-decision-summary">
            <div><span>当前判断</span><strong>{hasData ? `${result.grade} 级 · ${result.totalScore.toFixed(1)} 分` : "等待数据"}</strong></div>
            <div><span>数据可信度</span><strong>{result.dataCompleteness >= 90 ? "完整" : result.dataCompleteness >= 70 ? "参考级" : "待补数据"}</strong></div>
            <div><span>已识别红线</span><strong>{result.redlines.length} 项</strong></div>
          </div>

          <div className="listing-action-list">
            <h4>优先动作</h4>
            {result.priorityActions.map((action, index) => (
              <div key={`${action}-${index}`}><span>{index + 1}</span><p>{action}</p></div>
            ))}
          </div>

          <div className="listing-method-note">
            <Info size={17} />
            <div>
              <strong>评分边界</strong>
              <p>这是透明的经营评分模型，不是 Amazon 官方 Listing Quality Dashboard。总分按已完成字段标准化；跨类目比较前，必须先换成同类目、同价格带、同生命周期的基准。</p>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

export default ListingScorePanel;
