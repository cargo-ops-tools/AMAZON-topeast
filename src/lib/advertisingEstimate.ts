export interface CalibrationSample {
  id: string;
  name: string;
  adScore: number;
  organicScore: number;
  adClicks: number;
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

export type AdvertisingQualityLevel = "unavailable" | "low" | "reference" | "usable" | "high-risk";

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
    sampleCounts: {
      click: number;
      cpc: number;
      order: number;
    };
    level: AdvertisingQualityLevel;
    isExtrapolated: boolean;
    extrapolation: {
      adScore: boolean;
      cpcProxy: boolean;
      adOrganicRatio: boolean;
    };
    hasObservationWindowMismatch: boolean;
    hasConversionInconsistency: boolean;
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
  return {
    p25: percentile(values, 0.25),
    p50: percentile(values, 0.5),
    p75: percentile(values, 0.75),
  };
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
  return { sampleId: sample.id, sampleName: sample.name, value };
}

function outsideRange(value: number, values: number[]): boolean {
  if (!finite(value) || values.length === 0) return false;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return value < minimum || value > maximum;
}

export function calculateAdvertisingEstimate(
  samples: CalibrationSample[],
  target: AdvertisingTarget,
): AdvertisingEstimate {
  const hasValidWindow = (sample: CalibrationSample) => finite(sample.observationDays) && sample.observationDays > 0;
  const clickSamples = samples.filter((sample) => (
    hasValidWindow(sample)
    && finite(sample.adScore) && sample.adScore > 0
    && finite(sample.adClicks) && sample.adClicks > 0
  ));
  const cpcSamples = samples.filter((sample) => (
    hasValidWindow(sample)
    && finite(sample.adClicks) && sample.adClicks > 0
    && finite(sample.adSpend) && sample.adSpend > 0
    && finite(sample.cpcProxy) && sample.cpcProxy > 0
  ));
  const orderSamples = samples.filter((sample) => (
    hasValidWindow(sample)
    && finite(sample.adScore) && sample.adScore > 0
    && finite(sample.organicScore) && sample.organicScore > 0
    && finite(sample.totalOrders) && sample.totalOrders > 0
    && finite(sample.adOrders) && sample.adOrders >= 0
    && sample.adOrders <= sample.totalOrders
  ));

  const clickObservations = clickSamples
    .map((sample) => observation(sample, sample.adClicks / sample.adScore));

  const cpcObservations = cpcSamples
    .map((sample) => observation(sample, (sample.adSpend / sample.adClicks) / sample.cpcProxy));

  const orderObservations = orderSamples.map((sample) => {
    // Jeffreys smoothing keeps 0% and 100% boundary samples finite instead of discarding them.
    const adOrderShare = (sample.adOrders! + 0.5) / (sample.totalOrders + 1);
    return observation(sample, (adOrderShare / (1 - adOrderShare)) / (sample.adScore / sample.organicScore));
  });

  const clickScaleValues = clickObservations.map((item) => item.value);
  const cpcScaleValues = cpcObservations.map((item) => item.value);
  const orderTendencyValues = orderObservations.map((item) => item.value);
  const clickScale = median(clickScaleValues);
  const cpcScale = median(cpcScaleValues);
  const orderTendency = median(orderTendencyValues);

  const targetHasPositiveTraffic = finite(target.adScore) && target.adScore > 0
    && finite(target.organicScore) && target.organicScore > 0;
  const targetScoreTotal = target.adScore + target.organicScore;
  const trafficShare = targetHasPositiveTraffic
    ? target.adScore / targetScoreTotal
    : null;
  const estimatedClicks = clickScale !== null && finite(target.adScore) && target.adScore > 0
    ? clickScale * target.adScore
    : null;
  const estimatedCpc = cpcScale !== null && finite(target.cpcProxy) && target.cpcProxy > 0
    ? cpcScale * target.cpcProxy
    : null;
  const estimatedSpend = estimatedClicks !== null && estimatedCpc !== null
    ? estimatedClicks * estimatedCpc
    : null;
  const estimatedDailySpend = estimatedSpend !== null && finite(target.observationDays) && target.observationDays > 0
    ? estimatedSpend / target.observationDays
    : null;

  const orderDenominator = orderTendency !== null && targetHasPositiveTraffic
    ? orderTendency * target.adScore + target.organicScore
    : null;
  const adOrderShare = orderTendency !== null && targetHasPositiveTraffic && orderDenominator !== null && orderDenominator > 0
    ? (orderTendency * target.adScore) / orderDenominator
    : null;
  const nonAdOrderShare = adOrderShare !== null ? 1 - adOrderShare : null;
  const hasReliableTargetOrders = target.totalOrders !== null && finite(target.totalOrders) && target.totalOrders > 0;
  const estimatedAdOrders = adOrderShare !== null && hasReliableTargetOrders
    ? target.totalOrders! * adOrderShare
    : null;
  const estimatedNonAdOrders = nonAdOrderShare !== null && hasReliableTargetOrders
    ? target.totalOrders! * nonAdOrderShare
    : null;

  const hasUnitPrice = target.unitPrice !== null && finite(target.unitPrice) && target.unitPrice > 0;
  const hasPreAdUnitProfit = target.preAdUnitProfit !== null && finite(target.preAdUnitProfit);
  const hasPositivePreAdUnitProfit = hasPreAdUnitProfit && target.preAdUnitProfit! > 0;
  const hasAverageUnitsPerOrder = finite(target.averageUnitsPerOrder) && target.averageUnitsPerOrder > 0;
  const estimatedAdCvr = estimatedAdOrders !== null && estimatedClicks !== null && estimatedClicks > 0
    ? estimatedAdOrders / estimatedClicks
    : null;
  const hasConversionInconsistency = estimatedAdCvr !== null && estimatedAdCvr > 1;
  const estimatedAdSales = estimatedAdOrders !== null && hasUnitPrice && hasAverageUnitsPerOrder
    ? estimatedAdOrders * target.averageUnitsPerOrder * target.unitPrice!
    : null;
  const estimatedTotalSales = hasReliableTargetOrders && hasUnitPrice && hasAverageUnitsPerOrder
    ? target.totalOrders! * target.averageUnitsPerOrder * target.unitPrice!
    : null;
  const acos = estimatedSpend !== null && estimatedAdSales !== null && estimatedAdSales > 0
    ? estimatedSpend / estimatedAdSales
    : null;
  const tacos = estimatedSpend !== null && estimatedTotalSales !== null && estimatedTotalSales > 0
    ? estimatedSpend / estimatedTotalSales
    : null;
  const breakEvenAcos = hasUnitPrice && hasPreAdUnitProfit
    ? target.preAdUnitProfit! / target.unitPrice!
    : null;
  const maxSafeCpc = estimatedAdCvr !== null && !hasConversionInconsistency && hasPositivePreAdUnitProfit && hasAverageUnitsPerOrder
    ? estimatedAdCvr * target.averageUnitsPerOrder * target.preAdUnitProfit!
    : null;
  const profitAfterAds = hasReliableTargetOrders && hasAverageUnitsPerOrder && hasPreAdUnitProfit && estimatedSpend !== null
    ? target.totalOrders! * target.averageUnitsPerOrder * target.preAdUnitProfit! - estimatedSpend
    : null;
  const profitMarginAfterAds = profitAfterAds !== null && estimatedTotalSales !== null && estimatedTotalSales > 0
    ? profitAfterAds / estimatedTotalSales
    : null;

  const clickScaleInterval = interval(clickScaleValues);
  const cpcScaleInterval = interval(cpcScaleValues);
  const orderTendencyInterval = interval(orderTendencyValues);
  const estimatedClicksInterval = finite(target.adScore) && target.adScore > 0
    ? mapInterval(clickScaleInterval, (value) => value * target.adScore)
    : interval([]);
  const estimatedCpcInterval = finite(target.cpcProxy) && target.cpcProxy > 0
    ? mapInterval(cpcScaleInterval, (value) => value * target.cpcProxy)
    : interval([]);
  const estimatedSpendInterval = combineIntervals(
    estimatedClicksInterval,
    estimatedCpcInterval,
    (clicks, cpc) => clicks * cpc,
  );
  const estimatedDailySpendInterval = finite(target.observationDays) && target.observationDays > 0
    ? mapInterval(estimatedSpendInterval, (value) => value / target.observationDays)
    : interval([]);
  const adOrderShareInterval = targetHasPositiveTraffic
    ? mapInterval(orderTendencyInterval, (value) => (
      (value * target.adScore) / (value * target.adScore + target.organicScore)
    ))
    : interval([]);

  const extrapolation = {
    adScore: finite(target.adScore) && target.adScore > 0
      ? outsideRange(target.adScore, clickSamples.map((sample) => sample.adScore))
      : false,
    cpcProxy: finite(target.cpcProxy) && target.cpcProxy > 0
      ? outsideRange(target.cpcProxy, cpcSamples.map((sample) => sample.cpcProxy))
      : false,
    adOrganicRatio: targetHasPositiveTraffic
      ? outsideRange(
        target.adScore / target.organicScore,
        orderSamples.map((sample) => sample.adScore / sample.organicScore),
      )
      : false,
  };
  const isExtrapolated = extrapolation.adScore || extrapolation.cpcProxy || extrapolation.adOrganicRatio;
  const usedSampleIds = new Set([
    ...clickSamples.map((sample) => sample.id),
    ...cpcSamples.map((sample) => sample.id),
    ...orderSamples.map((sample) => sample.id),
  ]);
  const usedObservationDays = samples
    .filter((sample) => usedSampleIds.has(sample.id))
    .map((sample) => sample.observationDays)
    .filter((days) => finite(days) && days > 0);
  const hasObservationWindowMismatch = usedObservationDays.length > 0 && (
    new Set(usedObservationDays).size > 1
    || (finite(target.observationDays) && target.observationDays > 0
      && usedObservationDays.some((days) => days !== target.observationDays))
  );

  const sampleCounts = {
    click: clickObservations.length,
    cpc: cpcObservations.length,
    order: orderObservations.length,
  };
  const minimumSampleCount = Math.min(sampleCounts.click, sampleCounts.cpc, sampleCounts.order);
  const targetCoreReady = targetHasPositiveTraffic
    && finite(target.cpcProxy) && target.cpcProxy > 0
    && finite(target.observationDays) && target.observationDays > 0;
  let qualityLevel: AdvertisingQualityLevel;
  if (minimumSampleCount === 0 || !targetCoreReady) qualityLevel = "unavailable";
  else if (isExtrapolated || hasObservationWindowMismatch || hasConversionInconsistency) qualityLevel = "high-risk";
  else if (minimumSampleCount < 3) qualityLevel = "low";
  else if (minimumSampleCount < 5) qualityLevel = "reference";
  else qualityLevel = "usable";

  const warnings: string[] = [];
  if (clickObservations.length < 5) warnings.push(`点击尺度仅有 ${clickObservations.length} 个有效样本，建议至少积累 5 个同类 ASIN。`);
  if (cpcObservations.length < 5) warnings.push(`CPC 尺度仅有 ${cpcObservations.length} 个有效样本，建议至少积累 5 个同类 ASIN。`);
  if (orderObservations.length < 5) warnings.push(`订单倾向仅有 ${orderObservations.length} 个有效样本，建议至少积累 5 个同类 ASIN。`);
  if (clickObservations.length === 0) warnings.push("没有有效的点击尺度样本：需要有效观察窗口、广告得分 A > 0，并提供真实广告点击 C。");
  if (cpcObservations.length === 0) warnings.push("没有有效的 CPC 校准样本：需要有效观察窗口、真实点击、真实花费和大于 0 的 CPC 代理。");
  if (orderObservations.length === 0) warnings.push("没有有效的订单倾向样本：需要有效观察窗口、总订单大于 0、0 ≤ 广告归因订单 ≤ 总订单，且 A、O 均大于 0。");
  const invalidOrderSamples = samples.filter((sample) => (
    finite(sample.totalOrders) && finite(sample.adOrders)
    && (sample.totalOrders < 0 || sample.adOrders < 0 || sample.adOrders > sample.totalOrders)
  ));
  if (invalidOrderSamples.length > 0) warnings.push(`有 ${invalidOrderSamples.length} 个样本的订单字段无效，已排除订单倾向校准。`);
  const invalidWindowSamples = samples.filter((sample) => !finite(sample.observationDays) || sample.observationDays <= 0);
  if (invalidWindowSamples.length > 0) warnings.push(`有 ${invalidWindowSamples.length} 个样本的观察天数无效，已排除校准。`);
  if (hasObservationWindowMismatch) warnings.push("校准样本或目标的观察天数不一致，当前结果属于高风险跨窗口估算。");
  if (hasConversionInconsistency) warnings.push("估算 Ad CVR 超过 100%，点击与订单模型口径互相矛盾；已将结果降为高风险并停止输出最大安全 CPC。");
  if (extrapolation.adScore) warnings.push("竞品广告得分超出点击校准样本范围，点击与花费结果属于外推。");
  if (extrapolation.cpcProxy) warnings.push("竞品 CPC 代理超出 CPC 校准样本范围，CPC 与花费结果属于外推。");
  if (extrapolation.adOrganicRatio) warnings.push("竞品 A/O 比超出订单校准样本范围，广告订单占比属于外推。");
  if (!finite(target.adScore) || !finite(target.organicScore) || target.adScore < 0 || target.organicScore < 0) warnings.push("竞品广告得分和自然得分必须是非负数。");
  if (!targetHasPositiveTraffic) warnings.push("竞品 A 与 O 都必须大于 0，才能计算流量得分占比或订单比例；得分为 0 不等于确认没有投放。");
  if (!target.observationDays || target.observationDays <= 0) warnings.push("观察天数必须大于 0，才能计算日均广告花费。");
  if (target.totalOrders === null) warnings.push("未输入竞品总订单，只输出广告归因订单占比，不输出广告单和非广告单数量。");
  if (target.totalOrders !== null && (!finite(target.totalOrders) || target.totalOrders < 0)) warnings.push("竞品总订单不能为负数或非有限数。");
  if (target.totalOrders === 0) warnings.push("竞品总订单为 0，按方法边界不把它当作可靠 Q，因此不输出估算订单数量。");
  if (!hasUnitPrice) warnings.push("未输入有效售价，ACOS、TACoS、销售额和利润率相关结果不可用。");
  if (!hasAverageUnitsPerOrder) warnings.push("平均每单件数必须大于 0，才能计算销售额、ACOS、TACoS 和广告后利润。");
  if (!hasPreAdUnitProfit) warnings.push("未输入广告前单件利润，Break-even ACOS、最大安全 CPC 和广告后利润相关结果不可用。");
  if (hasPreAdUnitProfit && !hasPositivePreAdUnitProfit) warnings.push("广告前单件利润不大于 0，当前没有可用广告空间，因此不输出最大安全 CPC。");
  warnings.push("广告花费、CPC 和订单比例均为 Modeled_Estimate；西柚得分不是点击、曝光或后台真实花费。");
  warnings.push("结果只覆盖你在模型中输入的渠道和观察窗口；未观测的商品定向、SD 或跨商品 SB 支出不会被默认为 0。");

  return {
    scales: { clickScale, cpcScale, orderTendency },
    observations: {
      clickScale: clickObservations,
      cpcScale: cpcObservations,
      orderTendency: orderObservations,
    },
    quality: {
      sampleCounts,
      level: qualityLevel,
      isExtrapolated,
      extrapolation,
      hasObservationWindowMismatch,
      hasConversionInconsistency,
    },
    target: {
      trafficShare,
      estimatedClicks,
      estimatedCpc,
      estimatedSpend,
      estimatedDailySpend,
      adOrderShare,
      nonAdOrderShare,
      estimatedAdOrders,
      estimatedNonAdOrders,
      estimatedAdCvr,
      estimatedAdSales,
      estimatedTotalSales,
      acos,
      tacos,
      breakEvenAcos,
      maxSafeCpc,
      profitAfterAds,
      profitMarginAfterAds,
      intervals: {
        estimatedClicks: estimatedClicksInterval,
        estimatedCpc: estimatedCpcInterval,
        estimatedSpend: estimatedSpendInterval,
        estimatedDailySpend: estimatedDailySpendInterval,
        adOrderShare: adOrderShareInterval,
      },
    },
    validSampleCount: usedSampleIds.size,
    warnings,
  };
}
