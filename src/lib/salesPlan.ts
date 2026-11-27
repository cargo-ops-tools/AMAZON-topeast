export type SalesPlanPeriodType = "actual" | "plan";
export type SalesPlanStatusSeverity = "ok" | "warning" | "error";

export interface SalesPlanAssumptions {
  productName: string;
  productId: string;
  currency: string;
  startMonth: string;
  initialInventory: number;
  unitsPerOrder: number;
  productCostPerUnit: number;
  packagingCostPerUnit: number;
  budgetFbaPerUnit: number;
  budgetFirstMilePerUnit: number;
  referralFeeRate: number;
  returnRate: number;
  averageReturnLoss: number;
  otherNetExpensePoolRate: number;
  monthlyFixedOperatingCost: number;
  initialInvestment: number;
}

export interface SalesPlanMonthInput {
  id: string;
  month: string;
  periodType: SalesPlanPeriodType;
  stage: string;
  action: string;
  targetDailyUnits: number;
  naturalDailyOrders: number;
  unitPrice: number;
  promotionDiscountRate: number;
  promotionOrderShare: number;
  cpo: number;
  cpc: number;
  receipts: number;
  storageCost: number;
  couponExpenseRate: number;
  dealExpenseRate: number;
  vineExpenseRate: number;
  actualRefundLoss: number | null;
  actualFbaFee: number | null;
  actualFirstMileCost: number | null;
}

export interface SalesPlanMonthResult extends SalesPlanMonthInput {
  days: number;
  targetUnits: number;
  openingInventory: number;
  availableInventory: number;
  actualUnits: number;
  stockoutUnits: number;
  endingInventory: number;
  totalOrders: number | null;
  plannedNaturalOrders: number;
  naturalOrders: number | null;
  adOrders: number | null;
  adSpend: number | null;
  adClicks: number | null;
  adCvr: number | null;
  grossSales: number;
  promotionDiscount: number;
  netSalesBeforeRefund: number;
  averageNetAsp: number | null;
  adSales: number | null;
  acos: number | null;
  tacos: number | null;
  referralFee: number;
  productAndPackagingCost: number;
  fbaCost: number | null;
  firstMileCost: number | null;
  expectedRefundLoss: number;
  refundLoss: number | null;
  residualOtherNetExpenseRate: number;
  totalOtherNetExpenseRate: number;
  otherNetExpense: number;
  profitBeforeAds: number | null;
  preAdUnitProfit: number | null;
  monthlyProfit: number | null;
  profitMargin: number | null;
  cumulativeProfit: number | null;
  inventoryCoverageDays: number | null;
  status: string;
  statusSeverity: SalesPlanStatusSeverity;
  warnings: string[];
}

export interface SalesPlanSummary {
  totalUnits: number;
  totalNetSales: number;
  totalAdSpend: number | null;
  operatingProfit: number | null;
  endingCumulativeProfit: number | null;
  maximumFundingGap: number | null;
  weightedTacos: number | null;
  weightedAcos: number | null;
  negativeProfitMonths: number;
  abnormalMonths: number;
  endingInventory: number;
  isComplete: boolean;
}

export interface SalesPlanResult {
  months: SalesPlanMonthResult[];
  summary: SalesPlanSummary;
}

export const DEFAULT_SALES_PLAN_ASSUMPTIONS: SalesPlanAssumptions = {
  productName: "B251042样例",
  productId: "B251042",
  currency: "USD",
  startMonth: "2026-12",
  initialInventory: 3000,
  unitsPerOrder: 1,
  productCostPerUnit: 3.84,
  packagingCostPerUnit: 0,
  budgetFbaPerUnit: 5.52,
  budgetFirstMilePerUnit: 0.61,
  referralFeeRate: 0.15,
  returnRate: 0.08,
  averageReturnLoss: 10,
  otherNetExpensePoolRate: 0.037,
  monthlyFixedOperatingCost: 300,
  initialInvestment: 5000,
};

