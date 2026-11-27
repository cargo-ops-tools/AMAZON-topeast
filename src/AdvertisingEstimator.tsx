import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bookmark,
  Calculator,
  Check,
  Clipboard,
  Download,
  Info,
  Plus,
  RotateCcw,
  Save,
  Scale,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from "lucide-react";
import {
  ADVERTISING_MODEL_FORMULAS,
  calculateAdvertisingEstimate,
  type AdvertisingTarget,
  type CalibrationSample,
  type EstimateInterval,
} from "./lib/advertisingEstimate";

const DEMO_SAMPLE: CalibrationSample = {
  id: "sample-demo",
  asin: "DEMO-SAMPLE",
  name: "文档演示样本",
  adScore: 4000,
  organicScore: 2000,
  adClicks: 3200,
  adSpend: 3456,
  cpcProxy: 1.2,
  totalOrders: 600,
  adOrders: 300,
  observationDays: 30,
};

const DEMO_TARGET: AdvertisingTarget = {
  asin: "假设竞品",
  adScore: 6000,
  organicScore: 4000,
  cpcProxy: 1.3,
  totalOrders: 700,
  observationDays: 30,
  averageUnitsPerOrder: 1,
  unitPrice: 29.99,
  preAdUnitProfit: 9,
};

const EMPTY_SAMPLE: CalibrationSample = {
  id: "sample-empty",
  asin: "",
  name: "新校准样本",
  adScore: 0,
  organicScore: 0,
  adClicks: null,
  adSpend: 0,
  cpcProxy: 0,
  totalOrders: 0,
  adOrders: null,
  observationDays: 30,
};

const EMPTY_TARGET: AdvertisingTarget = {
  asin: "",
  adScore: 0,
  organicScore: 0,
  cpcProxy: 0,
  totalOrders: null,
  observationDays: 30,
  averageUnitsPerOrder: 1,
  unitPrice: null,
  preAdUnitProfit: null,
};

interface SavedAdvertisingTemplate {
  schemaVersion: 3;
  id: string;
  name: string;
  samples: CalibrationSample[];
  target: AdvertisingTarget;
  site: string;
  channelScope: string;
  calibrationSite: string;
  calibrationChannelScope: string;
  calibrationScopeVerified: boolean;
  isDemo: boolean;
}

const LEGACY_TEMPLATE_STORAGE_KEY = "amazon-inventory-decision-advertising-templates";
const INTERIM_TEMPLATE_STORAGE_KEY = "amazon-inventory-decision-advertising-templates-v2";
const TEMPLATE_STORAGE_KEY = "amazon-inventory-decision-advertising-templates-v3";
const SITE_CURRENCY: Record<string, { code: string; symbol: string }> = {
  "Amazon US": { code: "USD", symbol: "$" },
  "Amazon CA": { code: "CAD", symbol: "C$" },
  "Amazon UK": { code: "GBP", symbol: "£" },
  "Amazon DE": { code: "EUR", symbol: "€" },
};

const QUALITY_LABELS = {
  unavailable: "不可计算",
  blocked: "已阻断",
  low: "低可信",
  reference: "参考级",
  usable: "样本达标",
  "high-risk": "高风险",
} as const;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeCalibrationSample(value: unknown, legacyZeroClicksAreUnknown: boolean): CalibrationSample | null {
  if (!value || typeof value !== "object") return null;
  const sample = value as Partial<CalibrationSample>;
  const valid = typeof sample.id === "string"
    && typeof sample.name === "string"
    && isFiniteNumber(sample.adScore)
    && isFiniteNumber(sample.organicScore)
    && (sample.adClicks === null || sample.adClicks === undefined || isFiniteNumber(sample.adClicks))
    && isFiniteNumber(sample.adSpend)
    && isFiniteNumber(sample.cpcProxy)
    && isFiniteNumber(sample.totalOrders)
    && (sample.adOrders === null || sample.adOrders === undefined || isFiniteNumber(sample.adOrders));
  if (!valid) return null;
  return {
    id: sample.id!,
    asin: typeof sample.asin === "string"
      ? sample.asin
      : /^[A-Z0-9]{10}$/i.test(sample.name!.trim()) ? sample.name!.trim().toUpperCase() : "",
    name: sample.name!,
    adScore: sample.adScore!,
    organicScore: sample.organicScore!,
    adClicks: sample.adClicks === null || sample.adClicks === undefined
      || (legacyZeroClicksAreUnknown && sample.adClicks === 0) ? null : sample.adClicks,
    adSpend: sample.adSpend!,
    cpcProxy: sample.cpcProxy!,
    totalOrders: sample.totalOrders!,
    adOrders: sample.adOrders === null || sample.adOrders === undefined ? null : sample.adOrders,
    observationDays: isFiniteNumber(sample.observationDays) && sample.observationDays > 0 ? sample.observationDays : 0,
  };
}

