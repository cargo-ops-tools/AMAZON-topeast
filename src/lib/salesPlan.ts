export type SalesPlanStatusSeverity = "ok" | "warning" | "error";

export interface SalesPlanAssumptions {
  productName: string;
  productId: string;
  currency: string;
  actualSellingPrice: number;
  productCostPerUnit: number;
  storageCostPerUnit: number;
  fbaFeePerUnit: number;
  firstMileCostPerUnit: number;
  referralFeeRate: number;
  returnRate: number;
  averageReturnLoss: number;
  otherVariableCostRate: number;
}

export interface SalesPlanMonthInput {
  id: string;
  month: string;
  stage: string;
  action: string;
  targetDailyUnits: number;
  cpo: number;
  cpc: number;
  naturalOrderShare: number;
  otherVariableCostRateOverride: number | null;
}

export interface SalesPlanMonthResult extends SalesPlanMonthInput {
  days: number;
  monthlyUnits: number;
  naturalUnits: number;
  adUnits: number;
  salesRevenue: number;
  adSpend: number | null;
  adClicks: number | null;
  adCvr: number | null;
  adSales: number;
  acos: number | null;
  tacos: number | null;
  referralFeePerUnit: number;
  expectedRefundLossPerUnit: number;
  effectiveOtherVariableCostRate: number;
  otherVariableCostPerUnit: number;
  breakEvenCpo: number | null;
  monthlyBreakEvenCpo: number | null;
  productCostTotal: number;
  firstMileCostTotal: number;
  fbaCostTotal: number;
  referralFeeTotal: number;
  storageMultiplier: number;
  storageCostTotal: number;
  expectedRefundLossTotal: number;
  promotionCostTotal: number;
  profitBeforeAds: number | null;
  monthlyProfit: number | null;
  profitMargin: number | null;
  cumulativeProfit: number | null;
  status: string;
  statusSeverity: SalesPlanStatusSeverity;
  warnings: string[];
}

export interface SalesPlanSummary {
  totalUnits: number | null;
  totalRevenue: number | null;
  totalAdSpend: number | null;
  operatingProfit: number | null;
  endingCumulativeProfit: number | null;
  maximumFundingGap: number | null;
  weightedTacos: number | null;
  weightedAcos: number | null;
  negativeProfitMonths: number;
  abnormalMonths: number;
  breakEvenCpo: number | null;
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
  actualSellingPrice: 24.99,
  productCostPerUnit: 3.84,
  storageCostPerUnit: 0,
  fbaFeePerUnit: 5.52,
  firstMileCostPerUnit: 0.61,
  referralFeeRate: 0.15,
  returnRate: 0.08,
  averageReturnLoss: 10,
  otherVariableCostRate: 0.037,
};

export const SALES_PLAN_STAGE_ACTIONS: Record<string, string[]> = {
  测款期: ["低预算测词，验证主图、价格和基础CVR", "收集Search Term，清理无关词", "测试价格与Coupon对转化率的影响"],
  增长期: ["放大高CVR词，增加Exact预算", "提升核心Keyword自然排名", "补充Review、视频与A+内容", "优化Placement，降低无效点击"],
  盈利过渡期: ["压降CPO，保留高利润广告词", "减少促销依赖，提高自然单占比", "复核退货、仓储和实际账单"],
  稳定期: ["按TACoS安全线分配预算", "维持高效词，拓展长尾Keyword", "根据利润调整投放节奏", "月度复盘并制定下一周期目标"],
};

const DEFAULT_STAGES = ["测款期", "测款期", "增长期", "增长期", "增长期", "盈利过渡期", "盈利过渡期", "盈利过渡期", "稳定期", "稳定期", "稳定期", "稳定期"];
const DEFAULT_DAILY_UNITS = [10, 12, 15, 18, 20, 22, 25, 25, 28, 30, 30, 32];
const DEFAULT_NATURAL_SHARES = [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7];
const DEFAULT_CPOS = [14, 13.5, 13, 12.5, 12, 11.5, 11, 10.8, 10.5, 10.2, 10, 9.8];
const DEFAULT_CPCS = [0.7, 0.68, 0.65, 0.62, 0.6, 0.58, 0.56, 0.55, 0.54, 0.53, 0.52, 0.5];
const PEAK_STORAGE_MULTIPLIER = 3.08;