const STAGES = ["测款期", "测款期", "增长期", "增长期", "增长期", "盈利过渡期", "盈利过渡期", "盈利过渡期", "稳定期", "稳定期", "稳定期", "稳定期"];
const ACTIONS = [
  "低预算测词，验证主图、价格和基础CVR",
  "清理低转化词，建立核心Exact词",
  "放大高CVR词，补充Review与视频素材",
  "扩大核心词预算，控制无效Placement",
  "提高自然排名，降低泛词预算占比",
  "压降CPO，复核Coupon与毛利空间",
  "稳定核心词，减少低效促销依赖",
  "扩大自然单，保持广告订单质量",
  "以利润为主，按TACoS安全线分配预算",
  "优化长尾词，控制库存与补货节奏",
  "维持高效词，复核退货与实际账单",
  "年度复盘，确定下一周期预算与库存",
];
const DAILY_UNITS = [10, 12, 15, 18, 20, 22, 25, 25, 28, 30, 30, 32];
const NATURAL_DAILY_ORDERS = [2, 3, 4, 6, 8, 10, 12, 13, 15, 17, 18, 20];
const PROMOTION_DISCOUNT_RATES = [0.15, 0.15, 0.1, 0.1, 0.1, 0.05, 0.05, 0.05, 0, 0, 0, 0];
const PROMOTION_ORDER_SHARES = [0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.2, 0, 0, 0, 0];
const CPOS = [14, 13.5, 13, 12.5, 12, 11.5, 11, 10.8, 10.5, 10.2, 10, 9.8];
const CPCS = [0.7, 0.68, 0.65, 0.62, 0.6, 0.58, 0.56, 0.55, 0.54, 0.53, 0.52, 0.5];
const RECEIPTS = [0, 0, 0, 2000, 0, 0, 2000, 0, 0, 2000, 0, 0];

function parseMonth(month: string): { year: number; monthIndex: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return { year: 2026, monthIndex: 11 };
  const year = Number(match[1]);
  const monthIndex = Math.min(11, Math.max(0, Number(match[2]) - 1));
  return { year, monthIndex };
}