function normalizeAdvertisingTarget(value: unknown): AdvertisingTarget | null {
  if (!value || typeof value !== "object") return null;
  const target = value as Partial<AdvertisingTarget>;
  const valid = typeof target.asin === "string"
    && isFiniteNumber(target.adScore)
    && isFiniteNumber(target.organicScore)
    && isFiniteNumber(target.cpcProxy)
    && (target.totalOrders === null || isFiniteNumber(target.totalOrders))
    && (target.observationDays === null || target.observationDays === undefined || isFiniteNumber(target.observationDays));
  if (!valid) return null;
  return {
    asin: target.asin!,
    adScore: target.adScore!,
    organicScore: target.organicScore!,
    cpcProxy: target.cpcProxy!,
    totalOrders: target.totalOrders!,
    observationDays: isFiniteNumber(target.observationDays) && target.observationDays > 0 ? target.observationDays : 0,
    averageUnitsPerOrder: isFiniteNumber(target.averageUnitsPerOrder) && target.averageUnitsPerOrder > 0 ? target.averageUnitsPerOrder : 1,
    unitPrice: target.unitPrice === null || target.unitPrice === undefined ? null : isFiniteNumber(target.unitPrice) ? target.unitPrice : null,
    preAdUnitProfit: target.preAdUnitProfit === null || target.preAdUnitProfit === undefined ? null : isFiniteNumber(target.preAdUnitProfit) ? target.preAdUnitProfit : null,
  };
}

function normalizeSavedAdvertisingTemplate(value: unknown): SavedAdvertisingTemplate | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<SavedAdvertisingTemplate>;
  if (!(typeof item.id === "string"
    && typeof item.name === "string"
    && Array.isArray(item.samples)
    && typeof item.site === "string"
    && typeof item.channelScope === "string")) return null;
  const isV3 = item.schemaVersion === 3;
  const samples = item.samples
    .map((sample) => normalizeCalibrationSample(sample, !isV3))
    .filter((sample): sample is CalibrationSample => sample !== null);
  const target = normalizeAdvertisingTarget(item.target);
  if (samples.length !== item.samples.length || target === null) return null;
  const legacyDemo = item.isDemo === undefined
    && target.asin === DEMO_TARGET.asin
    && samples.some((sample) => sample.name === DEMO_SAMPLE.name);
  return {
    schemaVersion: 3,
    id: item.id,
    name: item.name,
    samples,
    target,
    site: item.site,
    channelScope: item.channelScope,
    calibrationSite: typeof item.calibrationSite === "string" ? item.calibrationSite : item.site,
    calibrationChannelScope: typeof item.calibrationChannelScope === "string" ? item.calibrationChannelScope : item.channelScope,
    calibrationScopeVerified: isV3 && item.calibrationScopeVerified === true,
    isDemo: item.isDemo === true || legacyDemo,
  };
}

function readSavedTemplates(): SavedAdvertisingTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(TEMPLATE_STORAGE_KEY)
      ?? window.localStorage.getItem(INTERIM_TEMPLATE_STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_TEMPLATE_STORAGE_KEY)
      ?? "[]";
    const value = JSON.parse(stored) as unknown;
    return Array.isArray(value)
      ? value.map(normalizeSavedAdvertisingTemplate).filter((item): item is SavedAdvertisingTemplate => item !== null)
      : [];
  } catch {
    return [];
  }
}

