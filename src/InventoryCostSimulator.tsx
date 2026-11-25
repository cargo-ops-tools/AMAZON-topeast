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
  type DecisionAction,
  type InventoryInput,
  type InventoryResult,
  type InventorySizeTier,
} from "./lib/inventory";
import { numberInputValue } from "./lib/input";

const OFFICIAL_STORAGE_RULE = "https://sellercentral.amazon.com/help/hub/reference/external/G3EDYEF6KUCFQTNM";
const OFFICIAL_2026_RULE = "https://sellercentral.amazon.com/help/hub/reference/external/G201411300";
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
  return {
    sku: "",
    asin: "",
    productName: "",
    currentInventory: 0,
    unitVolumeCuFt: 0,
    averageDailySales: 0,
    inboundDate: "",
    currentDate: localDateString(),
    sizeTier: "standard",
    dangerousGoods: false,
    utilizationEligible: false,
    utilizationWeeks: 0,
    customStorageRate: null,
    customAgedRate: null,
    removalQuantity: 0,
    unitWeightLb: 0,
    customRemovalFee: null,
    liquidationQuantity: 0,
    averageSellingPrice: 0,
    unitCost: 0,
    firstMileCostPerUnit: null,
    recoveryRate: 0.075,
    forecastMonths: 0,
  };
}

const DECISION_LABELS: Record<DecisionAction, string> = {
  continue: "继续销售",
  promote: "降价促销",
  remove: "移除库存",
  liquidate: "批量清货",
};

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

function number(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.00";
}

