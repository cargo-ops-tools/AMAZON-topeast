/**
 * FBA 利润测算纯计算引擎。
 * 来源（固定版本 f9f2d1bc6cb9f19214e5f0fda021d0eee01ec3ed）：
 * https://raw.githubusercontent.com/rughouse-fba-tools/fba-calculator/f9f2d1bc6cb9f19214e5f0fda021d0eee01ec3ed/index.html
 *
 * 口径：2026 US FBA Size Tier、配送费、仓储费、入库配置费、
 * 整箱头程计费重，以及 7 个头程渠道的单件利润。
 */
export const FBA_PROFIT_SOURCE_URL =
  "https://raw.githubusercontent.com/rughouse-fba-tools/fba-calculator/f9f2d1bc6cb9f19214e5f0fda021d0eee01ec3ed/index.html";

export type DimensionUnit = "cm" | "in";
export type WeightUnit = "g" | "kg" | "lb";
export type FbaProductCategory = "非服装" | "服装" | "危险品";
export type FulfillmentSeason = "非旺季" | "旺季";
export type StorageSeason = "offpeak" | "peak";
export type SizeTierCategory = "Standard" | "Oversize";
export type FreightMode =
  | "default_sea" | "sea" | "fastsea" | "west_air"
  | "express" | "own" | "own_fast";
export type SizeTierName =
  | "Small standard-size" | "Large standard-size"
  | "Small bulky" | "Large bulky"
  | "Extra-large 0 to 50 lb" | "Extra-large 50+ to 70 lb"
  | "Extra-large 70+ to 150 lb" | "Extra-large 150+ lb";
export type WeightBasis = "actual-only" | "actual" | "dimensional" | "equal";

export interface FbaProfitInput {
  length: number;
  width: number;
  height: number;
  dimensionUnit: DimensionUnit;
  weight: number;
  weightUnit: WeightUnit;
  priceUsd: number;
  cogsRmb: number;
  exchangeRateRmbPerUsd: number;
  /** 下列 Rate 均为小数：12% 传 0.12。 */
  advertisingRate: number;
  storageTurnoverWeeks: number;
  storageUtilizationSurcharge: boolean;
  storageAgedOver30DaysRate: number;
  fuelSurchargeRate: number;
  refundRate: number;
  couponRate: number;
  productCategory: FbaProductCategory;
  fulfillmentSeason: FulfillmentSeason;
  storageSeason: StorageSeason;
  referralRate: number;
  packCountLength: number;
  packCountWidth: number;
  packCountHeight: number;
  cartonTareKg: number;
  packMarginLengthCm: number;
  packMarginWidthCm: number;
  packMarginHeightCm: number;
  plannedCartonWeightLimitKg: number;
  selectedFreightMode: FreightMode;
}

export interface FreightChannelDefinition {
  mode: FreightMode;
  label: string;
  rateRmbPerKg: number;
  volumeDivisor: 5000 | 6000;
  aglInboundFeeExempt: boolean;
}

export interface FreightProfitResult extends FreightChannelDefinition {
  billableCartonWeightKg: number;
  freightUsd: number;
  inboundFeeUsd: number;
  fbaTotalUsd: number;
  netProfitUsd: number;
  /** 百分数：18.5 表示 18.5%。 */
  marginPct: number;
}

export interface FbaProfitResult {
  validation: { isCalculable: boolean; errors: string[]; warnings: string[] };
  unit: {
    dimensionsCm: [number, number, number];
    dimensionsIn: [number, number, number];
    actualWeightKg: number;
    actualWeightLb: number;
    dimensionalWeightLb: number;
    determinationWeightLb: number;
    billableWeightLb: number;
    weightBasis: WeightBasis;
    lengthPlusGirthIn: number;
    volumeCubicFeet: number;
    sizeTier: SizeTierName | null;
    sizeTierCategory: SizeTierCategory | null;
  };
  storage: {
    baseRateUsdPerCubicFoot: number;
    utilizationSurchargeRateUsdPerCubicFoot: number;
    effectiveRateUsdPerCubicFoot: number;
    feeUsdPerUnitPerMonth: number;
  };
  fees: {
    inboundFeeUsd: number;
    fulfillmentBeforeFuelUsd: number;
    fuelSurchargeUsd: number;
    fulfillmentFeeUsd: number;
    cogsUsd: number;
    effectiveSellingPriceUsd: number;
    selectedFbaTotalUsd: number;
  };
  carton: {
    unitCount: number;
    packingCounts: [number, number, number];
    dimensionsCm: [number, number, number];
    actualWeightKg: number;
    dimensionalWeightKgBy6000: number;
    dimensionalWeightKgBy5000: number;
    selectedBillableWeightKg: number;
    selectedVolumeDivisor: 5000 | 6000;
    lengthPlusGirthCm: number;
    effectiveWeightLimitKg: number;
    isCompliant: boolean;
    issues: string[];
  };
  channels: Record<FreightMode, FreightProfitResult>;
  selectedChannel: FreightProfitResult;
}

