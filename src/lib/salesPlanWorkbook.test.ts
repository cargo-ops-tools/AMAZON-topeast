import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { calculateSalesPlan, type SalesPlanAssumptions, type SalesPlanMonthInput } from "./salesPlan";
import {
  SALES_PLAN_ASSUMPTIONS_SHEET_NAME,
  SALES_PLAN_EXPORT_HEADERS,
  SALES_PLAN_SHEET_NAME,
  buildSalesPlanWorkbook,
  salesPlanWorkbookFilename,
} from "./salesPlanWorkbook";

const assumptions: SalesPlanAssumptions = {
  productName: "测试产品",
  productId: "TEST/FORMULA",
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

const months: SalesPlanMonthInput[] = [
  {
    id: "jan",
    month: "2026-01",
    stage: "测款期",
    action: "验证转化",
    targetDailyUnits: 10.5,
    cpo: 3,
    cpc: 0.6,
    naturalOrderShare: 0.4,
    otherVariableCostRateOverride: null,
  },
  {
    id: "oct",
    month: "2026-10",
    stage: "增长期",
    action: "放大高效词",
    targetDailyUnits: 12,
    cpo: 2.8,
    cpc: 0.56,
    naturalOrderShare: 0.5,
    otherVariableCostRateOverride: 0,
  },
  {
    id: "nov",
    month: "2026-11",
    stage: "稳定期",
    action: "控制TACoS",
    targetDailyUnits: 15,
    cpo: 2.5,
    cpc: 0.5,
    naturalOrderShare: 0.6,
    otherVariableCostRateOverride: 0.05,
  },
];

function formula(sheet: XLSX.WorkSheet, address: string): string {
  return String(sheet[address]?.f ?? "");
}

function hasBalancedParentheses(value: string): boolean {
  let depth = 0;
  let inString = false;
  for (const character of value) {
    if (character === '"') {
      inString = !inString;
    } else if (!inString && character === "(") {
      depth += 1;
    } else if (!inString && character === ")") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0 && !inString;
}

describe("sales promotion plan formula workbook", () => {
  it("keeps the requested column order and fixed-parameter sheet", () => {
    const workbook = buildSalesPlanWorkbook(XLSX, assumptions, months);
    expect(workbook.SheetNames).toEqual([SALES_PLAN_SHEET_NAME, SALES_PLAN_ASSUMPTIONS_SHEET_NAME]);
    const planSheet = workbook.Sheets[SALES_PLAN_SHEET_NAME];
    const headerRow = XLSX.utils.sheet_to_json<unknown[]>(planSheet, { header: 1, raw: true })[0];
    expect(headerRow).toEqual(SALES_PLAN_EXPORT_HEADERS);
    expect(headerRow.indexOf("当月Break-even CPO/CPA")).toBe(headerRow.indexOf("CPO/CPA") + 1);
    expect(headerRow.slice(headerRow.indexOf("CPC") + 1, headerRow.indexOf("CPC") + 4)).toEqual(["Ad CVR", "ACoS", "TACoS"]);
  });

  it("writes formulas into fixed parameters and monthly calculated fields", () => {
    const workbook = buildSalesPlanWorkbook(XLSX, assumptions, months);
    const fixedSheet = workbook.Sheets[SALES_PLAN_ASSUMPTIONS_SHEET_NAME];
    const planSheet = workbook.Sheets[SALES_PLAN_SHEET_NAME];

    expect(formula(fixedSheet, "B16")).toBe("B6*B11");
    expect(formula(fixedSheet, "B17")).toBe("B12*B13");
    expect(formula(fixedSheet, "B18")).toBe("B6*B14");
    expect(formula(fixedSheet, "B19")).toContain("B6<=0");
    expect(formula(fixedSheet, "B19")).toContain("B6-B7-B10-B9-B16-B8-B17-B18");

    expect(formula(planSheet, "F2")).toContain("'固定参数与公式'!$B$6");
    expect(formula(planSheet, "F2")).toContain("$X2");
    expect(formula(planSheet, "H2")).toBe('IF(OR($Q2="",$Q2=0,$E2<=0,$G2<=0),"",$G2/$E2)');
    expect(formula(planSheet, "I2")).toContain("$R2/($Q2*'固定参数与公式'!$B$6)");
    expect(formula(planSheet, "J2")).toBe('IF(OR($T2="",$T2=0,$R2=""),"",$R2/$T2)');
    expect(formula(planSheet, "O2")).toContain("$D2*$N2");
    expect(formula(planSheet, "AC2")).toContain("$T2-$U2-$V2-$W2-$Y2-$Z2-$AA2-$AB2-$R2");
    expect(formula(planSheet, "AC2")).toContain("COUNTIF($A$2:$A$4,$A2)>1");
    expect(formula(planSheet, "AC2")).toContain("'固定参数与公式'!$B$6<=0");
    expect(formula(planSheet, "AE2")).toBe('IF($AC2="","",$AC2)');
    expect(formula(planSheet, "AE3")).toContain("$AE2+$AC3");
    expect(formula(planSheet, "AF2")).toContain("CPO高于当月Break-even");
    expect(formula(planSheet, "AF2")).toContain("月利润为负");
  });

  it("preserves blank, zero and custom monthly rate overrides", () => {
    const workbook = buildSalesPlanWorkbook(XLSX, assumptions, months);
    const planSheet = workbook.Sheets[SALES_PLAN_SHEET_NAME];
    expect(planSheet.L2?.v).toBe("");
    expect(planSheet.L2?.z).toBe('0.0"%"');
    expect(formula(planSheet, "M2")).toBe('IF($L2="",\'固定参数与公式\'!$B$14,$L2/100)');
    expect(planSheet.L3?.v).toBe(0);
    expect(planSheet.M3?.v).toBe(0);
    expect(planSheet.L4?.v).toBe(5);
    expect(planSheet.M4?.v).toBe(0.05);
  });

  it("keeps cached formula results aligned with the web calculation engine", () => {
    const expected = calculateSalesPlan(assumptions, months);
    const workbook = buildSalesPlanWorkbook(XLSX, assumptions, months);
    const planSheet = workbook.Sheets[SALES_PLAN_SHEET_NAME];
    expect(planSheet.F2?.v).toBeCloseTo(expected.months[0].monthlyBreakEvenCpo ?? NaN, 8);
    expect(planSheet.H2?.v).toBeCloseTo(expected.months[0].adCvr ?? NaN, 8);
    expect(planSheet.X3?.v).toBe(3.08);
    expect(planSheet.Y3?.v).toBeCloseTo(expected.months[1].storageCostTotal, 8);
    expect(planSheet.AC4?.v).toBeCloseTo(expected.months[2].monthlyProfit ?? NaN, 8);
    expect(planSheet.AE4?.v).toBeCloseTo(expected.months[2].cumulativeProfit ?? NaN, 8);
  });

  it("retains formulas after a real XLSX write and read round trip", () => {
    const workbook = buildSalesPlanWorkbook(XLSX, assumptions, months);
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const reopened = XLSX.read(bytes, { type: "array", cellFormula: true, cellNF: true });
    const fixedSheet = reopened.Sheets[SALES_PLAN_ASSUMPTIONS_SHEET_NAME];
    const planSheet = reopened.Sheets[SALES_PLAN_SHEET_NAME];
    expect(formula(fixedSheet, "B19")).toContain("B6-B7-B10-B9-B16-B8-B17-B18");
    expect(formula(planSheet, "F2")).toContain("'固定参数与公式'!$B$6");
    expect(formula(planSheet, "M2")).toContain("'固定参数与公式'!$B$14");
    expect(formula(planSheet, "AC4")).toContain("$R4");

    const formulaCells = Object.values(planSheet).filter((cell): cell is XLSX.CellObject => Boolean(cell && typeof cell === "object" && "f" in cell));
    expect(formulaCells.length).toBeGreaterThan(months.length * 20);
    expect(formulaCells.every((cell) => !String(cell.f).includes("#REF!"))).toBe(true);
    expect(formulaCells.every((cell) => hasBalancedParentheses(String(cell.f)))).toBe(true);
  });

  it("retains formulas when the current web result is unavailable", () => {
    const invalidCpcMonth: SalesPlanMonthInput = { ...months[0], cpc: 0 };
    const workbook = buildSalesPlanWorkbook(XLSX, assumptions, [invalidCpcMonth]);
    const planSheet = workbook.Sheets[SALES_PLAN_SHEET_NAME];
    expect(planSheet.H2?.v).toBe("");
    expect(planSheet.S2?.v).toBe("");
    expect(planSheet.AC2?.v).toBe("");
    expect(formula(planSheet, "H2")).toContain("$G2/$E2");
    expect(formula(planSheet, "S2")).toContain("$R2/$G2");
    expect(formula(planSheet, "AC2")).toContain("$S2");

    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const reopened = XLSX.read(bytes, { type: "array", cellFormula: true });
    const reopenedPlanSheet = reopened.Sheets[SALES_PLAN_SHEET_NAME];
    expect(formula(reopenedPlanSheet, "H2")).toContain("$G2/$E2");
    expect(formula(reopenedPlanSheet, "S2")).toContain("$R2/$G2");
    expect(formula(reopenedPlanSheet, "AC2")).toContain("$S2");
  });

  it("preserves formula cells for 100% natural sales and invalid fixed assumptions", () => {
    const naturalOnlyMonth: SalesPlanMonthInput = { ...months[0], cpo: 0, cpc: 0, naturalOrderShare: 1 };
    const naturalWorkbook = buildSalesPlanWorkbook(XLSX, assumptions, [naturalOnlyMonth]);
    const naturalBytes = XLSX.write(naturalWorkbook, { bookType: "xlsx", type: "array" });
    const naturalReopened = XLSX.read(naturalBytes, { type: "array", cellFormula: true });
    const naturalPlan = naturalReopened.Sheets[SALES_PLAN_SHEET_NAME];
    expect(naturalPlan.R2?.v).toBe(0);
    expect(naturalPlan.S2?.v).toBe(0);
    expect(naturalPlan.H2?.v).toBe("");
    expect(naturalPlan.I2?.v).toBe("");
    expect(naturalPlan.J2?.v).toBe(0);
    expect(formula(naturalPlan, "H2")).toContain("$G2/$E2");
    expect(formula(naturalPlan, "I2")).toContain("$R2/($Q2*'固定参数与公式'!$B$6)");

    const invalidWorkbook = buildSalesPlanWorkbook(XLSX, { ...assumptions, actualSellingPrice: 0 }, [months[0]]);
    const invalidBytes = XLSX.write(invalidWorkbook, { bookType: "xlsx", type: "array" });
    const invalidReopened = XLSX.read(invalidBytes, { type: "array", cellFormula: true });
    const invalidFixed = invalidReopened.Sheets[SALES_PLAN_ASSUMPTIONS_SHEET_NAME];
    const invalidPlan = invalidReopened.Sheets[SALES_PLAN_SHEET_NAME];
    expect(invalidFixed.B19?.v).toBe("");
    expect(formula(invalidFixed, "B19")).toContain("B6<=0");
    expect(formula(invalidFixed, "B19")).toContain("B6-B7-B10-B9-B16-B8-B17-B18");
    expect(invalidPlan.F2?.v).toBe("");
    expect(formula(invalidPlan, "F2")).toContain("'固定参数与公式'!$B$6");
  });

  it("creates a filesystem-safe formula workbook filename", () => {
    expect(salesPlanWorkbookFilename(assumptions)).toBe("TEST_FORMULA_销售推广计划_含公式.xlsx");
  });
});
