import type { CellObject, WorkBook, WorkSheet } from "xlsx";
import { calculateSalesPlan, type SalesPlanAssumptions, type SalesPlanMonthInput } from "./salesPlan";

export const SALES_PLAN_SHEET_NAME = "销售推广计划";
export const SALES_PLAN_ASSUMPTIONS_SHEET_NAME = "固定参数与公式";

export const SALES_PLAN_EXPORT_HEADERS = [
  "月份",
  "推广阶段",
  "运营动作",
  "日销目标",
  "CPO/CPA",
  "当月Break-even CPO/CPA",
  "CPC",
  "Ad CVR",
  "ACoS",
  "TACoS",
  "自然单占比",
  "当月其他变动成本率（覆盖；填3.7=3.7%）",
  "当月其他变动成本率（生效）",
  "月天数",
  "月销量",
  "自然单销量",
  "广告单销量",
  "广告花费",
  "广告点击",
  "销售额",
  "采购成本当月总额（测算）",
  "FBA当月总额（测算）",
  "头程当月总额（测算）",
  "仓储季节系数",
  "仓储费当月总额（测算）",
  "Amazon佣金当月总额（测算）",
  "预计退款损失当月总额（测算）",
  "月度推广费用",
  "月利润",
  "利润率",
  "累计利润",
  "状态",
] as const;

export const SALES_PLAN_FIXED_CELLS = {
  actualSellingPrice: "B6",
  productCostPerUnit: "B7",
  storageCostPerUnit: "B8",
  fbaFeePerUnit: "B9",
  firstMileCostPerUnit: "B10",
  referralFeeRate: "B11",
  returnRate: "B12",
  averageReturnLoss: "B13",
  otherVariableCostRate: "B14",
  peakStorageMultiplier: "B15",
  referralFeePerUnit: "B16",
  expectedRefundLossPerUnit: "B17",
  otherVariableCostPerUnit: "B18",
  breakEvenCpo: "B19",
} as const;

type XlsxModule = typeof import("xlsx");
type ExportCell = string | number | boolean | null | CellObject;

const MONEY_FORMAT = "#,##0.00";
const QUANTITY_FORMAT = "#,##0.0";
const RATE_FORMAT = "0.0%";

function finite(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null;
}

function formulaNumber(formula: string, cachedValue: number | null, numberFormat = MONEY_FORMAT): CellObject {
  const cached = finite(cachedValue);
  if (cached === null) return { t: "s", f: formula, v: "", z: numberFormat };
  return { t: "n", f: formula, v: cached, z: numberFormat };
}

function formulaText(formula: string, cachedValue: string): CellObject {
  return { t: "s", f: formula, v: cachedValue };
}

function optionalPercentagePoints(value: number | null): CellObject {
  if (value === null) return { t: "s", v: "", z: '0.0"%"' };
  return { t: "n", v: value * 100, z: '0.0"%"' };
}

function setNumberFormat(sheet: WorkSheet, addresses: string[], numberFormat: string) {
  addresses.forEach((address) => {
    const cell = sheet[address];
    if (cell) cell.z = numberFormat;
  });
}

function fixedReference(address: string): string {
  return `'${SALES_PLAN_ASSUMPTIONS_SHEET_NAME}'!$${address.replace(/([A-Z]+)(\d+)/, "$1$$$2")}`;
}