export function addMonths(month: string, offset: number): string {
  const parsed = parseMonth(month);
  const date = new Date(Date.UTC(parsed.year, parsed.monthIndex + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysInPlanMonth(month: string): number {
  const parsed = parseMonth(month);
  return new Date(Date.UTC(parsed.year, parsed.monthIndex + 1, 0)).getUTCDate();
}

export function buildDefaultSalesPlanMonths(startMonth: string): SalesPlanMonthInput[] {
  return Array.from({ length: 12 }, (_, index) => ({
    id: `month-${index + 1}`,
    month: addMonths(startMonth, index),
    periodType: "plan" as const,
    stage: STAGES[index],
    action: ACTIONS[index],
    targetDailyUnits: DAILY_UNITS[index],
    naturalDailyOrders: NATURAL_DAILY_ORDERS[index],
    unitPrice: 24.99,
    promotionDiscountRate: PROMOTION_DISCOUNT_RATES[index],
    promotionOrderShare: PROMOTION_ORDER_SHARES[index],
    cpo: CPOS[index],
    cpc: CPCS[index],
    receipts: RECEIPTS[index],
    storageCost: 0,
    couponExpenseRate: 0,
    dealExpenseRate: 0,
    vineExpenseRate: 0,
    actualRefundLoss: null,
    actualFbaFee: null,
    actualFirstMileCost: null,
  }));
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function nonNegative(value: number): number {
  return Math.max(0, finiteOrZero(value));
}

function inRateRange(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function sumKnown(values: Array<number | null>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export function calculateSalesPlan(assumptions: SalesPlanAssumptions, inputs: SalesPlanMonthInput[]): SalesPlanResult {
  let openingInventory = nonNegative(assumptions.initialInventory);
  let previousCumulative: number | null = -nonNegative(assumptions.initialInvestment);

  const months = inputs.map<SalesPlanMonthResult>((input) => {
    const warnings: string[] = [];
    const days = daysInPlanMonth(input.month);
    const targetDailyUnits = nonNegative(input.targetDailyUnits);
    const naturalDailyOrders = nonNegative(input.naturalDailyOrders);
    const unitPrice = nonNegative(input.unitPrice);
    const receipts = nonNegative(input.receipts);
    const storageCost = nonNegative(input.storageCost);
    const targetUnits = Math.round(targetDailyUnits * days);
    const availableInventory = openingInventory + receipts;
    const actualUnits = Math.min(targetUnits, availableInventory);
    const stockoutUnits = Math.max(0, targetUnits - actualUnits);
    const endingInventory = availableInventory - actualUnits;

    const unitsPerOrderValid = Number.isFinite(assumptions.unitsPerOrder) && assumptions.unitsPerOrder > 0;
    const totalOrders = unitsPerOrderValid ? actualUnits / assumptions.unitsPerOrder : null;
    const targetOrders = unitsPerOrderValid ? targetUnits / assumptions.unitsPerOrder : null;
    const plannedNaturalOrders = naturalDailyOrders * days;
    const naturalOrderShare = targetOrders !== null && targetOrders > 0
      ? Math.min(1, plannedNaturalOrders / targetOrders)
      : 0;
    const naturalOrders = totalOrders !== null ? totalOrders * naturalOrderShare : null;
    const adOrders = totalOrders !== null && naturalOrders !== null ? totalOrders - naturalOrders : null;
    const adSpend = adOrders === null ? null : adOrders === 0 ? 0 : input.cpo > 0 ? adOrders * input.cpo : null;
    const adClicks = adSpend === null ? null : adSpend === 0 ? 0 : input.cpc > 0 ? adSpend / input.cpc : null;
    const adCvr = adOrders !== null && adOrders > 0 && adClicks !== null && adClicks > 0 ? adOrders / adClicks : null;

    const grossSales = actualUnits * unitPrice;
    const promotionDiscount = grossSales * nonNegative(input.promotionDiscountRate) * nonNegative(input.promotionOrderShare);
    const netSalesBeforeRefund = grossSales - promotionDiscount;
    const averageNetAsp = actualUnits > 0 ? netSalesBeforeRefund / actualUnits : null;
    const adSales = adOrders !== null && averageNetAsp !== null ? adOrders * assumptions.unitsPerOrder * averageNetAsp : null;
    const acos = adSpend !== null && adSales !== null && adSales > 0 ? adSpend / adSales : null;
    const tacos = adSpend !== null && netSalesBeforeRefund > 0 ? adSpend / netSalesBeforeRefund : null;

    const referralFee = netSalesBeforeRefund * nonNegative(assumptions.referralFeeRate);
    const productAndPackagingCost = actualUnits * (nonNegative(assumptions.productCostPerUnit) + nonNegative(assumptions.packagingCostPerUnit));
    const fbaCost = input.periodType === "actual" ? input.actualFbaFee : actualUnits * nonNegative(assumptions.budgetFbaPerUnit);
    const firstMileCost = input.periodType === "actual" ? input.actualFirstMileCost : actualUnits * nonNegative(assumptions.budgetFirstMilePerUnit);
    const expectedRefundLoss = actualUnits * nonNegative(assumptions.returnRate) * nonNegative(assumptions.averageReturnLoss);
    const refundLoss = input.periodType === "actual" ? input.actualRefundLoss : expectedRefundLoss;

    const explicitExpenseRate = nonNegative(input.couponExpenseRate) + nonNegative(input.dealExpenseRate) + nonNegative(input.vineExpenseRate);
    const residualOtherNetExpenseRate = Math.max(0, nonNegative(assumptions.otherNetExpensePoolRate) - explicitExpenseRate);
    const totalOtherNetExpenseRate = explicitExpenseRate + residualOtherNetExpenseRate;
    const otherNetExpense = grossSales * totalOtherNetExpenseRate;

    const requiredNumbers = [
      input.targetDailyUnits,
      input.naturalDailyOrders,
      input.unitPrice,
      input.cpo,
      input.cpc,
      input.receipts,
      input.storageCost,
    ];
    const assumptionNumbers = [
      assumptions.initialInventory,
      assumptions.productCostPerUnit,
      assumptions.packagingCostPerUnit,
      assumptions.budgetFbaPerUnit,
      assumptions.budgetFirstMilePerUnit,
      assumptions.averageReturnLoss,
      assumptions.monthlyFixedOperatingCost,
      assumptions.initialInvestment,
    ];
    const invalidAssumptionRate = !inRateRange(assumptions.referralFeeRate)
      || !inRateRange(assumptions.returnRate)
      || !inRateRange(assumptions.otherNetExpensePoolRate);
    const invalidAssumptionNumber = assumptionNumbers.some((value) => !Number.isFinite(value) || value < 0);
    const invalidRequiredNumber = requiredNumbers.some((value) => !Number.isFinite(value) || value < 0)
      || unitPrice <= 0
      || !inRateRange(input.promotionDiscountRate)
      || !inRateRange(input.promotionOrderShare)
      || !inRateRange(input.couponExpenseRate)
      || !inRateRange(input.dealExpenseRate)
      || !inRateRange(input.vineExpenseRate)
      || (input.actualRefundLoss !== null && (!Number.isFinite(input.actualRefundLoss) || input.actualRefundLoss < 0))
      || (input.actualFbaFee !== null && (!Number.isFinite(input.actualFbaFee) || input.actualFbaFee < 0))
      || (input.actualFirstMileCost !== null && (!Number.isFinite(input.actualFirstMileCost) || input.actualFirstMileCost < 0));

    if (invalidRequiredNumber) warnings.push("输入超范围");
    if (invalidAssumptionRate) warnings.push("固定费率需在0%至100%之间");
    if (invalidAssumptionNumber) warnings.push("固定参数需为非负数");
    if (!unitsPerOrderValid) warnings.push("UPT需大于0");
    if (input.periodType === "actual" && input.actualRefundLoss === null) warnings.push("实际月缺退款");
    if (input.periodType === "actual" && input.actualFbaFee === null) warnings.push("实际月缺FBA");
    if (input.periodType === "actual" && input.actualFirstMileCost === null) warnings.push("实际月缺头程");
    if (targetOrders !== null && plannedNaturalOrders > targetOrders) warnings.push("自然单超过目标总单");
    if (adOrders !== null && adOrders > 0 && input.cpo <= 0) warnings.push("CPO需大于0");
    if (adOrders !== null && adOrders > 0 && input.cpc <= 0) warnings.push("CPC需大于0");
    if (adCvr !== null && adCvr > 1) warnings.push("Ad CVR超过100%");
    if (explicitExpenseRate > assumptions.otherNetExpensePoolRate) warnings.push("费用明细高于默认率");
    if (stockoutUnits > 0) warnings.push("库存不足");

    const profitInputsAvailable = !invalidRequiredNumber
      && !invalidAssumptionRate
      && !invalidAssumptionNumber
      && unitsPerOrderValid
      && adSpend !== null
      && fbaCost !== null
      && firstMileCost !== null
      && refundLoss !== null;
    const profitBeforeAds = profitInputsAvailable
      ? netSalesBeforeRefund
        - referralFee
        - productAndPackagingCost
        - fbaCost
        - firstMileCost
        - storageCost
        - refundLoss
        - otherNetExpense
        - nonNegative(assumptions.monthlyFixedOperatingCost)
      : null;
    const preAdUnitProfit = profitBeforeAds !== null && actualUnits > 0 ? profitBeforeAds / actualUnits : null;
    const monthlyProfit = profitBeforeAds !== null && adSpend !== null ? profitBeforeAds - adSpend : null;
    const profitMargin = monthlyProfit !== null && netSalesBeforeRefund > 0 ? monthlyProfit / netSalesBeforeRefund : null;
    const cumulativeProfit = previousCumulative !== null && monthlyProfit !== null ? previousCumulative + monthlyProfit : null;
    const inventoryCoverageDays = targetDailyUnits > 0 ? endingInventory / targetDailyUnits : null;

    if (monthlyProfit !== null && monthlyProfit < 0) warnings.push("月利润为负");
    const status = warnings[0] ?? "正常";
    const statusSeverity: SalesPlanStatusSeverity = status === "正常"
      ? "ok"
      : ["费用明细高于默认率", "库存不足"].includes(status)
        ? "warning"
        : "error";

    const result: SalesPlanMonthResult = {
      ...input,
      days,
      targetUnits,
      openingInventory,
      availableInventory,
      actualUnits,
      stockoutUnits,
      endingInventory,
      totalOrders,
      plannedNaturalOrders,
      naturalOrders,
      adOrders,
      adSpend,
      adClicks,
      adCvr,
      grossSales,
      promotionDiscount,
      netSalesBeforeRefund,
      averageNetAsp,
      adSales,
      acos,
      tacos,
      referralFee,
      productAndPackagingCost,
      fbaCost,
      firstMileCost,
      storageCost,
      expectedRefundLoss,
      refundLoss,
      residualOtherNetExpenseRate,
      totalOtherNetExpenseRate,
      otherNetExpense,
      profitBeforeAds,
      preAdUnitProfit,
      monthlyProfit,
      profitMargin,
      cumulativeProfit,
      inventoryCoverageDays,
      status,
      statusSeverity,
      warnings,
    };

    openingInventory = endingInventory;
    previousCumulative = cumulativeProfit;
    return result;
  });

  const totalNetSales = months.reduce((total, month) => total + month.netSalesBeforeRefund, 0);
  const adSpendValues = months.map((month) => month.adSpend);
  const adSalesValues = months.map((month) => month.adSales);
  const allAdSpendKnown = adSpendValues.every((value) => value !== null);
  const allAdSalesKnown = adSalesValues.every((value) => value !== null);
  const totalAdSpend = allAdSpendKnown ? sumKnown(adSpendValues) : null;
  const totalAdSales = allAdSalesKnown ? sumKnown(adSalesValues) : null;
  const isComplete = months.every((month) => month.monthlyProfit !== null);
  const operatingProfit = isComplete ? sumKnown(months.map((month) => month.monthlyProfit)) : null;
  const cumulativeValues = months.map((month) => month.cumulativeProfit);
  const endingCumulativeProfit = isComplete ? cumulativeValues.at(-1) ?? -assumptions.initialInvestment : null;
  const maximumFundingGap = isComplete
    ? Math.max(0, -Math.min(-nonNegative(assumptions.initialInvestment), ...cumulativeValues.map((value) => value ?? 0)))
    : null;

  return {
    months,
    summary: {
      totalUnits: months.reduce((total, month) => total + month.actualUnits, 0),
      totalNetSales,
      totalAdSpend,
      operatingProfit,
      endingCumulativeProfit,
      maximumFundingGap,
      weightedTacos: totalAdSpend !== null && totalNetSales > 0 ? totalAdSpend / totalNetSales : null,
      weightedAcos: totalAdSpend !== null && totalAdSales !== null && totalAdSales > 0 ? totalAdSpend / totalAdSales : null,
      negativeProfitMonths: months.filter((month) => month.monthlyProfit !== null && month.monthlyProfit < 0).length,
      abnormalMonths: months.filter((month) => month.status !== "正常").length,
      endingInventory: months.at(-1)?.endingInventory ?? assumptions.initialInventory,
      isComplete,
    },
  };
}
