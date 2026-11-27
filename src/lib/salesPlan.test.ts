import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildDefaultSalesPlanMonths,
  calculateBreakEvenCpo,
  calculateSalesPlan,
  createSalesPlanMonth,
  daysInPlanMonth,
  type SalesPlanAssumptions,
  type SalesPlanMonthInput,
} from "./salesPlan";

const assumptions: SalesPlanAssumptions = {
  productName: "测试产品",
  productId: "TEST",
  currency: "USD",
  actualSellingPrice: 20,
  productCostPerUnit: 3,
  storageCostPerUnit: 0.5,
  fbaFeePerUnit: 5,
  firstMileCostPerUnit: 1,
  referralFeeRate: 0.15,
  returnRate: 0.1,
  averageReturnLoss: 4,
  otherVariableCostRate: 0.037,
};

function baselineMonth(overrides: Partial<SalesPlanMonthInput> = {}): SalesPlanMonthInput {
  return {
    id: "m1",
    month: "2026-01",
    stage: "测款期",
    action: "测试",
    targetDailyUnits: 100 / 31,
    cpo: 3,
    cpc: 0.6,
    naturalOrderShare: 0.4,
    otherVariableCostRateOverride: null,
    ...overrides,
  };
}

describe("sales promotion plan v2", () => {
  it("calculates the per-unit Break-even CPO/CPA", () => {
    expect(calculateBreakEvenCpo(assumptions)).toBeCloseTo(6.36, 8);
  });

  it("calculates advertising metrics from CPO, CPC and natural share", () => {
    const month = calculateSalesPlan(assumptions, [baselineMonth()]).months[0];
    expect(month.monthlyUnits).toBe(100);
    expect(month.naturalUnits).toBeCloseTo(40, 8);
    expect(month.adUnits).toBeCloseTo(60, 8);
    expect(month.adSpend).toBeCloseTo(180, 8);
    expect(month.adClicks).toBeCloseTo(300, 8);
    expect(month.adCvr).toBeCloseTo(0.2, 8);
    expect(month.acos).toBeCloseTo(0.15, 8);
    expect(month.tacos).toBeCloseTo(0.09, 8);
  });

  it("derives every monthly cost total from per-unit assumptions", () => {
    const month = calculateSalesPlan(assumptions, [baselineMonth()]).months[0];
    expect(month.salesRevenue).toBe(2000);
    expect(month.productCostTotal).toBe(300);
    expect(month.firstMileCostTotal).toBe(100);
    expect(month.fbaCostTotal).toBe(500);
    expect(month.referralFeeTotal).toBe(300);
    expect(month.storageCostTotal).toBe(50);
    expect(month.expectedRefundLossTotal).toBe(40);
    expect(month.promotionCostTotal).toBeCloseTo(74, 8);
    expect(month.profitBeforeAds).toBeCloseTo(636, 8);
    expect(month.monthlyProfit).toBeCloseTo(456, 8);
  });

  it("uses normal storage from January through September", () => {
    for (const monthValue of ["2026-01", "2026-05", "2026-09"]) {
      const days = daysInPlanMonth(monthValue);
      const month = calculateSalesPlan(assumptions, [baselineMonth({ month: monthValue, targetDailyUnits: 100 / days })]).months[0];
      expect(month.storageMultiplier).toBe(1);
      expect(month.storageCostTotal).toBe(50);
      expect(month.monthlyBreakEvenCpo).toBeCloseTo(6.36, 8);
    }
  });

  it("multiplies storage by 3.08 from October through December", () => {
    for (const monthValue of ["2026-10", "2026-11", "2026-12"]) {
      const days = daysInPlanMonth(monthValue);
      const month = calculateSalesPlan(assumptions, [baselineMonth({ month: monthValue, targetDailyUnits: 100 / days })]).months[0];
      expect(month.monthlyUnits).toBe(100);
      expect(month.storageMultiplier).toBe(3.08);
      expect(month.storageCostTotal).toBeCloseTo(154, 8);
      expect(month.monthlyBreakEvenCpo).toBeCloseTo(5.32, 8);
    }
  });

  it("allows a monthly other-variable-cost rate override", () => {
    const month = calculateSalesPlan(assumptions, [baselineMonth({ otherVariableCostRateOverride: 0.05 })]).months[0];
    expect(month.effectiveOtherVariableCostRate).toBe(0.05);
    expect(month.otherVariableCostPerUnit).toBe(1);
    expect(month.promotionCostTotal).toBe(100);
    expect(month.monthlyBreakEvenCpo).toBeCloseTo(6.1, 8);
    expect(month.monthlyProfit).toBeCloseTo(430, 8);
  });

  it("preserves a valid zero monthly promotion rate", () => {
    const month = calculateSalesPlan(assumptions, [baselineMonth({ otherVariableCostRateOverride: 0 })]).months[0];
    expect(month.effectiveOtherVariableCostRate).toBe(0);
    expect(month.promotionCostTotal).toBe(0);
    expect(month.monthlyProfit).toBeCloseTo(530, 8);
  });

  it("allows 100% natural sales with zero CPO and CPC", () => {
    const month = calculateSalesPlan(assumptions, [baselineMonth({ naturalOrderShare: 1, cpo: 0, cpc: 0 })]).months[0];
    expect(month.adUnits).toBe(0);
    expect(month.adSpend).toBe(0);
    expect(month.adCvr).toBeNull();
    expect(month.acos).toBeNull();
    expect(month.monthlyProfit).toBeCloseTo(636, 8);
  });

  it("blocks profit when paid sales exist but CPO or CPC is missing", () => {
    const missingCpo = calculateSalesPlan(assumptions, [baselineMonth({ cpo: 0 })]);
    const missingCpc = calculateSalesPlan(assumptions, [baselineMonth({ cpc: 0 })]);
    expect(missingCpo.months[0].warnings).toContain("CPO需大于0");
    expect(missingCpo.months[0].monthlyProfit).toBeNull();
    expect(missingCpc.months[0].warnings).toContain("CPC需大于0");
    expect(missingCpc.months[0].monthlyProfit).toBeNull();
    expect(missingCpc.summary.totalAdSpend).toBeNull();
    expect(missingCpc.summary.operatingProfit).toBeNull();
  });

  it("warns against the month-specific Break-even CPO", () => {
    const month = calculateSalesPlan(assumptions, [baselineMonth({ cpo: 7 })]).months[0];
    expect(month.warnings).toContain("CPO高于当月Break-even");
    expect(month.statusSeverity).toBe("warning");
    expect(month.monthlyProfit).not.toBeNull();
  });

  it("keeps error severity when an advisory and a hard error coexist", () => {
    const month = calculateSalesPlan(assumptions, [baselineMonth({ cpo: 7, cpc: 0 })]).months[0];
    expect(month.warnings).toContain("CPC需大于0");
    expect(month.warnings).toContain("CPO高于当月Break-even");
    expect(month.statusSeverity).toBe("error");
  });

  it("blocks duplicate months and warns for non-ascending months", () => {
    const duplicate = calculateSalesPlan(assumptions, [baselineMonth(), baselineMonth({ id: "m2" })]);
    const outOfOrder = calculateSalesPlan(assumptions, [baselineMonth({ month: "2026-02" }), baselineMonth({ id: "m2", month: "2026-01" })]);
    expect(duplicate.months[0].warnings).toContain("月份重复");
    expect(duplicate.months[1].warnings).toContain("月份重复");
    expect(duplicate.summary.isComplete).toBe(false);
    expect(duplicate.summary.totalUnits).toBeNull();
    expect(duplicate.summary.totalRevenue).toBeNull();
    expect(outOfOrder.months[1].warnings).toContain("月份未按升序排列");
    expect(outOfOrder.summary.isComplete).toBe(false);
    expect(outOfOrder.summary.operatingProfit).toBeNull();
  });

  it("rejects an empty or invalid month", () => {
    const invalid = calculateSalesPlan(assumptions, [baselineMonth({ month: "" })]);
    expect(invalid.months[0].warnings).toContain("月份未填写或格式无效");
    expect(invalid.months[0].monthlyProfit).toBeNull();
  });

  it("builds any requested number of editable months", () => {
    const months = buildDefaultSalesPlanMonths("2026-11", 3);
    expect(months).toHaveLength(3);
    expect(months.map((month) => month.month)).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(createSalesPlanMonth("2027-02", 5).month).toBe("2027-02");
    const thirteenthMonth = createSalesPlanMonth("2027-11", 12);
    expect(thirteenthMonth.stage).toBe("稳定期");
    expect(thirteenthMonth.targetDailyUnits).toBe(32);
    expect(thirteenthMonth.naturalOrderShare).toBe(0.7);
  });

  it("keeps exact decimal monthly sales instead of rounding", () => {
    const month = calculateSalesPlan(assumptions, [baselineMonth({ targetDailyUnits: 10.5 })]).months[0];
    expect(month.monthlyUnits).toBe(325.5);
    expect(month.salesRevenue).toBe(6510);
  });

  it("handles month arithmetic and leap years", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("invalid", 1)).toBe("");
    expect(daysInPlanMonth("2028-02")).toBe(29);
    expect(daysInPlanMonth("invalid")).toBe(0);
  });

  it("rolls profit into the summary without an initial investment", () => {
    const result = calculateSalesPlan(assumptions, [baselineMonth(), baselineMonth({ id: "m2", month: "2026-02", targetDailyUnits: 100 / 28 })]);
    expect(result.summary.totalUnits).toBe(200);
    expect(result.summary.totalRevenue).toBe(4000);
    expect(result.summary.totalAdSpend).toBeCloseTo(360, 8);
    expect(result.summary.operatingProfit).toBeCloseTo(912, 8);
    expect(result.summary.endingCumulativeProfit).toBeCloseTo(912, 8);
    expect(result.summary.maximumFundingGap).toBe(0);
    expect(result.summary.breakEvenCpo).toBeCloseTo(6.36, 8);
  });

  it("reports the maximum funding gap from cumulative losses", () => {
    const result = calculateSalesPlan(assumptions, [baselineMonth({ cpo: 20 })]);
    expect(result.months[0].monthlyProfit).toBeCloseTo(-564, 8);
    expect(result.summary.maximumFundingGap).toBeCloseTo(564, 8);
    expect(result.summary.negativeProfitMonths).toBe(1);
  });

  it("rejects fixed or monthly rates outside 0% to 100%", () => {
    const invalidFixed = calculateSalesPlan({ ...assumptions, referralFeeRate: 1.2 }, [baselineMonth()]);
    const invalidMonthly = calculateSalesPlan(assumptions, [baselineMonth({ naturalOrderShare: 1.2 })]);
    expect(invalidFixed.summary.breakEvenCpo).toBeNull();
    expect(invalidFixed.months[0].monthlyProfit).toBeNull();
    expect(invalidMonthly.months[0].monthlyProfit).toBeNull();
  });
});
