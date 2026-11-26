import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Gauge,
  Info,
  PackageMinus,
  Printer,
  RotateCcw,
  Scale,
  Sparkles,
  TrendingDown,
  Warehouse,
} from "lucide-react";
import {
  calculateInventoryCosts,
  getStorageSeasonFromDate,
  type InventoryInput,
  type InventoryResult,
} from "./lib/inventory";
import { numberInputValue } from "./lib/input";

const OFFICIAL_STORAGE_RULE = "https://sellercentral.amazon.com/help/hub/reference/external/G3EDYEF6KUCFQTNM";
const OFFICIAL_AGED_INVENTORY_RULE = "https://sellercentral.amazon.com/help/hub/reference/external/GJQNPA23YWVA4SBD?locale=en-US";
const OFFICIAL_REMOVAL_RULE = "https://sellercentral.amazon.com/help/hub/reference/external/GZ5Q2VW5WF4JWRGC";
const OFFICIAL_LIQUIDATION_RULE = "https://sellercentral.amazon.com/help/hub/reference/external/GYVCG5Q3BEJ6MLMF";

function localDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createDefaultInput(): InventoryInput {
  const currentDate = localDateString();
  return {
    sku: "",
    asin: "",
    productName: "",
    currentInventory: 0,
    packageLengthCm: 0,
    packageWidthCm: 0,
    packageHeightCm: 0,
    actualWeightKg: 0,
    averageDailySales: 0,
    inboundDate: "",
    currentDate,
    dangerousGoods: false,
    utilizationEligible: false,
    utilizationWeeks: 0,
    storageSeason: getStorageSeasonFromDate(currentDate),
    customAgedRate: null,
    agedSurchargeEarlyTierExempt: false,
    removalQuantity: 0,
    customRemovalFee: null,
    liquidationQuantity: 0,
    averageSellingPrice: 0,
    unitCost: 0,
    firstMileCostPerUnit: null,
    recoveryRate: 0.075,
    forecastMonths: 0,
  };
}