function daysOfSupply(value: number): string {
  return Number.isFinite(value) ? `${Math.ceil(value)} 天` : "无销量";
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
  return [
    { 分区: "基础信息", 项目: "SKU", 数值: input.sku },
    { 分区: "基础信息", 项目: "ASIN", 数值: input.asin },
    { 分区: "基础信息", 项目: "产品名称", 数值: input.productName },
    { 分区: "基础信息", 项目: "当前库存", 数值: input.currentInventory },
    { 分区: "基础信息", 项目: "库存年龄（天）", 数值: result.inventoryAgeDays },
    { 分区: "基础信息", 项目: "库存可售天数", 数值: daysOfSupply(result.daysOfSupply) },
    { 分区: "月仓储费", 项目: "库存总体积（cu ft）", 数值: number(result.totalVolume) },
    { 分区: "月仓储费", 项目: "基础仓储费（$）", 数值: money(result.monthlyBaseStorageFee) },
    { 分区: "月仓储费", 项目: "库容利用率附加费（$）", 数值: money(result.monthlyUtilizationSurcharge) },
    { 分区: "月仓储费", 项目: "预计月仓储费（$）", 数值: money(result.monthlyStorageFee) },
    { 分区: "老化库存", 项目: "费率档位", 数值: result.agedRates.ageBand },
    { 分区: "老化库存", 项目: "预计老化库存费用（$）", 数值: money(result.agedInventoryFee) },
    { 分区: "移除方案", 项目: "移除数量", 数值: Math.min(input.currentInventory, input.removalQuantity) },
    { 分区: "移除方案", 项目: "单件移除费（$）", 数值: money(result.removalFeePerUnit) },
    { 分区: "移除方案", 项目: "总移除费（$）", 数值: money(result.removalTotalFee) },
    { 分区: "清货方案", 项目: "测算状态", 数值: result.liquidationConfigured ? "完整 P&L" : "待补齐输入" },
    { 分区: "清货方案", 项目: "清货数量（件）", 数值: result.liquidationQuantity },
    { 分区: "清货方案", 项目: "ASP（$/件）", 数值: input.averageSellingPrice > 0 ? money(input.averageSellingPrice) : recoveryPending },
    { 分区: "清货方案", 项目: "回收率", 数值: `${number(input.recoveryRate * 100, 1)}%` },
    { 分区: "清货方案", 项目: "Amazon Shipping Weight（lb）", 数值: input.unitWeightLb > 0 ? number(input.unitWeightLb) : recoveryPending },
    { 分区: "清货方案", 项目: "Processing fee（$/件）", 数值: result.liquidationRecoveryReady ? money(result.liquidationProcessingFeePerUnit) : recoveryPending },
    { 分区: "清货方案", 项目: "预计毛回收（$）", 数值: result.liquidationRecoveryReady ? money(result.liquidationGrossRecovery) : recoveryPending },
    { 分区: "清货方案", 项目: "Referral fee 15%（$）", 数值: result.liquidationRecoveryReady ? money(result.liquidationReferralFee) : recoveryPending },
    { 分区: "清货方案", 项目: "Processing fee 合计（$）", 数值: result.liquidationRecoveryReady ? money(result.liquidationProcessingFee) : recoveryPending },
    { 分区: "清货方案", 项目: "Amazon 费用合计（$）", 数值: result.liquidationRecoveryReady ? money(result.liquidationAmazonFees) : recoveryPending },
    { 分区: "清货方案", 项目: "预计净回收（$）", 数值: result.liquidationRecoveryReady ? money(result.liquidationNetRecovery) : recoveryPending },
    { 分区: "清货方案", 项目: "采购成本（$/件）", 数值: result.liquidationConfigured ? money(input.unitCost) : pnlPending },
    { 分区: "清货方案", 项目: "头程成本（$/件）", 数值: result.liquidationConfigured ? money(input.firstMileCostPerUnit ?? 0) : pnlPending },
    { 分区: "清货方案", 项目: "当月仓储（$/件）", 数值: result.liquidationConfigured && result.liquidationQuantity > 0 ? money(result.liquidationCurrentMonthStorageFee / result.liquidationQuantity) : pnlPending },
    { 分区: "清货方案", 项目: "采购成本合计（$）", 数值: result.liquidationConfigured ? money(result.liquidationProductCost) : pnlPending },
    { 分区: "清货方案", 项目: "头程成本合计（$）", 数值: result.liquidationConfigured ? money(result.liquidationFirstMileCost) : pnlPending },
    { 分区: "清货方案", 项目: "当月仓储分摊（$）", 数值: result.liquidationConfigured ? money(result.liquidationCurrentMonthStorageFee) : pnlPending },
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
    月初库存: number(row.openingInventory),
    月末库存: number(row.closingInventory),
    平均库存: number(row.averageInventory),
    预计库龄天数: row.ageDays,
    仓储费: money(row.storageFee),
    老化库存费: money(row.agedFee),
    月度合计: money(row.totalFee),
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
  const maxForecastFee = Math.max(1, ...result.forecast.map((row) => row.totalFee));
  const liquidationStatusText = result.liquidationQuantity <= 0
    ? "请先填写清货数量"
    : "请补齐 ASP、采购成本、头程、单件体积与 Shipping Weight";

  const update = (key: keyof InventoryInput, value: InventoryInput[keyof InventoryInput]) => {
    setInput((current) => ({ ...current, [key]: value } as InventoryInput));
  };

  const copyResult = async () => {
    const text = [
      "【FBA 库存成本推演】",
      `SKU：${input.sku || "未填写"}`,
      `ASIN：${input.asin || "未填写"}`,
      `当前库存：${input.currentInventory} 件`,
      `当前库龄：${result.inventoryAgeDays} 天`,
      `库存总体积：${number(result.totalVolume)} cu ft`,
      `预计月仓储费：$${money(result.monthlyStorageFee)}`,
      `预计老化库存费：$${money(result.agedInventoryFee)}`,
      `移除方案：$${money(result.removalTotalFee)}`,
      `清货数量：${result.liquidationQuantity} 件`,
      `ASP：${input.averageSellingPrice > 0 ? `$${money(input.averageSellingPrice)} / 件` : "待补齐回收输入"}`,
      `回收率：${number(input.recoveryRate * 100, 1)}%`,
      `Shipping Weight：${input.unitWeightLb > 0 ? `${number(input.unitWeightLb)} lb` : "待补齐回收输入"}`,
      `清货毛回收：${result.liquidationRecoveryReady ? signedMoney(result.liquidationGrossRecovery) : "待补齐回收输入"}`,
      `Referral fee（15%）：${result.liquidationRecoveryReady ? `−$${money(result.liquidationReferralFee)}` : "待补齐回收输入"}`,
      `Processing fee：${result.liquidationRecoveryReady ? `−$${money(result.liquidationProcessingFee)}（$${money(result.liquidationProcessingFeePerUnit)}/件）` : "待补齐回收输入"}`,
      `清货净回收：${result.liquidationRecoveryReady ? signedMoney(result.liquidationNetRecovery) : "待补齐回收输入"}`,
      `采购成本：${result.liquidationConfigured ? `−$${money(result.liquidationProductCost)}` : "待补齐 P&L 输入"}`,
      `头程成本：${result.liquidationConfigured ? `−$${money(result.liquidationFirstMileCost)}` : "待补齐 P&L 输入"}`,
      `当月仓储分摊：${result.liquidationConfigured ? `−$${money(result.liquidationCurrentMonthStorageFee)}` : "待补齐 P&L 输入"}`,
      `批清 P&L：${result.liquidationConfigured ? signedMoney(result.liquidationPnl) : "待补齐输入"}`,
      `未来持有成本：$${money(result.projectedHoldingCost)}`,
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
                <label className="field-label"><span>单件体积（cu ft）</span><input type="number" min="0" step="0.001" value={numberInputValue(input.unitVolumeCuFt)} onChange={(event) => update("unitVolumeCuFt", numeric(event.target.value))} /></label>
                <label className="field-label"><span>平均日销</span><input type="number" min="0" step="0.01" value={numberInputValue(input.averageDailySales)} onChange={(event) => update("averageDailySales", numeric(event.target.value))} /></label>
                <label className="field-label"><span>ASP / 平均售价（$/件）</span><input type="number" min="0" step="0.01" value={numberInputValue(input.averageSellingPrice)} onChange={(event) => update("averageSellingPrice", numeric(event.target.value))} /></label>
                <label className="field-label"><span>采购成本（$/件）</span><input type="number" min="0" step="0.01" value={numberInputValue(input.unitCost)} onChange={(event) => update("unitCost", numeric(event.target.value))} /></label>
                <label className="field-label"><span>头程成本（$/件，可填 0）</span><input type="number" min="0" step="0.01" value={numberInputValue(input.firstMileCostPerUnit)} onChange={(event) => update("firstMileCostPerUnit", event.target.value === "" ? null : numeric(event.target.value))} /></label>
                <label className="field-label"><span>入仓日期</span><input type="date" value={input.inboundDate} onChange={(event) => update("inboundDate", event.target.value)} /></label>
                <label className="field-label"><span>当前日期</span><input type="date" value={input.currentDate} onChange={(event) => update("currentDate", event.target.value)} /></label>
              </div>
            </div>

            <div className="inventory-form-section">
              <div className="section-label"><Scale size={15} /> Amazon 费用参数</div>
              <div className="tier-segment" aria-label="尺寸等级">
                <button className={input.sizeTier === "standard" ? "active" : ""} type="button" onClick={() => update("sizeTier", "standard" as InventorySizeTier)}>Standard-size</button>
                <button className={input.sizeTier === "oversize" ? "active" : ""} type="button" onClick={() => update("sizeTier", "oversize" as InventorySizeTier)}>Oversize</button>
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

              <div className="custom-rate-row">
                <label className="inventory-check-row compact">
                  <input type="checkbox" checked={input.customStorageRate !== null} onChange={(event) => update("customStorageRate", event.target.checked ? result.storageRates.baseRate : null)} />
                  <span><b>手动月仓储费率</b><small>关闭时按月份自动匹配</small></span>
                </label>
                {input.customStorageRate !== null && <label className="rate-input"><span>$ / cu ft</span><input type="number" min="0" step="0.01" value={numberInputValue(input.customStorageRate)} onChange={(event) => update("customStorageRate", numeric(event.target.value))} /></label>}
              </div>
              <div className="custom-rate-row">
                <label className="inventory-check-row compact">
                  <input type="checkbox" checked={input.customAgedRate !== null} onChange={(event) => update("customAgedRate", event.target.checked ? result.agedRates.volumeRate : null)} />
                  <span><b>手动老化库存费率</b><small>用于账单复核或新费率覆盖</small></span>
                </label>
                {input.customAgedRate !== null && <label className="rate-input"><span>$ / cu ft</span><input type="number" min="0" step="0.01" value={numberInputValue(input.customAgedRate)} onChange={(event) => update("customAgedRate", numeric(event.target.value))} /></label>}
              </div>
            </div>

            <div className="inventory-form-section">
              <div className="section-label"><PackageMinus size={15} /> 退出方案参数</div>
              <div className="inventory-form-grid">
                <label className="field-label"><span>Amazon Shipping Weight（lb）</span><input type="number" min="0" step="0.01" value={numberInputValue(input.unitWeightLb)} onChange={(event) => update("unitWeightLb", numeric(event.target.value))} /></label>
                <label className="field-label"><span>移除数量</span><input type="number" min="0" step="1" value={numberInputValue(input.removalQuantity)} onChange={(event) => update("removalQuantity", integer(event.target.value))} /></label>
                <label className="field-label"><span>清货数量</span><input type="number" min="0" step="1" value={numberInputValue(input.liquidationQuantity)} onChange={(event) => update("liquidationQuantity", integer(event.target.value))} /></label>
                <label className="field-label"><span>预计回收率（按 ASP）</span><div className="percent-input"><input type="number" min="0" max="15" step="0.1" value={numberInputValue(input.recoveryRate * 100)} onChange={(event) => update("recoveryRate", Math.min(0.15, numeric(event.target.value) / 100))} /><b>%</b></div></label>
              </div>
              <small className="inventory-field-hint">Shipping Weight 请优先采用 Seller Central 计费重；仅填产品实重可能低估 Processing fee。</small>
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
                <div className="inventory-cost-total"><sup>$</sup>{money(result.projectedHoldingCost)}</div>
                <p>按当前日销推演 {result.forecast.length} 个月，库存售罄后停止计费</p>
                <div className="fee-meta">
                  <span>库龄 {result.inventoryAgeDays} 天</span>
                  <span>可售 {daysOfSupply(result.daysOfSupply)}</span>
                  <span>{result.storageRates.season === "peak" ? "10–12 月旺季" : "1–9 月非旺季"}</span>
                </div>
              </div>
              <div className="decision-hero-block">
                <small>系统建议</small>
                <strong>{DECISION_LABELS[result.decision]}</strong>
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
              <div><span>当前老化库存费</span><strong className={result.agedInventoryFee > 0 ? "warning-text" : "success-text"}>${money(result.agedInventoryFee)}</strong></div>
              <div><span>当前库存货值</span><strong>${money(result.remainingInventoryValue)}</strong></div>
            </div>

            <article className="inventory-section">
              <div className="inventory-section-heading">
                <div><span>01</span><div><h2>月仓储费推算</h2><p>当前库存 × 单件体积 × 月费率</p></div></div>
                <a href={OFFICIAL_STORAGE_RULE} target="_blank" rel="noreferrer">查看规则 <ExternalLink size={12} /></a>
              </div>
              <div className="inventory-metric-strip four">
                <div><small>当前库存</small><strong>{input.currentInventory} 件</strong></div>
                <div><small>单件体积</small><strong>{number(input.unitVolumeCuFt, 3)} cu ft</strong></div>
                <div><small>基础费率</small><strong>${money(result.storageRates.baseRate)} / cu ft</strong></div>
                <div><small>库容附加费率</small><strong>${money(result.storageRates.utilizationRate)} / cu ft</strong></div>
              </div>
              <div className="inventory-invoice">
                <div><span>库存总体积</span><b>{input.currentInventory} × {number(input.unitVolumeCuFt, 3)} = {number(result.totalVolume)} cu ft</b></div>
                <div><span>基础月仓储费</span><b>${money(result.monthlyBaseStorageFee)}</b></div>
                <div><span>Storage Utilization Surcharge</span><b>${money(result.monthlyUtilizationSurcharge)}</b></div>
                <div className="total"><span>预计当月仓储费</span><b>${money(result.monthlyStorageFee)}</b></div>
              </div>
            </article>

            <article className="inventory-section">
              <div className="inventory-section-heading">
                <div><span>02</span><div><h2>长期仓储费 / 老化库存</h2><p>按当前库龄匹配费率，体积费与最低每件费取较高值</p></div></div>
                <a href={OFFICIAL_2026_RULE} target="_blank" rel="noreferrer">2026 费率 <ExternalLink size={12} /></a>
              </div>
              <div className="aged-status-row">
                <div><Clock3 size={20} /><span><small>当前库龄</small><strong>{result.inventoryAgeDays} 天</strong></span></div>
                <div><CalendarDays size={20} /><span><small>计费档位</small><strong>{result.agedRates.ageBand}</strong></span></div>
                <div><Warehouse size={20} /><span><small>老化库存数量</small><strong>{result.agedInventoryQuantity} 件</strong></span></div>
              </div>
              <div className="aged-comparison">
                <div><small>体积口径</small><strong>${money(result.agedVolumeFee)}</strong><span>{result.agedInventoryQuantity} × {number(input.unitVolumeCuFt, 3)} × ${money(result.agedRates.volumeRate)}</span></div>
                <b>取较高值</b>
                <div><small>最低每件口径</small><strong>${money(result.agedMinimumFee)}</strong><span>{result.agedInventoryQuantity} × ${money(result.agedRates.minimumPerUnit)}</span></div>
                <div className="aged-selected"><small>预计老化库存费</small><strong>${money(result.agedInventoryFee)}</strong></div>
              </div>
              {input.customAgedRate === null && result.inventoryAgeDays >= 181 && result.inventoryAgeDays <= 365 && <p className="inventory-rule-note"><Info size={14} /> 181–365 天档位已内置；费率变化时可在左侧启用“手动老化库存费率”覆盖。</p>}
            </article>

            <div className="exit-plan-grid">
              <article className="exit-plan removal-plan">
                <div className="exit-plan-title"><PackageMinus size={20} /><div><h2>库存移除方案</h2><p>按尺寸等级与单件重量匹配 2026 移除费</p></div></div>
                <div className="exit-plan-amount"><span>预计总移除费用</span><strong>${money(result.removalTotalFee)}</strong></div>
                <dl>
                  <div><dt>计算数量</dt><dd>{Math.min(input.currentInventory, input.removalQuantity)} 件</dd></div>
                  <div><dt>Shipping Weight</dt><dd>{number(input.unitWeightLb)} lb</dd></div>
                  <div><dt>单件移除费</dt><dd>${money(result.removalFeePerUnit)}</dd></div>
                  <div><dt>移除后货权</dt><dd>货物可退回或处置</dd></div>
                </dl>
                <a href={OFFICIAL_REMOVAL_RULE} target="_blank" rel="noreferrer">Amazon removal fee <ExternalLink size={12} /></a>
              </article>

              <article className={`exit-plan liquidation-plan ${result.liquidationConfigured ? "is-ready" : "is-pending"}`}>
                <div className="exit-plan-title"><TrendingDown size={20} /><div><h2>批量清货方案</h2><p>ASP 回收 → Amazon 费用 → 全成本 P&amp;L</p></div></div>
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
                  <div><dt>Processing fee</dt><dd>{result.liquidationRecoveryReady ? `−$${money(result.liquidationProcessingFee)}` : "—"} <small>{input.unitWeightLb > 0 ? `($${money(result.liquidationProcessingFeePerUnit)}/件)` : ""}</small></dd></div>
                  <div><dt>Amazon 费用合计</dt><dd>{result.liquidationRecoveryReady ? `−$${money(result.liquidationAmazonFees)}` : "—"}</dd></div>
                  <div className="net"><dt>预计净回收</dt><dd>{result.liquidationRecoveryReady ? signedMoney(result.liquidationNetRecovery) : "—"}</dd></div>
                  <div><dt>采购成本</dt><dd>{result.liquidationConfigured ? `−$${money(result.liquidationProductCost)}` : "—"}</dd></div>
                  <div><dt>头程成本</dt><dd>{result.liquidationConfigured ? `−$${money(result.liquidationFirstMileCost)}` : "—"}</dd></div>
                  <div><dt>当月仓储分摊</dt><dd>{result.liquidationConfigured ? `−$${money(result.liquidationCurrentMonthStorageFee)}` : "—"}</dd></div>
                  <div className="net"><dt>批清 P&amp;L 合计</dt><dd>{result.liquidationConfigured ? signedMoney(result.liquidationPnl) : "—"}</dd></div>
                </dl>
                <p>{result.liquidationConfigured ? "P&L 已扣采购成本、头程与本月仓储；不含未来仓储和老化库存费。" : liquidationStatusText} 实际报价以 Amazon 及清算商结果为准。</p>
                <a href={OFFICIAL_LIQUIDATION_RULE} target="_blank" rel="noreferrer">Amazon FBA Liquidations <ExternalLink size={12} /></a>
              </article>
            </div>

            <article className="inventory-section cost-summary-section">
              <div className="inventory-section-heading">
                <div><span>03</span><div><h2>库存处理方案对比</h2><p>当前费用快照与互斥退出方案</p></div></div>
              </div>
              <div className="cost-summary-table">
                <div><span>月仓储费</span><b>${money(result.monthlyStorageFee)}</b></div>
                <div><span>老化库存费用</span><b>${money(result.agedInventoryFee)}</b></div>
                <div><span>库存移除费用</span><b>${money(result.removalTotalFee)}</b></div>
                <div><span>批量清货损益</span><b>{result.liquidationConfigured ? signedMoney(result.liquidationPnl) : "—"}</b></div>
              </div>
              <p className="inventory-rule-note neutral"><Info size={14} /> 移除与清货是互斥方案，不能相加。批清 P&amp;L 已包含所选数量的本月仓储分摊；决策应分别比较未来持有成本、移除费和清货损失。</p>
            </article>

            <article className="inventory-section forecast-section">
              <div className="inventory-section-heading">
                <div><span>04</span><div><h2>未来月度成本推演</h2><p>按日销递减库存，并自动跨越旺季和库龄费率节点</p></div></div>
                <strong>合计 ${money(result.projectedHoldingCost)}</strong>
              </div>
              <div className="forecast-table-wrap">
                <table className="forecast-table">
                  <thead><tr><th>月份</th><th>月初库存</th><th>月末库存</th><th>预计库龄</th><th>仓储费</th><th>老化费</th><th>月度合计</th><th>成本趋势</th></tr></thead>
                  <tbody>
                    {result.forecast.map((row) => <tr key={row.month}>
                      <td><b>{row.month}</b></td>
                      <td>{number(row.openingInventory)} 件</td>
                      <td>{number(row.closingInventory)} 件</td>
                      <td>{row.ageDays} 天</td>
                      <td>${money(row.storageFee)}</td>
                      <td>${money(row.agedFee)}</td>
                      <td><b>${money(row.totalFee)}</b></td>
                      <td><div className="forecast-bar"><i style={{ width: `${Math.max(2, (row.totalFee / maxForecastFee) * 100)}%` }} /></div></td>
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
                <div><small>未来持有成本</small><b>${money(result.projectedHoldingCost)}</b></div>
                <div><small>移除费用</small><b>${money(result.removalTotalFee)}</b></div>
                <div><small>清货损益</small><b>{result.liquidationConfigured ? signedMoney(result.liquidationPnl) : "—"}</b></div>
              </div>
            </article>

            <div className="warning-list inventory-warnings">
              {result.warnings.map((warning) => <p key={warning}><AlertTriangle size={14} />{warning}</p>)}
            </div>

            <footer className="source-footer inventory-source-footer">
              <span>规则来源 · Amazon US 2026</span>
              <a href={OFFICIAL_STORAGE_RULE} target="_blank" rel="noreferrer">Monthly storage fees <ExternalLink size={12} /></a>
              <a href={OFFICIAL_2026_RULE} target="_blank" rel="noreferrer">Aged inventory surcharge <ExternalLink size={12} /></a>
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
