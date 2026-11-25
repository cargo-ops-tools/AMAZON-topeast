export type InventorySizeTier = "standard" | "oversize";
export type DecisionAction = "continue" | "promote" | "remove" | "liquidate";

export interface InventoryInput {
  sku: string;
  asin: string;
  productName: string;
  currentInventory: number;
  packageLengthCm: number;
  packageWidthCm: number;
  packageHeightCm: number;
  actualWeightKg: number;
  averageDailySales: number;
  inboundDate: string;
  currentDate: string;
  dangerousGoods: boolean;
  utilizationEligible: boolean;
  utilizationWeeks: number;
  customStorageRate: number | null;
  customAgedRate: number | null;
  removalQuantity: number;
  customRemovalFee: number | null;
  liquidationQuantity: number;
  averageSellingPrice: number;
  unitCost: number;
  firstMileCostPerUnit: number | null;
  recoveryRate: number;
  forecastMonths: number;
}

export interface StorageRateResult {
  baseRate: number;
  utilizationRate: number;
  totalRate: number;
  season: "offPeak" | "peak";
}

export interface AgedRateResult {
  ageBand: string;
  volumeRate: number;
  minimumPerUnit: number;
}

export interface PackageClassification {
  valid: boolean;
  dimensionsValid: boolean;
  weightValid: boolean;
  sortedDimensionsCm: [number, number, number];
  sortedDimensionsIn: [number, number, number];
  unitVolumeCuFt: number;
  actualWeightKg: number;
  actualWeightLb: number;
  dimensionalWeightLb: number;
  decisionWeightLb: number;
  rawShippingWeightLb: number;
  shippingWeightLb: number;
  lengthPlusGirthIn: number;
  sizeTier: InventorySizeTier;
  sizeTierName: string;
  weightBasis: "pending" | "actual" | "dimensional" | "actual-only";
  outOfRange: boolean;
}

export interface ForecastRow {
  month: string;
  openingInventory: number;
  closingInventory: number;
  averageInventory: number;
  ageDays: number;
  storageFee: number;
  agedFee: number;
  totalFee: number;
}

export interface InventoryResult {
  packageClassification: PackageClassification;
  inventoryAgeDays: number;
  daysOfSupply: number;
  totalVolume: number;
  storageRates: StorageRateResult;
  monthlyBaseStorageFee: number;
  monthlyUtilizationSurcharge: number;
  monthlyStorageFee: number;
  agedRates: AgedRateResult;
  agedInventoryQuantity: number;
  agedVolumeFee: number;
  agedMinimumFee: number;
  agedInventoryFee: number;
  removalFeePerUnit: number;
  removalTotalFee: number;
  liquidationQuantity: number;
  liquidationRecoveryReady: boolean;
  liquidationConfigured: boolean;
  liquidationProcessingFeePerUnit: number;
  liquidationProductCost: number;
  liquidationFirstMileCost: number;
  liquidationCurrentMonthStorageFee: number;
  liquidationGrossRecovery: number;
  liquidationReferralFee: number;
  liquidationProcessingFee: number;
  liquidationAmazonFees: number;
  liquidationNetRecovery: number;
  liquidationPnlPerUnit: number;
  liquidationPnl: number;
  liquidationLoss: number;
  remainingInventoryValue: number;
  forecast: ForecastRow[];
  projectedHoldingCost: number;
  decision: DecisionAction;
  decisionTitle: string;
  decisionReason: string;
  warnings: string[];
}

const MS_PER_DAY = 86_400_000;
const CM3_PER_CUBIC_FOOT = 28_316.846592;
const CM_PER_INCH = 2.54;
const LB_PER_KG = 2.20462262;

interface SizeTierRule {
  name: string;
  weightCapLb: number;
  maxLengthIn: number;
  maxWidthIn: number;
  maxHeightIn: number;
  maxLengthPlusGirthIn: number;
  category: InventorySizeTier;
}

