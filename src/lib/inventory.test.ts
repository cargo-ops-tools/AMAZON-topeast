import { describe, expect, it } from "vitest";
import {
  calculateInventoryAge,
  calculateInventoryCosts,
  calculateLiquidationProcessingFee,
  calculateRemovalFeePerUnit,
  classifyInventoryPackage,
  getAgedInventoryRate,
  getStorageRates,
  getStorageSeasonFromDate,
  type InventoryInput,
} from "./inventory";

const input: InventoryInput = {
  sku: "SKU-AGING",
  asin: "B000000000",
  productName: "示例产品",
  currentInventory: 420,
  packageLengthCm: 35,
  packageWidthCm: 24.5,
  packageHeightCm: 7.5,
  actualWeightKg: 0.6,
  averageDailySales: 2.5,
  inboundDate: "2025-06-15",
  currentDate: "2026-07-28",
  dangerousGoods: false,
  utilizationEligible: false,
  utilizationWeeks: 18,
  storageSeason: "offPeak",
  customAgedRate: null,
  agedSurchargeEarlyTierExempt: false,
  removalQuantity: 420,
  customRemovalFee: null,
  liquidationQuantity: 420,
  averageSellingPrice: 20,
  unitCost: 8,
  firstMileCostPerUnit: 2.5,
  recoveryRate: 0.08,
  forecastMonths: 12,
};

const smallStandardPackage = {
  packageLengthCm: 10,
  packageWidthCm: 10,
  packageHeightCm: 1,
  actualWeightKg: 0.09,
};

describe("package classification", () => {
  it("derives volume, dimensional weight, tier and shipping weight from cm and kg", () => {
    const result = classifyInventoryPackage(35, 24.5, 7.5, 0.6);
    expect(result.valid).toBe(true);
    expect(result.unitVolumeCuFt).toBeCloseTo(0.2271174504, 8);
    expect(result.actualWeightLb).toBeCloseTo(1.322773572, 8);
    expect(result.dimensionalWeightLb).toBeCloseTo(2.823445714, 8);
    expect(result.sizeTierName).toBe("Large standard-size");
    expect(result.sizeTier).toBe("standard");
    expect(result.shippingWeightLb).toBe(3);
    expect(result.weightBasis).toBe("dimensional");
  });

  it("sorts the three package dimensions before classification", () => {
    const first = classifyInventoryPackage(35, 24.5, 7.5, 0.6);
    const shuffled = classifyInventoryPackage(7.5, 35, 24.5, 0.6);
    expect(shuffled.sortedDimensionsCm).toEqual([35, 24.5, 7.5]);
    expect(shuffled).toEqual(first);
  });

  it("rounds sub-one-pound standard shipping weight up to 0.1 lb", () => {
    const result = classifyInventoryPackage(10, 10, 1, 0.2);
    expect(result.sizeTierName).toBe("Small standard-size");
    expect(result.actualWeightLb).toBeCloseTo(0.440924524, 8);
    expect(result.shippingWeightLb).toBe(0.5);
    expect(result.weightBasis).toBe("actual-only");
  });

  it("classifies bulky packages and rounds shipping weight up to a whole pound", () => {
    const result = classifyInventoryPackage(60, 40, 30, 1);
    expect(result.sizeTierName).toBe("Small bulky");
    expect(result.sizeTier).toBe("oversize");
    expect(result.shippingWeightLb).toBe(32);
  });

  it("returns an invalid result when any package input is missing", () => {
    const result = classifyInventoryPackage(35, 24.5, 0, 0.6);
    expect(result.valid).toBe(false);
    expect(result.shippingWeightLb).toBe(0);
    expect(result.sizeTierName).toBe("待计算");
  });
});

