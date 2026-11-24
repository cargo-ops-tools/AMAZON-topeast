export const LISTING_SCORE_DIMENSION_WEIGHTS = {
  content: 20,
  traffic: 20,
  conversion: 20,
  review: 20,
  profitAds: 15,
  risk: 5,
} as const;

export type ListingScoreDimensionKey = keyof typeof LISTING_SCORE_DIMENSION_WEIGHTS;
export type ListingScoreGrade = "S" | "A" | "B" | "C";
export type IpTroRisk = "none" | "low" | "medium" | "high";

export interface ListingScoreInput {
  content: {
    /** 0-100，Title 对目标 Keyword 的覆盖率。 */
    titleKeywordCoverage: number | null;
    /** 0-100，已完成的有效 Bullet 占比。 */
    bulletCompleteness: number | null;
    imageCount: number | null;
    hasVideo: boolean | null;
    hasAPlus: boolean | null;
  };
  traffic: {
    /** CTR 与 categoryCtr 必须使用相同单位，例如都填百分数 0.45。 */
    ctr: number | null;
    categoryCtr: number | null;
    organicTop10Keywords: number | null;
    competitorMedianOrganicTop10Keywords: number | null;
    /** 百分点；负数代表 BSR 改善，正数代表 BSR 变差。 */
    bsrChange30d: number | null;
  };
  conversion: {
    /** CVR 与 categoryCvr 必须使用相同单位。 */
    cvr: number | null;
    categoryCvr: number | null;
    /** 退货率与类目退货率必须使用相同单位。 */
    returnRate: number | null;
    categoryReturnRate: number | null;
  };
  review: {
    reviewCount: number | null;
    competitorMedianReviewCount: number | null;
    /** 1-5。 */
    rating: number | null;
    /** 1-5。 */
    categoryRating: number | null;
    /** 1-3 星占全部 Rating 的百分比，填 0-100。 */
    lowStarRate: number | null;
  };
  profitAds: {
    /** 仅用于识别负利润红线；不同币种均可。 */
    monthlyProfit: number | null;
    /** 百分点，可为负数。 */
    profitMargin: number | null;
    /** actualTacos 与 breakEvenTacos 必须使用相同单位。 */
    actualTacos: number | null;
    breakEvenTacos: number | null;
    /** actualCpc 与 maxSafeCpc 必须使用相同币种。 */
    actualCpc: number | null;
    maxSafeCpc: number | null;
  };
  risk: {
    stockCoverageDays: number | null;
    listingSuppressed: boolean | null;
    ipTroRisk: IpTroRisk | null;
  };
}

export const EMPTY_LISTING_SCORE_INPUT: ListingScoreInput = {
  content: {
    titleKeywordCoverage: null,
    bulletCompleteness: null,
    imageCount: null,
    hasVideo: null,
    hasAPlus: null,
  },
  traffic: {
    ctr: null,
    categoryCtr: null,
    organicTop10Keywords: null,
    competitorMedianOrganicTop10Keywords: null,
    bsrChange30d: null,
  },
  conversion: {
    cvr: null,
    categoryCvr: null,
    returnRate: null,
    categoryReturnRate: null,
  },
  review: {
    reviewCount: null,
    competitorMedianReviewCount: null,
    rating: null,
    categoryRating: null,
    lowStarRate: null,
  },
  profitAds: {
    monthlyProfit: null,
    profitMargin: null,
    actualTacos: null,
    breakEvenTacos: null,
    actualCpc: null,
    maxSafeCpc: null,
  },
  risk: {
    stockCoverageDays: null,
    listingSuppressed: null,
    ipTroRisk: null,
  },
};

export interface ListingScoreDimensionResult {
  label: string;
  weight: number;
  completedWeight: number;
  completeness: number;
  /** 本维度没有任何有效指标时为 null。 */
  score: number | null;
}

export interface ListingScoreRedline {
  code: "NEGATIVE_PROFIT" | "LISTING_SUPPRESSED" | "HIGH_IP_TRO_RISK";
  message: string;
}