interface SizeTierRule {
  tier: SizeTierName;
  weightCapLb: number;
  longestIn: number;
  middleIn: number;
  shortestIn: number;
  lengthPlusGirthCapIn: number;
  category: SizeTierCategory;
}
interface InboundRule {
  tier: SizeTierName;
  lowerLb: number;
  upperLb: number;
  feeUsd: number;
}
interface FulfillmentBracket {
  tier: SizeTierName;
  lowerLb: number;
  upperLb: number;
  baseWeightLb: number;
  incrementalFeeUsd: number;
  stepWeightLb: number;
}
type FeeTriple = readonly [number, number, number];

const CM_TO_IN = 0.3937008;
const GRAM_TO_LB = 0.0022046;
const LB_TO_GRAM = 453.59237;
const CUBIC_CM_PER_CUBIC_FOOT = 28_316.8;
const CARTON_MAX_KG = 22.68;
const CARTON_MAX_LONG_CM = 91.44;
const CARTON_MAX_SIDE_CM = 63.5;
const FREIGHT_OUTER_MARGIN_CM = 1;
const EPSILON = 1e-9;

export const REFERRAL_CATEGORIES = [
  { label: "箱包/手袋/皮具/行李箱(Luggage & Handbags)", rate: 0.15 },
  { label: "服装及配饰(Clothing & Accessories)", rate: 0.17 },
  { label: "鞋靴(Shoes)", rate: 0.15 },
  { label: "美妆(Beauty)", rate: 0.08 },
  { label: "珠宝(Jewelry)", rate: 0.20 },
  { label: "消费电子(Consumer Electronics)", rate: 0.08 },
  { label: "电脑及配件(Computers)", rate: 0.08 },
  { label: "家居厨房(Home & Kitchen)", rate: 0.15 },
  { label: "玩具游戏(Toys & Games)", rate: 0.15 },
  { label: "户外运动(Sporting Goods)", rate: 0.15 },
  { label: "办公用品(Office Products)", rate: 0.15 },
  { label: "工具五金(Tools & Home Improvement)", rate: 0.15 },
  { label: "其他/默认(Everything Else)", rate: 0.15 },
] as const;

export const FREIGHT_CHANNELS: Record<FreightMode, FreightChannelDefinition> = {
  default_sea: { mode: "default_sea", label: "默认普船海派", rateRmbPerKg: 12.5, volumeDivisor: 6000, aglInboundFeeExempt: false },
  sea: { mode: "sea", label: "普船海派", rateRmbPerKg: 8.2, volumeDivisor: 6000, aglInboundFeeExempt: false },
  fastsea: { mode: "fastsea", label: "快船", rateRmbPerKg: 13.6, volumeDivisor: 6000, aglInboundFeeExempt: false },
  west_air: { mode: "west_air", label: "美西空运", rateRmbPerKg: 60, volumeDivisor: 6000, aglInboundFeeExempt: false },
  express: { mode: "express", label: "快递", rateRmbPerKg: 97, volumeDivisor: 5000, aglInboundFeeExempt: false },
  own: { mode: "own", label: "公司自有-快船海卡", rateRmbPerKg: 8, volumeDivisor: 6000, aglInboundFeeExempt: true },
  own_fast: { mode: "own_fast", label: "公司自有-普船海派", rateRmbPerKg: 14, volumeDivisor: 6000, aglInboundFeeExempt: true },
};
export const FREIGHT_MODES = Object.keys(FREIGHT_CHANNELS) as FreightMode[];

export const DEFAULT_FBA_PROFIT_INPUT: FbaProfitInput = {
  length: 38, width: 22, height: 12, dimensionUnit: "cm",
  weight: 1200, weightUnit: "g", priceUsd: 45.99,
  cogsRmb: 89.5, exchangeRateRmbPerUsd: 7.095,
  advertisingRate: 0.12, storageTurnoverWeeks: 15,
  storageUtilizationSurcharge: false, storageAgedOver30DaysRate: 1,
  fuelSurchargeRate: 0.035, refundRate: 0, couponRate: 0,
  productCategory: "非服装", fulfillmentSeason: "非旺季",
  storageSeason: "offpeak", referralRate: 0.15,
  packCountLength: 1, packCountWidth: 2, packCountHeight: 3,
  cartonTareKg: 1.3, packMarginLengthCm: 2,
  packMarginWidthCm: 2.5, packMarginHeightCm: 6,
  plannedCartonWeightLimitKg: 22.68,
  selectedFreightMode: "default_sea",
};