describe("inventory age and rate cards", () => {
  it("calculates inventory age using calendar dates", () => {
    expect(calculateInventoryAge("2026-01-01", "2026-07-01")).toBe(181);
  });

  it("matches monthly storage season and size tier", () => {
    expect(getStorageRates("2026-07-28", "standard", false, false, 0, 100).baseRate).toBe(0.78);
    expect(getStorageRates("2026-11-01", "oversize", false, false, 0, 100).baseRate).toBe(1.40);
    expect(getStorageRates("2026-11-01", "standard", true, false, 0, 100).baseRate).toBe(3.63);
  });

  it("uses the selected Amazon storage season instead of a manual numeric rate", () => {
    expect(getStorageSeasonFromDate("2026-09-30")).toBe("offPeak");
    expect(getStorageSeasonFromDate("2026-10-01")).toBe("peak");
    expect(getStorageRates("2026-07-28", "standard", false, false, 0, 100, "peak").baseRate).toBe(2.40);
    expect(getStorageRates("2026-11-01", "oversize", false, false, 0, 100, "offPeak").baseRate).toBe(0.56);
    expect(getStorageRates("2026-07-28", "standard", true, false, 0, 100, "offPeak").baseRate).toBe(0.99);
  });

  it("matches storage utilization surcharge tiers", () => {
    expect(getStorageRates("2026-07-28", "standard", false, true, 25, 100).utilizationRate).toBe(0.44);
    expect(getStorageRates("2026-07-28", "oversize", false, true, 54, 100).utilizationRate).toBe(1.26);
  });

  it("uses the 2026 minimum aged fee for 12 to 15 month inventory", () => {
    expect(getAgedInventoryRate(400)).toEqual({ ageBand: "366–455 天", volumeRate: 6.90, minimumPerUnit: 0.30 });
    expect(getAgedInventoryRate(500)).toEqual({ ageBand: "456 天以上", volumeRate: 7.90, minimumPerUnit: 0.35 });
  });

  it("applies the 181–270 day exemption for clothing, shoes, bags, jewelry and watches", () => {
    expect(getAgedInventoryRate(200, null, true)).toEqual({ ageBand: "181–210 天（豁免类目）", volumeRate: 0, minimumPerUnit: 0 });
    expect(getAgedInventoryRate(240, null, true).volumeRate).toBe(0);
    expect(getAgedInventoryRate(270, null, true).volumeRate).toBe(0);
    expect(getAgedInventoryRate(271, null, true).volumeRate).toBe(5.45);
    expect(getAgedInventoryRate(200, 9, true)).toEqual({ ageBand: "181–210 天（豁免类目）", volumeRate: 0, minimumPerUnit: 0 });
  });

  it("keeps the official minimum per-unit fee when only volume rate is overridden", () => {
    expect(getAgedInventoryRate(400, 8)).toEqual({ ageBand: "366–455 天 · 手动体积费率", volumeRate: 8, minimumPerUnit: 0.30 });
    expect(getAgedInventoryRate(500, 9)).toEqual({ ageBand: "456 天以上 · 手动体积费率", volumeRate: 9, minimumPerUnit: 0.35 });
  });
});