function parseMonth(month: string): { year: number; monthIndex: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isInteger(year) || year < 1900 || year > 9999 || monthIndex < 0 || monthIndex > 11) return null;
  return { year, monthIndex };
}

export function addMonths(month: string, offset: number): string {
  const parsed = parseMonth(month);
  if (!parsed) return "";
  const date = new Date(Date.UTC(parsed.year, parsed.monthIndex + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysInPlanMonth(month: string): number {
  const parsed = parseMonth(month);
  if (!parsed) return 0;
  return new Date(Date.UTC(parsed.year, parsed.monthIndex + 1, 0)).getUTCDate();
}

export function createSalesPlanMonth(month: string, index = 0): SalesPlanMonthInput {
  const patternIndex = Math.min(DEFAULT_STAGES.length - 1, Math.max(0, Math.floor(index)));
  const stage = DEFAULT_STAGES[patternIndex];
  const actions = SALES_PLAN_STAGE_ACTIONS[stage] ?? [];
  const stageOccurrence = DEFAULT_STAGES.slice(0, patternIndex + 1).filter((item) => item === stage).length - 1;
  return {
    id: `month-${index + 1}-${month || "unset"}`,
    month,
    stage,
    action: actions[stageOccurrence % Math.max(1, actions.length)] ?? "",
    targetDailyUnits: DEFAULT_DAILY_UNITS[patternIndex],
    cpo: DEFAULT_CPOS[patternIndex],
    cpc: DEFAULT_CPCS[patternIndex],
    naturalOrderShare: DEFAULT_NATURAL_SHARES[patternIndex],
    otherVariableCostRateOverride: null,
  };
}

export function buildDefaultSalesPlanMonths(startMonth: string, count = 12): SalesPlanMonthInput[] {
  const safeCount = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  return Array.from({ length: safeCount }, (_, index) => createSalesPlanMonth(addMonths(startMonth, index), index));
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

function assumptionsAreValid(assumptions: SalesPlanAssumptions): boolean {
  const amounts = [assumptions.actualSellingPrice, assumptions.productCostPerUnit, assumptions.storageCostPerUnit, assumptions.fbaFeePerUnit, assumptions.firstMileCostPerUnit, assumptions.averageReturnLoss];
  return assumptions.actualSellingPrice > 0
    && amounts.every((value) => Number.isFinite(value) && value >= 0)
    && inRateRange(assumptions.referralFeeRate)
    && inRateRange(assumptions.returnRate)
    && inRateRange(assumptions.otherVariableCostRate);
}

export function calculateBreakEvenCpo(assumptions: SalesPlanAssumptions): number | null {
  if (!assumptionsAreValid(assumptions)) return null;
  const sellingPrice = assumptions.actualSellingPrice;
  return sellingPrice
    - assumptions.productCostPerUnit
    - assumptions.firstMileCostPerUnit
    - assumptions.fbaFeePerUnit
    - sellingPrice * assumptions.referralFeeRate
    - assumptions.storageCostPerUnit
    - assumptions.returnRate * assumptions.averageReturnLoss
    - sellingPrice * assumptions.otherVariableCostRate;
}

function sumKnown(values: Array<number | null>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export function calculateSalesPlan(assumptions: SalesPlanAssumptions, inputs: SalesPlanMonthInput[]): SalesPlanResult {
  const validAssumptions = assumptionsAreValid(assumptions);
  const sellingPrice = nonNegative(assumptions.actualSellingPrice);
  const referralFeePerUnit = sellingPrice * nonNegative(assumptions.referralFeeRate);
  const expectedRefundLossPerUnit = nonNegative(assumptions.returnRate) * nonNegative(assumptions.averageReturnLoss);
  const defaultOtherVariableCostRate = nonNegative(assumptions.otherVariableCostRate);
  const breakEvenCpo = calculateBreakEvenCpo(assumptions);
  const monthCounts = inputs.reduce<Map<string, number>>((counts, input) => {
    if (parseMonth(input.month)) counts.set(input.month, (counts.get(input.month) ?? 0) + 1);
    return counts;
  }, new Map());
  let previousCumulative: number | null = 0;

  const months = inputs.map<SalesPlanMonthResult>((input, index) => {
    const warnings: string[] = [];
    const parsedMonth = parseMonth(input.month);
    const previousParsedMonth = index > 0 ? parseMonth(inputs[index - 1].month) : null;
    const days = daysInPlanMonth(input.month);
    const targetDailyUnits = nonNegative(input.targetDailyUnits);
    const monthlyUnits = days > 0 ? targetDailyUnits * days : 0;
    const naturalOrderShare = inRateRange(input.naturalOrderShare) ? input.naturalOrderShare : 0;
    const naturalUnits = monthlyUnits * naturalOrderShare;
    const adUnits = monthlyUnits - naturalUnits;
    const adSpend = adUnits === 0 ? 0 : input.cpo > 0 && Number.isFinite(input.cpo) ? adUnits * input.cpo : null;
    const adClicks = adSpend === null ? null : adSpend === 0 ? 0 : input.cpc > 0 && Number.isFinite(input.cpc) ? adSpend / input.cpc : null;
    const adCvr = adUnits > 0 && adClicks !== null && adClicks > 0 ? adUnits / adClicks : null;
    const salesRevenue = monthlyUnits * sellingPrice;
    const adSales = adUnits * sellingPrice;
    const acos = adSpend !== null && adSales > 0 ? adSpend / adSales : null;
    const tacos = adSpend !== null && salesRevenue > 0 ? adSpend / salesRevenue : null;
    const effectiveOtherVariableCostRate = input.otherVariableCostRateOverride ?? defaultOtherVariableCostRate;
    const otherVariableCostPerUnit = sellingPrice * nonNegative(effectiveOtherVariableCostRate);
    const storageMultiplier = parsedMonth && parsedMonth.monthIndex >= 9 ? PEAK_STORAGE_MULTIPLIER : 1;
    const monthlyBreakEvenCpo = validAssumptions && inRateRange(effectiveOtherVariableCostRate)
      ? sellingPrice - assumptions.productCostPerUnit - assumptions.firstMileCostPerUnit - assumptions.fbaFeePerUnit - referralFeePerUnit - assumptions.storageCostPerUnit * storageMultiplier - expectedRefundLossPerUnit - otherVariableCostPerUnit
      : null;
    const productCostTotal = monthlyUnits * nonNegative(assumptions.productCostPerUnit);
    const firstMileCostTotal = monthlyUnits * nonNegative(assumptions.firstMileCostPerUnit);
    const fbaCostTotal = monthlyUnits * nonNegative(assumptions.fbaFeePerUnit);
    const referralFeeTotal = monthlyUnits * referralFeePerUnit;
    const storageCostTotal = monthlyUnits * nonNegative(assumptions.storageCostPerUnit) * storageMultiplier;
    const expectedRefundLossTotal = monthlyUnits * expectedRefundLossPerUnit;
    const promotionCostTotal = monthlyUnits * otherVariableCostPerUnit;
    const duplicateMonth = parsedMonth !== null && (monthCounts.get(input.month) ?? 0) > 1;
    const outOfOrderMonth = parsedMonth !== null && previousParsedMonth !== null
      && (parsedMonth.year < previousParsedMonth.year || (parsedMonth.year === previousParsedMonth.year && parsedMonth.monthIndex <= previousParsedMonth.monthIndex));
    const validInput = parsedMonth !== null
      && !duplicateMonth
      && !outOfOrderMonth
      && Number.isFinite(input.targetDailyUnits) && input.targetDailyUnits >= 0
      && Number.isFinite(input.cpo) && input.cpo >= 0
      && Number.isFinite(input.cpc) && input.cpc >= 0
      && inRateRange(input.naturalOrderShare)
      && (input.otherVariableCostRateOverride === null || inRateRange(input.otherVariableCostRateOverride));

    if (!parsedMonth) warnings.push("月份未填写或格式无效");
    if (duplicateMonth) warnings.push("月份重复");
    if (!duplicateMonth && outOfOrderMonth) warnings.push("月份未按升序排列");
    if (!validAssumptions) warnings.push("固定参数无效");
    if (!validInput && parsedMonth && !duplicateMonth) warnings.push("月度输入超范围");
    if (adUnits > 0 && input.cpo <= 0) warnings.push("CPO需大于0");
    if (adUnits > 0 && input.cpc <= 0) warnings.push("CPC需大于0");
    if (adCvr !== null && adCvr > 1) warnings.push("Ad CVR超过100%");
    if (monthlyBreakEvenCpo !== null && adUnits > 0 && input.cpo > monthlyBreakEvenCpo) warnings.push("CPO高于当月Break-even");
    if (monthlyBreakEvenCpo !== null && monthlyBreakEvenCpo < 0) warnings.push("单件基础利润为负");

    const metricsAvailable = validAssumptions && validInput && (adUnits === 0 || (adSpend !== null && adClicks !== null));
    const profitBeforeAds = metricsAvailable
      ? salesRevenue - productCostTotal - firstMileCostTotal - fbaCostTotal - referralFeeTotal - storageCostTotal - expectedRefundLossTotal - promotionCostTotal
      : null;
    const monthlyProfit = profitBeforeAds !== null && adSpend !== null ? profitBeforeAds - adSpend : null;
    const profitMargin = monthlyProfit !== null && salesRevenue > 0 ? monthlyProfit / salesRevenue : null;
    const cumulativeProfit = previousCumulative !== null && monthlyProfit !== null ? previousCumulative + monthlyProfit : null;
    if (monthlyProfit !== null && monthlyProfit < 0) warnings.push("月利润为负");
    const status = warnings[0] ?? "正常";
    const advisoryWarnings = new Set(["CPO高于当月Break-even", "Ad CVR超过100%", "月份未按升序排列"]);
    const statusSeverity: SalesPlanStatusSeverity = warnings.length === 0
      ? "ok"
      : warnings.every((warning) => advisoryWarnings.has(warning))
        ? "warning"
        : "error";

    const result: SalesPlanMonthResult = {
      ...input,
      days,
      monthlyUnits,
      naturalUnits,
      adUnits,
      salesRevenue,
      adSpend,
      adClicks,
      adCvr,
      adSales,
      acos,
      tacos,
      referralFeePerUnit,
      expectedRefundLossPerUnit,
      effectiveOtherVariableCostRate,
      otherVariableCostPerUnit,
      breakEvenCpo,
      monthlyBreakEvenCpo,
      productCostTotal,
      firstMileCostTotal,
      fbaCostTotal,
      referralFeeTotal,
      storageMultiplier,
      storageCostTotal,
      expectedRefundLossTotal,
      promotionCostTotal,
      profitBeforeAds,
      monthlyProfit,
      profitMargin,
      cumulativeProfit,
      status,
      statusSeverity,
      warnings,
    };
    previousCumulative = cumulativeProfit;
    return result;
  });

  const rawTotalUnits = months.reduce((total, month) => total + month.monthlyUnits, 0);
  const rawTotalRevenue = months.reduce((total, month) => total + month.salesRevenue, 0);
  const adSpendValues = months.map((month) => month.adSpend);
  const rawTotalAdSpend = adSpendValues.every((value) => value !== null) ? sumKnown(adSpendValues) : null;
  const totalAdSales = months.reduce((total, month) => total + month.adSales, 0);
  const isComplete = months.length > 0 && months.every((month) => month.monthlyProfit !== null);
  const totalUnits = isComplete ? rawTotalUnits : null;
  const totalRevenue = isComplete ? rawTotalRevenue : null;
  const totalAdSpend = isComplete ? rawTotalAdSpend : null;
  const operatingProfit = isComplete ? sumKnown(months.map((month) => month.monthlyProfit)) : null;
  const cumulativeValues = months.map((month) => month.cumulativeProfit);
  const endingCumulativeProfit = isComplete ? cumulativeValues.at(-1) ?? 0 : null;
  const maximumFundingGap = isComplete ? Math.max(0, -Math.min(0, ...cumulativeValues.map((value) => value ?? 0))) : null;

  return {
    months,
    summary: {
      totalUnits,
      totalRevenue,
      totalAdSpend,
      operatingProfit,
      endingCumulativeProfit,
      maximumFundingGap,
      weightedTacos: totalAdSpend !== null && totalRevenue !== null && totalRevenue > 0 ? totalAdSpend / totalRevenue : null,
      weightedAcos: totalAdSpend !== null && totalAdSales > 0 ? totalAdSpend / totalAdSales : null,
      negativeProfitMonths: months.filter((month) => month.monthlyProfit !== null && month.monthlyProfit < 0).length,
      abnormalMonths: months.filter((month) => month.status !== "正常").length,
      breakEvenCpo,
      isComplete,
    },
  };
}