const SIZE_TIER_RULES: readonly SizeTierRule[] = [
  { name: "Small standard-size", weightCapLb: 1, maxLengthIn: 15, maxWidthIn: 12, maxHeightIn: 0.75, maxLengthPlusGirthIn: Number.POSITIVE_INFINITY, category: "standard" },
  { name: "Large standard-size", weightCapLb: 20, maxLengthIn: 18, maxWidthIn: 14, maxHeightIn: 8, maxLengthPlusGirthIn: Number.POSITIVE_INFINITY, category: "standard" },
  { name: "Small bulky", weightCapLb: 50, maxLengthIn: 37, maxWidthIn: 28, maxHeightIn: 20, maxLengthPlusGirthIn: 130, category: "oversize" },
  { name: "Large bulky", weightCapLb: 50, maxLengthIn: 59, maxWidthIn: 33, maxHeightIn: 33, maxLengthPlusGirthIn: 130, category: "oversize" },
  { name: "Extra-large 0 to 50 lb", weightCapLb: 50, maxLengthIn: Number.POSITIVE_INFINITY, maxWidthIn: Number.POSITIVE_INFINITY, maxHeightIn: Number.POSITIVE_INFINITY, maxLengthPlusGirthIn: 1650, category: "oversize" },
  { name: "Extra-large 50+ to 70 lb", weightCapLb: 70, maxLengthIn: Number.POSITIVE_INFINITY, maxWidthIn: Number.POSITIVE_INFINITY, maxHeightIn: Number.POSITIVE_INFINITY, maxLengthPlusGirthIn: 1650, category: "oversize" },
  { name: "Extra-large 70+ to 150 lb", weightCapLb: 150, maxLengthIn: Number.POSITIVE_INFINITY, maxWidthIn: Number.POSITIVE_INFINITY, maxHeightIn: Number.POSITIVE_INFINITY, maxLengthPlusGirthIn: 1650, category: "oversize" },
  { name: "Extra-large 150+ lb", weightCapLb: 1500, maxLengthIn: Number.POSITIVE_INFINITY, maxWidthIn: Number.POSITIVE_INFINITY, maxHeightIn: Number.POSITIVE_INFINITY, maxLengthPlusGirthIn: 1650, category: "oversize" },
];

function ceilSafe(value: number): number {
  return Math.ceil(Math.round(value * 1e9) / 1e9);
}