describe("removal and liquidation", () => {
  it("matches 2026 removal fee weight bands", () => {
    expect(calculateRemovalFeePerUnit("standard", 0)).toBe(0);
    expect(calculateRemovalFeePerUnit("standard", 0.4)).toBe(0.84);
    expect(calculateRemovalFeePerUnit("standard", 1.2)).toBe(2.27);
    expect(calculateRemovalFeePerUnit("standard", 11)).toBeCloseTo(12.43, 6);
    expect(calculateRemovalFeePerUnit("oversize", 12)).toBe(16.44);
  });

  it("matches the 600-unit, 11 lb removal example while keeping internal cost positive", () => {
    const result = calculateInventoryCosts({
      ...input,
      currentInventory: 600,
      removalQuantity: 600,
      liquidationQuantity: 0,
      actualWeightKg: 4.8,
    });
    expect(result.packageClassification.sizeTierName).toBe("Large standard-size");
    expect(result.packageClassification.shippingWeightLb).toBe(11);
    expect(result.removalFeePerUnit).toBeCloseTo(12.43, 6);
    expect(result.removalTotalFee).toBeCloseTo(7458, 6);
  });

  it("matches liquidation processing fee bands", () => {
    expect(calculateLiquidationProcessingFee("standard", 1.2)).toBe(0.35);
    expect(calculateLiquidationProcessingFee("oversize", 12)).toBe(2.30);
    expect(calculateLiquidationProcessingFee("standard", 0)).toBe(0);
  });

  it("uses ASP rather than product cost for gross recovery", () => {
    const result = calculateInventoryCosts({
      ...input,
      currentInventory: 1,
      liquidationQuantity: 1,
      averageSellingPrice: 20,
      recoveryRate: 0.075,
      ...smallStandardPackage,
    });
    expect(result.liquidationGrossRecovery).toBeCloseTo(1.5, 6);
    expect(result.liquidationReferralFee).toBeCloseTo(0.23, 6);
    expect(result.liquidationProcessingFee).toBeCloseTo(0.25, 6);
    expect(result.liquidationNetRecovery).toBeCloseTo(1.02, 6);
  });

  it("keeps negative net recovery instead of truncating it to zero", () => {
    const result = calculateInventoryCosts({
      ...input,
      currentInventory: 1,
      liquidationQuantity: 1,
      averageSellingPrice: 1,
      recoveryRate: 0.05,
      ...smallStandardPackage,
    });
    expect(result.liquidationNetRecovery).toBeCloseTo(-0.21, 6);
  });
});

