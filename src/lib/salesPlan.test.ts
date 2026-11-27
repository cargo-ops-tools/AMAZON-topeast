import { describe, expect, it } from "vitest";
import {
  calculateSalesPlan,
  type SalesPlanAssumptions,
  type SalesPlanMonthInput,
} from "./salesPlan";

const assumptions: SalesPlanAssumptions = {
  productName: "测试产品",
  productId: "TEST",
  currency: "USD",
  startMonth: "2026-01",
  initialInventory: 1000,
  unitsPerOrder: 1,
  productCostPerUnit: 3.84,
  packagingCostPerUnit: 0,
  budgetFbaPerUnit: 5.52,
  budgetFirstMilePerUnit: 0.61,
  referralFeeRate: 0.15,
  returnRate: 0.05,
  averageReturnLoss: 10,
  otherNetExpensePoolRate: 0.037,
  monthlyFixedOperatingCost: 0,
  initialInvestment: 0,
};

function baselineMonth(overrides: Partial<SalesPlanMonthInput> = {}): SalesPlanMonthInput {
  return {
    id: "m1",
    month: "2026-01",
    periodType: "plan",
    stage: "测款期",
    action: "测试",
    targetDailyUnits: 100 / 31,
    naturalDailyOrders: 0,
    unitPrice: 20,
    promotionDiscountRate: 0.1,
    promotionOrderShare: 1,
    cpo: 3,
    cpc: 1,
    receipts: 0,
    storageCost: 50,
    couponExpenseRate: 0,
    dealExpenseRate: 0,
    vineExpenseRate: 0,
    actualRefundLoss: null,
    actualFbaFee: null,
    actualFirstMileCost: null,
    ...overrides,
  };
}