function formatNumber(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatMoney(value: number | null, site: string, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const currency = SITE_CURRENCY[site];
  return currency ? `${currency.symbol}${formatNumber(value, digits)}` : `${formatNumber(value, digits)}（币种待定）`;
}

function formatPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${formatNumber(value * 100, digits)}%`;
}

function formatInterval(interval: EstimateInterval, formatter: (value: number | null) => string): string {
  if (interval.p25 === null || interval.p75 === null) return "—";
  return `${formatter(interval.p25)} – ${formatter(interval.p75)}`;
}

function formatCsvNumber(value: number | null, digits = 2): string {
  return value === null || !Number.isFinite(value) ? "" : value.toFixed(digits);
}

function numericValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function optionalNumericValue(value: string, clampToZero = true): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return clampToZero ? Math.max(0, parsed) : parsed;
}

function newSampleId(): string {
  return `sample-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ResultMetric({ label, value, detail, tone = "default" }: { label: string; value: string; detail: string; tone?: "default" | "accent" | "success" }) {
  return (
    <div className={`ad-result-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function AdvertisingEstimator() {
  const [samples, setSamples] = useState<CalibrationSample[]>([{ ...EMPTY_SAMPLE }]);
  const [target, setTarget] = useState<AdvertisingTarget>({ ...EMPTY_TARGET });
  const [site, setSite] = useState("Amazon US");
  const [channelScope, setChannelScope] = useState("Sponsored Products · Keyword");
  const [calibrationSite, setCalibrationSite] = useState("Amazon US");
  const [calibrationChannelScope, setCalibrationChannelScope] = useState("Sponsored Products · Keyword");
  const [calibrationScopeVerified, setCalibrationScopeVerified] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedAdvertisingTemplate[]>(readSavedTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("我的广告测算样板");

  const result = useMemo(() => calculateAdvertisingEstimate(samples, target, {
    targetSite: site,
    targetChannelScope: channelScope,
    calibrationSite,
    calibrationChannelScope,
    calibrationScopeVerified,
  }), [samples, target, site, channelScope, calibrationSite, calibrationChannelScope, calibrationScopeVerified]);
  const currency = SITE_CURRENCY[site];
  const calibrationCurrency = SITE_CURRENCY[calibrationSite];
  const resultStatus = QUALITY_LABELS[result.quality.level];
  const effectiveSampleCount = Math.min(
    result.quality.sampleCounts.click,
    result.quality.sampleCounts.cpc,
    result.quality.sampleCounts.order,
  );
  const decisionUseGuidance = result.quality.level === "usable"
    ? "样本已达标，仍需用 Seller Central 实际结果复核"
    : result.quality.level === "reference"
      ? "仅供方向参考，不可直接转成预算或出价"
      : "不可直接用于预算、竞品或采购决策";

  useEffect(() => {
    try {
      window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(savedTemplates));
    } catch {
      // Private browsing or storage quotas can make browser-local templates unavailable.
    }
  }, [savedTemplates]);

  const updateSample = <K extends keyof CalibrationSample>(id: string, key: K, value: CalibrationSample[K]) => {
    setCalibrationScopeVerified(false);
    setSamples((current) => current.map((sample) => sample.id === id ? { ...sample, [key]: value } : sample));
  };

  const updateTarget = <K extends keyof AdvertisingTarget>(key: K, value: AdvertisingTarget[K]) => {
    if (key !== "averageUnitsPerOrder" && key !== "unitPrice" && key !== "preAdUnitProfit") {
      setCalibrationScopeVerified(false);
    }
    setTarget((current) => ({ ...current, [key]: value }));
  };

  const addSample = () => {
    setCalibrationScopeVerified(false);
    setSamples((current) => [...current, { ...EMPTY_SAMPLE, id: newSampleId(), name: `校准样本 ${current.length + 1}` }]);
  };
  const removeSample = (id: string) => {
    setCalibrationScopeVerified(false);
    setSamples((current) => current.length > 1 ? current.filter((sample) => sample.id !== id) : current);
  };
  const loadDemo = () => {
    setSamples([{ ...DEMO_SAMPLE, id: newSampleId() }]);
    setTarget(DEMO_TARGET);
    setSite("Amazon US");
    setChannelScope("Sponsored Products · Keyword");
    setCalibrationSite("Amazon US");
    setCalibrationChannelScope("Sponsored Products · Keyword");
    setCalibrationScopeVerified(true);
    setSelectedTemplateId("");
    setIsDemo(true);
  };
  const clearAll = () => {
    setSamples([{ ...EMPTY_SAMPLE, id: newSampleId() }]);
    setTarget({ ...EMPTY_TARGET });
    setSite("Amazon US");
    setChannelScope("Sponsored Products · Keyword");
    setCalibrationSite("Amazon US");
    setCalibrationChannelScope("Sponsored Products · Keyword");
    setCalibrationScopeVerified(false);
    setSelectedTemplateId("");
    setIsDemo(false);
    setFeedback("");
  };

  const saveTemplate = () => {
    const id = selectedTemplateId || newSampleId();
    const nextTemplate: SavedAdvertisingTemplate = {
      schemaVersion: 3,
      id,
      name: templateName.trim() || `广告样板 ${savedTemplates.length + 1}`,
      samples: samples.map((sample) => ({ ...sample })),
      target: { ...target },
      site,
      channelScope,
      calibrationSite,
      calibrationChannelScope,
      calibrationScopeVerified,
      isDemo,
    };
    setSavedTemplates((current) => [...current.filter((item) => item.id !== id), nextTemplate]);
    setSelectedTemplateId(id);
    setTemplateName(nextTemplate.name);
    setFeedback("样板已保存在当前浏览器");
    window.setTimeout(() => setFeedback(""), 1800);
  };

  const loadTemplate = (id: string) => {
    const template = savedTemplates.find((item) => item.id === id);
    if (!template) {
      setSelectedTemplateId("");
      return;
    }
    setSelectedTemplateId(id);
    setTemplateName(template.name);
    setSamples(template.samples.map((sample) => ({ ...sample })));
    setTarget({ ...template.target });
    setSite(template.site);
    setChannelScope(template.channelScope);
    setCalibrationSite(template.calibrationSite);
    setCalibrationChannelScope(template.calibrationChannelScope);
    setCalibrationScopeVerified(template.calibrationScopeVerified);
    setIsDemo(template.isDemo);
  };

  const deleteTemplate = () => {
    if (!selectedTemplateId) return;
    if (!window.confirm("确认删除当前广告测算样板？此操作只影响当前浏览器。")) return;
    setSavedTemplates((current) => current.filter((item) => item.id !== selectedTemplateId));
    setSelectedTemplateId("");
    setFeedback("样板已删除");
  };

  const copyResult = async () => {
    const text = [
      "【广告测算】",
      `竞品站点/渠道：${site} / ${channelScope}`,
      `校准样本站点/渠道：${calibrationSite} / ${calibrationChannelScope}（${calibrationScopeVerified ? "已确认" : "未确认"}）`,
      `竞品：${target.asin || "未填写"}`,
      `币种：${currency?.code ?? "未指定"}`,
      `平均每单件数：${formatNumber(target.averageUnitsPerOrder, 2)}`,
      `数据性质：${isDemo ? "演示数据，不可用于决策" : "用户录入数据"}`,
      `模型质量：${QUALITY_LABELS[result.quality.level]}（点击/CPC/订单样本 ${result.quality.sampleCounts.click}/${result.quality.sampleCounts.cpc}/${result.quality.sampleCounts.order}）`,
      `决策使用：${decisionUseGuidance}`,
      `估算观察期广告花费：${formatMoney(result.target.estimatedSpend, site)}`,
      `广告花费组合情景 P25–P75：${formatInterval(result.target.intervals.estimatedSpend, (value) => formatMoney(value, site))}`,
      `估算日均广告花费：${formatMoney(result.target.estimatedDailySpend, site)}`,
      `估算 CPC：${formatMoney(result.target.estimatedCpc, site)}`,
      `广告归因订单占比：${formatPercent(result.target.adOrderShare)}`,
      `非广告归因订单占比：${formatPercent(result.target.nonAdOrderShare)}`,
      `估算广告订单：${formatNumber(result.target.estimatedAdOrders, 1)}`,
      `估算非广告归因订单：${formatNumber(result.target.estimatedNonAdOrders, 1)}`,
      `估算 ACOS：${formatPercent(result.target.acos)}`,
      `估算 TACoS：${formatPercent(result.target.tacos)}`,
      `Break-even ACOS：${formatPercent(result.target.breakEvenAcos)}`,
      `最大安全 CPC：${formatMoney(result.target.maxSafeCpc, site)}`,
      `广告后利润：${formatMoney(result.target.profitAfterAds, site)}`,
      "结果类型：Modeled_Estimate，不等同于竞品后台真实报表。",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ["项目", "组合情景 P25", "P50/点估算", "组合情景 P75", "说明"],
      ["竞品站点/渠道", "", `${site} / ${channelScope}`, "", ""],
      ["校准样本站点/渠道", "", `${calibrationSite} / ${calibrationChannelScope}`, "", calibrationScopeVerified ? "已确认" : "未确认"],
      ["竞品", "", target.asin || "未填写", "", ""],
      ["平均每单件数", "", formatCsvNumber(target.averageUnitsPerOrder), "", "经营指标按单件售价/利润换算"],
      ["数据性质", "", isDemo ? "演示数据，不可用于决策" : "用户录入数据", "", ""],
      ["模型质量", "", QUALITY_LABELS[result.quality.level], "", `点击/CPC/订单样本 ${result.quality.sampleCounts.click}/${result.quality.sampleCounts.cpc}/${result.quality.sampleCounts.order}`],
      ["决策使用", "", decisionUseGuidance, "", ""],
      ["观察期广告花费", formatCsvNumber(result.target.intervals.estimatedSpend.p25), formatCsvNumber(result.target.estimatedSpend), formatCsvNumber(result.target.intervals.estimatedSpend.p75), currency?.code ?? ""],
      ["日均广告花费", formatCsvNumber(result.target.intervals.estimatedDailySpend.p25), formatCsvNumber(result.target.estimatedDailySpend), formatCsvNumber(result.target.intervals.estimatedDailySpend.p75), currency?.code ?? ""],
      ["CPC", formatCsvNumber(result.target.intervals.estimatedCpc.p25), formatCsvNumber(result.target.estimatedCpc), formatCsvNumber(result.target.intervals.estimatedCpc.p75), currency?.code ?? ""],
      ["广告订单占比", formatPercent(result.target.intervals.adOrderShare.p25), formatPercent(result.target.adOrderShare), formatPercent(result.target.intervals.adOrderShare.p75), ""],
      ["ACOS", "", formatPercent(result.target.acos), "", ""],
      ["TACoS", "", formatPercent(result.target.tacos), "", ""],
      ["Break-even ACOS", "", formatPercent(result.target.breakEvenAcos), "", ""],
      ["最大安全 CPC", "", formatCsvNumber(result.target.maxSafeCpc), "", currency?.code ?? ""],
      ["广告后利润", "", formatCsvNumber(result.target.profitAfterAds), "", currency?.code ?? ""],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `advertising-estimate-${target.asin.trim() || "result"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="main-content advertising-estimator-main">
      <header className="topbar advertising-estimator-topbar">
        <div>
          <div className="eyebrow">板块十 · COMPETITOR ADVERTISING ESTIMATOR</div>
          <h1>广告测算</h1>
          <p>用授权样本校准西柚得分，估算竞品广告花费、CPC 与广告归因订单比例</p>
        </div>
        <div className="ad-top-actions">
          <button className="rule-link" type="button" onClick={loadDemo}><Calculator size={15} /> 文档示例</button>
          <button className="rule-link" type="button" onClick={clearAll}><RotateCcw size={15} /> 清空输入</button>
        </div>
      </header>

      <div className="advertising-estimator-page">
        <section className="ad-estimator-hero">
          <div>
            <span>CALIBRATED SCENARIO MODEL</span>
            <strong>把西柚信号变成可复核的估算</strong>
            <p>先用真实广告报表校准点击尺度、CPC 尺度和订单倾向，再把竞品 A/O 得分带入。所有金额与比例都保留为模型估算，不冒充后台实测。</p>
          </div>
          <div className="ad-estimator-hero-status">
            <div><span>质量最短板</span><b>{effectiveSampleCount} 个</b></div>
            <div><span>点击 / CPC / 订单</span><b>{result.quality.sampleCounts.click} / {result.quality.sampleCounts.cpc} / {result.quality.sampleCounts.order}</b></div>
            <div><span>模型质量</span><b><ShieldCheck size={15} /> {resultStatus}</b></div>
          </div>
        </section>

        {isDemo && <div className="ad-demo-banner" role="status"><AlertTriangle size={17} /><strong>当前包含演示数据</strong><span>即使局部修改，仍不可直接用于预算、竞品判断或采购决策。请清空并替换为同站点、同渠道、同窗口的真实校准数据。</span></div>}

        <section className="ad-template-bar" aria-label="广告测算样板">
          <div className="ad-template-title"><Bookmark size={16} /><div><strong>我的输入样板</strong><span>保存在当前浏览器，可随时恢复</span></div></div>
          <div className="ad-template-controls">
            <label><span className="sr-only">样板名称</span><input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="输入样板名称" /></label>
            <button className="ad-secondary-button" type="button" onClick={saveTemplate}><Save size={15} /> 保存样板</button>
            <label className="ad-template-select"><span className="sr-only">选择已保存样板</span><select value={selectedTemplateId} onChange={(event) => loadTemplate(event.target.value)}><option value="">选择已保存样板</option>{savedTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
            <button className="icon-button" type="button" onClick={deleteTemplate} disabled={!selectedTemplateId} title="删除已选样板" aria-label="删除已选样板"><Trash2 size={15} /></button>
            <span className="ad-template-feedback" aria-live="polite">{feedback}</span>
          </div>
        </section>

        <div className="ad-estimator-config-grid">
          <section className="ad-panel ad-target-panel">
            <div className="ad-panel-heading">
              <div><span>01</span><div><h2>竞品输入</h2><p>输入西柚同一窗口的得分和 CPC 代理</p></div></div>
              <TrendingUp size={18} />
            </div>
            <div className="ad-form">
              <div className="ad-form-grid two">
                <label className="ad-field"><span>竞品站点</span><select value={site} onChange={(event) => setSite(event.target.value)}><option>Amazon US</option><option>Amazon CA</option><option>Amazon UK</option><option>Amazon DE</option><option>其他站点</option></select></label>
                <label className="ad-field"><span>竞品渠道</span><select value={channelScope} onChange={(event) => setChannelScope(event.target.value)}><option>Sponsored Products · Keyword</option><option>Sponsored Products · Product Targeting</option><option>Sponsored Brands</option><option>Sponsored Display</option><option>混合渠道（仅同口径）</option><option value="SP CPC">SP CPC（旧样板）</option>{!["Sponsored Products · Keyword", "Sponsored Products · Product Targeting", "Sponsored Brands", "Sponsored Display", "混合渠道（仅同口径）", "SP CPC"].includes(channelScope) && <option value={channelScope}>{channelScope}（旧样板）</option>}</select></label>
              </div>
              <label className="ad-field"><span>竞品 ASIN 或备注</span><input value={target.asin} onChange={(event) => updateTarget("asin", event.target.value)} placeholder="例如：B0XXXXXXX" /></label>
              <div className="ad-form-grid two">
                <label className="ad-field"><span>竞品广告得分 A*</span><input type="number" min="0" step="1" value={target.adScore || ""} onChange={(event) => updateTarget("adScore", numericValue(event.target.value))} /><small>西柚广告流量得分</small></label>
                <label className="ad-field"><span>竞品自然得分 O*</span><input type="number" min="0" step="1" value={target.organicScore || ""} onChange={(event) => updateTarget("organicScore", numericValue(event.target.value))} /><small>必须与 A* 同口径</small></label>
              </div>
              <div className="ad-form-grid two">
                <label className="ad-field"><span>竞品 CPC 代理 b*</span><div className="ad-input-prefix"><b>{currency?.symbol ?? "¤"}</b><input type="number" min="0" step="0.01" value={target.cpcProxy || ""} onChange={(event) => updateTarget("cpcProxy", numericValue(event.target.value))} /></div><small>来自同范围关键词篮子</small></label>
                <label className="ad-field"><span>有效观察天数 D</span><input type="number" min="1" step="1" value={target.observationDays || ""} onChange={(event) => updateTarget("observationDays", numericValue(event.target.value))} /><small>必须与全部校准样本一致，否则阻断总量结果</small></label>
              </div>
              <div className="ad-form-grid two">
                <label className="ad-field"><span>竞品同口径总订单 Q <em>可选</em></span><input type="number" min="0" step="1" value={target.totalOrders ?? ""} onChange={(event) => updateTarget("totalOrders", optionalNumericValue(event.target.value))} placeholder="没有可靠 Q 时留空" /><small>用于广告单数、CVR 与 TACoS</small></label>
                <label className="ad-field"><span>平均每单件数</span><input type="number" min="0.01" step="0.01" value={target.averageUnitsPerOrder || ""} onChange={(event) => updateTarget("averageUnitsPerOrder", numericValue(event.target.value))} /><small>多件订单需填写；不确认时按 1 件假设</small></label>
              </div>
              <div className="ad-form-grid two">
                <label className="ad-field"><span>观察期平均成交价 <em>可选</em></span><div className="ad-input-prefix"><b>{currency?.symbol ?? "¤"}</b><input type="number" min="0" step="0.01" value={target.unitPrice ?? ""} onChange={(event) => updateTarget("unitPrice", optionalNumericValue(event.target.value))} /></div><small>按单件售价，用于销售额、ACOS 与 TACoS</small></label>
                <label className="ad-field"><span>广告前单件利润 <em>可选</em></span><div className="ad-input-prefix"><b>{currency?.symbol ?? "¤"}</b><input type="number" step="0.01" value={target.preAdUnitProfit ?? ""} onChange={(event) => updateTarget("preAdUnitProfit", optionalNumericValue(event.target.value, false))} /></div><small>单件售价扣除 Coupon、佣金、FBA、退货、采购和头程，但尚未扣广告</small></label>
              </div>
            </div>
          </section>

          <section className="ad-panel ad-result-panel" aria-live="polite">
            <div className="ad-panel-heading ad-result-heading">
              <div><span>02</span><div><h2>竞品估算结果</h2><p>质量按最短板 {effectiveSampleCount} 个判断；{result.validSampleCount} 个样本参与过至少一个系数</p></div></div>
              <div className="ad-result-actions">
                <button className="ad-secondary-button" type="button" onClick={copyResult} disabled={result.target.estimatedSpend === null}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? "已复制" : "复制"}</button>
                <button className="ad-secondary-button" type="button" onClick={exportCsv} disabled={result.target.estimatedSpend === null}><Download size={16} /> CSV</button>
              </div>
            </div>
            <div className="ad-result-grid">
              <ResultMetric label="观察期广告花费" value={formatMoney(result.target.estimatedSpend, site)} detail={`组合情景 P25–P75 ${formatInterval(result.target.intervals.estimatedSpend, (value) => formatMoney(value, site))}`} tone="accent" />
              <ResultMetric label="估算实际 CPC" value={formatMoney(result.target.estimatedCpc, site)} detail={`情景 P25–P75 ${formatInterval(result.target.intervals.estimatedCpc, (value) => formatMoney(value, site))}`} />
              <ResultMetric label="日均广告花费" value={formatMoney(result.target.estimatedDailySpend, site)} detail={`${target.observationDays || 0} 天 · 组合情景 P25–P75 ${formatInterval(result.target.intervals.estimatedDailySpend, (value) => formatMoney(value, site))}`} />
              <ResultMetric label="广告归因单占比" value={formatPercent(result.target.adOrderShare)} detail={`情景 P25–P75 ${formatInterval(result.target.intervals.adOrderShare, (value) => formatPercent(value))}`} tone="success" />
            </div>
            <div className="ad-result-detail-grid">
              <div><span>估算广告点击</span><strong>{formatNumber(result.target.estimatedClicks, 1)}</strong></div>
              <div><span>广告流量得分占比</span><strong>{formatPercent(result.target.trafficShare)}</strong></div>
              <div><span>估算广告归因订单</span><strong>{formatNumber(result.target.estimatedAdOrders, 1)}</strong></div>
              <div><span>非广告归因订单</span><strong>{formatNumber(result.target.estimatedNonAdOrders, 1)}</strong></div>
            </div>
            <div className="ad-business-grid">
              <div><span>估算 Ad CVR</span><strong>{formatPercent(result.target.estimatedAdCvr)}</strong></div>
              <div><span>估算 ACOS</span><strong>{formatPercent(result.target.acos)}</strong></div>
              <div><span>估算 TACoS</span><strong>{formatPercent(result.target.tacos)}</strong></div>
              <div><span>Break-even ACOS</span><strong>{formatPercent(result.target.breakEvenAcos)}</strong></div>
              <div><span>最大安全 CPC</span><strong>{formatMoney(result.target.maxSafeCpc, site)}</strong></div>
              <div className={result.target.profitAfterAds !== null && result.target.profitAfterAds < 0 ? "danger" : ""}><span>估算广告后利润</span><strong>{formatMoney(result.target.profitAfterAds, site)}</strong></div>
            </div>
            {(result.quality.isDecisionBlocked || result.quality.isExtrapolated || result.quality.hasConversionInconsistency || result.quality.hasHighDispersion || result.quality.hasSuspiciousClones || result.quality.hasProfitInputInconsistency) && <div className="ad-quality-alert"><AlertTriangle size={15} /><span>当前存在{[result.quality.hasUnverifiedContext && "样本口径未确认", result.quality.hasContextMismatch && "站点/渠道不一致", result.quality.hasObservationWindowMismatch && "观察窗口不一致", result.quality.isExtrapolated && "范围外推", result.quality.hasConversionInconsistency && "Ad CVR 达到或超过 100%", result.quality.hasHighDispersion && "样本离散度过高", result.quality.hasSuspiciousClones && "跨编号数据完全相同", result.quality.hasProfitInputInconsistency && "利润高于售价"].filter(Boolean).join("、")}。{result.quality.isDecisionBlocked ? "核心估算已停止输出。" : result.quality.level === "unavailable" ? "核心估算不可用。" : "最大安全 CPC 已停止输出，其余数值仅作高风险情景参考。"}</span></div>}
            {(result.quality.level === "low" || result.quality.level === "reference") && <div className="ad-quality-alert"><Info size={15} /><span>{decisionUseGuidance}；最大安全 CPC 仅在“样本达标”时输出。</span></div>}
            <div className="ad-model-badge"><Info size={14} /><span>这是校准后的情景估算。非广告归因订单是总订单扣除可匹配广告归因订单的残余口径，不等于纯自然搜索订单，也不代表广告增量因果。</span></div>
          </section>
        </div>

        <section className="ad-panel ad-samples-panel">
          <div className="ad-panel-heading ad-samples-heading">
            <div><span>03</span><div><h2>校准样本</h2><p>每行对应一个授权 ASIN 和同一时间/渠道口径的真实广告报表</p></div></div>
            <div className="ad-sample-actions"><button className="ad-secondary-button" type="button" onClick={addSample}><Plus size={15} /> 增加样本</button><button className="ad-secondary-button" type="button" onClick={() => { setSamples([]); setCalibrationScopeVerified(false); }}><Trash2 size={15} /> 清空样本</button></div>
          </div>
          <div className="ad-calibration-context">
            <div className="ad-form-grid two">
              <label className="ad-field"><span>校准样本站点</span><select value={calibrationSite} onChange={(event) => { setCalibrationSite(event.target.value); setCalibrationScopeVerified(false); }}><option>Amazon US</option><option>Amazon CA</option><option>Amazon UK</option><option>Amazon DE</option><option>其他站点</option>{!["Amazon US", "Amazon CA", "Amazon UK", "Amazon DE", "其他站点"].includes(calibrationSite) && <option value={calibrationSite}>{calibrationSite}（旧样板）</option>}</select></label>
              <label className="ad-field"><span>校准样本渠道</span><select value={calibrationChannelScope} onChange={(event) => { setCalibrationChannelScope(event.target.value); setCalibrationScopeVerified(false); }}><option>Sponsored Products · Keyword</option><option>Sponsored Products · Product Targeting</option><option>Sponsored Brands</option><option>Sponsored Display</option><option>混合渠道（仅同口径）</option><option value="SP CPC">SP CPC（旧样板）</option>{!["Sponsored Products · Keyword", "Sponsored Products · Product Targeting", "Sponsored Brands", "Sponsored Display", "混合渠道（仅同口径）", "SP CPC"].includes(calibrationChannelScope) && <option value={calibrationChannelScope}>{calibrationChannelScope}（旧样板）</option>}</select></label>
            </div>
            <label className="ad-scope-confirm"><input type="checkbox" checked={calibrationScopeVerified} onChange={(event) => setCalibrationScopeVerified(event.target.checked)} /><span>我确认整组样本彼此、并与目标竞品采用同一日期区间、归因窗口、报表时区、币种及得分快照口径；系统不会自动换币种或重标旧数据。修改样本或目标核心输入后需重新确认。</span></label>
          </div>
          <div className="ad-table-wrap">
            <table className="ad-sample-table">
              <thead><tr><th>样本 ASIN / 唯一编号</th><th>窗口天数</th><th>广告得分 A</th><th>自然得分 O</th><th>真实广告点击 C</th><th>真实花费 S</th><th>CPC 代理 b</th><th>总订单 Q</th><th>广告归因订单</th><th>操作</th></tr></thead>
              <tbody>
                {samples.length === 0 ? <tr><td colSpan={10} className="ad-empty-row">暂无校准样本，请增加样本或载入文档示例。</td></tr> : samples.map((sample) => <tr key={sample.id}>
                  <td data-label="样本 ASIN / 编号"><input className="ad-sample-name" value={sample.asin} onChange={(event) => updateSample(sample.id, "asin", event.target.value.toUpperCase())} placeholder="必填，用于去重" /></td>
                  <td data-label="窗口天数"><input type="number" min="1" step="1" value={sample.observationDays || ""} onChange={(event) => updateSample(sample.id, "observationDays", numericValue(event.target.value))} /></td>
                  <td data-label="广告得分 A"><input type="number" min="0" step="1" value={sample.adScore || ""} onChange={(event) => updateSample(sample.id, "adScore", numericValue(event.target.value))} /></td>
                  <td data-label="自然得分 O"><input type="number" min="0" step="1" value={sample.organicScore || ""} onChange={(event) => updateSample(sample.id, "organicScore", numericValue(event.target.value))} /></td>
                  <td data-label="真实广告点击 C"><input type="number" min="0" step="1" value={sample.adClicks ?? ""} onChange={(event) => updateSample(sample.id, "adClicks", optionalNumericValue(event.target.value))} placeholder="零点击填 0" /></td>
                  <td data-label="真实花费 S"><div className="ad-table-money"><b>{calibrationCurrency?.symbol ?? "¤"}</b><input type="number" min="0" step="0.01" value={sample.adSpend || ""} onChange={(event) => updateSample(sample.id, "adSpend", numericValue(event.target.value))} /></div></td>
                  <td data-label="CPC 代理 b"><div className="ad-table-money"><b>{calibrationCurrency?.symbol ?? "¤"}</b><input type="number" min="0" step="0.01" value={sample.cpcProxy || ""} onChange={(event) => updateSample(sample.id, "cpcProxy", numericValue(event.target.value))} /></div></td>
                  <td data-label="总订单 Q"><input type="number" min="0" step="1" value={sample.totalOrders || ""} onChange={(event) => updateSample(sample.id, "totalOrders", numericValue(event.target.value))} /></td>
                  <td data-label="广告归因订单"><input type="number" min="0" step="1" value={sample.adOrders ?? ""} onChange={(event) => updateSample(sample.id, "adOrders", optionalNumericValue(event.target.value))} placeholder="留空则不参与订单校准" /></td>
                  <td data-label="操作"><button className="icon-button" type="button" onClick={() => removeSample(sample.id)} title="删除样本" aria-label={`删除${sample.asin || sample.name}`}><Trash2 size={15} /></button></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="ad-sample-note"><Scale size={14} /><span>每个 ASIN / 唯一编号只计 1 个独立样本；重复行自动去重，冲突行整组排除。系统自动校验站点、渠道和窗口天数，其余报表口径由上方勾选确认。</span></div>
        </section>

        <div className="ad-bottom-grid">
          <section className="ad-panel ad-calibration-panel">
            <div className="ad-panel-heading"><div><span>04</span><div><h2>校准系数</h2><p>中位数用于常规估算，第 25～第 75 百分位用于上下限情景</p></div></div><BarChart3 size={18} /></div>
            <div className="ad-coefficient-list">
              <div><span>点击换算系数 k</span><strong>{formatNumber(result.scales.clickScale, 4)}</strong><small>点击数 C ÷ 广告得分 A 的中位数 · {result.observations.clickScale.length} 个唯一样本</small></div>
              <div><span>单次点击费用换算系数 m</span><strong>{formatNumber(result.scales.cpcScale, 4)}</strong><small>真实单次点击费用 ÷ 费用代理值 b 的中位数 · {result.observations.cpcScale.length} 个唯一样本</small></div>
              <div><span>广告订单倾向系数 λ</span><strong>{formatNumber(result.scales.orderTendency, 4)}</strong><small>各样本订单倾向系数的中位数 · {result.observations.orderTendency.length} 个唯一样本</small></div>
            </div>
            <div className="ad-formula-list">
              {ADVERTISING_MODEL_FORMULAS.map((item) => <article key={item.id}><b>{item.title}</b><code>{item.formula}</code><span>{item.logic}</span></article>)}
            </div>
          </section>

          <section className="ad-panel ad-warning-panel">
            <div className="ad-panel-heading"><div><span>05</span><div><h2>口径与风险提示</h2><p>模型输出前的边界检查</p></div></div><AlertTriangle size={18} /></div>
            <div className="ad-warning-list">{result.warnings.map((warning, index) => <p key={`${warning}-${index}`}><Info size={14} />{warning}</p>)}</div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default AdvertisingEstimator;
