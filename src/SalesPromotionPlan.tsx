import { useMemo, useState, type ReactNode } from "react";
import { BarChart3, CalendarRange, FileSpreadsheet, Info, Plus, RotateCcw, SlidersHorizontal, TableProperties, Trash2 } from "lucide-react";
import NumberInput from "./NumberInput";
import { DEFAULT_SALES_PLAN_ASSUMPTIONS, SALES_PLAN_STAGE_ACTIONS, addMonths, buildDefaultSalesPlanMonths, calculateSalesPlan, createSalesPlanMonth } from "./lib/salesPlan";
import { downloadSalesPlanWorkbook } from "./lib/salesPlanWorkbook";
import ToolSetupPanel, { RequiredBadge } from "./ToolSetupPanel";

type SalesPlanAssumptions = typeof DEFAULT_SALES_PLAN_ASSUMPTIONS;
type SalesPlanMonthInput = ReturnType<typeof buildDefaultSalesPlanMonths>[number];
type SalesPlanMonthResult = ReturnType<typeof calculateSalesPlan>["months"][number];

const STAGES = Object.keys(SALES_PLAN_STAGE_ACTIONS);
const ALL_STAGE_ACTIONS = new Set(Object.values(SALES_PLAN_STAGE_ACTIONS).flat());
const EMPTY_SALES_PLAN_ASSUMPTIONS: SalesPlanAssumptions = {
  productName: "",
  productId: "",
  currency: "USD",
  actualSellingPrice: 0,
  productCostPerUnit: 0,
  storageCostPerUnit: 0,
  fbaFeePerUnit: 0,
  firstMileCostPerUnit: 0,
  referralFeeRate: 0,
  returnRate: 0,
  averageReturnLoss: 0,
  otherVariableCostRate: 0,
};