function numeric(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function integer(value: string): number {
  return Math.floor(numeric(value));
}

function money(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function signedMoney(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}$${money(Math.abs(value))}`;
}

function outflowMoney(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const cost = Math.max(0, value);
  return cost > 0 ? `−$${money(cost)}` : "$0.00";
}

function number(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.00";
}

function daysOfSupply(value: number): string {
  return Number.isFinite(value) ? `${Math.ceil(value)} 天` : "无销量";
}

function weightBasisLabel(profile: InventoryResult["packageClassification"]): string {
  if (!profile.valid) return "待补齐包装参数";
  if (profile.weightBasis === "dimensional") return "体积重较高，按体积重计费";
  if (profile.weightBasis === "actual-only") return "该 Size Tier 按实际重量计费";
  return "实际重量较高，按实重计费";
}

function storageSeasonLabel(season: InventoryResult["storageRates"]["season"]): string {
  return season === "peak" ? "旺季（10–12 月）" : "淡季（1–9 月）";
}

async function writeClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function buildSummaryRows(input: InventoryInput, result: InventoryResult) {
  const recoveryPending = "待补齐回收输入";
  const pnlPending = "待补齐 P&L 输入";
  const packagePending = "待补齐包装参数";
  const profile = result.packageClassification;
  const removalReady = profile.valid || (input.customRemovalFee !== null && input.customRemovalFee > 0);
  return [
    { 分区: "基础信息", 项目: "SKU", 数值: input.sku },
    { 分区: "基础信息", 项目: "ASIN", 数值: input.asin },
    { 分区: "基础信息", 项目: "产品名称", 数值: input.productName },
    { 分区: "基础信息", 项目: "当前库存", 数值: input.currentInventory },
    { 分区: "基础信息", 项目: "库存年龄（天）", 数值: result.inventoryAgeReady ? result.inventoryAgeDays : "待填写入仓日期" },
    { 分区: "基础信息", 项目: "库存可售天数", 数值: daysOfSupply(result.daysOfSupply) },
    { 分区: "包装自动判定", 项目: "包装尺寸（cm）", 数值: profile.dimensionsValid ? `${number(input.packageLengthCm)} × ${number(input.packageWidthCm)} × ${number(input.packageHeightCm)}` : packagePending },
    { 分区: "包装自动判定", 项目: "实际重量（kg）", 数值: profile.weightValid ? number(profile.actualWeightKg, 3) : packagePending },
    { 分区: "包装自动判定", 项目: "实际重量（lb）", 数值: profile.weightValid ? number(profile.actualWeightLb, 3) : packagePending },
    { 分区: "包装自动判定", 项目: "Amazon 计费体积（cu ft/件）", 数值: profile.dimensionsValid ? number(profile.unitVolumeCuFt, 4) : packagePending },
    { 分区: "包装自动判定", 项目: "Dimensional Weight（lb）", 数值: profile.valid ? number(profile.dimensionalWeightLb, 3) : packagePending },
    { 分区: "包装自动判定", 项目: "Size Tier", 数值: profile.valid ? profile.sizeTierName : packagePending },
    { 分区: "包装自动判定", 项目: "Amazon Shipping Weight（lb）", 数值: profile.valid ? number(profile.shippingWeightLb, 1) : packagePending },
    { 分区: "包装自动判定", 项目: "计费依据", 数值: weightBasisLabel(profile) },
    { 分区: "月仓储费", 项目: "Amazon 仓储季节", 数值: storageSeasonLabel(result.storageRates.season) },
    { 分区: "月仓储费", 项目: "基础费率（$/cu ft）", 数值: money(result.storageRates.baseRate) },
    { 分区: "月仓储费", 项目: "库存总体积（cu ft）", 数值: number(result.totalVolume) },
    { 分区: "月仓储费", 项目: "基础仓储费（$）", 数值: money(result.monthlyBaseStorageFee) },
    { 分区: "月仓储费", 项目: "库容利用率附加费（$）", 数值: money(result.monthlyUtilizationSurcharge) },
    { 分区: "月仓储费", 项目: "预计月仓储费（$）", 数值: money(result.monthlyStorageFee) },
    { 分区: "老化库存", 项目: "181–270 天豁免类目", 数值: input.agedSurchargeEarlyTierExempt ? "是（服饰/鞋/箱包/珠宝/手表）" : "否" },
    { 分区: "老化库存", 项目: "费率档位", 数值: result.agedCalculationReady ? result.agedRates.ageBand : "待填写入仓日期" },
    { 分区: "老化库存", 项目: "预计老化库存费用（$）", 数值: result.agedCalculationReady ? money(result.agedInventoryFee) : "待计算" },
    { 分区: "移除方案", 项目: "移除数量", 数值: Math.min(input.currentInventory, input.removalQuantity) },
    { 分区: "移除方案", 项目: "单件移除费（$）", 数值: removalReady ? money(result.removalFeePerUnit) : packagePending },
    { 分区: "移除方案", 项目: "总移除费用现金流（$）", 数值: removalReady ? money(-result.removalTotalFee) : packagePending },
    { 分区: "清货方案", 项目: "测算状态", 数值: result.liquidationConfigured ? "采购与头程 P&L" : "待补齐输入" },
    { 分区: "清货方案", 项目: "清货数量（件）", 数值: result.liquidationQuantity },
    { 分区: "清货方案", 项目: "ASP（$/件）", 数值: input.averageSellingPrice > 0 ? money(input.averageSellingPrice) : recoveryPending },
    { 分区: "清货方案", 项目: "回收率", 数值: `${number(input.recoveryRate * 100, 1)}%` },
    { 分区: "清货方案", 项目: "Amazon Shipping Weight（lb）", 数值: profile.valid ? number(profile.shippingWeightLb, 1) : recoveryPending },
    { 分区: "清货方案", 项目: "Processing fee（$/件）", 数值: result.liquidationRecoveryReady ? money(result.liquidationProcessingFeePerUnit) : recoveryPending },
    { 分区: "清货方案", 项目: "预计毛回收（$）", 数值: result.liquidationRecoveryReady ? money(result.liquidationGrossRecovery) : recoveryPending },
    { 分区: "清货方案", 项目: "Referral fee 15%（$）", 数值: result.liquidationRecoveryReady ? money(result.liquidationReferralFee) : recoveryPending },
    { 分区: "清货方案", 项目: "Processing fee 合计（$）", 数值: result.liquidationRecoveryReady ? money(result.liquidationProcessingFee) : recoveryPending },
    { 分区: "清货方案", 项目: "Amazon 费用合计（$）", 数值: result.liquidationRecoveryReady ? money(result.liquidationAmazonFees) : recoveryPending },
    { 分区: "清货方案", 项目: "预计净回收（$）", 数值: result.liquidationRecoveryReady ? money(result.liquidationNetRecovery) : recoveryPending },
    { 分区: "清货方案", 项目: "采购成本（$/件）", 数值: result.liquidationConfigured ? money(input.unitCost) : pnlPending },
    { 分区: "清货方案", 项目: "头程成本（$/件）", 数值: result.liquidationConfigured ? money(input.firstMileCostPerUnit ?? 0) : pnlPending },
    { 分区: "清货方案", 项目: "采购成本合计（$）", 数值: result.liquidationConfigured ? money(result.liquidationProductCost) : pnlPending },
    { 分区: "清货方案", 项目: "头程成本合计（$）", 数值: result.liquidationConfigured ? money(result.liquidationFirstMileCost) : pnlPending },
    { 分区: "清货方案", 项目: "批清损益/件（$）", 数值: result.liquidationConfigured ? money(result.liquidationPnlPerUnit) : pnlPending },
    { 分区: "清货方案", 项目: "批清损益合计（$）", 数值: result.liquidationConfigured ? money(result.liquidationPnl) : pnlPending },
    { 分区: "清货方案", 项目: "预计亏损（$，仅负损益）", 数值: result.liquidationConfigured ? money(result.liquidationLoss) : pnlPending },
    { 分区: "决策", 项目: "建议动作", 数值: result.decisionTitle },
    { 分区: "决策", 项目: "判断依据", 数值: result.decisionReason },
  ];
}

async function exportInventoryWorkbook(input: InventoryInput, result: InventoryResult): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.json_to_sheet(buildSummaryRows(input, result));
  const forecastSheet = XLSX.utils.json_to_sheet(result.forecast.map((row) => ({
    月份: row.month,
    仓储季节: storageSeasonLabel(row.storageSeason),
    月初库存: number(row.openingInventory),
    月末库存: number(row.closingInventory),
    平均库存: number(row.averageInventory),
    预计库龄天数: row.ageKnown ? row.ageDays : "待填写入仓日期",
    仓储费: money(row.storageFee),
    老化库存费: row.ageKnown ? money(row.agedFee) : "待计算",
    月度合计: row.ageKnown ? money(row.totalFee) : "待计算",
  })));
  XLSX.utils.book_append_sheet(workbook, summarySheet, "成本汇总");
  XLSX.utils.book_append_sheet(workbook, forecastSheet, "月度推演");
  XLSX.writeFile(workbook, "FBA_Inventory_Cost.xlsx");
}

async function exportInventoryCsv(input: InventoryInput, result: InventoryResult): Promise<void> {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(buildSummaryRows(input, result));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Cost");
  XLSX.writeFile(workbook, "FBA_Inventory_Cost.csv", { bookType: "csv" });
}

function InventoryCostSimulator() {
  const [input, setInput] = useState<InventoryInput>(() => createDefaultInput());
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => calculateInventoryCosts(input), [input]);
  const packageProfile = result.packageClassification;
  const removalConfigured = packageProfile.valid || (input.customRemovalFee !== null && input.customRemovalFee > 0);
  const maxForecastFee = Math.max(1, ...result.forecast.map((row) => row.totalFee));
  const missingPackageFields = [
    input.packageLengthCm > 0 ? "" : "包装长",
    input.packageWidthCm > 0 ? "" : "包装宽",
    input.packageHeightCm > 0 ? "" : "包装高",
    input.actualWeightKg > 0 ? "" : "实际重量",
  ].filter(Boolean);
  const packageStatusText = packageProfile.valid
    ? "包装参数已自动计算"
    : `还差：${missingPackageFields.join("、")}`;
  const liquidationStatusText = result.liquidationQuantity <= 0
    ? "请先填写清货数量"
    : "请补齐 ASP、采购成本、头程与包装参数";

  const update = (key: keyof InventoryInput, value: InventoryInput[keyof InventoryInput]) => {
    setInput((current) => ({ ...current, [key]: value } as InventoryInput));
  };

  const copyResult = async () => {
    const text = [
      "【FBA 库存成本推演】",
      `SKU：${input.sku || "未填写"}`,
      `ASIN：${input.asin || "未填写"}`,
      `当前库存：${input.currentInventory} 件`,
      `当前库龄：${result.inventoryAgeReady ? `${result.inventoryAgeDays} 天` : "待填写入仓日期"}`,
      `包装尺寸：${packageProfile.dimensionsValid ? `${number(input.packageLengthCm)} × ${number(input.packageWidthCm)} × ${number(input.packageHeightCm)} cm` : "待补齐"}`,
      `实际重量：${packageProfile.weightValid ? `${number(packageProfile.actualWeightKg, 3)} kg / ${number(packageProfile.actualWeightLb, 3)} lb` : "待补齐"}`,
      `Amazon 计费体积：${packageProfile.dimensionsValid ? `${number(packageProfile.unitVolumeCuFt, 4)} cu ft / 件` : "待补齐"}`,
      `Dimensional Weight：${packageProfile.valid ? `${number(packageProfile.dimensionalWeightLb, 3)} lb` : "待补齐"}`,
      `Size Tier：${packageProfile.valid ? packageProfile.sizeTierName : "待补齐"}`,
      `Shipping Weight：${packageProfile.valid ? `${number(packageProfile.shippingWeightLb, 1)} lb` : "待补齐"}`,
      `计费依据：${weightBasisLabel(packageProfile)}`,
      `Amazon 仓储季节：${storageSeasonLabel(result.storageRates.season)}`,
      `月仓储基础费率：$${money(result.storageRates.baseRate)} / cu ft`,
      `库存总体积：${number(result.totalVolume)} cu ft`,
      `预计月仓储费：$${money(result.monthlyStorageFee)}`,
      `181–270 天豁免类目：${input.agedSurchargeEarlyTierExempt ? "是（服饰/鞋/箱包/珠宝/手表）" : "否"}`,
      `预计老化库存费：${result.agedCalculationReady ? `$${money(result.agedInventoryFee)}` : "待填写入仓日期"}`,
      `移除方案现金流：${removalConfigured ? outflowMoney(result.removalTotalFee) : "待补齐包装参数"}`,
      `清货数量：${result.liquidationQuantity} 件`,
      `ASP：${input.averageSellingPrice > 0 ? `$${money(input.averageSellingPrice)} / 件` : "待补齐回收输入"}`,
      `回收率：${number(input.recoveryRate * 100, 1)}%`,
      `Shipping Weight：${packageProfile.valid ? `${number(packageProfile.shippingWeightLb, 1)} lb` : "待补齐回收输入"}`,
      `清货毛回收：${result.liquidationRecoveryReady ? signedMoney(result.liquidationGrossRecovery) : "待补齐回收输入"}`,
      `Referral fee（15%）：${result.liquidationRecoveryReady ? `−$${money(result.liquidationReferralFee)}` : "待补齐回收输入"}`,
      `Processing fee：${result.liquidationRecoveryReady ? `−$${money(result.liquidationProcessingFee)}（$${money(result.liquidationProcessingFeePerUnit)}/件）` : "待补齐回收输入"}`,
      `清货净回收：${result.liquidationRecoveryReady ? signedMoney(result.liquidationNetRecovery) : "待补齐回收输入"}`,
      `采购成本：${result.liquidationConfigured ? `−$${money(result.liquidationProductCost)}` : "待补齐 P&L 输入"}`,
      `头程成本：${result.liquidationConfigured ? `−$${money(result.liquidationFirstMileCost)}` : "待补齐 P&L 输入"}`,
      `批清 P&L：${result.liquidationConfigured ? signedMoney(result.liquidationPnl) : "待补齐输入"}`,
      `未来持有成本：${result.projectedHoldingCostReady ? `$${money(result.projectedHoldingCost)}` : "待填写有效入仓日期"}`,
      `建议动作：${result.decisionTitle}`,
      `判断依据：${result.decisionReason}`,
    ].join("\n");
    await writeClipboard(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const reset = () => setInput(createDefaultInput());

  return (
    <main className="main-content inventory-main">
      <header className="topbar inventory-topbar">
        <div>
          <div className="eyebrow">板块三 · INVENTORY COST SIMULATOR</div>
          <h1>FBA 库存成本推演</h1>
          <p>月仓储费、老化库存、移除与批量清货决策</p>
        </div>
        <div className="inventory-top-actions">
          <button className="rule-link" type="button" onClick={() => window.print()}><Printer size={15} /> 打印</button>
          <a className="rule-link" href={OFFICIAL_STORAGE_RULE} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Amazon 官方规则</a>
        </div>
      </header>

      <div className="inventory-page">
        <div className="inventory-workspace">
          <section className="inventory-input-panel" aria-labelledby="inventory-input-title">
            <div className="panel-heading">
              <div><span>01</span><h2 id="inventory-input-title">库存参数</h2></div>
              <button className="icon-button" type="button" onClick={reset} title="清空数据"><RotateCcw size={17} /></button>
            </div>

            <div className="inventory-form-section">
              <div className="section-label"><Warehouse size={15} /> 产品基础信息</div>
              <div className="inventory-form-grid">
                <label className="field-label"><span>SKU</span><input value={input.sku} onChange={(event) => update("sku", event.target.value)} /></label>
                <label className="field-label"><span>ASIN</span><input value={input.asin} onChange={(event) => update("asin", event.target.value)} /></label>
                <label className="field-label full"><span>产品名称</span><input value={input.productName} onChange={(event) => update("productName", event.target.value)} /></label>
              </div>
            </div>

            <div className="inventory-form-section">
              <div className="section-label"><Gauge size={15} /> 库存与周转</div>
              <div className="inventory-form-grid">
                <label className="field-label"><span>当前库存（件）</span><input type="number" min="0" step="1" value={numberInputValue(input.currentInventory)} onChange={(event) => update("currentInventory", integer(event.target.value))} /></label>
                <label className="field-label"><span>平均日销</span><input type="number" min="0" step="0.01" value={numberInputValue(input.averageDailySales)} onChange={(event) => update("averageDailySales", numeric(event.target.value))} /></label>
                <label className="field-label"><span>ASP / 平均售价（$/件）</span><input type="number" min="0" step="0.01" value={numberInputValue(input.averageSellingPrice)} onChange={(event) => update("averageSellingPrice", numeric(event.target.value))} /></label>
                <label className="field-label"><span>采购成本（$/件）</span><input type="number" min="0" step="0.01" value={numberInputValue(input.unitCost)} onChange={(event) => update("unitCost", numeric(event.target.value))} /></label>
                <label className="field-label"><span>头程成本（$/件，可填 0）</span><input type="number" min="0" step="0.01" value={numberInputValue(input.firstMileCostPerUnit)} onChange={(event) => update("firstMileCostPerUnit", event.target.value === "" ? null : numeric(event.target.value))} /></label>
                <label className="field-label"><span>入仓日期</span><input type="date" value={input.inboundDate} onChange={(event) => update("inboundDate", event.target.value)} /></label>
                <label className="field-label"><span>当前日期</span><input type="date" value={input.currentDate} onChange={(event) => update("currentDate", event.target.value)} /></label>
              </div>
            </div>

            <div className="inventory-form-section">
              <div className="section-label"><Scale size={15} /> 单品包装与 Amazon 计费</div>
              <div className="inventory-form-grid">
                <label className="field-label"><span>包装长（cm）</span><input type="number" min="0" step="0.1" value={numberInputValue(input.packageLengthCm)} onChange={(event) => update("packageLengthCm", numeric(event.target.value))} /></label>
                <label className="field-label"><span>包装宽（cm）</span><input type="number" min="0" step="0.1" value={numberInputValue(input.packageWidthCm)} onChange={(event) => update("packageWidthCm", numeric(event.target.value))} /></label>
                <label className="field-label"><span>包装高（cm）</span><input type="number" min="0" step="0.1" value={numberInputValue(input.packageHeightCm)} onChange={(event) => update("packageHeightCm", numeric(event.target.value))} /></label>
                <label className="field-label"><span>含包装实际重量（kg）</span><input type="number" min="0" step="0.001" value={numberInputValue(input.actualWeightKg)} onChange={(event) => update("actualWeightKg", numeric(event.target.value))} /></label>
              </div>
              <small className="inventory-field-hint">三边无需按大小排序；系统会自动计算体积、Size Tier、Dimensional Weight 与 Shipping Weight。</small>

              <div className={`package-auto-panel ${packageProfile.valid ? "ready" : "pending"}`}>
                <div className="package-auto-heading"><span>自动判定结果</span><b>{packageProfile.valid ? "已计算" : packageStatusText}</b></div>
                <div className="package-auto-grid">
                  <div><small>Amazon 计费体积</small><strong>{packageProfile.dimensionsValid ? `${number(packageProfile.unitVolumeCuFt, 4)} ft³/件` : "—"}</strong></div>
                  <div><small>实际重量</small><strong>{packageProfile.weightValid ? `${number(packageProfile.actualWeightKg, 3)} kg / ${number(packageProfile.actualWeightLb, 2)} lb` : "—"}</strong></div>
                  <div><small>Dimensional Weight</small><strong>{packageProfile.valid ? `${number(packageProfile.dimensionalWeightLb, 2)} lb` : "—"}</strong></div>
                  <div><small>Amazon Size Tier</small><strong>{packageProfile.valid ? packageProfile.sizeTierName : "—"}</strong></div>
                  <div className="shipping-weight-result"><small>Shipping Weight</small><strong>{packageProfile.valid ? `${number(packageProfile.shippingWeightLb, packageProfile.shippingWeightLb < 1 ? 1 : 0)} lb` : "—"}</strong></div>
                  <div><small>计费依据</small><strong>{weightBasisLabel(packageProfile)}</strong></div>
                </div>
              </div>

              <label className="inventory-check-row">
                <input type="checkbox" checked={input.dangerousGoods} onChange={(event) => setInput((current) => ({ ...current, dangerousGoods: event.target.checked, utilizationEligible: event.target.checked ? false : current.utilizationEligible }))} />
                <span><b>危险品 / Hazmat</b><small>自动使用危险品月仓储费率</small></span>
              </label>
              <label className={`inventory-check-row ${input.dangerousGoods ? "disabled" : ""}`}>
                <input type="checkbox" disabled={input.dangerousGoods} checked={input.utilizationEligible} onChange={(event) => update("utilizationEligible", event.target.checked)} />
                <span><b>符合库容利用率附加费条件</b><small>专业账户、首票超过 365 天且体积和周转达到门槛</small></span>
              </label>
              {input.utilizationEligible && <label className="field-label"><span>历史库容利用率（周）</span><input type="number" min="0" step="0.1" value={numberInputValue(input.utilizationWeeks)} onChange={(event) => update("utilizationWeeks", numeric(event.target.value))} /></label>}

              <div className="storage-season-panel">
                <div className="storage-season-heading"><span>Amazon 月仓储季节</span><small>直接选择，系统按 Size Tier 自动匹配费率</small></div>
                <div className="tier-segment storage-season-segment" role="group" aria-label="Amazon 月仓储季节">
                  <button type="button" className={input.storageSeason === "offPeak" ? "active" : ""} aria-pressed={input.storageSeason === "offPeak"} onClick={() => update("storageSeason", "offPeak")}><b>淡季</b><small>1–9 月</small></button>
                  <button type="button" className={input.storageSeason === "peak" ? "active" : ""} aria-pressed={input.storageSeason === "peak"} onClick={() => update("storageSeason", "peak")}><b>旺季</b><small>10–12 月</small></button>
                </div>
                <p>{packageProfile.valid
                  ? `当前：${storageSeasonLabel(result.storageRates.season)} · ${input.dangerousGoods ? "危险品" : "普通商品"} · ${packageProfile.sizeTierName} · $${money(result.storageRates.baseRate)}/cu ft`
                  : `已选${input.storageSeason === "peak" ? "旺季" : "淡季"}；补齐包装尺寸与重量后自动匹配 Standard-size / Oversize 费率。`}</p>
                <small className="storage-season-forecast-note">当前月和推演首月按所选季节；后续月份按日历自动跨季。</small>
              </div>
              <label className="inventory-check-row">
                <input type="checkbox" checked={input.agedSurchargeEarlyTierExempt} onChange={(event) => update("agedSurchargeEarlyTierExempt", event.target.checked)} />
                <span><b>服饰 / 鞋 / 箱包 / 珠宝 / 手表</b><small>181–270 天老化库存附加费豁免；271 天起正常计费</small></span>
              </label>
              <div className="custom-rate-row">
                <label className="inventory-check-row compact">
                  <input type="checkbox" checked={input.customAgedRate !== null} onChange={(event) => update("customAgedRate", event.target.checked ? result.agedRates.volumeRate : null)} />
                  <span><b>手动老化库存体积费率</b><small>只覆盖 $/cu ft；366 天以上最低每件费仍保留</small></span>
                </label>
                {input.customAgedRate !== null && <label className="rate-input"><span>$ / cu ft</span><input type="number" min="0" step="0.01" value={numberInputValue(input.customAgedRate)} onChange={(event) => update("customAgedRate", numeric(event.target.value))} /></label>}
              </div>
            </div>

            <div className="inventory-form-section">
              <div className="section-label"><PackageMinus size={15} /> 退出方案参数</div>
              <div className="inventory-form-grid">
                <label className="field-label"><span>移除数量</span><input type="number" min="0" step="1" value={numberInputValue(input.removalQuantity)} onChange={(event) => update("removalQuantity", integer(event.target.value))} /></label>
                <label className="field-label"><span>清货数量</span><input type="number" min="0" step="1" value={numberInputValue(input.liquidationQuantity)} onChange={(event) => update("liquidationQuantity", integer(event.target.value))} /></label>
                <label className="field-label"><span>预计回收率（按 ASP）</span><div className="percent-input"><input type="number" min="0" max="15" step="0.1" value={numberInputValue(input.recoveryRate * 100)} onChange={(event) => update("recoveryRate", Math.min(0.15, numeric(event.target.value) / 100))} /><b>%</b></div></label>
              </div>
              <div className="liquidation-rate-scenarios" aria-label="清货回收率情景">
                <span>快速情景</span>
                {[0.05, 0.075, 0.10].map((rate) => <button className={Math.abs(input.recoveryRate - rate) < 0.0001 ? "active" : ""} type="button" key={rate} onClick={() => update("recoveryRate", rate)}>{number(rate * 100, rate === 0.075 ? 1 : 0)}%</button>)}
                <small>Amazon 常见估算区间为 ASP 的 5%–10%</small>
              </div>
              <div className="custom-rate-row removal-rate-row">
                <label className="inventory-check-row compact">
                  <input type="checkbox" checked={input.customRemovalFee !== null} onChange={(event) => update("customRemovalFee", event.target.checked ? result.removalFeePerUnit : null)} />
                  <span><b>手动单件移除费</b><small>关闭时按 2026 重量阶梯自动匹配</small></span>
                </label>
                {input.customRemovalFee !== null && <label className="rate-input"><span>$ / 件</span><input type="number" min="0" step="0.01" value={numberInputValue(input.customRemovalFee)} onChange={(event) => update("customRemovalFee", numeric(event.target.value))} /></label>}
              </div>
              <label className="field-label forecast-field"><span>未来持有成本推演（月）</span><input type="number" min="1" max="24" step="1" value={numberInputValue(input.forecastMonths)} onChange={(event) => update("forecastMonths", event.target.value === "" ? 0 : Math.min(24, Math.max(1, integer(event.target.value))))} /></label>
            </div>
          </section>

          <section className="inventory-results" aria-live="polite">
            <div className={`inventory-result-hero decision-${result.decision}`}>
              <div>
                <span className="result-kicker">未来持有成本推演</span>
                <div className="inventory-cost-total">{result.projectedHoldingCostReady ? <><sup>$</sup>{money(result.projectedHoldingCost)}</> : "待计算"}</div>
                <p>{result.projectedHoldingCostReady ? `按当前日销推演 ${result.forecast.length} 个月，库存售罄后停止计费` : "请先填写有效入仓日期；当前仅列出可确定的月仓储费明细"}</p>
                <div className="fee-meta">
                  <span>库龄 {result.inventoryAgeReady ? `${result.inventoryAgeDays} 天` : "待填写"}</span>
                  <span>可售 {daysOfSupply(result.daysOfSupply)}</span>
                  <span>{storageSeasonLabel(result.storageRates.season)}</span>
                </div>
              </div>
              <div className="decision-hero-block">
                <small>系统建议</small>
                <strong>{result.decisionTitle}</strong>
                <p>{result.decisionReason}</p>
              </div>
              <div className="inventory-hero-actions">
                <button type="button" onClick={copyResult}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "已复制" : "复制"}</button>
                <button type="button" onClick={() => exportInventoryWorkbook(input, result)}><FileSpreadsheet size={15} /> Excel</button>
                <button type="button" onClick={() => exportInventoryCsv(input, result)}><Download size={15} /> CSV</button>
              </div>
            </div>

            <div className="inventory-summary-grid">
              <div><span>库存总体积</span><strong>{number(result.totalVolume)}<small> cu ft</small></strong></div>
              <div><span>预计月仓储费</span><strong>${money(result.monthlyStorageFee)}</strong></div>
              <div><span>当前老化库存费</span><strong className={result.agedCalculationReady && result.agedInventoryFee > 0 ? "warning-text" : "success-text"}>{result.agedCalculationReady ? `$${money(result.agedInventoryFee)}` : "—"}</strong></div>
              <div><span>当前库存货值</span><strong>${money(result.remainingInventoryValue)}</strong></div>
            </div>

            <article className="inventory-section">
              <div className="inventory-section-heading">
                <div><span>01</span><div><h2>月仓储费推算</h2><p>当前库存 × 单件体积 × 月费率</p></div></div>
                <a href={OFFICIAL_STORAGE_RULE} target="_blank" rel="noreferrer">查看规则 <ExternalLink size={12} /></a>
              </div>
              <div className="inventory-metric-strip four">
                <div><small>当前库存</small><strong>{input.currentInventory} 件</strong></div>
                <div><small>单件体积（自动）</small><strong>{packageProfile.dimensionsValid ? `${number(packageProfile.unitVolumeCuFt, 4)} cu ft` : "—"}</strong></div>
                <div><small>基础费率</small><strong>${money(result.storageRates.baseRate)} / cu ft</strong></div>
                <div><small>库容附加费率</small><strong>${money(result.storageRates.utilizationRate)} / cu ft</strong></div>
              </div>
              <div className="inventory-invoice">
                <div><span>库存总体积</span><b>{packageProfile.dimensionsValid ? `${input.currentInventory} × ${number(packageProfile.unitVolumeCuFt, 4)} = ${number(result.totalVolume)} cu ft` : "待补齐包装尺寸"}</b></div>
                <div><span>基础月仓储费</span><b>${money(result.monthlyBaseStorageFee)}</b></div>
                <div><span>Storage Utilization Surcharge</span><b>${money(result.monthlyUtilizationSurcharge)}</b></div>
                <div className="total"><span>预计当月仓储费</span><b>${money(result.monthlyStorageFee)}</b></div>
              </div>
            </article>

            <article className="inventory-section">
              <div className="inventory-section-heading">
                <div><span>02</span><div><h2>长期仓储费 / 老化库存</h2><p>按当前库龄匹配费率，体积费与最低每件费取较高值</p></div></div>
                <a href={OFFICIAL_AGED_INVENTORY_RULE} target="_blank" rel="noreferrer">2026 费率 <ExternalLink size={12} /></a>
              </div>
              <div className="aged-status-row">
                <div><Clock3 size={20} /><span><small>当前库龄</small><strong>{result.inventoryAgeReady ? `${result.inventoryAgeDays} 天` : "待填写入仓日期"}</strong></span></div>
                <div><CalendarDays size={20} /><span><small>计费档位</small><strong>{result.agedCalculationReady ? result.agedRates.ageBand : "待计算"}</strong></span></div>
                <div><Warehouse size={20} /><span><small>老化库存数量</small><strong>{result.agedCalculationReady ? `${result.agedInventoryQuantity} 件` : "—"}</strong></span></div>
              </div>
              <div className="aged-comparison">
                <div><small>体积口径</small><strong>{result.agedCalculationReady ? `$${money(result.agedVolumeFee)}` : "—"}</strong><span>{result.agedCalculationReady ? packageProfile.dimensionsValid ? `${result.agedInventoryQuantity} × ${number(packageProfile.unitVolumeCuFt, 4)} × $${money(result.agedRates.volumeRate)}` : "待补齐包装尺寸" : "待填写入仓日期"}</span></div>
                <b>取较高值</b>
                <div><small>最低每件口径</small><strong>{result.agedCalculationReady ? `$${money(result.agedMinimumFee)}` : "—"}</strong><span>{result.agedCalculationReady ? `${result.agedInventoryQuantity} × $${money(result.agedRates.minimumPerUnit)}` : "待填写入仓日期"}</span></div>
                <div className="aged-selected"><small>预计老化库存费</small><strong>{result.agedCalculationReady ? `$${money(result.agedInventoryFee)}` : "—"}</strong></div>
              </div>
              {!result.agedCalculationReady && <p className="inventory-rule-note"><Info size={14} /> 请填写入仓日期；缺少日期时不把库存默认当作 0 天，也不推演老化库存费。</p>}
              {result.inventoryAgeReady && input.agedSurchargeEarlyTierExempt && result.inventoryAgeDays >= 181 && result.inventoryAgeDays <= 270 && <p className="inventory-rule-note"><Info size={14} /> 当前属于 181–270 天豁免档，服饰、鞋、箱包、珠宝和手表不收该档老化库存附加费。</p>}
              {input.customAgedRate === null && result.inventoryAgeReady && result.inventoryAgeDays >= 181 && result.inventoryAgeDays <= 365 && <p className="inventory-rule-note"><Info size={14} /> 181–365 天档位已内置；费率变化时可在左侧启用“手动老化库存体积费率”覆盖。</p>}
              <p className="inventory-rule-note neutral"><Info size={14} /> 当前按单一入仓日期估算；Amazon 实际按每月 15 日快照与 FIFO 库龄分布计费。</p>
            </article>

            <div className="exit-plan-grid">
              <article className="exit-plan removal-plan">
                <div className="exit-plan-title"><PackageMinus size={20} /><div><h2>库存移除方案</h2><p>按自动判定的 Size Tier 与 Shipping Weight 匹配移除费</p></div></div>
                <div className="exit-plan-amount"><span>预计总移除费用</span><strong>{removalConfigured ? outflowMoney(result.removalTotalFee) : "—"}</strong><small>{removalConfigured ? "负号表示预计现金流出" : "补齐包装参数后自动测算"}</small></div>
                <dl>
                  <div><dt>计算数量</dt><dd>{Math.min(input.currentInventory, input.removalQuantity)} 件</dd></div>
                  <div><dt>Size Tier</dt><dd>{packageProfile.valid ? packageProfile.sizeTierName : "—"}</dd></div>
                  <div><dt>Shipping Weight</dt><dd>{packageProfile.valid ? `${number(packageProfile.shippingWeightLb, packageProfile.shippingWeightLb < 1 ? 1 : 0)} lb` : "—"}</dd></div>
                  <div><dt>单件移除费</dt><dd>{removalConfigured ? `$${money(result.removalFeePerUnit)}` : "—"}</dd></div>
                  <div><dt>移除后货权</dt><dd>货物可退回或处置</dd></div>
                </dl>
                <a href={OFFICIAL_REMOVAL_RULE} target="_blank" rel="noreferrer">Amazon removal fee <ExternalLink size={12} /></a>
              </article>

              <article className={`exit-plan liquidation-plan ${result.liquidationConfigured ? "is-ready" : "is-pending"}`}>
                <div className="exit-plan-title"><TrendingDown size={20} /><div><h2>批量清货方案</h2><p>ASP 回收 → Amazon 费用 → 采购与头程 P&amp;L</p></div></div>
                <div className={`exit-plan-amount ${result.liquidationConfigured && result.liquidationPnl >= 0 ? "pnl-positive" : "pnl-negative"}`}>
                  <span>{result.liquidationConfigured ? "预计批清损益" : "批清损益待测算"}</span>
                  <strong>{result.liquidationConfigured ? signedMoney(result.liquidationPnl) : "—"}</strong>
                  <small>{result.liquidationConfigured ? `${signedMoney(result.liquidationPnlPerUnit)} / 件` : liquidationStatusText}</small>
                </div>
                <dl>
                  <div><dt>计算数量</dt><dd>{result.liquidationQuantity || "—"} 件</dd></div>
                  <div><dt>ASP × 回收率</dt><dd>{input.averageSellingPrice > 0 ? `$${money(input.averageSellingPrice)} × ${number(input.recoveryRate * 100, 1)}%` : "—"}</dd></div>
                  <div><dt>预计毛回收</dt><dd>{result.liquidationRecoveryReady ? signedMoney(result.liquidationGrossRecovery) : "—"}</dd></div>
                  <div><dt>15% Referral fee</dt><dd>{result.liquidationRecoveryReady ? `−$${money(result.liquidationReferralFee)}` : "—"}</dd></div>
                  <div><dt>Processing fee</dt><dd>{result.liquidationRecoveryReady ? `−$${money(result.liquidationProcessingFee)}` : "—"} <small>{packageProfile.valid ? `(${number(packageProfile.shippingWeightLb, packageProfile.shippingWeightLb < 1 ? 1 : 0)} lb · $${money(result.liquidationProcessingFeePerUnit)}/件)` : ""}</small></dd></div>
                  <div><dt>Amazon 费用合计</dt><dd>{result.liquidationRecoveryReady ? `−$${money(result.liquidationAmazonFees)}` : "—"}</dd></div>
                  <div className="net"><dt>预计净回收</dt><dd>{result.liquidationRecoveryReady ? signedMoney(result.liquidationNetRecovery) : "—"}</dd></div>
                  <div><dt>采购成本</dt><dd>{result.liquidationConfigured ? `−$${money(result.liquidationProductCost)}` : "—"}</dd></div>
                  <div><dt>头程成本</dt><dd>{result.liquidationConfigured ? `−$${money(result.liquidationFirstMileCost)}` : "—"}</dd></div>
                  <div className="net"><dt>批清 P&amp;L 合计</dt><dd>{result.liquidationConfigured ? signedMoney(result.liquidationPnl) : "—"}</dd></div>
                </dl>
                <p>{result.liquidationConfigured ? "P&L 已扣采购成本与头程成本；月仓储费在下方方案对比中单独列示，不重复扣减。" : liquidationStatusText} 实际报价以 Amazon 及清算商结果为准。</p>
                <a href={OFFICIAL_LIQUIDATION_RULE} target="_blank" rel="noreferrer">Amazon FBA Liquidations <ExternalLink size={12} /></a>
              </article>
            </div>

            <article className="inventory-section cost-summary-section">
              <div className="inventory-section-heading">
                <div><span>03</span><div><h2>库存处理方案对比</h2><p>当前费用快照与互斥退出方案</p></div></div>
              </div>
              <div className="cost-summary-table">
                <div><span>当前整仓月仓储费</span><b>${money(result.monthlyStorageFee)}</b></div>
                <div><span>老化库存费用</span><b>{result.agedCalculationReady ? `$${money(result.agedInventoryFee)}` : "—"}</b></div>
                <div><span>库存移除费用</span><b>{removalConfigured ? outflowMoney(result.removalTotalFee) : "—"}</b></div>
                <div><span>批量清货损益</span><b>{result.liquidationConfigured ? signedMoney(result.liquidationPnl) : "—"}</b></div>
              </div>
              <p className="inventory-rule-note neutral"><Info size={14} /> 移除与清货是互斥方案，不能相加。当前整仓月仓储费单独列示，未计入批清 P&amp;L，避免重复扣减；决策应分别比较持有成本、移除费和清货损失。</p>
            </article>

            <article className="inventory-section forecast-section">
              <div className="inventory-section-heading">
                <div><span>04</span><div><h2>未来月度成本推演</h2><p>首月按所选季节，后续按月份自动跨季并匹配库龄费率</p></div></div>
                <strong>{result.projectedHoldingCostReady ? `合计 $${money(result.projectedHoldingCost)}` : "合计待计算"}</strong>
              </div>
              <div className="forecast-table-wrap">
                <table className="forecast-table">
                  <thead><tr><th>月份</th><th>月初库存</th><th>月末库存</th><th>预计库龄</th><th>仓储费</th><th>老化费</th><th>月度合计</th><th>成本趋势</th></tr></thead>
                  <tbody>
                    {result.forecast.map((row) => <tr key={row.month}>
                      <td><b>{row.month}</b><small className="forecast-season">{row.storageSeason === "peak" ? "旺季" : "淡季"}</small></td>
                      <td>{number(row.openingInventory)} 件</td>
                      <td>{number(row.closingInventory)} 件</td>
                      <td>{row.ageKnown ? `${row.ageDays} 天` : "—"}</td>
                      <td>${money(row.storageFee)}</td>
                      <td>{row.ageKnown ? `$${money(row.agedFee)}` : "—"}</td>
                      <td><b>{row.ageKnown ? `$${money(row.totalFee)}` : "—"}</b></td>
                      <td>{row.ageKnown ? <div className="forecast-bar"><i style={{ width: `${Math.max(2, (row.totalFee / maxForecastFee) * 100)}%` }} /></div> : "—"}</td>
                    </tr>)}
                  </tbody>
                </table>
                {result.forecast.length === 0 && <div className="empty-table">当前没有可推演库存。</div>}
              </div>
            </article>

            <article className={`decision-panel decision-${result.decision}`}>
              <Sparkles size={24} />
              <div><span>库存处理决策参考</span><h2>{result.decisionTitle}</h2><p>{result.decisionReason}</p></div>
              <div className="decision-comparison">
                <div><small>未来持有成本</small><b>{result.projectedHoldingCostReady ? `$${money(result.projectedHoldingCost)}` : "—"}</b></div>
                <div><small>移除费用</small><b>{removalConfigured ? outflowMoney(result.removalTotalFee) : "—"}</b></div>
                <div><small>清货损益</small><b>{result.liquidationConfigured ? signedMoney(result.liquidationPnl) : "—"}</b></div>
              </div>
            </article>

            <div className="warning-list inventory-warnings">
              {result.warnings.map((warning) => <p key={warning}><AlertTriangle size={14} />{warning}</p>)}
            </div>

            <footer className="source-footer inventory-source-footer">
              <span>规则来源 · Amazon US 2026</span>
              <a href={OFFICIAL_STORAGE_RULE} target="_blank" rel="noreferrer">Monthly storage fees <ExternalLink size={12} /></a>
              <a href={OFFICIAL_AGED_INVENTORY_RULE} target="_blank" rel="noreferrer">Aged inventory surcharge <ExternalLink size={12} /></a>
              <a href={OFFICIAL_REMOVAL_RULE} target="_blank" rel="noreferrer">Removal & liquidation <ExternalLink size={12} /></a>
              <a href={OFFICIAL_LIQUIDATION_RULE} target="_blank" rel="noreferrer">FBA Liquidations P&amp;L <ExternalLink size={12} /></a>
            </footer>
          </section>
        </div>
      </div>
    </main>
  );
}

export default InventoryCostSimulator;
