import { describe, expect, it } from "vitest";
import {
  DEFAULT_FBA_PROFIT_INPUT,
  FREIGHT_MODES,
  calculateFbaProfit,
  type FbaProfitInput,
} from "./fbaProfit";

function expectAllNumbersFinite(value: unknown): void {
  if (typeof value === "number") {
    expect(Number.isFinite(value)).toBe(true);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(expectAllNumbersFinite);
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach(expectAllNumbersFinite);
  }
}

describe("FBA profit engine", () => {
  it("reproduces the reference page default calculation", () => {
    const result = calculateFbaProfit(DEFAULT_FBA_PROFIT_INPUT);

    expect(result.validation.errors).toEqual([]);
    expect(result.unit.sizeTier).toBe("Large standard-size");
    expect(result.unit.sizeTierCategory).toBe("Standard");
    expect(result.unit.actualWeightLb).toBeCloseTo(2.64552, 10);
    expect(result.unit.dimensionalWeightLb).toBeCloseTo(4.4042464714288885, 10);
    expect(result.unit.billableWeightLb).toBeCloseTo(4.4042464714288885, 10);
    expect(result.unit.weightBasis).toBe("dimensional");

    expect(result.storage.baseRateUsdPerCubicFoot).toBe(0.78);
    expect(result.storage.utilizationSurchargeRateUsdPerCubicFoot).toBe(0);
    expect(result.storage.feeUsdPerUnitPerMonth).toBeCloseTo(0.2763363091874788, 10);
    expect(result.fees.inboundFeeUsd).toBe(0.57);
    expect(result.fees.fulfillmentBeforeFuelUsd).toBeCloseTo(7.45, 10);
    expect(result.fees.fuelSurchargeUsd).toBeCloseTo(0.26075, 10);
    expect(result.fees.fulfillmentFeeUsd).toBeCloseTo(7.71075, 10);
    expect(result.fees.selectedFbaTotalUsd).toBeCloseTo(8.557086309187477, 10);

    expect(result.carton.unitCount).toBe(6);
    expect(result.carton.dimensionsCm).toEqual([40, 46.5, 42]);
    expect(result.carton.actualWeightKg).toBeCloseTo(8.5, 10);
    expect(result.carton.dimensionalWeightKgBy6000).toBeCloseTo(13.957083333333333, 10);
    expect(result.carton.dimensionalWeightKgBy5000).toBeCloseTo(16.7485, 10);

    expect(FREIGHT_MODES).toHaveLength(7);
    expect(result.selectedChannel.freightUsd).toBeCloseTo(4.098274410774411, 10);
    expect(result.selectedChannel.netProfitUsd).toBeCloseTo(8.30282201435806, 10);
    expect(result.selectedChannel.marginPct).toBeCloseTo(18.05353775681248, 10);
  });

  it("keeps cm/in and g/kg/lb inputs economically equivalent", () => {
    const baseline = calculateFbaProfit(DEFAULT_FBA_PROFIT_INPUT);
    const variants: FbaProfitInput[] = [
      {
        ...DEFAULT_FBA_PROFIT_INPUT,
        length: DEFAULT_FBA_PROFIT_INPUT.length / 2.54,
        width: DEFAULT_FBA_PROFIT_INPUT.width / 2.54,
        height: DEFAULT_FBA_PROFIT_INPUT.height / 2.54,
        dimensionUnit: "in",
      },
      {
        ...DEFAULT_FBA_PROFIT_INPUT,
        weight: DEFAULT_FBA_PROFIT_INPUT.weight / 1000,
        weightUnit: "kg",
      },
      {
        ...DEFAULT_FBA_PROFIT_INPUT,
        weight: DEFAULT_FBA_PROFIT_INPUT.weight / 453.59237,
        weightUnit: "lb",
      },
    ];

    for (const variant of variants) {
      const result = calculateFbaProfit(variant);
      expect(result.unit.sizeTier).toBe(baseline.unit.sizeTier);
      expect(result.unit.billableWeightLb).toBeCloseTo(baseline.unit.billableWeightLb, 9);
      expect(result.fees.fulfillmentFeeUsd).toBeCloseTo(baseline.fees.fulfillmentFeeUsd, 9);
      expect(result.selectedChannel.freightUsd).toBeCloseTo(baseline.selectedChannel.freightUsd, 9);
      expect(result.selectedChannel.netProfitUsd).toBeCloseTo(baseline.selectedChannel.netProfitUsd, 9);
    }
  });

  it("waives inbound placement fees only for the two AGL channels", () => {
    const result = calculateFbaProfit(DEFAULT_FBA_PROFIT_INPUT);
    const nonAglFbaTotal =
      result.storage.feeUsdPerUnitPerMonth + result.fees.fulfillmentFeeUsd + 0.57;
    const aglFbaTotal =
      result.storage.feeUsdPerUnitPerMonth + result.fees.fulfillmentFeeUsd;

    expect(result.channels.default_sea.inboundFeeUsd).toBe(0.57);
    expect(result.channels.sea.inboundFeeUsd).toBe(0.57);
    expect(result.channels.express.inboundFeeUsd).toBe(0.57);
    expect(result.channels.own.inboundFeeUsd).toBe(0);
    expect(result.channels.own_fast.inboundFeeUsd).toBe(0);
    expect(result.channels.default_sea.fbaTotalUsd).toBeCloseTo(nonAglFbaTotal, 10);
    expect(result.channels.own.fbaTotalUsd).toBeCloseTo(aglFbaTotal, 10);
    expect(result.channels.default_sea.fbaTotalUsd - result.channels.own.fbaTotalUsd)
      .toBeCloseTo(0.57, 10);
  });

  it("uses dangerous-goods storage rates without utilization surcharge stacking", () => {
    const dangerous = calculateFbaProfit({
      ...DEFAULT_FBA_PROFIT_INPUT,
      productCategory: "危险品",
      storageTurnoverWeeks: 60,
      storageUtilizationSurcharge: true,
      storageAgedOver30DaysRate: 1,
    });
    const ordinary = calculateFbaProfit({
      ...DEFAULT_FBA_PROFIT_INPUT,
      productCategory: "非服装",
      storageTurnoverWeeks: 60,
      storageUtilizationSurcharge: true,
      storageAgedOver30DaysRate: 1,
    });

    expect(dangerous.storage.baseRateUsdPerCubicFoot).toBe(0.99);
    expect(dangerous.storage.utilizationSurchargeRateUsdPerCubicFoot).toBe(0);
    expect(dangerous.storage.effectiveRateUsdPerCubicFoot).toBe(0.99);
    expect(dangerous.storage.feeUsdPerUnitPerMonth)
      .toBeCloseTo(dangerous.unit.volumeCubicFeet * 0.99, 10);
    expect(ordinary.storage.baseRateUsdPerCubicFoot).toBe(0.78);
    expect(ordinary.storage.utilizationSurchargeRateUsdPerCubicFoot).toBe(1.88);
    expect(ordinary.storage.effectiveRateUsdPerCubicFoot).toBe(2.66);
  });

  it("uses divisor 5000 for express and 6000 for sea and west-air channels", () => {
    const result = calculateFbaProfit(DEFAULT_FBA_PROFIT_INPUT);

    expect(result.channels.express.volumeDivisor).toBe(5000);
    expect(result.channels.express.billableCartonWeightKg).toBeCloseTo(16.7485, 10);
    expect(result.channels.express.freightUsd)
      .toBeCloseTo(97 * 16.7485 / 6 / 7.095, 10);

    for (const mode of ["default_sea", "sea", "fastsea", "west_air", "own", "own_fast"] as const) {
      expect(result.channels[mode].volumeDivisor).toBe(6000);
      expect(result.channels[mode].billableCartonWeightKg)
        .toBeCloseTo(13.957083333333333, 10);
    }
    expect(result.channels.west_air.freightUsd)
      .toBeCloseTo(60 * 13.957083333333333 / 6 / 7.095, 10);
  });

  it("reports oversize, overweight and invalid carton-plan issues", () => {
    const result = calculateFbaProfit({
      ...DEFAULT_FBA_PROFIT_INPUT,
      packCountLength: 10,
      packCountWidth: 2,
      packCountHeight: 3,
      plannedCartonWeightLimitKg: 30,
    });

    expect(result.carton.actualWeightKg).toBeCloseTo(73.3, 10);
    expect(result.carton.isCompliant).toBe(false);
    expect(result.carton.issues.some((issue) => issue.startsWith("超重"))).toBe(true);
    expect(result.carton.issues).toContain("外箱尺寸超限");
    expect(result.carton.issues).toContain("计划毛重上限不得超过22.68kg");

    const invalidCounts = calculateFbaProfit({
      ...DEFAULT_FBA_PROFIT_INPUT,
      packCountLength: 0,
      packCountWidth: 1.5,
    });
    expect(invalidCounts.carton.unitCount).toBe(3);
    expect(invalidCounts.carton.packingCounts).toEqual([1, 1, 3]);
    expect(invalidCounts.carton.issues).toContain("三个方向的装箱数量须为正整数");
  });

  it("requires dimensions to follow longest, middle and shortest directions", () => {
    const result = calculateFbaProfit({
      ...DEFAULT_FBA_PROFIT_INPUT,
      length: 12,
      width: 38,
      height: 22,
    });

    expect(result.validation.isCalculable).toBe(false);
    expect(result.validation.errors).toContain("请按最长边 ≥ 次长边 ≥ 最短边的顺序填写单品尺寸");
    expect(result.unit.dimensionsCm).toEqual([12, 38, 22]);
    expect(result.carton.dimensionsCm).toEqual([14, 78.5, 72]);
  });

  it("returns finite outputs and validation errors for zero and invalid values", () => {
    const result = calculateFbaProfit({
      ...DEFAULT_FBA_PROFIT_INPUT,
      length: Number.NaN,
      width: 0,
      height: -1,
      weight: Number.POSITIVE_INFINITY,
      priceUsd: Number.NaN,
      cogsRmb: Number.NEGATIVE_INFINITY,
      exchangeRateRmbPerUsd: 0,
      advertisingRate: Number.NaN,
      fuelSurchargeRate: Number.POSITIVE_INFINITY,
      refundRate: -1,
      couponRate: 2,
      referralRate: Number.NaN,
      storageTurnoverWeeks: Number.NaN,
      plannedCartonWeightLimitKg: Number.NaN,
    });

    expect(result.validation.isCalculable).toBe(false);
    expect(result.validation.errors).toEqual(expect.arrayContaining([
      "单品三个尺寸都必须是大于0的有效数字",
      "单品重量必须是大于0的有效数字",
      "US售价必须是大于0的有效数字",
      "汇率必须是大于0的有效数字",
    ]));
    expect(result.validation.warnings.length).toBeGreaterThan(0);
    expect(result.selectedChannel.marginPct).toBe(0);
    expectAllNumbersFinite(result);
  });
});