export function classifyInventoryPackage(
  packageLengthCm: number,
  packageWidthCm: number,
  packageHeightCm: number,
  actualWeightKg: number,
): PackageClassification {
  const sortedDimensionsCm = [packageLengthCm, packageWidthCm, packageHeightCm]
    .map((value) => Math.max(0, Number.isFinite(value) ? value : 0))
    .sort((left, right) => right - left) as [number, number, number];
  const sortedDimensionsIn = sortedDimensionsCm.map((value) => value / CM_PER_INCH) as [number, number, number];
  const [lengthIn, widthIn, heightIn] = sortedDimensionsIn;
  const dimensionsValid = sortedDimensionsCm.every((value) => value > 0);
  const normalizedWeightKg = Math.max(0, Number.isFinite(actualWeightKg) ? actualWeightKg : 0);
  const weightValid = normalizedWeightKg > 0;
  const valid = dimensionsValid && weightValid;
  const unitVolumeCuFt = dimensionsValid
    ? sortedDimensionsCm.reduce((product, value) => product * value, 1) / CM3_PER_CUBIC_FOOT
    : 0;
  const actualWeightLb = normalizedWeightKg * LB_PER_KG;
  const rawDimensionalWeightLb = dimensionsValid ? (lengthIn * widthIn * heightIn) / 139 : 0;
  const largeStandardCandidate = valid
    && Math.max(actualWeightLb, rawDimensionalWeightLb) <= 20
    && lengthIn <= 18
    && widthIn <= 14
    && heightIn <= 8;
  const dimensionalWeightLb = dimensionsValid
    ? largeStandardCandidate
      ? rawDimensionalWeightLb
      : (lengthIn * Math.max(widthIn, 2) * Math.max(heightIn, 2)) / 139
    : 0;
  const decisionWeightLb = valid ? Math.max(actualWeightLb, dimensionalWeightLb) : 0;
  const lengthPlusGirthIn = dimensionsValid ? lengthIn + 2 * (widthIn + heightIn) : 0;

  if (!valid) {
    return {
      valid,
      dimensionsValid,
      weightValid,
      sortedDimensionsCm,
      sortedDimensionsIn,
      unitVolumeCuFt,
      actualWeightKg: normalizedWeightKg,
      actualWeightLb,
      dimensionalWeightLb,
      decisionWeightLb,
      rawShippingWeightLb: 0,
      shippingWeightLb: 0,
      lengthPlusGirthIn,
      sizeTier: "standard",
      sizeTierName: "待计算",
      weightBasis: "pending",
      outOfRange: false,
    };
  }

  const matchedRule = SIZE_TIER_RULES.find((rule) => (
    decisionWeightLb <= rule.weightCapLb
    && lengthIn <= rule.maxLengthIn
    && widthIn <= rule.maxWidthIn
    && heightIn <= rule.maxHeightIn
    && lengthPlusGirthIn <= rule.maxLengthPlusGirthIn
  ));
  const rule = matchedRule ?? SIZE_TIER_RULES[SIZE_TIER_RULES.length - 1];
  const usesActualOnly = rule.name === "Small standard-size" || rule.name === "Extra-large 150+ lb";
  const rawShippingWeightLb = usesActualOnly ? actualWeightLb : decisionWeightLb;
  const shippingWeightLb = rule.category === "standard" && rawShippingWeightLb < 1
    ? ceilSafe(rawShippingWeightLb * 10) / 10
    : ceilSafe(rawShippingWeightLb);
  const weightBasis: PackageClassification["weightBasis"] = usesActualOnly
    ? "actual-only"
    : dimensionalWeightLb > actualWeightLb
      ? "dimensional"
      : "actual";

  return {
    valid,
    dimensionsValid,
    weightValid,
    sortedDimensionsCm,
    sortedDimensionsIn,
    unitVolumeCuFt,
    actualWeightKg: normalizedWeightKg,
    actualWeightLb,
    dimensionalWeightLb,
    decisionWeightLb,
    rawShippingWeightLb,
    shippingWeightLb,
    lengthPlusGirthIn,
    sizeTier: rule.category,
    sizeTierName: rule.name,
    weightBasis,
    outOfRange: matchedRule === undefined,
  };
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calculateInventoryAge(inboundDate: string, currentDate: string): number {
  const inbound = parseDate(inboundDate);
  const current = parseDate(currentDate);
  if (!inbound || !current || current < inbound) return 0;
  return Math.floor((current.getTime() - inbound.getTime()) / MS_PER_DAY);
}

export function getStorageRates(
  currentDate: string,
  sizeTier: InventorySizeTier,
  dangerousGoods: boolean,
  utilizationEligible: boolean,
  utilizationWeeks: number,
  inventoryAgeDays: number,
  customStorageRate: number | null = null,
): StorageRateResult {
  const date = parseDate(currentDate) ?? new Date();
  const month = date.getUTCMonth() + 1;
  const season = month >= 10 ? "peak" : "offPeak";
  const baseRates = dangerousGoods
    ? season === "peak" ? { standard: 3.63, oversize: 2.43 } : { standard: 0.99, oversize: 0.78 }
    : season === "peak" ? { standard: 2.40, oversize: 1.40 } : { standard: 0.78, oversize: 0.56 };
  const baseRate = customStorageRate === null ? baseRates[sizeTier] : Math.max(0, customStorageRate);

  let utilizationRate = 0;
  if (!dangerousGoods && utilizationEligible && inventoryAgeDays > 30) {
    if (utilizationWeeks >= 52) utilizationRate = sizeTier === "standard" ? 1.88 : 1.26;
    else if (utilizationWeeks >= 44) utilizationRate = sizeTier === "standard" ? 1.58 : 0.76;
    else if (utilizationWeeks >= 36) utilizationRate = sizeTier === "standard" ? 1.16 : 0.63;
    else if (utilizationWeeks >= 28) utilizationRate = sizeTier === "standard" ? 0.76 : 0.46;
    else if (utilizationWeeks >= 22) utilizationRate = sizeTier === "standard" ? 0.44 : 0.23;
  }

  return { baseRate, utilizationRate, totalRate: baseRate + utilizationRate, season };
}

export function getAgedInventoryRate(ageDays: number, customRate: number | null = null): AgedRateResult {
  if (customRate !== null) return { ageBand: "手动费率", volumeRate: Math.max(0, customRate), minimumPerUnit: 0 };
  if (ageDays < 181) return { ageBand: "0–180 天", volumeRate: 0, minimumPerUnit: 0 };
  if (ageDays <= 210) return { ageBand: "181–210 天", volumeRate: 0.50, minimumPerUnit: 0 };
  if (ageDays <= 240) return { ageBand: "211–240 天", volumeRate: 1.00, minimumPerUnit: 0 };
  if (ageDays <= 270) return { ageBand: "241–270 天", volumeRate: 1.50, minimumPerUnit: 0 };
  if (ageDays <= 300) return { ageBand: "271–300 天", volumeRate: 5.45, minimumPerUnit: 0 };
  if (ageDays <= 330) return { ageBand: "301–330 天", volumeRate: 5.70, minimumPerUnit: 0 };
  if (ageDays <= 365) return { ageBand: "331–365 天", volumeRate: 5.90, minimumPerUnit: 0 };
  if (ageDays <= 455) return { ageBand: "366–455 天", volumeRate: 6.90, minimumPerUnit: 0.30 };
  return { ageBand: "456 天以上", volumeRate: 7.90, minimumPerUnit: 0.35 };
}

export function calculateRemovalFeePerUnit(sizeTier: InventorySizeTier, unitWeightLb: number): number {
  if (!Number.isFinite(unitWeightLb) || unitWeightLb <= 0) return 0;
  const weight = unitWeightLb;
  if (sizeTier === "standard") {
    if (weight <= 0.5) return 0.84;
    if (weight <= 1) return 1.53;
    if (weight <= 2) return 2.27;
    return 2.89 + Math.ceil(weight - 2 - Number.EPSILON) * 1.06;
  }
  if (weight <= 1) return 3.12;
  if (weight <= 2) return 4.30;
  if (weight <= 4) return 6.36;
  if (weight <= 10) return 10.04;
  return 14.32 + Math.ceil(weight - 10 - Number.EPSILON) * 1.06;
}

export function calculateLiquidationProcessingFee(sizeTier: InventorySizeTier, unitWeightLb: number): number {
  if (!Number.isFinite(unitWeightLb) || unitWeightLb <= 0) return 0;
  const weight = unitWeightLb;
  if (sizeTier === "standard") {
    if (weight <= 0.5) return 0.25;
    if (weight <= 1) return 0.30;
    if (weight <= 2) return 0.35;
    return 0.40 + Math.ceil(weight - 2 - Number.EPSILON) * 0.20;
  }
  if (weight <= 1) return 0.60;
  if (weight <= 2) return 0.70;
  if (weight <= 4) return 0.90;
  if (weight <= 10) return 1.45;
  return 1.90 + Math.ceil(weight - 10 - Number.EPSILON) * 0.20;
}

function shiftMonth(dateString: string, offset: number): string {
  const date = parseDate(dateString) ?? new Date();
  const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
  return shifted.toISOString().slice(0, 10);
}

function forecastHoldingCosts(
  input: InventoryInput,
  currentAgeDays: number,
  sizeTier: InventorySizeTier,
  unitVolumeCuFt: number,
): ForecastRow[] {
  const rows: ForecastRow[] = [];
  let inventory = Math.max(0, Math.floor(input.currentInventory));
  const monthlySales = Math.max(0, input.averageDailySales) * 30;
  const months = Math.min(24, Math.max(1, Math.floor(input.forecastMonths)));

  for (let index = 0; index < months && inventory > 0; index += 1) {
    const openingInventory = inventory;
    const closingInventory = Math.max(0, openingInventory - monthlySales);
    const averageInventory = (openingInventory + closingInventory) / 2;
    const ageDays = currentAgeDays + index * 30 + 15;
    const monthDate = shiftMonth(input.currentDate, index);
    const storageRates = getStorageRates(monthDate, sizeTier, input.dangerousGoods, input.utilizationEligible, input.utilizationWeeks, ageDays, input.customStorageRate);
    const storageFee = averageInventory * unitVolumeCuFt * storageRates.totalRate;
    const agedRates = getAgedInventoryRate(ageDays, input.customAgedRate);
    const agedVolumeFee = averageInventory * unitVolumeCuFt * agedRates.volumeRate;
    const agedFee = Math.max(agedVolumeFee, averageInventory * agedRates.minimumPerUnit);
    rows.push({
      month: monthDate.slice(0, 7),
      openingInventory,
      closingInventory,
      averageInventory,
      ageDays,
      storageFee,
      agedFee,
      totalFee: storageFee + agedFee,
    });
    inventory = closingInventory;
  }
  return rows;
}

function chooseDecision(
  inventoryAgeDays: number,
  daysOfSupply: number,
  projectedHoldingCost: number,
  removalTotalFee: number,
  liquidationLoss: number,
  averageDailySales: number,
  currentInventory: number,
  removalQuantity: number,
  liquidationQuantity: number,
  liquidationConfigured: boolean,
): { decision: DecisionAction; decisionTitle: string; decisionReason: string } {
  if (averageDailySales > 0 && daysOfSupply <= 90 && inventoryAgeDays < 181) {
    return { decision: "continue", decisionTitle: "继续销售", decisionReason: `预计 ${Math.ceil(daysOfSupply)} 天可售完，且尚未进入 181 天库龄附加费区间。` };
  }
  const holdingCostPerUnit = currentInventory > 0 ? projectedHoldingCost / currentInventory : 0;
  const comparedRemovalHoldingCost = holdingCostPerUnit * removalQuantity;
  const comparedLiquidationHoldingCost = holdingCostPerUnit * liquidationQuantity;
  if (
    comparedRemovalHoldingCost > 0
    && removalTotalFee > 0
    && comparedRemovalHoldingCost > removalTotalFee
    && (!liquidationConfigured || removalTotalFee <= liquidationLoss)
  ) {
    return { decision: "remove", decisionTitle: "优先评估移除", decisionReason: `所选 ${removalQuantity} 件的预测持有成本 $${comparedRemovalHoldingCost.toFixed(2)} 高于移除费 $${removalTotalFee.toFixed(2)}，移除后仍可保留货值。` };
  }
  if (liquidationConfigured && comparedLiquidationHoldingCost > liquidationLoss && liquidationLoss > 0) {
    return { decision: "liquidate", decisionTitle: "优先评估批量清货", decisionReason: `所选 ${liquidationQuantity} 件的清货损失 $${liquidationLoss.toFixed(2)} 低于对应预测持有成本 $${comparedLiquidationHoldingCost.toFixed(2)}。` };
  }
  return {
    decision: "promote",
    decisionTitle: "降价促销并观察",
    decisionReason: inventoryAgeDays >= 181
      ? `当前库龄 ${inventoryAgeDays} 天，已进入老化库存费用区间，但退出成本仍高于预测持有成本。`
      : `库存周转偏慢，建议先提升销量，再根据下一计费节点复核。`,
  };
}

export function calculateInventoryCosts(input: InventoryInput): InventoryResult {
  const currentInventory = Math.max(0, Math.floor(input.currentInventory));
  const packageClassification = classifyInventoryPackage(
    input.packageLengthCm,
    input.packageWidthCm,
    input.packageHeightCm,
    input.actualWeightKg,
  );
  const unitVolume = packageClassification.unitVolumeCuFt;
  const sizeTier = packageClassification.sizeTier;
  const shippingWeightLb = packageClassification.shippingWeightLb;
  const inventoryAgeDays = calculateInventoryAge(input.inboundDate, input.currentDate);
  const daysOfSupply = input.averageDailySales > 0 ? currentInventory / input.averageDailySales : Number.POSITIVE_INFINITY;
  const totalVolume = currentInventory * unitVolume;
  const storageRates = getStorageRates(input.currentDate, sizeTier, input.dangerousGoods, input.utilizationEligible, input.utilizationWeeks, inventoryAgeDays, input.customStorageRate);
  const monthlyBaseStorageFee = totalVolume * storageRates.baseRate;
  const monthlyUtilizationSurcharge = inventoryAgeDays > 30 ? totalVolume * storageRates.utilizationRate : 0;
  const monthlyStorageFee = monthlyBaseStorageFee + monthlyUtilizationSurcharge;

  const agedRates = getAgedInventoryRate(inventoryAgeDays, input.customAgedRate);
  const agedInventoryQuantity = inventoryAgeDays >= 181 || input.customAgedRate !== null ? currentInventory : 0;
  const agedVolumeFee = agedInventoryQuantity * unitVolume * agedRates.volumeRate;
  const agedMinimumFee = agedInventoryQuantity * agedRates.minimumPerUnit;
  const agedInventoryFee = Math.max(agedVolumeFee, agedMinimumFee);

  const removalFeePerUnit = input.customRemovalFee === null
    ? calculateRemovalFeePerUnit(sizeTier, shippingWeightLb)
    : Math.max(0, input.customRemovalFee);
  const removalQuantity = Math.min(currentInventory, Math.max(0, Math.floor(input.removalQuantity)));
  const removalTotalFee = removalQuantity * removalFeePerUnit;

  const liquidationQuantity = Math.min(currentInventory, Math.max(0, Math.floor(input.liquidationQuantity)));
  const liquidationProcessingFeePerUnit = calculateLiquidationProcessingFee(sizeTier, shippingWeightLb);
  const averageSellingPrice = Math.max(0, input.averageSellingPrice);
  const recoveryRate = Math.min(1, Math.max(0, input.recoveryRate));
  const liquidationRecoveryReady = liquidationQuantity > 0
    && averageSellingPrice > 0
    && recoveryRate > 0
    && packageClassification.valid;
  const liquidationConfigured = liquidationRecoveryReady
    && input.unitCost > 0
    && unitVolume > 0
    && input.firstMileCostPerUnit !== null;
  const liquidationProductCost = liquidationQuantity * Math.max(0, input.unitCost);
  const liquidationFirstMileCost = liquidationQuantity * Math.max(0, input.firstMileCostPerUnit ?? 0);
  const liquidationCurrentMonthStorageFee = liquidationQuantity * unitVolume * storageRates.totalRate;
  const liquidationGrossRecoveryPerUnit = roundCurrency(averageSellingPrice * recoveryRate);
  const liquidationReferralFeePerUnit = roundCurrency(liquidationGrossRecoveryPerUnit * 0.15);
  const liquidationNetRecoveryPerUnit = roundCurrency(
    liquidationGrossRecoveryPerUnit - liquidationReferralFeePerUnit - liquidationProcessingFeePerUnit,
  );
  const liquidationGrossRecovery = liquidationQuantity * liquidationGrossRecoveryPerUnit;
  const liquidationReferralFee = liquidationQuantity * liquidationReferralFeePerUnit;
  const liquidationProcessingFee = liquidationQuantity * liquidationProcessingFeePerUnit;
  const liquidationAmazonFees = liquidationReferralFee + liquidationProcessingFee;
  const liquidationNetRecovery = liquidationQuantity * liquidationNetRecoveryPerUnit;
  const liquidationPnl = liquidationConfigured
    ? liquidationNetRecovery - liquidationProductCost - liquidationFirstMileCost - liquidationCurrentMonthStorageFee
    : 0;
  const liquidationPnlPerUnit = liquidationConfigured && liquidationQuantity > 0
    ? liquidationPnl / liquidationQuantity
    : 0;
  const liquidationLoss = liquidationConfigured ? Math.max(0, -liquidationPnl) : 0;
  const remainingInventoryValue = currentInventory * Math.max(0, input.unitCost);
  const forecast = forecastHoldingCosts(input, inventoryAgeDays, sizeTier, unitVolume);
  const projectedHoldingCost = forecast.reduce((sum, row) => sum + row.totalFee, 0);
  const decision = chooseDecision(
    inventoryAgeDays,
    daysOfSupply,
    projectedHoldingCost,
    removalTotalFee,
    liquidationLoss,
    input.averageDailySales,
    currentInventory,
    removalQuantity,
    liquidationQuantity,
    liquidationConfigured,
  );
  const warnings: string[] = [];
  if (input.currentDate < input.inboundDate) warnings.push("当前日期早于入仓日期，库龄按 0 天处理。");
  if (input.removalQuantity > currentInventory) warnings.push("移除数量超过当前库存，计算已按当前库存截断。");
  if (input.liquidationQuantity > currentInventory) warnings.push("清货数量超过当前库存，计算已按当前库存截断。");
  if (liquidationQuantity > 0 && averageSellingPrice <= 0) warnings.push("已填写清货数量，但 ASP 未填写，无法按售价测算毛回收。");
  if (liquidationQuantity > 0 && recoveryRate <= 0) warnings.push("清货回收率为 0；可使用 5%、7.5% 或 10% 情景进行测算。");
  if ((removalQuantity > 0 || liquidationQuantity > 0) && !packageClassification.valid) warnings.push("包装长、宽、高或实际重量未补齐，无法自动判定 Size Tier 与 Shipping Weight。");
  if (liquidationQuantity > 0 && input.unitCost <= 0) warnings.push("采购成本未填写，完整批清 P&L 暂不生成。");
  if (liquidationQuantity > 0 && input.firstMileCostPerUnit === null) warnings.push("头程成本未填写；如确认无头程成本，请明确输入 0。");
  if (packageClassification.outOfRange) warnings.push("包装或重量超出内置 Size Tier 范围，当前按 Extra-large 150+ lb 估算，请以 Seller Central 为准。");
  if (!input.dangerousGoods && input.utilizationEligible) warnings.push("Storage Utilization Surcharge 仅对符合 Amazon 资格且库龄超过 30 天的库存适用。");
  warnings.push("实际费用以 Amazon 记录的平均每日库存、库龄分布、尺寸重量与下单时费率为准。");

  return {
    packageClassification,
    inventoryAgeDays,
    daysOfSupply,
    totalVolume,
    storageRates,
    monthlyBaseStorageFee,
    monthlyUtilizationSurcharge,
    monthlyStorageFee,
    agedRates,
    agedInventoryQuantity,
    agedVolumeFee,
    agedMinimumFee,
    agedInventoryFee,
    removalFeePerUnit,
    removalTotalFee,
    liquidationQuantity,
    liquidationRecoveryReady,
    liquidationConfigured,
    liquidationProcessingFeePerUnit,
    liquidationProductCost,
    liquidationFirstMileCost,
    liquidationCurrentMonthStorageFee,
    liquidationGrossRecovery,
    liquidationReferralFee,
    liquidationProcessingFee,
    liquidationAmazonFees,
    liquidationNetRecovery,
    liquidationPnlPerUnit,
    liquidationPnl,
    liquidationLoss,
    remainingInventoryValue,
    forecast,
    projectedHoldingCost,
    ...decision,
    warnings,
  };
}
