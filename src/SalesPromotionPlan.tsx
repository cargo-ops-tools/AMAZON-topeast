import { useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  CalendarRange,
  FileSpreadsheet,
  Info,
  RotateCcw,
  SlidersHorizontal,
  TableProperties,
} from "lucide-react";
import NumberInput from "./NumberInput";
import {
  DEFAULT_SALES_PLAN_ASSUMPTIONS,
  buildDefaultSalesPlanMonths,
  calculateSalesPlan,
} from "./lib/salesPlan";

type SalesPlanAssumptions = typeof DEFAULT_SALES_PLAN_ASSUMPTIONS;
type SalesPlanMonthInput = ReturnType<typeof buildDefaultSalesPlanMonths>[number];
type SalesPlanMonthResult = ReturnType<typeof calculateSalesPlan>["months"][number];

const STAGES = ["测款期", "增长期", "盈利过渡期", "稳定期"];

function numberValue(raw: string): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function optionalNumberValue(raw: string): number | null {
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function money(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) return "--";
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return value.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
  }
}

function numeric(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function rate(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return (value * 100).toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }) + "%";
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

interface TrendSeries {
  label: string;
  color: string;
  values: Array<number | null>;
}

function TrendChart({
  title,
  subtitle,
  labels,
  series,
  currency,
}: {
  title: string;
  subtitle: string;
  labels: string[];
  series: TrendSeries[];
  currency?: string;
}) {
  const width = 760;
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

  return (
    <section className="profit-panel sales-plan-chart-card">
      <div className="sales-plan-chart-heading">
        <div><BarChart3 size={18} /><span><h3>{title}</h3><p>{subtitle}</p></span></div>
        <div className="sales-plan-chart-legend">{series.map((item) => <span key={item.label}><i style={{ background: item.color }} />{item.label}</span>)}</div>
      </div>
      <div className="sales-plan-chart-scroll">
        <svg className="sales-plan-chart" viewBox={"0 0 " + width + " " + height} role="img" aria-label={title}>
          {ticks.map((tick, index) => (
            <g key={index}>
              <line className="sales-plan-chart-grid-line" x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} />
              <text className="sales-plan-chart-axis-text" x={padding.left - 9} y={y(tick) + 4} textAnchor="end">{tickLabel(tick)}</text>
            </g>
          ))}
          <line className="sales-plan-chart-zero-line" x1={padding.left} x2={width - padding.right} y1={y(0)} y2={y(0)} />
          {series.map((item) => {
            const segments: string[][] = [];
            let currentSegment: string[] = [];
            item.values.forEach((value, index) => {
              if (value === null || !Number.isFinite(value)) {
                if (currentSegment.length > 0) segments.push(currentSegment);
                currentSegment = [];
                return;
              }
              currentSegment.push(x(index) + "," + y(value));
            });
            if (currentSegment.length > 0) segments.push(currentSegment);
            return (
              <g key={item.label}>
                {segments.map((points, index) => <polyline key={index} points={points.join(" ")} fill="none" stroke={item.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />)}
                {item.values.map((value, index) => value === null || !Number.isFinite(value) ? null : (
                  <circle key={index} cx={x(index)} cy={y(value)} r="3.8" fill="#fff" stroke={item.color} strokeWidth="2.4" />
                ))}
              </g>
            );
          })}
          {labels.map((label, index) => <text className="sales-plan-chart-axis-text" key={label + index} x={x(index)} y={height - 11} textAnchor="middle">{label}</text>)}
        </svg>
      </div>
    </section>
  );
}

function Kpi({
  label,
  value,
  note,
  tone = "",
}: {
  label: string;
  value: ReactNode;
  note?: string;
  tone?: string;
}) {
  return <div><span>{label}</span><strong className={tone}>{value}</strong>{note && <small>{note}</small>}</div>;
}