export interface ListingScoreResult {
  /** 基于已完成指标权重标准化后的 0-100 分。 */
  totalScore: number;
  /** 已完成指标权重占总权重的百分比。 */
  dataCompleteness: number;
  dimensions: Record<ListingScoreDimensionKey, ListingScoreDimensionResult>;
  grade: ListingScoreGrade;
  redlines: ListingScoreRedline[];
  priorityActions: string[];
  /** 非 null 但不可用于计算的字段路径。 */
  invalidFields: string[];
}

interface MetricEvaluation {
  id: string;
  dimension: ListingScoreDimensionKey;
  label: string;
  weight: number;
  score: number | null;
  action: string;
  missingAction: string;
}

const DIMENSION_LABELS: Record<ListingScoreDimensionKey, string> = {
  content: "内容完整度",
  traffic: "流量与 Keyword",
  conversion: "转化竞争力",
  review: "Review 健康度",
  profitAds: "利润与广告承载力",
  risk: "风险与合规",
};

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

interface NumberOptions {
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  integer?: boolean;
}

function validNumber(
  value: number | null,
  path: string,
  invalidFields: Set<string>,
  options: NumberOptions = {},
): number | null {
  if (value === null) return null;

  const invalid = typeof value !== "number"
    || !Number.isFinite(value)
    || (options.minimum !== undefined && value < options.minimum)
    || (options.maximum !== undefined && value > options.maximum)
    || (options.exclusiveMinimum !== undefined && value <= options.exclusiveMinimum)
    || (options.integer === true && !Number.isInteger(value));

  if (invalid) {
    invalidFields.add(path);
    return null;
  }
  return value;
}

function validBoolean(
  value: boolean | null,
  path: string,
  invalidFields: Set<string>,
): boolean | null {
  if (value === null) return null;
  if (typeof value !== "boolean") {
    invalidFields.add(path);
    return null;
  }
  return value;
}

/** 达到竞品/类目基准的 1.2 倍时得满分。 */
function higherIsBetterRelative(value: number | null, benchmark: number | null): number | null {
  if (value === null || benchmark === null) return null;
  return clamp((value / benchmark / 1.2) * 100);
}

/** 低于基准 25% 得满分；等于基准得 80 分；达到基准 1.5 倍时为 0 分。 */
function lowerIsBetterRelative(value: number | null, benchmark: number | null): number | null {
  if (value === null || benchmark === null) return null;
  const ratio = value / benchmark;
  if (ratio <= 0.75) return 100;
  if (ratio <= 1) return 100 - ((ratio - 0.75) / 0.25) * 20;
  if (ratio <= 1.5) return 80 - ((ratio - 1) / 0.5) * 80;
  return 0;
}

/** Rating 等于类目均值为 80 分，高出 5% 得满分。 */
function ratingRelativeScore(value: number | null, benchmark: number | null): number | null {
  if (value === null || benchmark === null) return null;
  const ratio = value / benchmark;
  return clamp(((ratio - 0.8) / 0.25) * 100);
}

/** TACoS/CPC 在安全线 70% 内得满分，达到安全线为 40 分，超出 20% 为 0 分。 */
function safetyLineScore(actual: number | null, safetyLine: number | null): number | null {
  if (actual === null || safetyLine === null) return null;
  const ratio = actual / safetyLine;
  if (ratio <= 0.7) return 100;
  if (ratio <= 1) return 100 - ((ratio - 0.7) / 0.3) * 60;
  if (ratio <= 1.2) return 40 - ((ratio - 1) / 0.2) * 40;
  return 0;
}

function bsrTrendScore(change: number | null): number | null {
  if (change === null) return null;
  if (change <= -20) return 100;
  if (change <= 0) return 100 - ((change + 20) / 20) * 30;
  if (change <= 20) return 70 - (change / 20) * 70;
  return 0;
}