describe("complete inventory scenario", () => {
  it("calculates storage, aged, removal and net liquidation economics", () => {
    const result = calculateInventoryCosts(input);
    expect(result.packageClassification.sizeTierName).toBe("Large standard-size");
    expect(result.packageClassification.shippingWeightLb).toBe(3);
    expect(result.totalVolume).toBeCloseTo(95.389329, 6);
    expect(result.monthlyStorageFee).toBeCloseTo(74.403677, 6);
    expect(result.agedInventoryFee).toBeCloseTo(658.186371, 6);
    expect(result.removalTotalFee).toBeCloseTo(1659, 6);
    expect(result.liquidationGrossRecovery).toBeCloseTo(672, 6);
    expect(result.liquidationNetRecovery).toBeCloseTo(319.2, 6);
    expect(result.liquidationProductCost).toBeCloseTo(3360, 6);
    expect(result.liquidationFirstMileCost).toBeCloseTo(1050, 6);
    expect(result.liquidationPnl).toBeCloseTo(-4090.8, 6);
    expect(result.liquidationLoss).toBeCloseTo(4090.8, 6);
    expect(result.forecast.length).toBe(6);
    expect(result.projectedHoldingCostReady).toBe(true);
  });

  it("keeps monthly storage separate from liquidation P&L", () => {
    const offPeak = calculateInventoryCosts({ ...input, currentDate: "2026-07-28", storageSeason: "offPeak" });
    const peak = calculateInventoryCosts({ ...input, currentDate: "2026-07-28", storageSeason: "peak" });
    expect(peak.storageRates.season).toBe("peak");
    expect(peak.monthlyBaseStorageFee).toBeCloseTo(peak.totalVolume * 2.40, 6);
    expect(peak.monthlyStorageFee).toBeGreaterThan(offPeak.monthlyStorageFee);
    expect(peak.liquidationPnl).toBeCloseTo(offPeak.liquidationPnl, 6);
  });

  it("uses the selected season for forecast month one, then follows calendar months", () => {
    const result = calculateInventoryCosts({
      ...input,
      currentInventory: 10,
      averageDailySales: 0,
      currentDate: "2026-09-01",
      inboundDate: "2026-08-01",
      storageSeason: "offPeak",
      forecastMonths: 2,
      removalQuantity: 0,
      liquidationQuantity: 0,
    });
    expect(result.forecast.map((row) => row.storageSeason)).toEqual(["offPeak", "peak"]);
    expect(result.forecast[0].storageFee).toBeCloseTo(result.totalVolume * 0.78, 6);
    expect(result.forecast[1].storageFee).toBeCloseTo(result.totalVolume * 2.40, 6);
  });

  it("does not use an incomplete liquidation estimate in the recommendation", () => {
    const result = calculateInventoryCosts({
      ...input,
      removalQuantity: 0,
      packageHeightCm: 0,
    });
    expect(result.liquidationConfigured).toBe(false);
    expect(result.liquidationPnl).toBe(0);
    expect(result.decision).not.toBe("liquidate");
    expect(result.warnings).toContain("包装长、宽、高或实际重量未补齐，无法自动判定 Size Tier 与 Shipping Weight。");
  });

  it("does not treat a missing inbound date as zero-day inventory", () => {
    const result = calculateInventoryCosts({
      ...input,
      inboundDate: "",
      forecastMonths: 12,
      currentInventory: 90,
      averageDailySales: 3,
      removalQuantity: 0,
      liquidationQuantity: 0,
    });
    expect(result.inventoryAgeReady).toBe(false);
    expect(result.agedCalculationReady).toBe(false);
    expect(result.projectedHoldingCostReady).toBe(false);
    expect(result.agedInventoryFee).toBe(0);
    expect(result.forecast.every((row) => !row.ageKnown && row.agedFee === 0)).toBe(true);
    expect(result.decision).not.toBe("continue");
    expect(result.decisionTitle).toBe("补齐入仓日期后评估");
    expect(result.warnings).toContain("入仓日期未填写，老化库存费与库龄推演暂不计算。");
  });

  it("does not let a manual volume rate replace a missing inbound date", () => {
    const result = calculateInventoryCosts({
      ...input,
      inboundDate: "",
      customAgedRate: 9,
      forecastMonths: 12,
    });
    expect(result.inventoryAgeReady).toBe(false);
    expect(result.agedCalculationReady).toBe(false);
    expect(result.projectedHoldingCostReady).toBe(false);
    expect(result.agedInventoryQuantity).toBe(0);
    expect(result.agedInventoryFee).toBe(0);
    expect(result.forecast.every((row) => !row.ageKnown && row.agedFee === 0)).toBe(true);
    expect(result.warnings).toContain("入仓日期未填写，老化库存费与库龄推演暂不计算。");
  });

  it("does not charge a manual aged volume rate before day 181", () => {
    const result = calculateInventoryCosts({
      ...input,
      inboundDate: "2026-07-01",
      currentDate: "2026-07-20",
      customAgedRate: 9,
    });
    expect(result.inventoryAgeDays).toBe(19);
    expect(result.agedCalculationReady).toBe(true);
    expect(result.agedInventoryQuantity).toBe(0);
    expect(result.agedInventoryFee).toBe(0);
    expect(result.forecast.slice(0, 5).every((row) => row.ageDays < 181 && row.agedFee === 0)).toBe(true);
    expect(result.forecast[5].ageDays).toBeGreaterThanOrEqual(181);
    expect(result.forecast[5].agedFee).toBeGreaterThan(0);
  });

  it("does not calculate aged fees when the current date is before the inbound date", () => {
    const result = calculateInventoryCosts({
      ...input,
      inboundDate: "2026-08-01",
      currentDate: "2026-07-20",
      forecastMonths: 12,
    });
    const withManualRate = calculateInventoryCosts({
      ...input,
      inboundDate: "2026-08-01",
      currentDate: "2026-07-20",
      customAgedRate: 9,
      forecastMonths: 12,
    });
    expect(result.inventoryAgeReady).toBe(false);
    expect(result.agedCalculationReady).toBe(false);
    expect(result.projectedHoldingCostReady).toBe(false);
    expect(result.agedInventoryFee).toBe(0);
    expect(result.forecast.every((row) => !row.ageKnown && row.agedFee === 0)).toBe(true);
    expect(result.warnings).toContain("当前日期早于入仓日期，请检查日期；库龄与老化库存费暂不计算。");
    expect(withManualRate.inventoryAgeReady).toBe(false);
    expect(withManualRate.agedCalculationReady).toBe(false);
    expect(withManualRate.projectedHoldingCostReady).toBe(false);
    expect(withManualRate.agedInventoryFee).toBe(0);
    expect(withManualRate.forecast.every((row) => !row.ageKnown && row.agedFee === 0)).toBe(true);
  });

  it("does not charge the early aged surcharge for an eligible bag-category item", () => {
    const exempt = calculateInventoryCosts({
      ...input,
      inboundDate: "2026-01-01",
      currentDate: "2026-07-20",
      agedSurchargeEarlyTierExempt: true,
    });
    const standard = calculateInventoryCosts({
      ...input,
      inboundDate: "2026-01-01",
      currentDate: "2026-07-20",
      agedSurchargeEarlyTierExempt: false,
    });
    expect(exempt.inventoryAgeDays).toBe(200);
    expect(exempt.agedInventoryQuantity).toBe(input.currentInventory);
    expect(exempt.agedInventoryFee).toBe(0);
    expect(standard.agedInventoryFee).toBeGreaterThan(0);
  });

  it("keeps the eligible-category exemption when a manual volume rate is enabled", () => {
    const result = calculateInventoryCosts({
      ...input,
      inboundDate: "2026-01-01",
      currentDate: "2026-07-20",
      agedSurchargeEarlyTierExempt: true,
      customAgedRate: 9,
    });
    expect(result.inventoryAgeDays).toBe(200);
    expect(result.agedRates.ageBand).toBe("181–210 天（豁免类目）");
    expect(result.agedInventoryFee).toBe(0);
  });

  it("distinguishes missing first-mile cost from an explicit zero", () => {
    const missing = calculateInventoryCosts({ ...input, firstMileCostPerUnit: null });
    const explicitZero = calculateInventoryCosts({ ...input, firstMileCostPerUnit: 0 });
    expect(missing.liquidationConfigured).toBe(false);
    expect(missing.warnings).toContain("头程成本未填写；如确认无头程成本，请明确输入 0。");
    expect(explicitZero.liquidationConfigured).toBe(true);
  });

  it("can recommend removal when liquidation inputs are incomplete", () => {
    const result = calculateInventoryCosts({
      ...input,
      averageSellingPrice: 0,
      customRemovalFee: 0.1,
      averageDailySales: 0,
    });
    expect(result.liquidationConfigured).toBe(false);
    expect(result.decision).toBe("remove");
  });

  it("uses the minimum per-unit aged fee when it is higher than the volume fee", () => {
    const result = calculateInventoryCosts({ ...input, ...smallStandardPackage, inboundDate: "2025-01-01", currentDate: "2026-07-28" });
    expect(result.agedRates.ageBand).toBe("456 天以上");
    expect(result.agedVolumeFee).toBeCloseTo(11.717406, 6);
    expect(result.agedMinimumFee).toBeCloseTo(147, 6);
    expect(result.agedInventoryFee).toBeCloseTo(147, 6);
  });

  it("recommends continuing for healthy young inventory", () => {
    const result = calculateInventoryCosts({ ...input, currentInventory: 90, averageDailySales: 3, inboundDate: "2026-06-01", removalQuantity: 90, liquidationQuantity: 90 });
    expect(result.decision).toBe("continue");
  });

  it("compares partial exit plans against the matching share of holding cost", () => {
    const result = calculateInventoryCosts({ ...input, removalQuantity: 1, liquidationQuantity: 1, forecastMonths: 1 });
    expect(result.decision).toBe("promote");
  });
});