const SIZE_TIERS: readonly SizeTierRule[] = [
  { tier: "Small standard-size", weightCapLb: 1, longestIn: 15, middleIn: 12, shortestIn: 0.75, lengthPlusGirthCapIn: 1e7, category: "Standard" },
  { tier: "Large standard-size", weightCapLb: 20, longestIn: 18, middleIn: 14, shortestIn: 8, lengthPlusGirthCapIn: 1e7, category: "Standard" },
  { tier: "Small bulky", weightCapLb: 50, longestIn: 37, middleIn: 28, shortestIn: 20, lengthPlusGirthCapIn: 130, category: "Oversize" },
  { tier: "Large bulky", weightCapLb: 50, longestIn: 59, middleIn: 33, shortestIn: 33, lengthPlusGirthCapIn: 130, category: "Oversize" },
  { tier: "Extra-large 0 to 50 lb", weightCapLb: 50, longestIn: 1e7, middleIn: 1e7, shortestIn: 1e7, lengthPlusGirthCapIn: 1650, category: "Oversize" },
  { tier: "Extra-large 50+ to 70 lb", weightCapLb: 70, longestIn: 1e7, middleIn: 1e7, shortestIn: 1e7, lengthPlusGirthCapIn: 1650, category: "Oversize" },
  { tier: "Extra-large 70+ to 150 lb", weightCapLb: 150, longestIn: 1e7, middleIn: 1e7, shortestIn: 1e7, lengthPlusGirthCapIn: 1650, category: "Oversize" },
  { tier: "Extra-large 150+ lb", weightCapLb: 1500, longestIn: 1e7, middleIn: 1e7, shortestIn: 1e7, lengthPlusGirthCapIn: 1650, category: "Oversize" },
];

const INBOUND_TABLE: readonly InboundRule[] = [
  { tier: "Small standard-size", lowerLb: 0, upperLb: 0.5, feeUsd: 0.23 },
  { tier: "Small standard-size", lowerLb: 0.5, upperLb: 1, feeUsd: 0.24 },
  { tier: "Large standard-size", lowerLb: 0, upperLb: 0.75, feeUsd: 0.30 },
  { tier: "Large standard-size", lowerLb: 0.75, upperLb: 1.5, feeUsd: 0.37 },
  { tier: "Large standard-size", lowerLb: 1.5, upperLb: 3, feeUsd: 0.47 },
  { tier: "Large standard-size", lowerLb: 3, upperLb: 5, feeUsd: 0.57 },
  { tier: "Large standard-size", lowerLb: 5, upperLb: 7, feeUsd: 0.69 },
  { tier: "Large standard-size", lowerLb: 7, upperLb: 10, feeUsd: 0.81 },
  { tier: "Large standard-size", lowerLb: 10, upperLb: 15, feeUsd: 0.97 },
  { tier: "Large standard-size", lowerLb: 15, upperLb: 20, feeUsd: 1.225 },
  { tier: "Small bulky", lowerLb: 0, upperLb: 5, feeUsd: 1.35 },
  { tier: "Small bulky", lowerLb: 5, upperLb: 12, feeUsd: 2.075 },
  { tier: "Small bulky", lowerLb: 12, upperLb: 28, feeUsd: 3.12 },
  { tier: "Small bulky", lowerLb: 28, upperLb: 42, feeUsd: 4.45 },
  { tier: "Small bulky", lowerLb: 42, upperLb: 50, feeUsd: 5.375 },
  { tier: "Large bulky", lowerLb: 0, upperLb: 5, feeUsd: 1.55 },
  { tier: "Large bulky", lowerLb: 5, upperLb: 12, feeUsd: 2.50 },
  { tier: "Large bulky", lowerLb: 12, upperLb: 28, feeUsd: 3.75 },
  { tier: "Large bulky", lowerLb: 28, upperLb: 42, feeUsd: 5.15 },
  { tier: "Large bulky", lowerLb: 42, upperLb: 50, feeUsd: 6.00 },
];