function lowStarScore(rate: number | null): number | null {
  if (rate === null) return null;
  if (rate <= 5) return 100;
  if (rate >= 30) return 0;
  return ((30 - rate) / 25) * 100;
}

function profitMarginScore(margin: number | null): number | null {
  if (margin === null) return null;
  return clamp((margin / 20) * 100);
}

function stockCoverageScore(days: number | null): number | null {
  if (days === null) return null;
  if (days < 30) return (days / 30) * 100;
  if (days <= 90) return 100;
  if (days <= 180) return 100 - ((days - 90) / 90) * 40;
  if (days <= 365) return 60 - ((days - 180) / 185) * 40;
  return 20;
}

function ipRiskScore(risk: IpTroRisk | null): number | null {
  if (risk === null) return null;
  return { none: 100, low: 75, medium: 30, high: 0 }[risk];
}

function addMetric(
  metrics: MetricEvaluation[],
  metric: MetricEvaluation,
): void {
  metrics.push({
    ...metric,
    score: metric.score === null ? null : clamp(metric.score),
  });
}

function determineGrade(
  score: number,
  completeness: number,
  hasRedline: boolean,
  riskAssessed: boolean,
): ListingScoreGrade {
  if (hasRedline) return "C";
  if (score >= 85 && completeness >= 90 && riskAssessed) return "S";
  if (score >= 75 && completeness >= 80) return "A";
  if (score >= 60) return "B";
  return "C";
}

