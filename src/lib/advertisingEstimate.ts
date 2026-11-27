export interface CalibrationSample {
  id: string;
  /** 业务唯一标识。优先填写 ASIN，也可以使用不会重复的内部编号。 */
  asin: string;
  name: string;
  adScore: number;
  organicScore: number;
  /** 空白表示未录入；0 表示报表确认零点击，二者不能混为一谈。 */
  adClicks: number | null;
  adSpend: number;
  cpcProxy: number;
  totalOrders: number;
  adOrders: number | null;
  observationDays: number;
}

export interface AdvertisingTarget {
  asin: string;
  adScore: number;
  organicScore: number;
  cpcProxy: number;
  totalOrders: number | null;
  observationDays: number;
  averageUnitsPerOrder: number;
  unitPrice: number | null;
  preAdUnitProfit: number | null;
}

export interface AdvertisingEstimateContext {
  targetSite: string;
  targetChannelScope: string;
  calibrationSite: string;
  calibrationChannelScope: string;
  calibrationScopeVerified: boolean;
}

export interface RatioObservation {
  sampleId: string;
  sampleName: string;
  value: number;
}

export interface EstimateInterval {
  p25: number | null;
  p50: number | null;
  p75: number | null;
}

export interface AdvertisingFormulaDefinition {
  id: string;
  title: string;
  formula: string;
  logic: string;
}

/** 页面公式说明直接使用本常量，避免代码、页面和文档出现不同版本。 */
export const ADVERTISING_MODEL_FORMULAS: readonly AdvertisingFormulaDefinition[] = [
  {
    id: "click-scale",
    title: "点击尺度 k",
    formula: "kᵢ = Cᵢ ÷ Aᵢ；k = P50(kᵢ)",
    logic: "C 为真实 Clicks，A 为同窗口广告得分；P50 即有效唯一样本的中位数。",
  },
  {
    id: "cpc-scale",
    title: "CPC 尺度 m",
    formula: "mᵢ = (Sᵢ ÷ Cᵢ) ÷ bᵢ；m = P50(mᵢ)",
    logic: "S÷C 为真实 CPC，b 为同范围 CPC 代理；m 用来校正代理值的整体尺度。",
  },
  {
    id: "order-tendency",
    title: "订单倾向 λ",
    formula: "pᵢ = (Ad Ordersᵢ + 0.5) ÷ (Qᵢ + 1)；λᵢ = [pᵢ ÷ (1-pᵢ)] ÷ (Aᵢ ÷ Oᵢ)；λ = P50(λᵢ)",
    logic: "0.5/1 为 Jeffreys 平滑，用于保留 0% 和 100% 广告订单边界样本。",
  },
  {
    id: "target-estimate",
    title: "目标竞品估算",
    formula: "Clicks^ = k × A*；CPC^ = m × b*；Spend^ = Clicks^ × CPC^；p̂_ad = λA* ÷ (λA* + O*)",
    logic: "系统自动校验唯一样本、站点、渠道和窗口天数；日期区间、归因窗口、时区及得分快照需由用户确认一致。",
  },
  {
    id: "safety-line",
    title: "利润安全线",
    formula: "Break-even ACOS = 广告前单件利润 ÷ 单件售价；Max Safe CPC = Ad CVR × 件/单 × 广告前单件利润",
    logic: "只有三个核心系数均至少有 10 个唯一样本，且模型质量达到“样本达标”时，才输出最大安全 CPC。",
  },
] as const;

export type AdvertisingQualityLevel = "unavailable" | "blocked" | "low" | "reference" | "usable" | "high-risk";

