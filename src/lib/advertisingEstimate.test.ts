import { describe, expect, it } from "vitest";
import { calculateAdvertisingEstimate, type CalibrationSample, type AdvertisingTarget } from "./advertisingEstimate";

const sample: CalibrationSample = {
  id: "sample-1",
  name: "文档演示样本",
  adScore: 4000,
  organicScore: 2000,
  adClicks: 3200,
  adSpend: 3456,
  cpcProxy: 1.2,
  totalOrders: 600,
  adOrders: 300,
  observationDays: 30,
};

const target: AdvertisingTarget = {
  asin: "DEMO",
  adScore: 6000,
  organicScore: 4000,
  cpcProxy: 1.3,
  totalOrders: 700,
  observationDays: 30,
  averageUnitsPerOrder: 1,
  unitPrice: 20,
  preAdUnitProfit: 6,
};

describe("calculateAdvertisingEstimate", () => {
  it("reproduces the method document demonstration and operating metrics", () => {
    const result = calculateAdvertisingEstimate([sample], target);

    expect(result.scales.clickScale).toBeCloseTo(0.8, 10);
    expect(result.scales.cpcScale).toBeCloseTo(0.9, 10);
    expect(result.scales.orderTendency).toBeCloseTo(0.5, 10);
    expect(result.target.estimatedClicks).toBeCloseTo(4800, 10);
    expect(result.target.estimatedCpc).toBeCloseTo(1.17, 10);
    expect(result.target.estimatedSpend).toBeCloseTo(5616, 10);
    expect(result.target.estimatedDailySpend).toBeCloseTo(187.2, 10);
    expect(result.target.adOrderShare).toBeCloseTo(3 / 7, 10);
    expect(result.target.estimatedAdOrders).toBeCloseTo(300, 10);
    expect(result.target.estimatedNonAdOrders).toBeCloseTo(400, 10);
    expect(result.target.estimatedAdCvr).toBeCloseTo(0.0625, 10);
    expect(result.target.estimatedAdSales).toBeCloseTo(6000, 10);
    expect(result.target.estimatedTotalSales).toBeCloseTo(14000, 10);
    expect(result.target.acos).toBeCloseTo(0.936, 10);
    expect(result.target.tacos).toBeCloseTo(0.4011428571, 10);
    expect(result.target.breakEvenAcos).toBeCloseTo(0.3, 10);
    expect(result.target.maxSafeCpc).toBeCloseTo(0.375, 10);
    expect(result.target.profitAfterAds).toBeCloseTo(-1416, 10);
    expect(result.target.profitMarginAfterAds).toBeCloseTo(-0.1011428571, 10);
  });

  it("uses Jeffreys smoothing and retains zero/all-ad boundary samples", () => {
    const result = calculateAdvertisingEstimate([
      sample,
      { ...sample, id: "zero-ad", adOrders: 0 },
      { ...sample, id: "all-ad", adOrders: sample.totalOrders },
    ], target);

    expect(result.observations.orderTendency).toHaveLength(3);
    expect(result.observations.orderTendency.every((item) => Number.isFinite(item.value))).toBe(true);
    expect(result.scales.orderTendency).toBeCloseTo(0.5, 10);
  });

  it("does not treat a blank Ad Orders cell as a real zero-order calibration", () => {
    const result = calculateAdvertisingEstimate([{ ...sample, adOrders: null }], target);

    expect(result.quality.sampleCounts).toEqual({ click: 1, cpc: 1, order: 0 });
    expect(result.scales.orderTendency).toBeNull();
    expect(result.target.adOrderShare).toBeNull();
  });

  it("does not invent order counts or dependent operating metrics when target total orders are missing", () => {
    const result = calculateAdvertisingEstimate([sample], { ...target, totalOrders: null });

    expect(result.target.adOrderShare).toBeCloseTo(3 / 7, 10);
    expect(result.target.estimatedAdOrders).toBeNull();
    expect(result.target.estimatedNonAdOrders).toBeNull();
    expect(result.target.estimatedAdCvr).toBeNull();
    expect(result.target.acos).toBeNull();
    expect(result.target.tacos).toBeNull();
    expect(result.target.profitAfterAds).toBeNull();
    expect(result.warnings.some((warning) => warning.includes("未输入竞品总订单"))).toBe(true);
  });

  it("ignores an empty template row instead of treating zero as a calibration", () => {
    const result = calculateAdvertisingEstimate([
      { ...sample, id: "empty", name: "空白样本", adScore: 0, organicScore: 0, adClicks: 0, adSpend: 0, cpcProxy: 0, totalOrders: 0, adOrders: 0 },
    ], target);

    expect(result.scales.clickScale).toBeNull();
    expect(result.scales.cpcScale).toBeNull();
    expect(result.scales.orderTendency).toBeNull();
    expect(result.target.estimatedSpend).toBeNull();
    expect(result.quality.level).toBe("unavailable");
  });

  it("does not treat a zero target ad score as confirmed zero spend", () => {
    const result = calculateAdvertisingEstimate([sample], { ...target, adScore: 0 });

    expect(result.target.trafficShare).toBeNull();
    expect(result.target.estimatedClicks).toBeNull();
    expect(result.target.estimatedSpend).toBeNull();
    expect(result.target.adOrderShare).toBeNull();
    expect(result.target.intervals.estimatedClicks.p50).toBeNull();
  });

  it("does not emit order counts when the target total order value is zero", () => {
    const result = calculateAdvertisingEstimate([sample], { ...target, totalOrders: 0 });

    expect(result.target.adOrderShare).toBeCloseTo(3 / 7, 10);
    expect(result.target.estimatedAdOrders).toBeNull();
    expect(result.target.estimatedNonAdOrders).toBeNull();
    expect(result.warnings.some((warning) => warning.includes("不把它当作可靠 Q"))).toBe(true);
  });

  it("returns P25/P50/P75 scenario intervals while preserving the median point estimate", () => {
    const lowerSample: CalibrationSample = {
      ...sample,
      id: "sample-lower",
      adClicks: 1600,
      adSpend: 960,
    };
    const inRangeTarget: AdvertisingTarget = {
      ...target,
      adScore: 4000,
      organicScore: 2000,
      cpcProxy: 1.2,
    };
    const result = calculateAdvertisingEstimate([lowerSample, sample], inRangeTarget);

    expect(result.target.intervals.estimatedClicks.p25).toBeCloseTo(2000, 10);
    expect(result.target.intervals.estimatedClicks.p50).toBeCloseTo(2400, 10);
    expect(result.target.intervals.estimatedClicks.p75).toBeCloseTo(2800, 10);
    expect(result.target.intervals.estimatedCpc.p25).toBeCloseTo(0.72, 10);
    expect(result.target.intervals.estimatedCpc.p50).toBeCloseTo(0.84, 10);
    expect(result.target.intervals.estimatedCpc.p75).toBeCloseTo(0.96, 10);
    expect(result.target.intervals.estimatedSpend.p25).toBeCloseTo(1440, 10);
    expect(result.target.intervals.estimatedSpend.p50).toBeCloseTo(2016, 10);
    expect(result.target.intervals.estimatedSpend.p75).toBeCloseTo(2688, 10);
    expect(result.target.intervals.estimatedSpend.p50).toBeCloseTo(result.target.estimatedSpend!, 10);
    expect(result.target.intervals.estimatedDailySpend.p50).toBeCloseTo(67.2, 10);
    expect(result.target.intervals.adOrderShare.p25).not.toBeNull();
    expect(result.target.intervals.adOrderShare.p50).toBeCloseTo(result.target.adOrderShare!, 10);
    expect(result.quality.level).toBe("low");
  });

  it("marks target inputs outside calibration ranges as extrapolated and high-risk", () => {
    const result = calculateAdvertisingEstimate([sample], target);

    expect(result.quality.isExtrapolated).toBe(true);
    expect(result.quality.extrapolation).toEqual({
      adScore: true,
      cpcProxy: true,
      adOrganicRatio: true,
    });
    expect(result.quality.level).toBe("high-risk");
    expect(result.warnings.some((warning) => warning.includes("外推"))).toBe(true);
  });

  it("marks inconsistent sample and target observation windows as high-risk", () => {
    const result = calculateAdvertisingEstimate([
      sample,
      { ...sample, id: "sample-14-days", observationDays: 14 },
    ], { ...target, adScore: 4000, organicScore: 2000, cpcProxy: 1.2 });

    expect(result.quality.hasObservationWindowMismatch).toBe(true);
    expect(result.quality.level).toBe("high-risk");
    expect(result.warnings.some((warning) => warning.includes("观察天数不一致"))).toBe(true);
  });

  it("counts validity separately for click, CPC and order samples", () => {
    const clickOnly = {
      ...sample,
      id: "click-only",
      adSpend: 0,
      organicScore: 0,
      totalOrders: 0,
    };
    const result = calculateAdvertisingEstimate([sample, clickOnly], target);

    expect(result.quality.sampleCounts).toEqual({ click: 2, cpc: 1, order: 1 });
    expect(result.warnings.some((warning) => warning.includes("点击尺度仅有 2 个有效样本"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("CPC 尺度仅有 1 个有效样本"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("订单倾向仅有 1 个有效样本"))).toBe(true);
  });

  it("returns null for price/profit dependent metrics when optional business inputs are missing", () => {
    const result = calculateAdvertisingEstimate([sample], {
      ...target,
      unitPrice: null,
      preAdUnitProfit: null,
    });

    expect(result.target.estimatedAdSales).toBeNull();
    expect(result.target.estimatedTotalSales).toBeNull();
    expect(result.target.acos).toBeNull();
    expect(result.target.tacos).toBeNull();
    expect(result.target.breakEvenAcos).toBeNull();
    expect(result.target.maxSafeCpc).toBeNull();
    expect(result.target.profitAfterAds).toBeNull();
    expect(result.target.profitMarginAfterAds).toBeNull();
  });

  it("uses average units per order for sales, profit and the maximum safe CPC", () => {
    const result = calculateAdvertisingEstimate([sample], { ...target, averageUnitsPerOrder: 2 });

    expect(result.target.estimatedAdSales).toBeCloseTo(12000, 10);
    expect(result.target.estimatedTotalSales).toBeCloseTo(28000, 10);
    expect(result.target.acos).toBeCloseTo(0.468, 10);
    expect(result.target.tacos).toBeCloseTo(0.2005714286, 10);
    expect(result.target.maxSafeCpc).toBeCloseTo(0.75, 10);
    expect(result.target.profitAfterAds).toBeCloseTo(2784, 10);
  });

  it("marks an impossible Ad CVR above 100% as high-risk and suppresses safe CPC", () => {
    const result = calculateAdvertisingEstimate([sample], {
      ...target,
      adScore: 4000,
      organicScore: 2000,
      cpcProxy: 1.2,
      totalOrders: 20000,
    });

    expect(result.target.estimatedAdCvr).toBeGreaterThan(1);
    expect(result.quality.hasConversionInconsistency).toBe(true);
    expect(result.quality.level).toBe("high-risk");
    expect(result.target.maxSafeCpc).toBeNull();
    expect(result.warnings.some((warning) => warning.includes("Ad CVR 超过 100%"))).toBe(true);
  });

  it("keeps an Ad CVR of exactly 100% valid while blocking only values above it", () => {
    const result = calculateAdvertisingEstimate([sample], {
      ...target,
      adScore: 4000,
      organicScore: 2000,
      cpcProxy: 1.2,
      totalOrders: 6400,
    });

    expect(result.target.estimatedAdCvr).toBeCloseTo(1, 10);
    expect(result.quality.hasConversionInconsistency).toBe(false);
    expect(result.quality.level).toBe("low");
    expect(result.target.maxSafeCpc).toBeCloseTo(6, 10);
  });

  it("suppresses unit-dependent business metrics when average units per order is invalid", () => {
    const result = calculateAdvertisingEstimate([sample], { ...target, averageUnitsPerOrder: 0 });

    expect(result.target.estimatedAdSales).toBeNull();
    expect(result.target.estimatedTotalSales).toBeNull();
    expect(result.target.acos).toBeNull();
    expect(result.target.tacos).toBeNull();
    expect(result.target.maxSafeCpc).toBeNull();
    expect(result.target.profitAfterAds).toBeNull();
    expect(result.warnings.some((warning) => warning.includes("平均每单件数必须大于 0"))).toBe(true);
  });

  it("does not output a safe CPC when pre-ad unit profit is not positive", () => {
    const result = calculateAdvertisingEstimate([sample], { ...target, preAdUnitProfit: -1 });

    expect(result.target.maxSafeCpc).toBeNull();
    expect(result.warnings.some((warning) => warning.includes("没有可用广告空间"))).toBe(true);
  });

  it("excludes invalid observation windows from every calibration set", () => {
    const result = calculateAdvertisingEstimate([{ ...sample, observationDays: 0 }], target);

    expect(result.quality.sampleCounts).toEqual({ click: 0, cpc: 0, order: 0 });
    expect(result.quality.level).toBe("unavailable");
    expect(result.warnings.some((warning) => warning.includes("观察天数无效"))).toBe(true);
  });
});