function currentMonth(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function createBlankSalesPlanMonth(month: string, id: string): SalesPlanMonthInput {
  return {
    ...createSalesPlanMonth(month, 0),
    id,
    action: "",
    targetDailyUnits: 0,
    cpo: 0,
    cpc: 0,
    naturalOrderShare: 0,
    otherVariableCostRateOverride: null,
  };
}

function buildBlankSalesPlanMonths(startMonth: string): SalesPlanMonthInput[] {
  return [createBlankSalesPlanMonth(startMonth, `blank-${startMonth}`)];
}

function numberValue(raw: string): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function money(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) return "--";
  try {
    return new Intl.NumberFormat("zh-CN", { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(value);
  } catch {
    return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  }
}

function numeric(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function rate(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return (value * 100).toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits }) + "%";
}

function valueClass(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "";
  return value >= 0 ? "sales-plan-positive" : "sales-plan-negative";
}

function statusTone(severity: SalesPlanMonthResult["statusSeverity"]): string {
  if (severity === "ok") return "sales-plan-status-ok";
  if (severity === "error") return "sales-plan-status-danger";
  return "sales-plan-status-warning";
}

interface TrendSeries { label: string; color: string; values: Array<number | null>; }

function TrendChart({ title, subtitle, labels, series, currency }: { title: string; subtitle: string; labels: string[]; series: TrendSeries[]; currency?: string }) {
  const width = Math.max(760, labels.length * 68);
  const height = 230;
  const padding = { top: 24, right: 20, bottom: 36, left: 66 };
  const finiteValues = series.flatMap((item) => item.values).filter((value): value is number => value !== null && Number.isFinite(value));
  const domainValues = finiteValues.concat(0);
  const min = Math.min(...domainValues);
  const max = Math.max(...domainValues);
  const span = max - min || 1;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const x = (index: number) => padding.left + (labels.length <= 1 ? 0 : index * plotWidth / (labels.length - 1));
  const y = (value: number) => padding.top + (max - value) * plotHeight / span;
  const ticks = Array.from({ length: 5 }, (_, index) => max - index * span / 4);
  const tickLabel = (value: number) => currency ? money(value, currency) : numeric(value);
  return <section className="profit-panel sales-plan-chart-card">
    <div className="sales-plan-chart-heading"><div><BarChart3 size={18} /><span><h3>{title}</h3><p>{subtitle}</p></span></div><div className="sales-plan-chart-legend">{series.map((item) => <span key={item.label}><i style={{ background: item.color }} />{item.label}</span>)}</div></div>
    <div className="sales-plan-chart-scroll"><svg className="sales-plan-chart" style={{ minWidth: `${width}px` }} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
      {ticks.map((tick, index) => <g key={index}><line className="sales-plan-chart-grid-line" x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} /><text className="sales-plan-chart-axis-text" x={padding.left - 9} y={y(tick) + 4} textAnchor="end">{tickLabel(tick)}</text></g>)}
      <line className="sales-plan-chart-zero-line" x1={padding.left} x2={width - padding.right} y1={y(0)} y2={y(0)} />
      {series.map((item) => {
        const segments: string[][] = [];
        let currentSegment: string[] = [];
        item.values.forEach((value, index) => {
          if (value === null || !Number.isFinite(value)) { if (currentSegment.length > 0) segments.push(currentSegment); currentSegment = []; return; }
          currentSegment.push(`${x(index)},${y(value)}`);
        });
        if (currentSegment.length > 0) segments.push(currentSegment);
        return <g key={item.label}>{segments.map((points, index) => <polyline key={index} points={points.join(" ")} fill="none" stroke={item.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />)}{item.values.map((value, index) => value === null || !Number.isFinite(value) ? null : <circle key={index} cx={x(index)} cy={y(value)} r="3.8" fill="#fff" stroke={item.color} strokeWidth="2.4" />)}</g>;
      })}
      {labels.map((label, index) => <text className="sales-plan-chart-axis-text" key={label + index} x={x(index)} y={height - 11} textAnchor="middle">{label || `M${index + 1}`}</text>)}
    </svg></div>
  </section>;
}

function Kpi({ label, value, note, tone = "" }: { label: string; value: ReactNode; note?: string; tone?: string }) {
  return <div><span>{label}</span><strong className={tone}>{value}</strong>{note && <small>{note}</small>}</div>;
}

function SalesPromotionPlan() {
  const defaultStartMonth = useMemo(currentMonth, []);
  const [assumptions, setAssumptions] = useState<SalesPlanAssumptions>(() => ({ ...EMPTY_SALES_PLAN_ASSUMPTIONS }));
  const [months, setMonths] = useState<SalesPlanMonthInput[]>(() => buildBlankSalesPlanMonths(defaultStartMonth));
  const [showCostDetails, setShowCostDetails] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const result = useMemo(() => calculateSalesPlan(assumptions, months), [assumptions, months]);
  const { summary } = result;
  const currency = assumptions.currency || "USD";
  const annualProfitMargin = summary.operatingProfit !== null && summary.totalRevenue !== null && summary.totalRevenue > 0 ? summary.operatingProfit / summary.totalRevenue : null;
  const incompleteProfitMonths = result.months.filter((month) => month.monthlyProfit === null).length;
  const amazonCommissionPerUnit = assumptions.actualSellingPrice * assumptions.referralFeeRate;
  const expectedReturnLossPerUnit = assumptions.returnRate * assumptions.averageReturnLoss;
  const otherVariableCostPerUnit = assumptions.actualSellingPrice * assumptions.otherVariableCostRate;

  const setAssumption = <K extends keyof SalesPlanAssumptions>(key: K, value: SalesPlanAssumptions[K]) => setAssumptions((current) => ({ ...current, [key]: value }));
  const setNumericAssumption = (key: keyof SalesPlanAssumptions, raw: string, percentage = false) => {
    const normalized = numberValue(raw) / (percentage ? 100 : 1);
    setAssumptions((current) => ({ ...current, [key]: percentage ? Math.min(1, normalized) : normalized } as SalesPlanAssumptions));
  };
  const updateMonth = (id: string, patch: Partial<SalesPlanMonthInput>) => setMonths((current) => current.map((month) => month.id === id ? { ...month, ...patch } : month));
  const setMonthNumber = (month: SalesPlanMonthInput, key: keyof SalesPlanMonthInput, raw: string, percentage = false) => {
    const normalized = numberValue(raw) / (percentage ? 100 : 1);
    updateMonth(month.id, { [key]: percentage ? Math.min(1, normalized) : normalized } as Partial<SalesPlanMonthInput>);
  };
  const setMonthlyVariableRate = (month: SalesPlanMonthInput, raw: string) => updateMonth(month.id, { otherVariableCostRateOverride: raw === "" ? null : Math.min(1, numberValue(raw) / 100) });
  const setStage = (month: SalesPlanMonthInput, stage: string) => {
    const shouldReplace = !month.action.trim() || ALL_STAGE_ACTIONS.has(month.action);
    updateMonth(month.id, { stage, action: shouldReplace ? SALES_PLAN_STAGE_ACTIONS[stage]?.[0] ?? "" : month.action });
  };
  const addMonth = () => {
    const latestMonth = months.map((month) => month.month).filter((month) => /^\d{4}-\d{2}$/.test(month)).sort().at(-1);
    const nextMonth = latestMonth ? addMonths(latestMonth, 1) : currentMonth();
    setMonths((current) => [...current, createBlankSalesPlanMonth(nextMonth, `month-${Date.now()}`)]);
  };
  const removeMonth = (id: string) => { if (months.length > 1) setMonths((current) => current.filter((month) => month.id !== id)); };
  const loadDemo = () => {
    setAssumptions({ ...DEFAULT_SALES_PLAN_ASSUMPTIONS });
    setMonths(buildDefaultSalesPlanMonths(defaultStartMonth, 12));
    setShowCostDetails(false);
    setIsDemo(true);
  };
  const resetPlan = () => {
    if (!window.confirm("确定恢复默认空白吗？当前填写的销售推广计划将被清空。")) return;
    setAssumptions({ ...EMPTY_SALES_PLAN_ASSUMPTIONS });
    setMonths(buildBlankSalesPlanMonths(defaultStartMonth));
    setShowCostDetails(false);
    setIsDemo(false);
  };

  const exportWorkbook = () => {
    const exportAssumptions = isDemo ? {
      ...assumptions,
      productName: `【演示数据，不可用于决策】${assumptions.productName || "销售推广计划"}`,
      productId: `DEMO-${assumptions.productId || "SAMPLE"}`,
    } : assumptions;
    void downloadSalesPlanWorkbook(exportAssumptions, months);
  };

  const assumptionNumberField = (label: string, key: keyof SalesPlanAssumptions, options: { percentage?: boolean; prefix?: string; suffix?: string; badge?: string } = {}) => {
    const stored = Number(assumptions[key] ?? 0);
    return <label className="sales-plan-field"><span>{label}{options.badge && <RequiredBadge label={options.badge} />}</span><div className="sales-plan-input-wrap">{options.prefix && <b>{options.prefix}</b>}<NumberInput min="0" max={options.percentage ? "100" : undefined} step={options.percentage ? "0.1" : "0.01"} value={options.percentage ? stored * 100 : stored} onRawChange={(raw) => setNumericAssumption(key, raw, options.percentage)} />{options.suffix && <em>{options.suffix}</em>}</div></label>;
  };
  const calculatedField = (label: string, value: string, note?: string, tone = "") => <div className="sales-plan-field sales-plan-calculated-field"><span>{label}</span><strong className={tone}>{value}</strong>{note && <small>{note}</small>}</div>;
  const tableNumberCell = (label: string, month: SalesPlanMonthInput, key: keyof SalesPlanMonthInput, options: { percentage?: boolean; money?: boolean; step?: string } = {}) => {
    const stored = Number(month[key] ?? 0);
    return <td data-label={label} className="sales-plan-editable-cell"><div className={options.money ? "sales-plan-table-money" : ""}>{options.money && <b>{currency}</b>}<NumberInput aria-label={`${month.month || "未选月份"} ${label}`} min="0" max={options.percentage ? "100" : undefined} step={options.step || (options.percentage ? "0.1" : "0.01")} value={options.percentage ? stored * 100 : stored} onRawChange={(raw) => setMonthNumber(month, key, raw, options.percentage)} />{options.percentage && <em>%</em>}</div></td>;
  };

  const chartLabels = result.months.map((item, index) => item.month || `M${index + 1}`);
  const incompleteNote = incompleteProfitMonths > 0 ? `${incompleteProfitMonths}个月输入不完整` : `${months.length}个月利润已完整计算`;
  return <div className="sales-plan-root">
    <ToolSetupPanel
      requirements={[
        { label: "实际成交价", met: assumptions.actualSellingPrice > 0 },
        { label: "采购成本/件", met: assumptions.productCostPerUnit > 0 },
        { label: "FBA 配送费/件", met: assumptions.fbaFeePerUnit > 0 },
        { label: "Referral Fee 率", met: assumptions.referralFeeRate > 0 },
        { label: "月份有效且至少一个月有日销目标", met: months.length > 0 && months.every((month) => /^\d{4}-\d{2}$/.test(month.month)) && months.some((month) => month.targetDailyUnits > 0) },
        { label: "广告月份的 CPO 与 CPC", met: months.length > 0 && months.every((month) => month.naturalOrderShare >= 1 || (month.cpo > 0 && month.cpc > 0)) },
      ]}
      isDemo={isDemo}
      onLoadDemo={loadDemo}
      onReset={resetPlan}
      demoMessage="当前为销售推广计划演示样板，请按真实售价、成本和每月推广目标逐项替换。"
    />

    <section className="sales-plan-hero"><div className="sales-plan-hero-title"><span>SALES PROMOTION PLAN</span><h2>销售、广告与利润推进节奏</h2><p>每月只录入日销、CPO、CPC、自然单占比和可选费用率，自动推导广告指标、成本总额与月利润。</p></div><div className="sales-plan-hero-primary"><small>计划周期经营利润 · 共{months.length}个月</small><strong className={valueClass(summary.operatingProfit)}>{money(summary.operatingProfit, currency)}</strong><span>{incompleteNote}</span></div><div className="sales-plan-hero-actions"><button type="button" onClick={exportWorkbook}><FileSpreadsheet size={16} />导出含公式 Excel</button><button type="button" onClick={resetPlan}><RotateCcw size={16} />恢复空白</button></div></section>

    <section className="sales-plan-kpis"><Kpi label="计划总销量" value={numeric(summary.totalUnits, 1)} note={`共 ${months.length} 个月`} /><Kpi label="销售额" value={money(summary.totalRevenue, currency)} note="实际成交价 × 月销量" /><Kpi label="广告花费" value={money(summary.totalAdSpend, currency)} note={`TACoS ${rate(summary.weightedTacos)} · ACoS ${rate(summary.weightedAcos)}`} /><Kpi label="经营利润" value={money(summary.operatingProfit, currency)} note={`利润率 ${rate(annualProfitMargin)} · 负利润 ${summary.negativeProfitMonths} 月`} tone={valueClass(summary.operatingProfit)} /><Kpi label="累计利润" value={money(summary.endingCumulativeProfit, currency)} note={`最大资金缺口 ${money(summary.maximumFundingGap, currency)}`} tone={valueClass(summary.endingCumulativeProfit)} /><Kpi label="Break-even CPO/CPA" value={money(summary.breakEvenCpo, currency)} note="单件 · 淡季仓储基准" tone={valueClass(summary.breakEvenCpo)} /></section>

    <section className="profit-panel sales-plan-assumptions"><div className="sales-plan-panel-heading"><div><SlidersHorizontal size={19} /><span><h3>固定参数</h3><p>黄色区域为手动输入；灰色区域由单件成本公式自动计算。</p></span></div><div className="sales-plan-legend"><span className="sales-plan-legend-input">手动输入</span><span className="sales-plan-legend-calculated">自动计算</span></div></div><div className="sales-plan-assumption-groups">
      <fieldset><legend>产品信息</legend><div className="sales-plan-field-grid"><label className="sales-plan-field"><span>产品名称</span><input value={assumptions.productName} onChange={(event) => setAssumption("productName", event.target.value as SalesPlanAssumptions["productName"])} /></label><label className="sales-plan-field"><span>ASIN / SKU</span><input value={assumptions.productId} onChange={(event) => setAssumption("productId", event.target.value as SalesPlanAssumptions["productId"])} /></label><label className="sales-plan-field"><span>币种</span><select value={assumptions.currency} onChange={(event) => setAssumption("currency", event.target.value as SalesPlanAssumptions["currency"])}><option value="USD">USD</option><option value="CAD">CAD</option><option value="GBP">GBP</option><option value="EUR">EUR</option><option value="JPY">JPY</option></select></label></div></fieldset>
      <fieldset><legend>单件成本预算</legend><div className="sales-plan-field-grid">{assumptionNumberField("实际成交价", "actualSellingPrice", { prefix: currency, badge: "核心必填" })}{assumptionNumberField("采购成本/件", "productCostPerUnit", { prefix: currency, badge: "核心必填" })}{assumptionNumberField("仓储费/件", "storageCostPerUnit", { prefix: currency })}{assumptionNumberField("FBA配送费/件", "fbaFeePerUnit", { prefix: currency, badge: "核心必填" })}{assumptionNumberField("头程成本/件", "firstMileCostPerUnit", { prefix: currency, badge: "建议填写，可为 0" })}{assumptionNumberField("Referral Fee率", "referralFeeRate", { percentage: true, suffix: "%", badge: "核心必填" })}{calculatedField("Amazon佣金/件", money(amazonCommissionPerUnit, currency), "实际成交价 × 佣金率")}{calculatedField("单件Break-even CPO/CPA", money(summary.breakEvenCpo, currency), "淡季仓储基准", valueClass(summary.breakEvenCpo))}</div><p className="sales-plan-assumption-note"><Info size={15} />Break-even CPO/CPA＝实际成交价－采购－头程－FBA－Amazon佣金－仓储－预计退货损失－其他单件变动成本</p></fieldset>
      <fieldset><legend>退货与其他费用</legend><div className="sales-plan-field-grid">{assumptionNumberField("预计退货率", "returnRate", { percentage: true, suffix: "%" })}{assumptionNumberField("每退货件平均净损失", "averageReturnLoss", { prefix: currency })}{assumptionNumberField("其他单件变动成本", "otherVariableCostRate", { percentage: true, suffix: "%" })}{calculatedField("预计退货损失/件", money(expectedReturnLossPerUnit, currency), "退货率 × 平均净损失")}{calculatedField("其他变动成本/件", money(otherVariableCostPerUnit, currency), "实际成交价 × 费率")}</div><p className="sales-plan-assumption-note"><Info size={15} />Coupon、秒杀、VINE与站外推广费用及其他合计默认3.7%</p></fieldset>
    </div></section>

    <div className="sales-plan-chart-grid"><TrendChart title="销售额与月利润" subtitle="实际成交价作为统一销售口径，退款损失与推广费用单独进入利润。" labels={chartLabels} currency={currency} series={[{ label: "销售额", color: "#4472c4", values: result.months.map((item) => item.salesRevenue) }, { label: "月利润", color: "#70ad47", values: result.months.map((item) => item.monthlyProfit) }]} /><TrendChart title="自然单销量与广告单销量" subtitle="自然销量由自然单占比确定，剩余销量自动归入广告单。" labels={chartLabels} series={[{ label: "自然单销量", color: "#70ad47", values: result.months.map((item) => item.naturalUnits) }, { label: "广告单销量", color: "#ed7d31", values: result.months.map((item) => item.adUnits) }]} /></div>

    <section className="profit-panel sales-plan-table-panel"><div className="sales-plan-panel-heading sales-plan-table-heading"><div><TableProperties size={19} /><span><h3>销售推广计划表</h3><p>月份逐行选择；黄色列为输入，费用总额和广告指标全部自动计算。</p></span></div><div className="sales-plan-table-actions"><button type="button" onClick={addMonth}><Plus size={16} />增加月份</button><button className={showCostDetails ? "sales-plan-active" : ""} type="button" onClick={() => setShowCostDetails((current) => !current)}><CalendarRange size={16} />{showCostDetails ? "收起成本明细" : "展开成本明细"}</button></div></div>
      <div className="sales-plan-table-wrap"><table className="sales-plan-table sales-plan-table-v2"><thead><tr><th>月份 <RequiredBadge /></th><th>推广阶段</th><th>运营重点动作</th><th>日销目标 <RequiredBadge label="计划月份必填；暂停月可为 0" /></th><th>CPO/CPA <RequiredBadge label="有广告单时必填" /></th><th>当月Break-even<br />CPO/CPA</th><th>CPC <RequiredBadge label="有广告单时必填" /></th><th>Ad CVR</th><th>ACoS</th><th>TACoS</th><th>自然单占比 <RequiredBadge /></th><th>当月其他<br />变动成本率</th><th>月销量</th><th>自然单销量</th><th>广告单销量</th><th>广告花费</th><th>月度推广费用</th><th>月利润</th><th>利润率</th>{showCostDetails && <><th>采购成本<br />当月总额（测算）</th><th>FBA<br />当月总额（测算）</th><th>头程<br />当月总额（测算）</th><th>仓储费<br />当月总额（测算）</th><th>仓储季节系数</th><th>Amazon佣金<br />当月总额（测算）</th><th>预计退款损失<br />当月总额（测算）</th></>}<th>状态</th><th>操作</th></tr></thead>
        <tbody>{months.map((month, index) => {
          const monthResult: SalesPlanMonthResult = result.months[index];
          const actionListId = `stage-actions-${month.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
          const overrideRate = month.otherVariableCostRateOverride === null ? null : month.otherVariableCostRateOverride * 100;
          const rowLabel = month.month || `第${index + 1}行`;
          return <tr key={month.id}><td data-label="月份" className="sales-plan-editable-cell sales-plan-sticky-month"><input aria-label={`${rowLabel} 月份`} type="month" value={month.month} onChange={(event) => updateMonth(month.id, { month: event.target.value })} /></td><td data-label="推广阶段" className="sales-plan-editable-cell"><select aria-label={`${rowLabel} 推广阶段`} value={month.stage} onChange={(event) => setStage(month, event.target.value)}>{STAGES.map((stage) => <option value={stage} key={stage}>{stage}</option>)}</select></td><td data-label="运营重点动作" className="sales-plan-editable-cell sales-plan-action-cell"><input aria-label={`${rowLabel} 运营重点动作`} list={actionListId} value={month.action} onChange={(event) => updateMonth(month.id, { action: event.target.value })} /><datalist id={actionListId}>{(SALES_PLAN_STAGE_ACTIONS[month.stage] ?? []).map((action) => <option value={action} key={action} />)}</datalist></td>{tableNumberCell("日销目标", month, "targetDailyUnits", { step: "0.1" })}{tableNumberCell("CPO/CPA", month, "cpo", { money: true })}<td data-label="当月Break-even CPO/CPA" className={valueClass(monthResult.monthlyBreakEvenCpo)}>{money(monthResult.monthlyBreakEvenCpo, currency)}</td>{tableNumberCell("CPC", month, "cpc", { money: true })}<td data-label="Ad CVR">{rate(monthResult.adCvr)}</td><td data-label="ACoS">{rate(monthResult.acos)}</td><td data-label="TACoS">{rate(monthResult.tacos)}</td>{tableNumberCell("自然单占比", month, "naturalOrderShare", { percentage: true })}<td data-label="当月其他变动成本率" className="sales-plan-editable-cell sales-plan-optional-rate-cell"><div><NumberInput aria-label={`${rowLabel} 当月其他变动成本率`} min="0" max="100" step="0.1" value={overrideRate} placeholder={`默认 ${(assumptions.otherVariableCostRate * 100).toFixed(1)}`} onRawChange={(raw) => setMonthlyVariableRate(month, raw)} /><em>%</em></div></td><td data-label="月销量">{numeric(monthResult.monthlyUnits, 1)}</td><td data-label="自然单销量">{numeric(monthResult.naturalUnits, 1)}</td><td data-label="广告单销量">{numeric(monthResult.adUnits, 1)}</td><td data-label="广告花费">{money(monthResult.adSpend, currency)}</td><td data-label="月度推广费用">{money(monthResult.promotionCostTotal, currency)}</td><td data-label="月利润" className={valueClass(monthResult.monthlyProfit)}><b>{money(monthResult.monthlyProfit, currency)}</b></td><td data-label="利润率" className={valueClass(monthResult.profitMargin)}>{rate(monthResult.profitMargin)}</td>{showCostDetails && <><td data-label="采购成本当月总额（测算）">{money(monthResult.productCostTotal, currency)}</td><td data-label="FBA当月总额（测算）">{money(monthResult.fbaCostTotal, currency)}</td><td data-label="头程当月总额（测算）">{money(monthResult.firstMileCostTotal, currency)}</td><td data-label="仓储费当月总额（测算）">{money(monthResult.storageCostTotal, currency)}</td><td data-label="仓储季节系数"><span className={monthResult.storageMultiplier > 1 ? "sales-plan-season-peak" : ""}>{monthResult.storageMultiplier > 1 ? `旺季 ×${numeric(monthResult.storageMultiplier, 2)}` : "淡季 ×1"}</span></td><td data-label="Amazon佣金当月总额（测算）">{money(monthResult.referralFeeTotal, currency)}</td><td data-label="预计退款损失当月总额（测算）">{money(monthResult.expectedRefundLossTotal, currency)}</td></>}<td data-label="状态"><span title={monthResult.warnings.join("；") || "正常"} className={`sales-plan-status ${statusTone(monthResult.statusSeverity)}`}>{monthResult.status}</span></td><td data-label="操作" className="sales-plan-row-action-cell"><button type="button" aria-label={`删除${rowLabel}`} disabled={months.length <= 1} onClick={() => removeMonth(month.id)}><Trash2 size={15} /></button></td></tr>;
        })}</tbody></table></div>
      <div className="sales-plan-table-footnote"><Info size={15} /><span>CPO/CPA按每个广告成交件计算：广告花费＝广告单销量×CPO，Ad CVR＝CPC÷CPO。1—9月仓储按淡季单价，10—12月仓储费自动乘以3.08；所有成本总额均为规划测算值，不等同于Seller Central实付账单。</span></div>
    </section>
  </div>;
}

export default SalesPromotionPlan;