export function calculateListingScore(input: ListingScoreInput): ListingScoreResult {
  const invalidFields = new Set<string>();
  const metrics: MetricEvaluation[] = [];

  const titleKeywordCoverage = validNumber(input.content.titleKeywordCoverage, "content.titleKeywordCoverage", invalidFields, { minimum: 0, maximum: 100 });
  const bulletCompleteness = validNumber(input.content.bulletCompleteness, "content.bulletCompleteness", invalidFields, { minimum: 0, maximum: 100 });
  const imageCount = validNumber(input.content.imageCount, "content.imageCount", invalidFields, { minimum: 0, integer: true });
  const hasVideo = validBoolean(input.content.hasVideo, "content.hasVideo", invalidFields);
  const hasAPlus = validBoolean(input.content.hasAPlus, "content.hasAPlus", invalidFields);

  addMetric(metrics, { id: "title-keyword", dimension: "content", label: "Title Keyword 覆盖", weight: 5, score: titleKeywordCoverage, action: "补齐 Title 中缺失的核心 Keyword，并保持可读性。", missingAction: "补录 Title Keyword 覆盖率。" });
  addMetric(metrics, { id: "bullets", dimension: "content", label: "Bullet 完整度", weight: 4, score: bulletCompleteness, action: "补齐 Bullet 的场景、规格、材质与差异化卖点。", missingAction: "补录 Bullet 完整度。" });
  addMetric(metrics, { id: "images", dimension: "content", label: "图片数量", weight: 4, score: imageCount === null ? null : (imageCount / 7) * 100, action: "将有效图片补至 7 张，并覆盖尺寸、结构和使用场景。", missingAction: "补录有效图片数量。" });
  addMetric(metrics, { id: "video", dimension: "content", label: "Video", weight: 3, score: hasVideo === null ? null : hasVideo ? 100 : 0, action: "补充展示核心功能和使用场景的 Video。", missingAction: "确认链接是否已有 Video。" });
  addMetric(metrics, { id: "a-plus", dimension: "content", label: "A+", weight: 4, score: hasAPlus === null ? null : hasAPlus ? 100 : 0, action: "补充 A+，重点解释差异化结构、材质和使用场景。", missingAction: "确认链接是否已有 A+。" });

  const ctr = validNumber(input.traffic.ctr, "traffic.ctr", invalidFields, { minimum: 0, maximum: 100 });
  const categoryCtr = validNumber(input.traffic.categoryCtr, "traffic.categoryCtr", invalidFields, { exclusiveMinimum: 0, maximum: 100 });
  const organicTop10 = validNumber(input.traffic.organicTop10Keywords, "traffic.organicTop10Keywords", invalidFields, { minimum: 0, integer: true });
  const competitorTop10 = validNumber(input.traffic.competitorMedianOrganicTop10Keywords, "traffic.competitorMedianOrganicTop10Keywords", invalidFields, { exclusiveMinimum: 0 });
  const bsrChange30d = validNumber(input.traffic.bsrChange30d, "traffic.bsrChange30d", invalidFields);

  addMetric(metrics, { id: "ctr", dimension: "traffic", label: "CTR 相对类目", weight: 8, score: higherIsBetterRelative(ctr, categoryCtr), action: "优先优化主图、Title、价格与 Coupon，提升 CTR。", missingAction: "补录 CTR 与类目 CTR 基准。" });
  addMetric(metrics, { id: "organic-top10", dimension: "traffic", label: "Organic Top 10", weight: 8, score: higherIsBetterRelative(organicTop10, competitorTop10), action: "围绕核心 Keyword 提升 Organic Top 10 覆盖。", missingAction: "补录 Organic Top 10 数量及竞品中位数。" });
  addMetric(metrics, { id: "bsr-trend", dimension: "traffic", label: "BSR 30 天趋势", weight: 4, score: bsrTrendScore(bsrChange30d), action: "排查 BSR 变差对应的流量、转化、库存或价格问题。", missingAction: "补录 BSR 30 天变化。" });

  const cvr = validNumber(input.conversion.cvr, "conversion.cvr", invalidFields, { minimum: 0, maximum: 100 });
  const categoryCvr = validNumber(input.conversion.categoryCvr, "conversion.categoryCvr", invalidFields, { exclusiveMinimum: 0, maximum: 100 });
  const returnRate = validNumber(input.conversion.returnRate, "conversion.returnRate", invalidFields, { minimum: 0, maximum: 100 });
  const categoryReturnRate = validNumber(input.conversion.categoryReturnRate, "conversion.categoryReturnRate", invalidFields, { exclusiveMinimum: 0, maximum: 100 });

  addMetric(metrics, { id: "cvr", dimension: "conversion", label: "CVR 相对类目", weight: 12, score: higherIsBetterRelative(cvr, categoryCvr), action: "优先定位 CVR 落后原因，核查价格、Review、页面表达和流量精准度。", missingAction: "补录 CVR 与类目 CVR 基准。" });
  addMetric(metrics, { id: "return-rate", dimension: "conversion", label: "退货率相对类目", weight: 8, score: lowerIsBetterRelative(returnRate, categoryReturnRate), action: "分析退货原因，并修正产品质量、尺寸说明或页面预期。", missingAction: "补录退货率与类目退货率基准。" });

  const reviewCount = validNumber(input.review.reviewCount, "review.reviewCount", invalidFields, { minimum: 0, integer: true });
  const competitorMedianReviewCount = validNumber(input.review.competitorMedianReviewCount, "review.competitorMedianReviewCount", invalidFields, { exclusiveMinimum: 0 });
  const rating = validNumber(input.review.rating, "review.rating", invalidFields, { minimum: 1, maximum: 5 });
  const categoryRating = validNumber(input.review.categoryRating, "review.categoryRating", invalidFields, { minimum: 1, maximum: 5 });
  const lowStarRate = validNumber(input.review.lowStarRate, "review.lowStarRate", invalidFields, { minimum: 0, maximum: 100 });

  addMetric(metrics, { id: "review-count", dimension: "review", label: "Review 数相对竞品", weight: 8, score: higherIsBetterRelative(reviewCount, competitorMedianReviewCount), action: "在合规前提下提升 Review 积累速度，并持续跟踪竞品中位数。", missingAction: "补录 Review 数和竞品中位 Review 数。" });
  addMetric(metrics, { id: "rating", dimension: "review", label: "Rating 相对类目", weight: 8, score: ratingRelativeScore(rating, categoryRating), action: "聚焦近期差评原因，优先修复影响 Rating 的产品与说明问题。", missingAction: "补录 Rating 与类目 Rating 基准。" });
  addMetric(metrics, { id: "low-star", dimension: "review", label: "1-3 星占比", weight: 4, score: lowStarScore(lowStarRate), action: "拆解 1-3 星 Review 痛点，按出现频次和损失优先修复。", missingAction: "补录 1-3 星 Rating 占比。" });

  const monthlyProfit = validNumber(input.profitAds.monthlyProfit, "profitAds.monthlyProfit", invalidFields);
  const profitMargin = validNumber(input.profitAds.profitMargin, "profitAds.profitMargin", invalidFields);
  const actualTacos = validNumber(input.profitAds.actualTacos, "profitAds.actualTacos", invalidFields, { minimum: 0 });
  const breakEvenTacos = validNumber(input.profitAds.breakEvenTacos, "profitAds.breakEvenTacos", invalidFields, { exclusiveMinimum: 0 });
  const actualCpc = validNumber(input.profitAds.actualCpc, "profitAds.actualCpc", invalidFields, { minimum: 0 });
  const maxSafeCpc = validNumber(input.profitAds.maxSafeCpc, "profitAds.maxSafeCpc", invalidFields, { exclusiveMinimum: 0 });

  addMetric(metrics, { id: "profit-margin", dimension: "profitAds", label: "利润率", weight: 5, score: profitMarginScore(profitMargin), action: "先修复低利润率，复核售价、Coupon、佣金、FBA、头程和采购成本。", missingAction: "补录利润率。" });
  addMetric(metrics, { id: "tacos", dimension: "profitAds", label: "TACoS 安全空间", weight: 6, score: safetyLineScore(actualTacos, breakEvenTacos), action: "压降 TACoS 或提高毛利，为广告留出安全空间。", missingAction: "补录实际 TACoS 与 Break-even TACoS。" });
  addMetric(metrics, { id: "cpc", dimension: "profitAds", label: "CPC 安全空间", weight: 4, score: safetyLineScore(actualCpc, maxSafeCpc), action: "降低实际 CPC，避免持续超过最大安全 CPC。", missingAction: "补录实际 CPC 与最大安全 CPC。" });

  const stockCoverageDays = validNumber(input.risk.stockCoverageDays, "risk.stockCoverageDays", invalidFields, { minimum: 0 });
  const listingSuppressed = validBoolean(input.risk.listingSuppressed, "risk.listingSuppressed", invalidFields);
  let ipTroRisk: IpTroRisk | null = input.risk.ipTroRisk;
  if (ipTroRisk !== null && !["none", "low", "medium", "high"].includes(ipTroRisk)) {
    invalidFields.add("risk.ipTroRisk");
    ipTroRisk = null;
  }

  addMetric(metrics, { id: "stock", dimension: "risk", label: "库存覆盖", weight: 2, score: stockCoverageScore(stockCoverageDays), action: "将库存覆盖调整至约 30-90 天，避免断货或长期积压。", missingAction: "补录库存覆盖天数。" });
  addMetric(metrics, { id: "suppressed", dimension: "risk", label: "链接抑制", weight: 1.5, score: listingSuppressed === null ? null : listingSuppressed ? 0 : 100, action: "立即处理链接抑制，恢复可售与流量入口。", missingAction: "确认链接是否被抑制。" });
  addMetric(metrics, { id: "ip-tro", dimension: "risk", label: "侵权/TRO 风险", weight: 1.5, score: ipRiskScore(ipTroRisk), action: "完成商标、专利、图片和 TRO 风险排查后再投入流量。", missingAction: "补录侵权/TRO 风险等级。" });

  const redlines: ListingScoreRedline[] = [];
  if ((monthlyProfit !== null && monthlyProfit < 0) || (profitMargin !== null && profitMargin < 0)) {
    redlines.push({ code: "NEGATIVE_PROFIT", message: "利润为负，链接等级强制为 C。" });
  }
  if (listingSuppressed === true) {
    redlines.push({ code: "LISTING_SUPPRESSED", message: "链接被抑制，等级强制为 C。" });
  }
  if (ipTroRisk === "high") {
    redlines.push({ code: "HIGH_IP_TRO_RISK", message: "侵权/TRO 风险为高，等级强制为 C。" });
  }

  const completedMetrics = metrics.filter((metric) => metric.score !== null);
  const completedWeight = completedMetrics.reduce((sum, metric) => sum + metric.weight, 0);
  const earnedWeight = completedMetrics.reduce((sum, metric) => sum + metric.weight * (metric.score as number) / 100, 0);
  const totalScore = completedWeight > 0 ? clamp((earnedWeight / completedWeight) * 100) : 0;
  const dataCompleteness = clamp(completedWeight);

  const dimensions = {} as Record<ListingScoreDimensionKey, ListingScoreDimensionResult>;
  (Object.keys(LISTING_SCORE_DIMENSION_WEIGHTS) as ListingScoreDimensionKey[]).forEach((dimension) => {
    const dimensionMetrics = completedMetrics.filter((metric) => metric.dimension === dimension);
    const dimensionCompletedWeight = dimensionMetrics.reduce((sum, metric) => sum + metric.weight, 0);
    const dimensionEarnedWeight = dimensionMetrics.reduce((sum, metric) => sum + metric.weight * (metric.score as number) / 100, 0);
    const dimensionWeight = LISTING_SCORE_DIMENSION_WEIGHTS[dimension];
    dimensions[dimension] = {
      label: DIMENSION_LABELS[dimension],
      weight: dimensionWeight,
      completedWeight: round(dimensionCompletedWeight),
      completeness: round((dimensionCompletedWeight / dimensionWeight) * 100),
      score: dimensionCompletedWeight > 0 ? round(clamp((dimensionEarnedWeight / dimensionCompletedWeight) * 100)) : null,
    };
  });

  const priorityActions: string[] = [];
  if (redlines.some((redline) => redline.code === "NEGATIVE_PROFIT")) {
    priorityActions.push("立即停止无效放量，先修复负利润并重算 Break-even TACoS。" );
  }
  if (redlines.some((redline) => redline.code === "LISTING_SUPPRESSED")) {
    priorityActions.push("立即处理链接抑制，恢复可售状态后再评估投放。" );
  }
  if (redlines.some((redline) => redline.code === "HIGH_IP_TRO_RISK")) {
    priorityActions.push("暂停新增采购和广告投入，先完成侵权/TRO 风险核查。" );
  }

  metrics
    .filter((metric) => metric.score !== null && metric.score < 70)
    .sort((left, right) => right.weight * (1 - (right.score as number) / 100) - left.weight * (1 - (left.score as number) / 100))
    .forEach((metric) => {
      if (priorityActions.length < 5 && !priorityActions.includes(metric.action)) priorityActions.push(metric.action);
    });

  metrics
    .filter((metric) => metric.score === null)
    .sort((left, right) => right.weight - left.weight)
    .forEach((metric) => {
      if (priorityActions.length < 5 && !priorityActions.includes(metric.missingAction)) priorityActions.push(metric.missingAction);
    });

  if (priorityActions.length === 0) {
    priorityActions.push("维持当前指标，并按周更新流量、转化、Review、利润和风险数据。" );
  }

  const roundedTotalScore = round(totalScore);
  const riskAssessed = listingSuppressed !== null && ipTroRisk !== null;

  return {
    totalScore: roundedTotalScore,
    dataCompleteness: round(dataCompleteness),
    dimensions,
    grade: determineGrade(roundedTotalScore, dataCompleteness, redlines.length > 0, riskAssessed),
    redlines,
    priorityActions,
    invalidFields: [...invalidFields],
  };
}