describe("sales promotion plan", () => {
  it("reconciles the baseline plan month", () => {
    const month = calculateSalesPlan(assumptions, [baselineMonth()]).months[0];
    expect(month.actualUnits).toBe(100);
    expect(month.netSalesBeforeRefund).toBeCloseTo(1800, 8);
    expect(month.adSpend).toBeCloseTo(300, 8);
    expect(month.adClicks).toBeCloseTo(300, 8);
    expect(month.adCvr).toBeCloseTo(1 / 3, 8);
    expect(month.fbaCost).toBeCloseTo(552, 8);
    expect(month.firstMileCost).toBeCloseTo(61, 8);
    expect(month.refundLoss).toBeCloseTo(50, 8);
    expect(month.otherNetExpense).toBeCloseTo(74, 8);
    expect(month.monthlyProfit).toBeCloseTo(59, 8);
  });

  it("splits the 3.7% pool without adding another 3.7%", () => {
    const month = calculateSalesPlan(assumptions, [baselineMonth({
      couponExpenseRate: 0.01,
      dealExpenseRate: 0.005,
      vineExpenseRate: 0.002,
    })]).months[0];
    expect(month.residualOtherNetExpenseRate).toBeCloseTo(0.02, 8);
    expect(month.totalOtherNetExpenseRate).toBeCloseTo(0.037, 8);
    expect(month.otherNetExpense).toBeCloseTo(74, 8);
    expect(month.monthlyProfit).toBeCloseTo(59, 8);
  });

  it("uses explicit rates above the default pool and warns", () => {
    const month = calculateSalesPlan(assumptions, [baselineMonth({
      couponExpenseRate: 0.02,
      dealExpenseRate: 0.01,
      vineExpenseRate: 0.01,
    })]).months[0];
    expect(month.residualOtherNetExpenseRate).toBe(0);
    expect(month.totalOtherNetExpenseRate).toBeCloseTo(0.04, 8);
    expect(month.otherNetExpense).toBeCloseTo(80, 8);
    expect(month.monthlyProfit).toBeCloseTo(53, 8);
    expect(month.warnings).toContain("费用明细高于默认率");
  });

  it("uses actual refund, FBA and first-mile values", () => {
    const month = calculateSalesPlan(assumptions, [baselineMonth({
      periodType: "actual",
      actualRefundLoss: 50,
      actualFbaFee: 600,
      actualFirstMileCost: 70,
    })]).months[0];
    expect(month.fbaCost).toBe(600);
    expect(month.firstMileCost).toBe(70);
    expect(month.refundLoss).toBe(50);
    expect(month.monthlyProfit).toBeCloseTo(2, 8);
  });

  it("preserves valid zero actual overrides", () => {
    const month = calculateSalesPlan(assumptions, [baselineMonth({
      periodType: "actual",
      actualRefundLoss: 50,
      actualFbaFee: 0,
      actualFirstMileCost: 0,
    })]).months[0];
    expect(month.fbaCost).toBe(0);
    expect(month.firstMileCost).toBe(0);
    expect(month.monthlyProfit).toBeCloseTo(672, 8);
  });

  it("deducts refunds separately without changing net sales or TACoS", () => {
    const withRefund = calculateSalesPlan(assumptions, [baselineMonth({
      periodType: "actual",
      actualRefundLoss: 50,
      actualFbaFee: 600,
      actualFirstMileCost: 70,
    })]).months[0];
    const withoutRefund = calculateSalesPlan(assumptions, [baselineMonth({
      periodType: "actual",
      actualRefundLoss: 0,
      actualFbaFee: 600,
      actualFirstMileCost: 70,
    })]).months[0];
    expect(withoutRefund.netSalesBeforeRefund).toBe(withRefund.netSalesBeforeRefund);
    expect(withoutRefund.tacos).toBe(withRefund.tacos);
    expect((withoutRefund.monthlyProfit ?? 0) - (withRefund.monthlyProfit ?? 0)).toBeCloseTo(50, 8);
  });

  it("keeps storage independent from the percentage pool", () => {
    const baseline = calculateSalesPlan(assumptions, [baselineMonth()]).months[0];
    const higherStorage = calculateSalesPlan(assumptions, [baselineMonth({ storageCost: 80 })]).months[0];
    expect(higherStorage.totalOtherNetExpenseRate).toBeCloseTo(0.037, 8);
    expect((baseline.monthlyProfit ?? 0) - (higherStorage.monthlyProfit ?? 0)).toBeCloseTo(30, 8);
  });

  it("supports changing the total pool assumption", () => {
    const result = calculateSalesPlan({ ...assumptions, otherNetExpensePoolRate: 0.05 }, [baselineMonth()]);
    expect(result.months[0].otherNetExpense).toBeCloseTo(100, 8);
    expect(result.months[0].monthlyProfit).toBeCloseTo(33, 8);
  });

  it("does not publish partial annual profit when an actual month is incomplete", () => {
    const result = calculateSalesPlan(assumptions, [
      baselineMonth(),
      baselineMonth({ id: "m2", month: "2026-02", periodType: "actual" }),
    ]);
    expect(result.months[1].status).toBe("实际月缺退款");
    expect(result.months[1].monthlyProfit).toBeNull();
    expect(result.summary.isComplete).toBe(false);
    expect(result.summary.operatingProfit).toBeNull();
    expect(result.summary.endingCumulativeProfit).toBeNull();
    expect(result.summary.maximumFundingGap).toBeNull();
  });

  it("rolls inventory and cumulative profit across months", () => {
    const result = calculateSalesPlan(assumptions, [
      baselineMonth(),
      baselineMonth({ id: "m2", month: "2026-02", targetDailyUnits: 100 / 28 }),
    ]);
    expect(result.months[0].endingInventory).toBe(900);
    expect(result.months[1].openingInventory).toBe(900);
    expect(result.months[1].endingInventory).toBe(800);
    expect(result.months[1].cumulativeProfit).toBeCloseTo(118, 8);
    expect(result.summary.operatingProfit).toBeCloseTo(118, 8);
  });

  it("includes the initial investment in the maximum funding gap", () => {
    const result = calculateSalesPlan(
      { ...assumptions, initialInvestment: 50 },
      [baselineMonth({ storageCost: 0, cpo: 1 })],
    );
    expect(result.months[0].monthlyProfit).toBeGreaterThan(50);
    expect(result.summary.maximumFundingGap).toBe(50);
  });

  it("keeps the order mix and profit calculable during a stockout", () => {
    const result = calculateSalesPlan(
      { ...assumptions, initialInventory: 50 },
      [baselineMonth({ naturalDailyOrders: 20 / 31 })],
    );
    const month = result.months[0];
    expect(month.actualUnits).toBe(50);
    expect(month.naturalOrders).toBeCloseTo(10, 8);
    expect(month.adOrders).toBeCloseTo(40, 8);
    expect(month.monthlyProfit).not.toBeNull();
    expect(month.warnings).toContain("库存不足");
  });

  it("does not publish weighted ad ratios when an ad month is incomplete", () => {
    const result = calculateSalesPlan(assumptions, [baselineMonth({ cpo: 0 })]);
    expect(result.months[0].adSpend).toBeNull();
    expect(result.summary.totalAdSpend).toBeNull();
    expect(result.summary.weightedTacos).toBeNull();
    expect(result.summary.weightedAcos).toBeNull();
  });

  it("rejects fixed rates outside 0% to 100%", () => {
    const result = calculateSalesPlan(
      { ...assumptions, referralFeeRate: 1.5 },
      [baselineMonth()],
    );
    expect(result.months[0].warnings).toContain("固定费率需在0%至100%之间");
    expect(result.months[0].monthlyProfit).toBeNull();
    expect(result.summary.isComplete).toBe(false);
  });
});