function SalesPromotionPlan() {
  const [assumptions, setAssumptions] = useState<SalesPlanAssumptions>(() => ({ ...DEFAULT_SALES_PLAN_ASSUMPTIONS }));
  const [months, setMonths] = useState<SalesPlanMonthInput[]>(() => buildDefaultSalesPlanMonths(DEFAULT_SALES_PLAN_ASSUMPTIONS.startMonth));
  const [showDetails, setShowDetails] = useState(false);
  const result = useMemo(() => calculateSalesPlan(assumptions, months), [assumptions, months]);
  const summary = result.summary;
  const currency = assumptions.currency || "USD";
  const annualProfitMargin = summary.operatingProfit !== null && summary.totalNetSales > 0
    ? summary.operatingProfit / summary.totalNetSales
    : null;
  const incompleteProfitMonths = result.months.filter((month) => month.monthlyProfit === null).length;

  const setAssumption = <K extends keyof SalesPlanAssumptions>(key: K, value: SalesPlanAssumptions[K]) => {
    setAssumptions((current) => ({ ...current, [key]: value }));
  };

  const setNumericAssumption = (key: keyof SalesPlanAssumptions, raw: string, percentage = false) => {
    const normalized = numberValue(raw) / (percentage ? 100 : 1);
    const next = percentage ? Math.min(1, normalized) : normalized;
    setAssumptions((current) => ({ ...current, [key]: next } as SalesPlanAssumptions));
  };

  const setStartMonth = (startMonth: string) => {
    setAssumption("startMonth", startMonth as SalesPlanAssumptions["startMonth"]);
    if (!/^\d{4}-\d{2}$/.test(startMonth)) return;
    setMonths((current) => buildDefaultSalesPlanMonths(startMonth).map((fresh, index) => ({
      ...current[index],
      id: fresh.id,
      month: fresh.month,
    })));
  };

  const updateMonth = (id: string, patch: Partial<SalesPlanMonthInput>) => {
    setMonths((current) => current.map((month) => month.id === id ? { ...month, ...patch } : month));
  };

  const setMonthNumber = (
    month: SalesPlanMonthInput,
    key: keyof SalesPlanMonthInput,
    raw: string,
    percentage = false,
  ) => {
    const normalized = numberValue(raw) / (percentage ? 100 : 1);
    const next = percentage ? Math.min(1, normalized) : normalized;
    updateMonth(month.id, { [key]: next } as Partial<SalesPlanMonthInput>);
  };

  const setOptionalMonthNumber = (
    month: SalesPlanMonthInput,
    key: "actualRefundLoss" | "actualFbaFee" | "actualFirstMileCost",
    raw: string,
  ) => updateMonth(month.id, { [key]: optionalNumberValue(raw) } as Partial<SalesPlanMonthInput>);

  const resetPlan = () => {
    if (!window.confirm("确定重置销售推广计划吗？当前填写的12个月数据将恢复为默认值。")) return;
    setAssumptions({ ...DEFAULT_SALES_PLAN_ASSUMPTIONS });
    setMonths(buildDefaultSalesPlanMonths(DEFAULT_SALES_PLAN_ASSUMPTIONS.startMonth));
    setShowDetails(false);
  };

  const exportWorkbook = async () => {
    const XLSX = await import("xlsx");
    const assumptionRows = [
      ["固定参数", "值"],
      ["产品名称", assumptions.productName],
      ["ASIN / SKU", assumptions.productId],
      ["开始月份", assumptions.startMonth],
      ["币种", assumptions.currency],
      ["期初库存", assumptions.initialInventory],
      ["UPT", assumptions.unitsPerOrder],
      ["产品成本/件", assumptions.productCostPerUnit],
      ["包装成本/件", assumptions.packagingCostPerUnit],
      ["预算FBA费/件", assumptions.budgetFbaPerUnit],
      ["预算头程费/件", assumptions.budgetFirstMilePerUnit],
      ["Referral Fee率", assumptions.referralFeeRate],
      ["预期退货率", assumptions.returnRate],
      ["每退货件平均净损失", assumptions.averageReturnLoss],
      ["其他净费用池默认率", assumptions.otherNetExpensePoolRate],
      ["月固定经营成本", assumptions.monthlyFixedOperatingCost],
      ["首期一次性投入", assumptions.initialInvestment],
    ];
    const headers = [
      "月份", "数据类型", "推广阶段", "运营动作", "日销目标", "自然日单", "售价", "促销折扣率", "促销订单占比",
      "CPO", "CPC", "入库量", "仓储费", "Coupon费用率", "秒杀费用率", "VINE费用率", "实际退款损失（当月总额）",
      "实际FBA（当月总额）", "实际头程（当月总额）", "可售销量", "自然单", "广告单", "广告花费", "广告点击", "Ad CVR", "标价销售额", "净销售额",
      "ACoS", "TACoS", "FBA费用", "头程费用", "退款损失", "其他净费用率合计", "月利润", "利润率", "累计利润", "状态",
    ];
    const rows = result.months.map((monthResult) => {
      return [
        monthResult.month, monthResult.periodType, monthResult.stage, monthResult.action, monthResult.targetDailyUnits, monthResult.naturalDailyOrders,
        monthResult.unitPrice, monthResult.promotionDiscountRate, monthResult.promotionOrderShare, monthResult.cpo, monthResult.cpc, monthResult.receipts,
        monthResult.storageCost, monthResult.couponExpenseRate, monthResult.dealExpenseRate, monthResult.vineExpenseRate,
        monthResult.periodType === "actual" ? monthResult.actualRefundLoss : null,
        monthResult.periodType === "actual" ? monthResult.actualFbaFee : null,
        monthResult.periodType === "actual" ? monthResult.actualFirstMileCost : null,
        monthResult.actualUnits, monthResult.naturalOrders, monthResult.adOrders,
        monthResult.adSpend, monthResult.adClicks, monthResult.adCvr, monthResult.grossSales, monthResult.netSalesBeforeRefund, monthResult.acos, monthResult.tacos,
        monthResult.fbaCost, monthResult.firstMileCost, monthResult.refundLoss, monthResult.totalOtherNetExpenseRate,
        monthResult.monthlyProfit, monthResult.profitMargin, monthResult.cumulativeProfit, monthResult.warnings.join("；") || "正常",
      ];
    });
    const workbook = XLSX.utils.book_new();
    const assumptionsSheet = XLSX.utils.aoa_to_sheet(assumptionRows);
    const planSheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    planSheet["!cols"] = headers.map((header) => ({ wch: Math.max(11, Math.min(24, header.length + 4)) }));
    XLSX.utils.book_append_sheet(workbook, planSheet, "12个月计划");
    XLSX.utils.book_append_sheet(workbook, assumptionsSheet, "固定参数");
    const safeName = (assumptions.productId || assumptions.productName || "销售推广计划").replace(/[\\/:*?"<>|]/g, "_");
    XLSX.writeFile(workbook, safeName + "_12个月销售推广计划.xlsx");
  };

  const assumptionNumberField = (
    label: string,
    key: keyof SalesPlanAssumptions,
    options: { percentage?: boolean; prefix?: string; suffix?: string } = {},
  ) => {
    const stored = Number(assumptions[key] ?? 0);
    const value = options.percentage ? stored * 100 : stored;
    return (
      <label className="sales-plan-field">
        <span>{label}</span>
        <div className="sales-plan-input-wrap">
          {options.prefix && <b>{options.prefix}</b>}
          <NumberInput min="0" max={options.percentage ? "100" : undefined} step={options.percentage ? "0.1" : "0.01"} value={value} onRawChange={(raw) => setNumericAssumption(key, raw, options.percentage)} />
          {options.suffix && <em>{options.suffix}</em>}
        </div>
      </label>
    );
  };

  const tableNumberCell = (
    label: string,
    month: SalesPlanMonthInput,
    key: keyof SalesPlanMonthInput,
    options: { percentage?: boolean; money?: boolean; step?: string } = {},
  ) => {
    const stored = Number(month[key] ?? 0);
    return (
      <td data-label={label} className="sales-plan-editable-cell">
        <div className={options.money ? "sales-plan-table-money" : ""}>
          {options.money && <b>{currency}</b>}
          <NumberInput
            aria-label={month.month + " " + label}
            min="0"
            max={options.percentage ? "100" : undefined}
            step={options.step || (options.percentage ? "0.1" : "0.01")}
            value={options.percentage ? stored * 100 : stored}
            onRawChange={(raw) => setMonthNumber(month, key, raw, options.percentage)}
          />
          {options.percentage && <em>%</em>}
        </div>
      </td>
    );
  };

  const optionalActualCell = (
    label: string,
    month: SalesPlanMonthInput,
    key: "actualRefundLoss" | "actualFbaFee" | "actualFirstMileCost",
  ) => {
    const isActual = month.periodType === "actual";
    const v = month[key];
    return (
      <td data-label={label} className="sales-plan-editable-cell sales-plan-actual-cell">
        <div className="sales-plan-table-money">
          <b>{currency}</b>
          <input
            aria-label={month.month + " " + label + "（当月总额）"}
            type="number"
            min="0"
            step="0.01"
            disabled={!isActual}
            value={isActual ? v ?? "" : ""}
            placeholder={isActual ? "必填" : "计划期不填"}
            onChange={(event) => setOptionalMonthNumber(month, key, event.target.value)}
          />
        </div>
      </td>
    );
  };

  const chartLabels = result.months.map((item) => item.month.slice(5));
  const incompleteNote = incompleteProfitMonths > 0 ? incompleteProfitMonths + "个月缺少实际费用" : "12个月利润已完整计算";

  return (
    <div className="sales-plan-root">
      <section className="sales-plan-hero">
        <div className="sales-plan-hero-title">
          <span>SALES PROMOTION PLAN</span>
          <h2>销售推广计划</h2>
          <p>统一推演销量、自然单、广告、库存和月度利润。实际月份使用实际费用，计划月份使用预算单价。</p>
        </div>
        <div className="sales-plan-hero-primary">
          <small>12个月经营利润</small>
          <strong className={valueClass(summary.operatingProfit)}>{money(summary.operatingProfit, currency)}</strong>
          <span>{incompleteNote}</span>
        </div>
        <div className="sales-plan-hero-actions">
          <button type="button" onClick={exportWorkbook}><FileSpreadsheet size={16} />导出 Excel</button>
          <button type="button" onClick={resetPlan}><RotateCcw size={16} />重置</button>
        </div>
      </section>

      <section className="sales-plan-kpis">
        <Kpi label="12个月销量" value={numeric(summary.totalUnits)} note="实际可售销量" />
        <Kpi label="净销售额" value={money(summary.totalNetSales, currency)} note="退款前口径" />
        <Kpi label="广告花费" value={money(summary.totalAdSpend, currency)} note={"TACoS " + rate(summary.weightedTacos) + " · ACoS " + rate(summary.weightedAcos)} />
        <Kpi label="经营利润" value={money(summary.operatingProfit, currency)} note={"利润率 " + rate(annualProfitMargin) + " · 负利润 " + summary.negativeProfitMonths + " 月"} tone={valueClass(summary.operatingProfit)} />
        <Kpi label="期末累计利润" value={money(summary.endingCumulativeProfit, currency)} note={"最大资金缺口 " + money(summary.maximumFundingGap, currency)} tone={valueClass(summary.endingCumulativeProfit)} />
        <Kpi label="期末库存" value={numeric(summary.endingInventory)} note={summary.abnormalMonths + " 个异常月份"} />
      </section>

      <section className="profit-panel sales-plan-assumptions">
        <div className="sales-plan-panel-heading">
          <div><SlidersHorizontal size={19} /><span><h3>固定参数</h3><p>这些参数由12个月共同使用；黄色区域为手动输入。</p></span></div>
          <div className="sales-plan-legend"><span className="sales-plan-legend-input">手动输入</span><span className="sales-plan-legend-calculated">自动计算</span></div>
        </div>
        <div className="sales-plan-assumption-groups">
          <fieldset>
            <legend>产品与周期</legend>
            <div className="sales-plan-field-grid">
              <label className="sales-plan-field"><span>产品名称</span><input value={assumptions.productName} onChange={(event) => setAssumption("productName", event.target.value as SalesPlanAssumptions["productName"])} /></label>
              <label className="sales-plan-field"><span>ASIN / SKU</span><input value={assumptions.productId} onChange={(event) => setAssumption("productId", event.target.value as SalesPlanAssumptions["productId"])} /></label>
              <label className="sales-plan-field"><span>计划开始月份</span><input type="month" value={assumptions.startMonth} onChange={(event) => setStartMonth(event.target.value)} /></label>
              <label className="sales-plan-field"><span>币种</span><select value={assumptions.currency} onChange={(event) => setAssumption("currency", event.target.value as SalesPlanAssumptions["currency"])}><option value="USD">USD</option><option value="CAD">CAD</option><option value="GBP">GBP</option><option value="EUR">EUR</option><option value="JPY">JPY</option></select></label>
              {assumptionNumberField("期初可售库存", "initialInventory", { suffix: "件" })}
              {assumptionNumberField("平均每单件数 UPT", "unitsPerOrder")}
            </div>
          </fieldset>
          <fieldset>
            <legend>单件成本预算</legend>
            <div className="sales-plan-field-grid">
              {assumptionNumberField("产品成本/件", "productCostPerUnit", { prefix: currency })}
              {assumptionNumberField("包装成本/件", "packagingCostPerUnit", { prefix: currency })}
              {assumptionNumberField("预算FBA费/件", "budgetFbaPerUnit", { prefix: currency })}
              {assumptionNumberField("预算头程费/件", "budgetFirstMilePerUnit", { prefix: currency })}
              {assumptionNumberField("Referral Fee率", "referralFeeRate", { percentage: true, suffix: "%" })}
              {assumptionNumberField("月固定经营成本", "monthlyFixedOperatingCost", { prefix: currency })}
            </div>
          </fieldset>
          <fieldset>
            <legend>退货与其他费用</legend>
            <div className="sales-plan-field-grid">
              {assumptionNumberField("预期退货率", "returnRate", { percentage: true, suffix: "%" })}
              {assumptionNumberField("每退货件平均净损失", "averageReturnLoss", { prefix: currency })}
              {assumptionNumberField("其他净费用池默认率", "otherNetExpensePoolRate", { percentage: true, suffix: "%" })}
              {assumptionNumberField("首期一次性投入", "initialInvestment", { prefix: currency })}
            </div>
            <p className="sales-plan-assumption-note"><Info size={15} />Coupon、秒杀、VINE与剩余其他净费用率合计默认3.7%，按标价销售额计提；仓储费按月度金额独立输入，不在该费用池内。</p>
          </fieldset>
        </div>
      </section>

      <div className="sales-plan-chart-grid">
        <TrendChart
          title="净销售额与月利润"
          subtitle="净销售额不扣退款；退款/退货净损失单独进入利润。"
          labels={chartLabels}
          currency={currency}
          series={[
            { label: "净销售额", color: "#4472c4", values: result.months.map((item) => item.netSalesBeforeRefund) },
            { label: "月利润", color: "#70ad47", values: result.months.map((item) => item.monthlyProfit) },
          ]}
        />
        <TrendChart
          title="自然单与广告单"
          subtitle="自然日单按 Orders/day，日销目标按 Units/day。"
          labels={chartLabels}
          series={[
            { label: "自然单", color: "#70ad47", values: result.months.map((item) => item.naturalOrders) },
            { label: "广告单", color: "#ed7d31", values: result.months.map((item) => item.adOrders) },
          ]}
        />
      </div>

      <section className="profit-panel sales-plan-table-panel">
        <div className="sales-plan-panel-heading sales-plan-table-heading">
          <div><TableProperties size={19} /><span><h3>12个月计划表</h3><p>实际月必须填写当月退款、FBA和头程总额；计划月自动使用每件预算。</p></span></div>
          <button className={showDetails ? "sales-plan-active" : ""} type="button" onClick={() => setShowDetails((current) => !current)}>
            <CalendarRange size={16} />{showDetails ? "收起详细列" : "展开详细列"}
          </button>
        </div>
        <div className="sales-plan-table-wrap">
          <table className="sales-plan-table">
            <thead>
              <tr>
                <th>月份</th><th>类型</th><th>推广阶段</th><th>运营重点动作</th><th>日销目标</th><th>自然日单</th><th>售价</th><th>CPO</th><th>CPC</th><th>Ad CVR</th>
                <th>仓储费</th><th>Coupon费用率</th><th>秒杀费用率</th><th>VINE费用率</th><th>实际退款损失<br />当月总额</th><th>实际FBA<br />当月总额</th><th>实际头程<br />当月总额</th>
                <th>可售销量</th><th>广告花费</th><th>净销售额</th><th>TACoS</th><th>月利润</th><th>利润率</th><th>状态</th>
                {showDetails && <>
                  <th>当月天数</th><th>促销折扣率</th><th>促销订单占比</th><th>入库量</th><th>目标销量</th><th>期末库存</th>
                  <th>自然单</th><th>广告单</th><th>标价销售额</th><th>促销折扣</th><th>ACoS</th><th>Referral Fee</th>
                  <th>产品及包装成本</th><th>FBA费用</th><th>头程费用</th><th>退款损失</th><th>剩余其他净费用率</th>
                  <th>费用率合计</th><th>其他净费用</th><th>累计利润</th><th>库存覆盖天数</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {months.map((month, index) => {
                const monthResult: SalesPlanMonthResult = result.months[index];
                const isActual = month.periodType === "actual";
                return (
                  <tr key={month.id} className={isActual ? "sales-plan-actual-row" : "sales-plan-forecast-row"}>
                    <td data-label="月份" className="sales-plan-sticky-month"><b>{month.month}</b></td>
                    <td data-label="类型" className="sales-plan-editable-cell"><select aria-label={month.month + " 数据类型"} value={month.periodType} onChange={(event) => updateMonth(month.id, { periodType: event.target.value as SalesPlanMonthInput["periodType"] })}><option value="plan">计划</option><option value="actual">实际</option></select></td>
                    <td data-label="推广阶段" className="sales-plan-editable-cell"><select aria-label={month.month + " 推广阶段"} value={month.stage} onChange={(event) => updateMonth(month.id, { stage: event.target.value as SalesPlanMonthInput["stage"] })}>{STAGES.map((stage) => <option value={stage} key={stage}>{stage}</option>)}</select></td>
                    <td data-label="运营重点动作" className="sales-plan-editable-cell sales-plan-action-cell"><input aria-label={month.month + " 运营重点动作"} value={month.action} onChange={(event) => updateMonth(month.id, { action: event.target.value })} /></td>
                    {tableNumberCell("日销目标", month, "targetDailyUnits", { step: "0.1" })}
                    {tableNumberCell("自然日单", month, "naturalDailyOrders", { step: "0.1" })}
                    {tableNumberCell("售价", month, "unitPrice", { money: true })}
                    {tableNumberCell("CPO", month, "cpo", { money: true })}
                    {tableNumberCell("CPC", month, "cpc", { money: true })}
                    <td data-label="Ad CVR">{rate(monthResult.adCvr)}</td>
                    {tableNumberCell("仓储费", month, "storageCost", { money: true })}
                    {tableNumberCell("Coupon费用率", month, "couponExpenseRate", { percentage: true })}
                    {tableNumberCell("秒杀费用率", month, "dealExpenseRate", { percentage: true })}
                    {tableNumberCell("VINE费用率", month, "vineExpenseRate", { percentage: true })}
                    {optionalActualCell("实际退款损失", month, "actualRefundLoss")}
                    {optionalActualCell("实际FBA", month, "actualFbaFee")}
                    {optionalActualCell("实际头程", month, "actualFirstMileCost")}
                    <td data-label="可售销量">{numeric(monthResult.actualUnits)}</td>
                    <td data-label="广告花费">{money(monthResult.adSpend, currency)}</td>
                    <td data-label="净销售额">{money(monthResult.netSalesBeforeRefund, currency)}</td>
                    <td data-label="TACoS">{rate(monthResult.tacos)}</td>
                    <td data-label="月利润" className={valueClass(monthResult.monthlyProfit)}><b>{money(monthResult.monthlyProfit, currency)}</b></td>
                    <td data-label="利润率" className={valueClass(monthResult.profitMargin)}>{rate(monthResult.profitMargin)}</td>
                    <td data-label="状态"><span title={monthResult.warnings.join("；") || "正常"} className={"sales-plan-status " + statusTone(monthResult.statusSeverity)}>{monthResult.status}</span></td>
                    {showDetails && <>
                      <td data-label="当月天数">{numeric(monthResult.days)}</td>
                      {tableNumberCell("促销折扣率", month, "promotionDiscountRate", { percentage: true })}
                      {tableNumberCell("促销订单占比", month, "promotionOrderShare", { percentage: true })}
                      {tableNumberCell("入库量", month, "receipts", { step: "1" })}
                      <td data-label="目标销量">{numeric(monthResult.targetUnits)}</td>
                      <td data-label="期末库存">{numeric(monthResult.endingInventory)}</td>
                      <td data-label="自然单">{numeric(monthResult.naturalOrders, 1)}</td>
                      <td data-label="广告单">{numeric(monthResult.adOrders, 1)}</td>
                      <td data-label="标价销售额">{money(monthResult.grossSales, currency)}</td>
                      <td data-label="促销折扣">{money(monthResult.promotionDiscount, currency)}</td>
                      <td data-label="ACoS">{rate(monthResult.acos)}</td>
                      <td data-label="Referral Fee">{money(monthResult.referralFee, currency)}</td>
                      <td data-label="产品及包装成本">{money(monthResult.productAndPackagingCost, currency)}</td>
                      <td data-label="FBA费用">{money(monthResult.fbaCost, currency)}</td>
                      <td data-label="头程费用">{money(monthResult.firstMileCost, currency)}</td>
                      <td data-label="退款损失">{money(monthResult.refundLoss, currency)}</td>
                      <td data-label="剩余其他净费用率">{rate(monthResult.residualOtherNetExpenseRate)}</td>
                      <td data-label="费用率合计">{rate(monthResult.totalOtherNetExpenseRate)}</td>
                      <td data-label="其他净费用">{money(monthResult.otherNetExpense, currency)}</td>
                      <td data-label="累计利润" className={valueClass(monthResult.cumulativeProfit)}>{money(monthResult.cumulativeProfit, currency)}</td>
                      <td data-label="库存覆盖天数">{numeric(monthResult.inventoryCoverageDays, 1)}</td>
                    </>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="sales-plan-table-footnote"><Info size={15} /><span>CPO 即广告订单成本（CPA），广告花费 = 广告单 × CPO，Ad CVR = 广告单 ÷（广告花费 ÷ CPC）。促销折扣率影响销售额；Coupon费用率属于3.7%费用池。实际退款、FBA和头程均填写当月总额；填0代表真实为0，不会回退预算。</span></div>
      </section>
    </div>
  );
}

export default SalesPromotionPlan;