export interface AdvertisingEstimate {
  scales: {
    clickScale: number | null;
    cpcScale: number | null;
    orderTendency: number | null;
  };
  observations: {
    clickScale: RatioObservation[];
    cpcScale: RatioObservation[];
    orderTendency: RatioObservation[];
  };
  quality: {
    sampleCounts: { click: number; cpc: number; order: number };
    level: AdvertisingQualityLevel;
    isExtrapolated: boolean;
    extrapolation: { adScore: boolean; cpcProxy: boolean; adOrganicRatio: boolean };
    hasObservationWindowMismatch: boolean;
    hasConversionInconsistency: boolean;
    hasContextMismatch: boolean;
    hasUnverifiedContext: boolean;
    hasHighDispersion: boolean;
    hasSuspiciousClones: boolean;
    hasProfitInputInconsistency: boolean;
    isDecisionBlocked: boolean;
    duplicateSampleCount: number;
    conflictingSampleIds: string[];
    suspiciousCloneSampleIds: string[];
    missingIdentityCount: number;
    dispersion: { click: number | null; cpc: number | null; order: number | null };
  };
  target: {
    trafficShare: number | null;
    estimatedClicks: number | null;
    estimatedCpc: number | null;
    estimatedSpend: number | null;
    estimatedDailySpend: number | null;
    adOrderShare: number | null;
    nonAdOrderShare: number | null;
    estimatedAdOrders: number | null;
    estimatedNonAdOrders: number | null;
    estimatedAdCvr: number | null;
    estimatedAdSales: number | null;
    estimatedTotalSales: number | null;
    acos: number | null;
    tacos: number | null;
    breakEvenAcos: number | null;
    maxSafeCpc: number | null;
    profitAfterAds: number | null;
    profitMarginAfterAds: number | null;
    intervals: {
      estimatedClicks: EstimateInterval;
      estimatedCpc: EstimateInterval;
      estimatedSpend: EstimateInterval;
      estimatedDailySpend: EstimateInterval;
      adOrderShare: EstimateInterval;
    };
  };
  validSampleCount: number;
  warnings: string[];
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function percentile(values: number[], quantile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * quantile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  if (lowerIndex === upperIndex) return sorted[lowerIndex];
  const weight = index - lowerIndex;
  return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
}

function median(values: number[]): number | null {
  return percentile(values, 0.5);
}

function interval(values: number[]): EstimateInterval {
  return { p25: percentile(values, 0.25), p50: percentile(values, 0.5), p75: percentile(values, 0.75) };
}

function emptyInterval(): EstimateInterval {
  return { p25: null, p50: null, p75: null };
}

function mapInterval(source: EstimateInterval, transform: (value: number) => number): EstimateInterval {
  return {
    p25: source.p25 === null ? null : transform(source.p25),
    p50: source.p50 === null ? null : transform(source.p50),
    p75: source.p75 === null ? null : transform(source.p75),
  };
}

function combineIntervals(
  left: EstimateInterval,
  right: EstimateInterval,
  transform: (leftValue: number, rightValue: number) => number,
): EstimateInterval {
  return {
    p25: left.p25 === null || right.p25 === null ? null : transform(left.p25, right.p25),
    p50: left.p50 === null || right.p50 === null ? null : transform(left.p50, right.p50),
    p75: left.p75 === null || right.p75 === null ? null : transform(left.p75, right.p75),
  };
}

function observation(sample: CalibrationSample, value: number): RatioObservation {
  return { sampleId: sample.id, sampleName: sample.asin.trim() || sample.name, value };
}

function outsideRange(value: number, values: number[]): boolean {
  if (!finite(value) || values.length === 0) return false;
  return value < Math.min(...values) || value > Math.max(...values);
}

function normalizedIdentity(sample: CalibrationSample): string {
  return sample.asin.trim().toUpperCase();
}

function hasCalibrationData(sample: CalibrationSample): boolean {
  return [sample.adScore, sample.organicScore, sample.adClicks, sample.adSpend, sample.cpcProxy, sample.totalOrders]
    .some((value) => finite(value) && value !== 0)
    || sample.adOrders !== null;
}

function sampleFingerprint(sample: CalibrationSample): string {
  return JSON.stringify([
    sample.observationDays,
    sample.adScore,
    sample.organicScore,
    sample.adClicks,
    sample.adSpend,
    sample.cpcProxy,
    sample.totalOrders,
    sample.adOrders,
  ]);
}

function prepareUniqueSamples(samples: CalibrationSample[]): {
  samples: CalibrationSample[];
  duplicateSampleCount: number;
  conflictingSampleIds: string[];
  suspiciousCloneSampleIds: string[];
  missingIdentityCount: number;
} {
  const groups = new Map<string, CalibrationSample[]>();
  let missingIdentityCount = 0;

  samples.forEach((sample) => {
    if (!hasCalibrationData(sample)) return;
    const identity = normalizedIdentity(sample);
    if (!identity) {
      missingIdentityCount += 1;
      return;
    }
    const group = groups.get(identity) ?? [];
    group.push(sample);
    groups.set(identity, group);
  });

  const uniqueSamples: CalibrationSample[] = [];
  const conflictingSampleIds: string[] = [];
  let duplicateSampleCount = 0;
  groups.forEach((group, identity) => {
    if (group.length === 1) {
      uniqueSamples.push(group[0]);
      return;
    }
    if (new Set(group.map(sampleFingerprint)).size === 1) {
      uniqueSamples.push(group[0]);
      duplicateSampleCount += group.length - 1;
      return;
    }
    conflictingSampleIds.push(identity);
  });
  const fingerprintGroups = new Map<string, CalibrationSample[]>();
  uniqueSamples.forEach((sample) => {
    const fingerprint = sampleFingerprint(sample);
    const group = fingerprintGroups.get(fingerprint) ?? [];
    group.push(sample);
    fingerprintGroups.set(fingerprint, group);
  });
  const suspiciousCloneSampleIds = [...fingerprintGroups.values()]
    .filter((group) => group.length > 1)
    .flatMap((group) => group.map(normalizedIdentity));

  return {
    samples: uniqueSamples,
    duplicateSampleCount,
    conflictingSampleIds,
    suspiciousCloneSampleIds,
    missingIdentityCount,
  };
}

function relativeIqr(values: number[]): number | null {
  const range = interval(values);
  if (range.p25 === null || range.p50 === null || range.p75 === null) return null;
  if (range.p50 === 0) return range.p75 === range.p25 ? 0 : Number.POSITIVE_INFINITY;
  return (range.p75 - range.p25) / Math.abs(range.p50);
}

function sameContextValue(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function calculateAdvertisingEstimate(
  samples: CalibrationSample[],
  target: AdvertisingTarget,
  context: AdvertisingEstimateContext,
): AdvertisingEstimate {
  const prepared = prepareUniqueSamples(samples);
  const uniqueSamples = prepared.samples;
  const hasValidWindow = (sample: CalibrationSample) => finite(sample.observationDays) && sample.observationDays > 0;
  const clickSamples = uniqueSamples.filter((sample) => (
    hasValidWindow(sample) && finite(sample.adScore) && sample.adScore > 0 && finite(sample.adClicks) && sample.adClicks >= 0
  ));
  const cpcSamples = uniqueSamples.filter((sample) => (
    hasValidWindow(sample) && finite(sample.adClicks) && sample.adClicks > 0
    && finite(sample.adSpend) && sample.adSpend > 0 && finite(sample.cpcProxy) && sample.cpcProxy > 0
  ));
  const orderSamples = uniqueSamples.filter((sample) => (
    hasValidWindow(sample) && finite(sample.adScore) && sample.adScore > 0
    && finite(sample.organicScore) && sample.organicScore > 0
    && finite(sample.totalOrders) && sample.totalOrders > 0
    && finite(sample.adOrders) && sample.adOrders >= 0 && sample.adOrders <= sample.totalOrders
  ));

  const clickObservations = clickSamples.map((sample) => observation(sample, sample.adClicks! / sample.adScore));
  const cpcObservations = cpcSamples.map((sample) => observation(sample, (sample.adSpend / sample.adClicks!) / sample.cpcProxy));
  const orderObservations = orderSamples.map((sample) => {
    const adOrderShare = (sample.adOrders! + 0.5) / (sample.totalOrders + 1);
    return observation(sample, (adOrderShare / (1 - adOrderShare)) / (sample.adScore / sample.organicScore));
  });

  const clickScaleValues = clickObservations.map((item) => item.value);
  const cpcScaleValues = cpcObservations.map((item) => item.value);
  const orderTendencyValues = orderObservations.map((item) => item.value);
  const clickScale = median(clickScaleValues);
  const cpcScale = median(cpcScaleValues);
  const orderTendency = median(orderTendencyValues);
  const clickScaleInterval = interval(clickScaleValues);
  const cpcScaleInterval = interval(cpcScaleValues);
  const orderTendencyInterval = interval(orderTendencyValues);

  const usedSampleKeys = new Set([
    ...clickSamples.map(normalizedIdentity),
    ...cpcSamples.map(normalizedIdentity),
    ...orderSamples.map(normalizedIdentity),
  ]);
  const usedObservationDays = uniqueSamples
    .filter((sample) => usedSampleKeys.has(normalizedIdentity(sample)))
    .map((sample) => sample.observationDays)
    .filter((days) => finite(days) && days > 0);
  const hasObservationWindowMismatch = usedObservationDays.length > 0 && (
    new Set(usedObservationDays).size > 1
    || (finite(target.observationDays) && target.observationDays > 0
      && usedObservationDays.some((days) => days !== target.observationDays))
  );
  const hasRelevantSamples = usedSampleKeys.size > 0;
  const contextComplete = Boolean(
    context.targetSite.trim() && context.targetChannelScope.trim()
    && context.calibrationSite.trim() && context.calibrationChannelScope.trim()
  );
  const hasUnverifiedContext = hasRelevantSamples && (!context.calibrationScopeVerified || !contextComplete);
  const hasContextMismatch = hasRelevantSamples && contextComplete && (
    !sameContextValue(context.targetSite, context.calibrationSite)
    || !sameContextValue(context.targetChannelScope, context.calibrationChannelScope)
  );
  const isDecisionBlocked = hasObservationWindowMismatch || hasUnverifiedContext || hasContextMismatch;
  const scopeReady = !hasUnverifiedContext && !hasContextMismatch;
  const targetWindowReady = finite(target.observationDays) && target.observationDays > 0;
  const volumeReady = scopeReady && targetWindowReady && !hasObservationWindowMismatch;

  const targetHasPositiveTraffic = finite(target.adScore) && target.adScore > 0
    && finite(target.organicScore) && target.organicScore > 0;
  const trafficShare = targetHasPositiveTraffic ? target.adScore / (target.adScore + target.organicScore) : null;
  const rawEstimatedClicks = clickScale !== null && finite(target.adScore) && target.adScore > 0
    ? clickScale * target.adScore : null;
  const rawEstimatedCpc = cpcScale !== null && finite(target.cpcProxy) && target.cpcProxy > 0
    ? cpcScale * target.cpcProxy : null;
  const rawEstimatedSpend = rawEstimatedClicks !== null && rawEstimatedCpc !== null
    ? rawEstimatedClicks * rawEstimatedCpc : null;
  const rawEstimatedDailySpend = rawEstimatedSpend !== null && finite(target.observationDays) && target.observationDays > 0
    ? rawEstimatedSpend / target.observationDays : null;

  const orderDenominator = orderTendency !== null && targetHasPositiveTraffic
    ? orderTendency * target.adScore + target.organicScore : null;
  const rawAdOrderShare = orderTendency !== null && targetHasPositiveTraffic && orderDenominator !== null && orderDenominator > 0
    ? (orderTendency * target.adScore) / orderDenominator : null;
  const rawNonAdOrderShare = rawAdOrderShare !== null ? 1 - rawAdOrderShare : null;
  const hasReliableTargetOrders = target.totalOrders !== null && finite(target.totalOrders) && target.totalOrders > 0;
  const rawEstimatedAdOrders = rawAdOrderShare !== null && hasReliableTargetOrders
    ? target.totalOrders! * rawAdOrderShare : null;
  const rawEstimatedNonAdOrders = rawNonAdOrderShare !== null && hasReliableTargetOrders
    ? target.totalOrders! * rawNonAdOrderShare : null;

  const hasUnitPrice = target.unitPrice !== null && finite(target.unitPrice) && target.unitPrice > 0;
  const hasPreAdUnitProfit = target.preAdUnitProfit !== null && finite(target.preAdUnitProfit);
  const hasPositivePreAdUnitProfit = hasPreAdUnitProfit && target.preAdUnitProfit! > 0;
  const hasProfitInputInconsistency = hasUnitPrice && hasPreAdUnitProfit && target.preAdUnitProfit! > target.unitPrice!;
  const hasAverageUnitsPerOrder = finite(target.averageUnitsPerOrder) && target.averageUnitsPerOrder > 0;
  const rawEstimatedAdCvr = rawEstimatedAdOrders !== null && rawEstimatedClicks !== null && rawEstimatedClicks > 0
    ? rawEstimatedAdOrders / rawEstimatedClicks : null;
  const hasConversionInconsistency = rawEstimatedAdCvr !== null && rawEstimatedAdCvr >= 1;
  const rawEstimatedAdSales = rawEstimatedAdOrders !== null && hasUnitPrice && hasAverageUnitsPerOrder
    ? rawEstimatedAdOrders * target.averageUnitsPerOrder * target.unitPrice! : null;
  const rawEstimatedTotalSales = hasReliableTargetOrders && hasUnitPrice && hasAverageUnitsPerOrder
    ? target.totalOrders! * target.averageUnitsPerOrder * target.unitPrice! : null;
  const rawAcos = rawEstimatedSpend !== null && rawEstimatedAdSales !== null && rawEstimatedAdSales > 0
    ? rawEstimatedSpend / rawEstimatedAdSales : null;
  const rawTacos = rawEstimatedSpend !== null && rawEstimatedTotalSales !== null && rawEstimatedTotalSales > 0
    ? rawEstimatedSpend / rawEstimatedTotalSales : null;
  const breakEvenAcos = hasUnitPrice && hasPreAdUnitProfit ? target.preAdUnitProfit! / target.unitPrice! : null;
  const rawMaxSafeCpc = rawEstimatedAdCvr !== null && !hasConversionInconsistency && !hasProfitInputInconsistency && hasPositivePreAdUnitProfit && hasAverageUnitsPerOrder
    ? rawEstimatedAdCvr * target.averageUnitsPerOrder * target.preAdUnitProfit! : null;
  const rawProfitAfterAds = hasReliableTargetOrders && hasAverageUnitsPerOrder && hasPreAdUnitProfit && rawEstimatedSpend !== null
    ? target.totalOrders! * target.averageUnitsPerOrder * target.preAdUnitProfit! - rawEstimatedSpend : null;
  const rawProfitMarginAfterAds = rawProfitAfterAds !== null && rawEstimatedTotalSales !== null && rawEstimatedTotalSales > 0
    ? rawProfitAfterAds / rawEstimatedTotalSales : null;

  const rawEstimatedClicksInterval = finite(target.adScore) && target.adScore > 0
    ? mapInterval(clickScaleInterval, (value) => value * target.adScore) : emptyInterval();
  const rawEstimatedCpcInterval = finite(target.cpcProxy) && target.cpcProxy > 0
    ? mapInterval(cpcScaleInterval, (value) => value * target.cpcProxy) : emptyInterval();
  const rawEstimatedSpendInterval = combineIntervals(rawEstimatedClicksInterval, rawEstimatedCpcInterval, (clicks, cpc) => clicks * cpc);
  const rawEstimatedDailySpendInterval = finite(target.observationDays) && target.observationDays > 0
    ? mapInterval(rawEstimatedSpendInterval, (value) => value / target.observationDays) : emptyInterval();
  const rawAdOrderShareInterval = targetHasPositiveTraffic
    ? mapInterval(orderTendencyInterval, (value) => (value * target.adScore) / (value * target.adScore + target.organicScore))
    : emptyInterval();

  const extrapolation = {
    adScore: finite(target.adScore) && target.adScore > 0
      ? outsideRange(target.adScore, clickSamples.map((sample) => sample.adScore)) : false,
    cpcProxy: finite(target.cpcProxy) && target.cpcProxy > 0
      ? outsideRange(target.cpcProxy, cpcSamples.map((sample) => sample.cpcProxy)) : false,
    adOrganicRatio: targetHasPositiveTraffic
      ? outsideRange(target.adScore / target.organicScore, orderSamples.map((sample) => sample.adScore / sample.organicScore)) : false,
  };
  const isExtrapolated = extrapolation.adScore || extrapolation.cpcProxy || extrapolation.adOrganicRatio;
  const dispersion = {
    click: relativeIqr(clickScaleValues),
    cpc: relativeIqr(cpcScaleValues),
    order: relativeIqr(orderTendencyValues),
  };
  const dispersionValues = Object.values(dispersion).filter((value): value is number => value !== null);
  const hasHighDispersion = dispersionValues.some((value) => value > 1);
  const hasModerateDispersion = dispersionValues.some((value) => value > 0.5);
  const hasSuspiciousClones = prepared.suspiciousCloneSampleIds.length > 0;
  const isHighRisk = isExtrapolated || hasConversionInconsistency || hasHighDispersion || hasSuspiciousClones || hasProfitInputInconsistency;

  const sampleCounts = { click: clickObservations.length, cpc: cpcObservations.length, order: orderObservations.length };
  const minimumSampleCount = Math.min(sampleCounts.click, sampleCounts.cpc, sampleCounts.order);
  const targetCoreReady = targetHasPositiveTraffic
    && finite(target.cpcProxy) && target.cpcProxy > 0
    && finite(target.observationDays) && target.observationDays > 0;
  let qualityLevel: AdvertisingQualityLevel;
  if (isDecisionBlocked) qualityLevel = "blocked";
  else if (minimumSampleCount === 0 || !targetCoreReady) qualityLevel = "unavailable";
  else if (isHighRisk) qualityLevel = "high-risk";
  else if (minimumSampleCount < 3) qualityLevel = "low";
  else if (minimumSampleCount < 10 || hasModerateDispersion) qualityLevel = "reference";
  else qualityLevel = "usable";
  const modelOutputReady = qualityLevel !== "unavailable";

  const warnings: string[] = [];
  if (clickObservations.length < 10) warnings.push(`点击尺度仅有 ${clickObservations.length} 个唯一有效样本；3–9 个只作参考，建议至少积累 10 个同类 ASIN。`);
  if (cpcObservations.length < 10) warnings.push(`CPC 尺度仅有 ${cpcObservations.length} 个唯一有效样本；3–9 个只作参考，建议至少积累 10 个同类 ASIN。`);
  if (orderObservations.length < 10) warnings.push(`订单倾向仅有 ${orderObservations.length} 个唯一有效样本；3–9 个只作参考，建议至少积累 10 个同类 ASIN。`);
  if (clickObservations.length === 0) warnings.push("没有有效的点击尺度样本：需要唯一 ASIN/编号、有效观察窗口、A > 0，并明确录入真实 Clicks（确认零点击可填 0，空白不参与）。");
  if (cpcObservations.length === 0) warnings.push("没有有效的 CPC 校准样本：需要唯一 ASIN/编号、真实点击、真实花费和 CPC 代理 > 0。");
  if (orderObservations.length === 0) warnings.push("没有有效的订单倾向样本：需要唯一 ASIN/编号、Q > 0、0 ≤ Ad Orders ≤ Q，且 A、O 均大于 0。");
  if (prepared.missingIdentityCount > 0) warnings.push(`有 ${prepared.missingIdentityCount} 行已录入数据但缺少 ASIN/唯一编号，已排除校准。`);
  if (prepared.duplicateSampleCount > 0) warnings.push(`发现 ${prepared.duplicateSampleCount} 行重复样本，质量等级只按唯一样本计算。`);
  if (prepared.conflictingSampleIds.length > 0) warnings.push(`以下样本编号存在冲突数据，已整组排除：${prepared.conflictingSampleIds.join("、")}。`);
  if (hasSuspiciousClones) warnings.push(`以下不同 ASIN/编号的全部校准字段完全相同，疑似复制数据，模型已降为高风险：${prepared.suspiciousCloneSampleIds.join("、")}。`);
  const invalidOrderSamples = uniqueSamples.filter((sample) => (
    finite(sample.totalOrders) && finite(sample.adOrders)
    && (sample.totalOrders < 0 || sample.adOrders < 0 || sample.adOrders > sample.totalOrders)
  ));
  if (invalidOrderSamples.length > 0) warnings.push(`有 ${invalidOrderSamples.length} 个唯一样本的订单字段无效，已排除订单倾向校准。`);
  const invalidWindowSamples = uniqueSamples.filter((sample) => !finite(sample.observationDays) || sample.observationDays <= 0);
  if (invalidWindowSamples.length > 0) warnings.push(`有 ${invalidWindowSamples.length} 个唯一样本的观察天数无效，已排除校准。`);
  if (hasUnverifiedContext) warnings.push("尚未确认校准样本与目标的完整口径（站点、渠道、日期、归因、时区、币种和得分快照），核心估算已阻断。");
  if (hasContextMismatch) warnings.push("校准样本与目标竞品的站点或渠道不一致，核心估算已阻断；系统不会自动换币种或重标旧样本。");
  if (hasObservationWindowMismatch) warnings.push("校准样本与目标竞品的观察天数不一致，总量、订单、ACOS/TACoS、利润和安全 CPC 已停止输出。");
  if (hasConversionInconsistency) warnings.push("估算 Ad CVR 达到或超过 100%，该边界不足以支持安全出价，点击与订单口径也可能互相矛盾。");
  if (hasProfitInputInconsistency) warnings.push("广告前单件利润高于单件售价，疑似币种、件/单或成本口径录错；最大安全 CPC 已停止输出。");
  if (hasHighDispersion) warnings.push("校准系数的 P25–P75 跨度超过 P50 的 100%，样本离散度过高，模型已降为高风险。");
  if (extrapolation.adScore) warnings.push("竞品广告得分超出点击校准样本范围，点击与花费结果属于外推。");
  if (extrapolation.cpcProxy) warnings.push("竞品 CPC 代理超出 CPC 校准样本范围，CPC 与花费结果属于外推。");
  if (extrapolation.adOrganicRatio) warnings.push("竞品 A/O 比超出订单校准样本范围，广告订单占比属于外推。");
  if (isHighRisk) warnings.push("当前模型为高风险，最大安全 CPC 已停止输出。");
  if (!finite(target.adScore) || !finite(target.organicScore) || target.adScore < 0 || target.organicScore < 0) warnings.push("竞品广告得分和自然得分必须是非负数。");
  if (!targetHasPositiveTraffic) warnings.push("竞品 A 与 O 都必须大于 0，才能计算得分占比或订单比例；得分为 0 不等于确认没有投放。");
  if (!target.observationDays || target.observationDays <= 0) warnings.push("观察天数必须大于 0，且必须与校准样本一致。");
  if (target.totalOrders === null) warnings.push("未输入竞品总订单，只输出广告归因订单占比，不输出广告单和非广告单数量。");
  if (target.totalOrders !== null && (!finite(target.totalOrders) || target.totalOrders < 0)) warnings.push("竞品总订单不能为负数或非有限数。");
  if (target.totalOrders === 0) warnings.push("竞品总订单为 0，按方法边界不把它当作可靠 Q，因此不输出估算订单数量。");
  if (!hasUnitPrice) warnings.push("未输入有效售价，ACOS、TACoS、销售额和利润率相关结果不可用。");
  if (!hasAverageUnitsPerOrder) warnings.push("平均每单件数必须大于 0，才能计算销售额、ACOS、TACoS 和广告后利润。");
  if (!hasPreAdUnitProfit) warnings.push("未输入广告前单件利润，Break-even ACOS、最大安全 CPC 和广告后利润相关结果不可用。");
  if (hasPreAdUnitProfit && !hasPositivePreAdUnitProfit) warnings.push("广告前单件利润不大于 0，当前没有可用广告空间，因此不输出最大安全 CPC。");
  if (rawMaxSafeCpc !== null && (qualityLevel === "low" || qualityLevel === "reference" || qualityLevel === "unavailable")) warnings.push("最大安全 CPC 只在三个系数均有至少 10 个唯一样本且模型为“样本达标”时输出；当前结果不满足安全线条件。");
  warnings.push("广告花费、CPC 和订单比例均为 Modeled_Estimate；西柚得分不是点击、曝光或后台真实花费。");
  warnings.push("P25–P75 是系数情景边界，不是统计置信区间；未观测的商品定向、SD 或跨商品 SB 支出不会被默认为 0。");

  return {
    scales: { clickScale, cpcScale, orderTendency },
    observations: { clickScale: clickObservations, cpcScale: cpcObservations, orderTendency: orderObservations },
    quality: {
      sampleCounts,
      level: qualityLevel,
      isExtrapolated,
      extrapolation,
      hasObservationWindowMismatch,
      hasConversionInconsistency,
      hasContextMismatch,
      hasUnverifiedContext,
      hasHighDispersion,
      hasSuspiciousClones,
      hasProfitInputInconsistency,
      isDecisionBlocked,
      duplicateSampleCount: prepared.duplicateSampleCount,
      conflictingSampleIds: prepared.conflictingSampleIds,
      suspiciousCloneSampleIds: prepared.suspiciousCloneSampleIds,
      missingIdentityCount: prepared.missingIdentityCount,
      dispersion,
    },
    target: {
      trafficShare,
      estimatedClicks: volumeReady && modelOutputReady ? rawEstimatedClicks : null,
      estimatedCpc: scopeReady && modelOutputReady ? rawEstimatedCpc : null,
      estimatedSpend: volumeReady && modelOutputReady ? rawEstimatedSpend : null,
      estimatedDailySpend: volumeReady && modelOutputReady ? rawEstimatedDailySpend : null,
      adOrderShare: volumeReady && modelOutputReady ? rawAdOrderShare : null,
      nonAdOrderShare: volumeReady && modelOutputReady ? rawNonAdOrderShare : null,
      estimatedAdOrders: volumeReady && modelOutputReady ? rawEstimatedAdOrders : null,
      estimatedNonAdOrders: volumeReady && modelOutputReady ? rawEstimatedNonAdOrders : null,
      estimatedAdCvr: volumeReady && modelOutputReady ? rawEstimatedAdCvr : null,
      estimatedAdSales: volumeReady && modelOutputReady ? rawEstimatedAdSales : null,
      estimatedTotalSales: volumeReady && modelOutputReady ? rawEstimatedTotalSales : null,
      acos: volumeReady && modelOutputReady ? rawAcos : null,
      tacos: volumeReady && modelOutputReady ? rawTacos : null,
      breakEvenAcos,
      maxSafeCpc: volumeReady && qualityLevel === "usable" ? rawMaxSafeCpc : null,
      profitAfterAds: volumeReady && modelOutputReady ? rawProfitAfterAds : null,
      profitMarginAfterAds: volumeReady && modelOutputReady ? rawProfitMarginAfterAds : null,
      intervals: {
        estimatedClicks: volumeReady && modelOutputReady ? rawEstimatedClicksInterval : emptyInterval(),
        estimatedCpc: scopeReady && modelOutputReady ? rawEstimatedCpcInterval : emptyInterval(),
        estimatedSpend: volumeReady && modelOutputReady ? rawEstimatedSpendInterval : emptyInterval(),
        estimatedDailySpend: volumeReady && modelOutputReady ? rawEstimatedDailySpendInterval : emptyInterval(),
        adOrderShare: volumeReady && modelOutputReady ? rawAdOrderShareInterval : emptyInterval(),
      },
    },
    validSampleCount: usedSampleKeys.size,
    warnings,
  };
}