function buildAssumptionsSheet(XLSX: XlsxModule, assumptions: SalesPlanAssumptions): WorkSheet {
  const amazonCommissionPerUnit = assumptions.actualSellingPrice * assumptions.referralFeeRate;
  const expectedRefundLossPerUnit = assumptions.returnRate * assumptions.averageReturnLoss;
  const otherVariableCostPerUnit = assumptions.actualSellingPrice * assumptions.otherVariableCostRate;
  const result = calculateSalesPlan(assumptions, []);
  const rows: ExportCell[][] = [
    ["固定参数与公式", null, null, "修改输入参数后，Excel/WPS会自动重算月度计划。"],
    ["参数", "值", "类型", "单位 / 说明"],
    ["产品名称", assumptions.productName, "输入", ""],
    ["ASIN / SKU", assumptions.productId, "输入", ""],
    ["币种", assumptions.currency, "输入", ""],
    ["实际成交价", assumptions.actualSellingPrice, "输入", "每件"],
    ["采购成本/件", assumptions.productCostPerUnit, "输入", "每件"],
    ["仓储费/件", assumptions.storageCostPerUnit, "输入", "1—9月淡季基准"],
    ["FBA配送费/件", assumptions.fbaFeePerUnit, "输入", "每件"],
    ["头程成本/件", assumptions.firstMileCostPerUnit, "输入", "每件"],
    ["Referral Fee率", assumptions.referralFeeRate, "输入", "按实际成交价计提"],
    ["预计退货率", assumptions.returnRate, "输入", ""],
    ["每退货件平均净损失", assumptions.averageReturnLoss, "输入", "每件退货"],
    ["默认其他单件变动成本率", assumptions.otherVariableCostRate, "输入", "Coupon、秒杀、VINE、站外推广及其他"],
    ["旺季仓储系数", 3.08, "规则", "10—12月使用；1—9月为1"],
    ["Amazon佣金/件", formulaNumber("B6*B11", amazonCommissionPerUnit), "公式", "实际成交价 × Referral Fee率"],
    ["预计退货损失/件", formulaNumber("B12*B13", expectedRefundLossPerUnit), "公式", "退货率 × 每退货件平均净损失"],
    ["其他单件变动成本/件", formulaNumber("B6*B14", otherVariableCostPerUnit), "公式", "实际成交价 × 默认其他单件变动成本率"],
    ["淡季Break-even CPO/CPA", formulaNumber('IF(OR(B6<=0,B7<0,B8<0,B9<0,B10<0,B11<0,B11>1,B12<0,B12>1,B13<0,B14<0,B14>1),"",B6-B7-B10-B9-B16-B8-B17-B18)', result.summary.breakEvenCpo), "公式", "实际成交价减全部淡季单件成本；参数无效时留空"],
    ["公式口径", "实际成交价－采购－头程－FBA－Amazon佣金－仓储－预计退货损失－其他单件变动成本", "说明", "当月Break-even会再应用当月仓储系数和当月生效费率"],
    ["月度覆盖率填写", "在销售推广计划L列填3.7表示3.7%；填0表示0%；留空使用默认费率", "说明", "不要输入小数0.037或带百分号的3.7%"],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 28 }, { wch: 48 }, { wch: 12 }, { wch: 56 }];
  setNumberFormat(sheet, ["B6", "B7", "B8", "B9", "B10", "B13", "B16", "B17", "B18", "B19"], MONEY_FORMAT);
  setNumberFormat(sheet, ["B11", "B12", "B14"], RATE_FORMAT);
  setNumberFormat(sheet, ["B15"], "0.00");
  return sheet;
}