const FULFILLMENT_BRACKETS: readonly FulfillmentBracket[] = [
  { tier: "Small standard-size", lowerLb: 0, upperLb: 0.125, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Small standard-size", lowerLb: 0.125, upperLb: 0.25, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Small standard-size", lowerLb: 0.25, upperLb: 0.375, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Small standard-size", lowerLb: 0.375, upperLb: 0.5, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Small standard-size", lowerLb: 0.5, upperLb: 0.625, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Small standard-size", lowerLb: 0.625, upperLb: 0.75, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Small standard-size", lowerLb: 0.75, upperLb: 0.875, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Small standard-size", lowerLb: 0.875, upperLb: 1, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Large standard-size", lowerLb: 0, upperLb: 0.25, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Large standard-size", lowerLb: 0.25, upperLb: 0.5, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Large standard-size", lowerLb: 0.5, upperLb: 0.75, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Large standard-size", lowerLb: 0.75, upperLb: 1, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Large standard-size", lowerLb: 1, upperLb: 1.25, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Large standard-size", lowerLb: 1.25, upperLb: 1.5, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Large standard-size", lowerLb: 1.5, upperLb: 1.75, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Large standard-size", lowerLb: 1.75, upperLb: 2, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Large standard-size", lowerLb: 2, upperLb: 2.25, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Large standard-size", lowerLb: 2.25, upperLb: 2.5, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Large standard-size", lowerLb: 2.5, upperLb: 2.75, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Large standard-size", lowerLb: 2.75, upperLb: 3, baseWeightLb: 0, incrementalFeeUsd: 0, stepWeightLb: 0 },
  { tier: "Large standard-size", lowerLb: 3, upperLb: 20, baseWeightLb: 3, incrementalFeeUsd: 0.08, stepWeightLb: 0.25 },
  { tier: "Small bulky", lowerLb: 0, upperLb: 50, baseWeightLb: 1, incrementalFeeUsd: 0.38, stepWeightLb: 1 },
  { tier: "Large bulky", lowerLb: 0, upperLb: 50, baseWeightLb: 1, incrementalFeeUsd: 0.38, stepWeightLb: 1 },
  { tier: "Extra-large 0 to 50 lb", lowerLb: 0, upperLb: 50, baseWeightLb: 1, incrementalFeeUsd: 0.38, stepWeightLb: 1 },
  { tier: "Extra-large 50+ to 70 lb", lowerLb: 50, upperLb: 70, baseWeightLb: 51, incrementalFeeUsd: 0.75, stepWeightLb: 1 },
  { tier: "Extra-large 70+ to 150 lb", lowerLb: 70, upperLb: 150, baseWeightLb: 71, incrementalFeeUsd: 0.75, stepWeightLb: 1 },
  { tier: "Extra-large 150+ lb", lowerLb: 150, upperLb: 1500, baseWeightLb: 151, incrementalFeeUsd: 0.19, stepWeightLb: 1 },
];

const FULFILLMENT_FEES: Record<string, readonly FeeTriple[]> = {
  "非服装|非旺季": [[2.43,3.32,3.58],[2.49,3.42,3.68],[2.56,3.45,3.71],[2.66,3.54,3.80],[2.77,3.68,3.94],[2.82,3.78,4.04],[2.92,3.91,4.17],[2.95,3.96,4.22],[2.91,3.73,3.99],[3.13,3.95,4.21],[3.38,4.20,4.46],[3.78,4.60,4.86],[4.22,5.04,5.30],[4.60,5.42,5.68],[4.75,5.57,5.83],[5.00,5.82,6.08],[5.10,5.92,6.18],[5.28,6.10,6.36],[5.44,6.26,6.52],[5.85,6.67,6.93],[6.15,6.97,7.23],[6.78,7.55,7.55],[8.58,9.35,9.35],[25.56,26.33,26.33],[36.55,37.32,37.32],[50.55,51.32,51.32],[194.18,194.95,194.95]],
  "非服装|旺季": [[2.62,3.51,3.77],[2.68,3.61,3.87],[2.76,3.65,3.91],[2.86,3.74,4.00],[2.98,3.89,4.15],[3.03,3.99,4.25],[3.14,4.13,4.39],[3.17,4.18,4.44],[3.15,3.97,4.23],[3.39,4.21,4.47],[3.66,4.48,4.74],[4.07,4.89,5.15],[4.52,5.34,5.60],[4.91,5.73,5.99],[5.07,5.89,6.15],[5.33,6.15,6.41],[5.47,6.29,6.55],[5.67,6.49,6.75],[5.84,6.66,6.92],[6.26,7.08,7.34],[6.69,7.51,7.77],[7.82,8.59,8.59],[9.62,10.39,10.39],[28.29,29.06,29.06],[39.36,40.13,40.13],[54.97,55.74,55.74],[202.69,203.46,203.46]],
  "服装|非旺季": [[2.62,3.51,3.77],[2.64,3.54,3.80],[2.68,3.59,3.85],[2.81,3.69,3.95],[3.00,3.91,4.17],[3.10,4.09,4.35],[3.20,4.20,4.46],[3.30,4.25,4.51],[3.48,4.30,4.56],[3.68,4.50,4.76],[3.90,4.72,4.98],[4.35,5.17,5.43],[5.05,5.87,6.13],[5.22,6.04,6.30],[5.32,6.14,6.40],[5.43,6.25,6.51],[5.78,6.60,6.86],[5.90,6.72,6.98],[5.95,6.77,7.03],[6.08,6.90,7.16],[6.15,6.97,7.23],[6.78,7.55,7.55],[8.58,9.35,9.35],[25.56,26.33,26.33],[36.55,37.32,37.32],[50.55,51.32,51.32],[194.18,194.95,194.95]],
  "服装|旺季": [[2.85,3.74,4.00],[2.87,3.77,4.03],[2.93,3.84,4.10],[3.06,3.94,4.20],[3.27,4.18,4.44],[3.37,4.36,4.62],[3.49,4.49,4.75],[3.59,4.54,4.80],[3.79,4.61,4.87],[4.00,4.82,5.08],[4.23,5.05,5.31],[4.69,5.51,5.77],[5.42,6.24,6.50],[5.59,6.41,6.67],[5.71,6.53,6.79],[5.82,6.64,6.90],[6.22,7.04,7.30],[6.34,7.16,7.42],[6.41,7.23,7.49],[6.54,7.36,7.62],[6.82,7.64,7.90],[7.82,8.59,8.59],[9.62,10.39,10.39],[28.29,29.06,29.06],[39.36,40.13,40.13],[54.97,55.74,55.74],[202.69,203.46,203.46]],
  "危险品|非旺季": [[3.40,4.29,4.55],[3.43,4.36,4.62],[3.48,4.37,4.63],[3.55,4.43,4.69],[3.64,4.55,4.81],[3.65,4.61,4.87],[3.73,4.72,4.98],[3.77,4.78,5.04],[3.73,4.55,4.81],[3.94,4.76,5.02],[4.17,4.99,5.25],[4.37,5.19,5.45],[4.82,5.64,5.90],[5.20,6.02,6.28],[5.35,6.17,6.43],[5.49,6.31,6.57],[5.56,6.38,6.64],[5.74,6.56,6.82],[5.90,6.72,6.98],[6.31,7.13,7.39],[6.61,7.43,7.69],[7.50,8.27,8.27],[9.30,10.07,10.07],[27.67,28.44,28.44],[39.76,40.53,40.53],[57.68,58.45,58.45],[218.76,219.53,219.53]],
  "危险品|旺季": [[3.74,4.63,4.89],[3.80,4.73,4.99],[3.88,4.77,5.03],[3.98,4.86,5.12],[4.10,5.01,5.27],[4.14,5.10,5.36],[4.25,5.24,5.50],[4.32,5.33,5.59],[4.32,5.14,5.40],[4.56,5.38,5.64],[4.82,5.64,5.90],[5.04,5.86,6.12],[5.51,6.33,6.59],[5.91,6.73,6.99],[6.08,6.90,7.16],[6.24,7.06,7.32],[6.33,7.15,7.41],[6.53,7.35,7.61],[6.70,7.52,7.78],[7.12,7.94,8.20],[7.51,8.33,8.59],[9.06,9.83,9.83],[10.86,11.63,11.63],[31.71,32.48,32.48],[43.86,44.63,44.63],[64.04,64.81,64.81],[230.84,231.61,231.61]],
};

const STORAGE_BASE = {
  offpeak: { Standard: 0.78, Oversize: 0.56 },
  peak: { Standard: 2.40, Oversize: 1.40 },
} as const;
const DANGEROUS_STORAGE_BASE = {
  offpeak: { Standard: 0.99, Oversize: 0.78 },
  peak: { Standard: 3.63, Oversize: 2.43 },
} as const;
const UTILIZATION_SURCHARGE = [
  [0, 22, 0, 0], [22, 28, 0.44, 0.23], [28, 36, 0.76, 0.46],
  [36, 44, 1.16, 0.63], [44, 52, 1.58, 0.76], [52, 9999, 1.88, 1.26],
] as const;

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
function rate(value: number, label: string, warnings: string[]): number {
  if (!Number.isFinite(value)) {
    warnings.push(label + "不是有效数字，已按0处理");
    return 0;
  }
  const result = Math.min(1, Math.max(0, value));
  if (result !== value) warnings.push(label + "已限制在0%–100%");
  return result;
}
function ceilStep(value: number, step: number): number {
  if (value <= 0 || step <= 0 || !Number.isFinite(value) || !Number.isFinite(step)) return 0;
  return Math.ceil(Math.round((value / step) * 1e9) / 1e9);
}
function packingCount(value: number): number {
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;
}
function utilizationRate(weeks: number): { standard: number; oversize: number } {
  const row = UTILIZATION_SURCHARGE.find(([lo, hi]) => weeks >= lo && weeks < hi);
  return row ? { standard: row[2], oversize: row[3] } : { standard: 0, oversize: 0 };
}

export function calculateFbaProfit(input: FbaProfitInput): FbaProfitResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rawDimensions = [input.length, input.width, input.height];
  if (rawDimensions.some((value) => !Number.isFinite(value) || value <= 0)) {
    errors.push("单品三个尺寸都必须是大于0的有效数字");
  }
  const dimensionFactor = input.dimensionUnit === "in" ? 2.54 : 1;
  const orientedCm = rawDimensions.map((value) => nonNegative(value) * dimensionFactor) as [number, number, number];
  const dimensionsCm = orientedCm;
  if (errors.length === 0 && !(dimensionsCm[0] >= dimensionsCm[1] && dimensionsCm[1] >= dimensionsCm[2])) {
    errors.push("请按最长边 ≥ 次长边 ≥ 最短边的顺序填写单品尺寸");
  }
  const dimensionsIn = dimensionsCm.map((value) => value * CM_TO_IN) as [number, number, number];

  if (!Number.isFinite(input.weight) || input.weight <= 0) {
    errors.push("单品重量必须是大于0的有效数字");
  }
  const gramsPerUnit = input.weightUnit === "kg" ? 1000 : input.weightUnit === "lb" ? LB_TO_GRAM : 1;
  const weightGrams = nonNegative(input.weight) * gramsPerUnit;
  const actualWeightKg = weightGrams / 1000;
  const actualWeightLb = weightGrams * GRAM_TO_LB;
  const [longestIn, middleIn, shortestIn] = dimensionsIn;
  const lengthPlusGirthIn = longestIn + 2 * (middleIn + shortestIn);
  const dimensionalWeightLb = longestIn * middleIn * shortestIn / 139;
  const determinationWeightLb = Math.max(actualWeightLb, dimensionalWeightLb);
  const tier = SIZE_TIERS.find((rule) =>
    determinationWeightLb <= rule.weightCapLb &&
    longestIn <= rule.longestIn &&
    middleIn <= rule.middleIn &&
    shortestIn <= rule.shortestIn &&
    lengthPlusGirthIn <= rule.lengthPlusGirthCapIn
  );
  if (!tier) errors.push("产品超出参考费率表可识别的Size Tier范围");
  const actualOnly = tier?.tier === "Small standard-size" || tier?.tier === "Extra-large 150+ lb";
  const billableWeightLb = actualOnly ? actualWeightLb : determinationWeightLb;
  const weightBasis: WeightBasis = actualOnly
    ? "actual-only"
    : Math.abs(actualWeightLb - dimensionalWeightLb) < EPSILON
      ? "equal"
      : dimensionalWeightLb > actualWeightLb ? "dimensional" : "actual";
  const volumeCubicFeet = dimensionsCm[0] * dimensionsCm[1] * dimensionsCm[2] / CUBIC_CM_PER_CUBIC_FOOT;

  const dangerous = input.productCategory === "危险品";
  const storageTable = dangerous ? DANGEROUS_STORAGE_BASE : STORAGE_BASE;
  const storageBaseRate = tier ? storageTable[input.storageSeason][tier.category] : 0;
  const utilization = utilizationRate(nonNegative(input.storageTurnoverWeeks));
  const rawSurcharge = tier?.category === "Standard" ? utilization.standard : tier?.category === "Oversize" ? utilization.oversize : 0;
  const storageSurchargeRate = !dangerous && input.storageUtilizationSurcharge
    ? rawSurcharge * rate(input.storageAgedOver30DaysRate, "库龄超过30天库存占比", warnings)
    : 0;
  const storageEffectiveRate = storageBaseRate + storageSurchargeRate;
  const storageFee = volumeCubicFeet * storageEffectiveRate;

  let inboundFee = 0;
  if (tier && !tier.tier.startsWith("Extra-large")) {
    const inbound = INBOUND_TABLE.find((row) =>
      row.tier === tier.tier && billableWeightLb >= row.lowerLb && billableWeightLb < row.upperLb
    );
    inboundFee = inbound?.feeUsd ?? 0;
  }

  const fulfillmentIndex = tier ? FULFILLMENT_BRACKETS.findIndex((row) =>
    row.tier === tier.tier && billableWeightLb > row.lowerLb && billableWeightLb <= row.upperLb
  ) : -1;
  let fulfillmentBeforeFuel = 0;
  if (fulfillmentIndex >= 0) {
    const bracket = FULFILLMENT_BRACKETS[fulfillmentIndex];
    const feeRow = FULFILLMENT_FEES[input.productCategory + "|" + input.fulfillmentSeason]?.[fulfillmentIndex];
    if (feeRow) {
      const price = nonNegative(input.priceUsd);
      const base = price < 10 ? feeRow[0] : price <= 50 ? feeRow[1] : feeRow[2];
      fulfillmentBeforeFuel = bracket.baseWeightLb === 0
        ? base
        : base + ceilStep(billableWeightLb - bracket.baseWeightLb, bracket.stepWeightLb) * bracket.incrementalFeeUsd;
    }
  } else if (tier) {
    errors.push("当前计费重未匹配到2026 FBA配送费阶梯");
  }
  const fuelSurchargeRate = rate(input.fuelSurchargeRate, "燃油物流附加费率", warnings);
  const fuelSurcharge = fulfillmentBeforeFuel * fuelSurchargeRate;
  const fulfillmentFee = fulfillmentBeforeFuel + fuelSurcharge;

  const rawCounts = [input.packCountLength, input.packCountWidth, input.packCountHeight];
  const countsValid = rawCounts.every((value) =>
    Number.isFinite(value) && value >= 1 && Number.isInteger(value)
  );
  const countLength = packingCount(input.packCountLength);
  const countWidth = packingCount(input.packCountWidth);
  const countHeight = packingCount(input.packCountHeight);
  const unitCount = countLength * countWidth * countHeight;
  const cartonDimensionsCm: [number, number, number] = [
    orientedCm[0] * countLength + nonNegative(input.packMarginLengthCm),
    orientedCm[1] * countWidth + nonNegative(input.packMarginWidthCm),
    orientedCm[2] * countHeight + nonNegative(input.packMarginHeightCm),
  ];
  const cartonActualWeightKg = actualWeightKg * unitCount + nonNegative(input.cartonTareKg);
  const freightVolume = cartonDimensionsCm.map((value) => value + FREIGHT_OUTER_MARGIN_CM);
  const dimensionalWeightKgBy6000 = freightVolume[0] * freightVolume[1] * freightVolume[2] / 6000;
  const dimensionalWeightKgBy5000 = freightVolume[0] * freightVolume[1] * freightVolume[2] / 5000;
  const sortedCartonEdges = [...cartonDimensionsCm].sort((a, b) => b - a);
  const cartonLengthPlusGirthCm = sortedCartonEdges[0] + 2 * (sortedCartonEdges[1] + sortedCartonEdges[2]);
  const requestedLimit = Number.isFinite(input.plannedCartonWeightLimitKg)
    ? input.plannedCartonWeightLimitKg : 0;
  const effectiveWeightLimitKg = Math.min(requestedLimit > 0 ? requestedLimit : CARTON_MAX_KG, CARTON_MAX_KG);
  const cartonIssues: string[] = [];
  if (cartonActualWeightKg > effectiveWeightLimitKg + EPSILON) {
    cartonIssues.push("超重" + (cartonActualWeightKg - effectiveWeightLimitKg).toFixed(2) + "kg");
  }
  if (
    sortedCartonEdges[0] > CARTON_MAX_LONG_CM + EPSILON ||
    sortedCartonEdges[1] > CARTON_MAX_SIDE_CM + EPSILON ||
    sortedCartonEdges[2] > CARTON_MAX_SIDE_CM + EPSILON
  ) cartonIssues.push("外箱尺寸超限");
  if (!countsValid) cartonIssues.push("三个方向的装箱数量须为正整数");
  if (requestedLimit > CARTON_MAX_KG + EPSILON) cartonIssues.push("计划毛重上限不得超过22.68kg");
  if (requestedLimit <= 0) warnings.push("计划单箱毛重上限无效，已按22.68kg处理");

  if (!Number.isFinite(input.priceUsd) || input.priceUsd <= 0) {
    errors.push("US售价必须是大于0的有效数字");
  }
  if (!Number.isFinite(input.exchangeRateRmbPerUsd) || input.exchangeRateRmbPerUsd <= 0) {
    errors.push("汇率必须是大于0的有效数字");
  }
  const priceUsd = nonNegative(input.priceUsd);
  const exchangeRate = Number.isFinite(input.exchangeRateRmbPerUsd) && input.exchangeRateRmbPerUsd > 0
    ? input.exchangeRateRmbPerUsd : 0;
  const cogsUsd = exchangeRate > 0 ? nonNegative(input.cogsRmb) / exchangeRate : 0;
  const advertisingRate = rate(input.advertisingRate, "广告消耗占比", warnings);
  const refundRate = rate(input.refundRate, "预计退货率", warnings);
  const couponRate = rate(input.couponRate, "Coupon费用率", warnings);
  const referralRate = rate(input.referralRate, "佣金率", warnings);
  const effectiveSellingPriceUsd = priceUsd * (1 - couponRate);

  const entries = FREIGHT_MODES.map((mode) => {
    const definition = FREIGHT_CHANNELS[mode];
    const dimensionalKg = definition.volumeDivisor === 5000
      ? dimensionalWeightKgBy5000 : dimensionalWeightKgBy6000;
    const billableCartonWeightKg = Math.max(cartonActualWeightKg, dimensionalKg);
    const freightUsd = exchangeRate > 0
      ? definition.rateRmbPerKg * billableCartonWeightKg / unitCount / exchangeRate : 0;
    const channelInboundFee = definition.aglInboundFeeExempt ? 0 : inboundFee;
    const fbaTotalUsd = storageFee + fulfillmentFee + channelInboundFee;
    const netRevenue = effectiveSellingPriceUsd * (1 - referralRate);
    const profitBeforeAd = netRevenue - fbaTotalUsd - cogsUsd - freightUsd;
    const calculatedProfit = (profitBeforeAd - priceUsd * advertisingRate) * (1 - refundRate);
    const netProfitUsd = Number.isFinite(calculatedProfit) ? calculatedProfit : 0;
    const result: FreightProfitResult = {
      ...definition,
      billableCartonWeightKg,
      freightUsd,
      inboundFeeUsd: channelInboundFee,
      fbaTotalUsd,
      netProfitUsd,
      marginPct: priceUsd > 0 ? netProfitUsd / priceUsd * 100 : 0,
    };
    return [mode, result] as const;
  });
  const channels = Object.fromEntries(entries) as Record<FreightMode, FreightProfitResult>;
  const selectedMode = FREIGHT_CHANNELS[input.selectedFreightMode]
    ? input.selectedFreightMode : "default_sea";
  const selectedChannel = channels[selectedMode];

  return {
    validation: { isCalculable: errors.length === 0, errors, warnings },
    unit: {
      dimensionsCm, dimensionsIn, actualWeightKg, actualWeightLb,
      dimensionalWeightLb, determinationWeightLb, billableWeightLb,
      weightBasis, lengthPlusGirthIn, volumeCubicFeet,
      sizeTier: tier?.tier ?? null,
      sizeTierCategory: tier?.category ?? null,
    },
    storage: {
      baseRateUsdPerCubicFoot: storageBaseRate,
      utilizationSurchargeRateUsdPerCubicFoot: storageSurchargeRate,
      effectiveRateUsdPerCubicFoot: storageEffectiveRate,
      feeUsdPerUnitPerMonth: storageFee,
    },
    fees: {
      inboundFeeUsd: inboundFee,
      fulfillmentBeforeFuelUsd: fulfillmentBeforeFuel,
      fuelSurchargeUsd: fuelSurcharge,
      fulfillmentFeeUsd: fulfillmentFee,
      cogsUsd,
      effectiveSellingPriceUsd,
      selectedFbaTotalUsd: selectedChannel.fbaTotalUsd,
    },
    carton: {
      unitCount,
      packingCounts: [countLength, countWidth, countHeight],
      dimensionsCm: cartonDimensionsCm,
      actualWeightKg: cartonActualWeightKg,
      dimensionalWeightKgBy6000,
      dimensionalWeightKgBy5000,
      selectedBillableWeightKg: selectedChannel.billableCartonWeightKg,
      selectedVolumeDivisor: selectedChannel.volumeDivisor,
      lengthPlusGirthCm: cartonLengthPlusGirthCm,
      effectiveWeightLimitKg,
      isCompliant: cartonIssues.length === 0,
      issues: cartonIssues,
    },
    channels,
    selectedChannel,
  };
}