function buildPlanSheet(XLSX: XlsxModule, assumptions: SalesPlanAssumptions, inputs: SalesPlanMonthInput[]): WorkSheet {
  const result = calculateSalesPlan(assumptions, inputs);
  const price = fixedReference(SALES_PLAN_FIXED_CELLS.actualSellingPrice);
  const productCost = fixedReference(SALES_PLAN_FIXED_CELLS.productCostPerUnit);
  const storageCost = fixedReference(SALES_PLAN_FIXED_CELLS.storageCostPerUnit);
  const fbaCost = fixedReference(SALES_PLAN_FIXED_CELLS.fbaFeePerUnit);
  const firstMileCost = fixedReference(SALES_PLAN_FIXED_CELLS.firstMileCostPerUnit);
  const defaultOtherRate = fixedReference(SALES_PLAN_FIXED_CELLS.otherVariableCostRate);
  const peakStorageMultiplier = fixedReference(SALES_PLAN_FIXED_CELLS.peakStorageMultiplier);
  const referralFeeRate = fixedReference(SALES_PLAN_FIXED_CELLS.referralFeeRate);
  const returnRate = fixedReference(SALES_PLAN_FIXED_CELLS.returnRate);
  const averageReturnLoss = fixedReference(SALES_PLAN_FIXED_CELLS.averageReturnLoss);
  const referralFeePerUnit = fixedReference(SALES_PLAN_FIXED_CELLS.referralFeePerUnit);
  const expectedRefundLossPerUnit = fixedReference(SALES_PLAN_FIXED_CELLS.expectedRefundLossPerUnit);
  const lastDataRow = Math.max(2, result.months.length + 1);
  const fixedInvalidFormula = `OR(${price}<=0,${productCost}<0,${storageCost}<0,${fbaCost}<0,${firstMileCost}<0,${referralFeeRate}<0,${referralFeeRate}>1,${returnRate}<0,${returnRate}>1,${averageReturnLoss}<0,${defaultOtherRate}<0,${defaultOtherRate}>1)`;

  const rows: ExportCell[][] = result.months.map((month, index) => {
    const row = index + 2;
    const monthlyBreakEvenFormula = `IF(OR($A${row}="",$M${row}="",$X${row}="",${fixedInvalidFormula},$M${row}<0,$M${row}>1),"",${price}-${productCost}-${firstMileCost}-${fbaCost}-${referralFeePerUnit}-(${storageCost}*$X${row})-${expectedRefundLossPerUnit}-(${price}*$M${row}))`;
    const effectiveOtherRateFormula = `IF($L${row}="",${defaultOtherRate},$L${row}/100)`;
    const daysFormula = `IF($A${row}="","",DAY(EOMONTH(DATE(VALUE(LEFT($A${row},4)),VALUE(RIGHT($A${row},2)),1),0)))`;
    const monthlyUnitsFormula = `IF(OR($D${row}="",$N${row}=""),"",$D${row}*$N${row})`;
    const naturalUnitsFormula = `IF($O${row}="","",$O${row}*$K${row})`;
    const adUnitsFormula = `IF(OR($O${row}="",$P${row}=""),"",$O${row}-$P${row})`;
    const adSpendFormula = `IF($Q${row}="","",IF($Q${row}=0,0,IF($E${row}>0,$Q${row}*$E${row},"")))`;
    const adClicksFormula = `IF($Q${row}="","",IF($Q${row}=0,0,IF(AND($R${row}<>"",$G${row}>0),$R${row}/$G${row},"")))`;
    const adCvrFormula = `IF(OR($Q${row}="",$Q${row}=0,$E${row}<=0,$G${row}<=0),"",$G${row}/$E${row})`;
    const salesRevenueFormula = `IF($O${row}="","",$O${row}*${price})`;
    const acosFormula = `IF(OR($Q${row}="",$Q${row}=0,$R${row}="",${price}<=0),"",$R${row}/($Q${row}*${price}))`;
    const tacosFormula = `IF(OR($T${row}="",$T${row}=0,$R${row}=""),"",$R${row}/$T${row})`;
    const productCostFormula = `IF($O${row}="","",$O${row}*${productCost})`;
    const fbaCostFormula = `IF($O${row}="","",$O${row}*${fbaCost})`;
    const firstMileFormula = `IF($O${row}="","",$O${row}*${firstMileCost})`;
    const storageMultiplierFormula = `IF($A${row}="","",IF(VALUE(RIGHT($A${row},2))>=10,${peakStorageMultiplier},1))`;
    const storageTotalFormula = `IF(OR($O${row}="",$X${row}=""),"",$O${row}*${storageCost}*$X${row})`;
    const referralFeeFormula = `IF($O${row}="","",$O${row}*${referralFeePerUnit})`;
    const returnLossFormula = `IF($O${row}="","",$O${row}*${expectedRefundLossPerUnit})`;
    const promotionCostFormula = `IF(OR($O${row}="",$M${row}=""),"",$O${row}*${price}*$M${row})`;
    const profitFormula = `IF(OR(${fixedInvalidFormula},COUNTIF($A$2:$A$${lastDataRow},$A${row})>1,AND(ROW()>2,$A${row}<=INDEX($A:$A,ROW()-1)),$D${row}<0,$E${row}<0,$G${row}<0,$K${row}<0,$K${row}>1,$M${row}<0,$M${row}>1,$T${row}="",$R${row}="",$S${row}=""),"",$T${row}-$U${row}-$V${row}-$W${row}-$Y${row}-$Z${row}-$AA${row}-$AB${row}-$R${row})`;
    const profitMarginFormula = `IF(OR($T${row}=0,$AC${row}=""),"",$AC${row}/$T${row})`;
    const cumulativeProfitFormula = index === 0
      ? `IF($AC${row}="","",$AC${row})`
      : `IF(OR($AE${row - 1}="",$AC${row}=""),"",$AE${row - 1}+$AC${row})`;
    const statusFormula = `IF($A${row}="","月份未填写或格式无效",IF(COUNTIF($A$2:$A$${lastDataRow},$A${row})>1,"月份重复",IF(AND(ROW()>2,$A${row}<=INDEX($A:$A,ROW()-1)),"月份未按升序排列",IF(${fixedInvalidFormula},"固定参数无效",IF(OR($D${row}<0,$E${row}<0,$G${row}<0,$K${row}<0,$K${row}>1,$M${row}<0,$M${row}>1),"月度输入超范围",IF(AND($Q${row}>0,$E${row}<=0),"CPO需大于0",IF(AND($Q${row}>0,$G${row}<=0),"CPC需大于0",IF(AND($H${row}<>"",$H${row}>1),"Ad CVR超过100%",IF(AND($F${row}<>"",$Q${row}>0,$E${row}>$F${row}),"CPO高于当月Break-even",IF(AND($F${row}<>"",$F${row}<0),"单件基础利润为负",IF(AND($AC${row}<>"",$AC${row}<0),"月利润为负","正常")))))))))))`;

    return [
      month.month,
      month.stage,
      month.action,
      month.targetDailyUnits,
      month.cpo,
      formulaNumber(monthlyBreakEvenFormula, month.monthlyBreakEvenCpo),
      month.cpc,
      formulaNumber(adCvrFormula, month.adCvr, RATE_FORMAT),
      formulaNumber(acosFormula, month.acos, RATE_FORMAT),
      formulaNumber(tacosFormula, month.tacos, RATE_FORMAT),
      month.naturalOrderShare,
      optionalPercentagePoints(month.otherVariableCostRateOverride),
      formulaNumber(effectiveOtherRateFormula, month.effectiveOtherVariableCostRate, RATE_FORMAT),
      formulaNumber(daysFormula, month.days, "0"),
      formulaNumber(monthlyUnitsFormula, month.monthlyUnits, QUANTITY_FORMAT),
      formulaNumber(naturalUnitsFormula, month.naturalUnits, QUANTITY_FORMAT),
      formulaNumber(adUnitsFormula, month.adUnits, QUANTITY_FORMAT),
      formulaNumber(adSpendFormula, month.adSpend),
      formulaNumber(adClicksFormula, month.adClicks, QUANTITY_FORMAT),
      formulaNumber(salesRevenueFormula, month.salesRevenue),
      formulaNumber(productCostFormula, month.productCostTotal),
      formulaNumber(fbaCostFormula, month.fbaCostTotal),
      formulaNumber(firstMileFormula, month.firstMileCostTotal),
      formulaNumber(storageMultiplierFormula, month.storageMultiplier, "0.00"),
      formulaNumber(storageTotalFormula, month.storageCostTotal),
      formulaNumber(referralFeeFormula, month.referralFeeTotal),
      formulaNumber(returnLossFormula, month.expectedRefundLossTotal),
      formulaNumber(promotionCostFormula, month.promotionCostTotal),
      formulaNumber(profitFormula, month.monthlyProfit),
      formulaNumber(profitMarginFormula, month.profitMargin, RATE_FORMAT),
      formulaNumber(cumulativeProfitFormula, month.cumulativeProfit),
      formulaText(statusFormula, month.warnings[0] ?? "正常"),
    ];
  });

  const sheet = XLSX.utils.aoa_to_sheet([SALES_PLAN_EXPORT_HEADERS as unknown as string[], ...rows]);
  sheet["!cols"] = SALES_PLAN_EXPORT_HEADERS.map((header, index) => {
    if (index === 2) return { wch: 36 };
    if (index === 11 || index === 12) return { wch: 28 };
    if (index === 31) return { wch: 24 };
    return { wch: Math.max(12, Math.min(24, header.length + 4)) };
  });
  sheet["!autofilter"] = { ref: `A1:AF${Math.max(1, rows.length + 1)}` };

  for (let row = 2; row <= rows.length + 1; row += 1) {
    setNumberFormat(sheet, [`D${row}`], "0.0");
    setNumberFormat(sheet, [`E${row}`, `F${row}`, `G${row}`, `R${row}`, `T${row}`, `U${row}`, `V${row}`, `W${row}`, `Y${row}`, `Z${row}`, `AA${row}`, `AB${row}`, `AC${row}`, `AE${row}`], MONEY_FORMAT);
    setNumberFormat(sheet, [`H${row}`, `I${row}`, `J${row}`, `K${row}`, `M${row}`, `AD${row}`], RATE_FORMAT);
    setNumberFormat(sheet, [`L${row}`], '0.0"%"');
    setNumberFormat(sheet, [`N${row}`], "0");
    setNumberFormat(sheet, [`O${row}`, `P${row}`, `Q${row}`, `S${row}`], QUANTITY_FORMAT);
    setNumberFormat(sheet, [`X${row}`], "0.00");
  }
  return sheet;
}

export function buildSalesPlanWorkbook(XLSX: XlsxModule, assumptions: SalesPlanAssumptions, inputs: SalesPlanMonthInput[]): WorkBook {
  const workbook = XLSX.utils.book_new();
  const planSheet = buildPlanSheet(XLSX, assumptions, inputs);
  const assumptionsSheet = buildAssumptionsSheet(XLSX, assumptions);
  XLSX.utils.book_append_sheet(workbook, planSheet, SALES_PLAN_SHEET_NAME);
  XLSX.utils.book_append_sheet(workbook, assumptionsSheet, SALES_PLAN_ASSUMPTIONS_SHEET_NAME);
  return workbook;
}

export function salesPlanWorkbookFilename(assumptions: SalesPlanAssumptions): string {
  const safeName = (assumptions.productId || assumptions.productName || "销售推广计划").replace(/[\\/:*?"<>|]/g, "_");
  return `${safeName}_销售推广计划_含公式.xlsx`;
}

export async function downloadSalesPlanWorkbook(assumptions: SalesPlanAssumptions, inputs: SalesPlanMonthInput[]): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = buildSalesPlanWorkbook(XLSX, assumptions, inputs);
  XLSX.writeFile(workbook, salesPlanWorkbookFilename(assumptions));
}
