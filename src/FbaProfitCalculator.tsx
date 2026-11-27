import { useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_FBA_PROFIT_INPUT,
  FREIGHT_CHANNELS,
  REFERRAL_CATEGORIES,
  calculateFbaProfit,
  type DimensionUnit,
  type FbaProductCategory,
  type FbaProfitInput,
  type FreightMode,
  type FulfillmentSeason,
  type StorageSeason,
  type WeightBasis,
  type WeightUnit,
} from "./lib/fbaProfit";
import "./FbaProfitCalculator.css";

const REFERENCE_SOURCE_URL =
  "https://github.com/rughouse-fba-tools/fba-calculator/blob/f9f2d1bc6cb9f19214e5f0fda021d0eee01ec3ed/index.html";
const AMAZON_FBA_SOURCE_URL =
  "https://sellercentral.amazon.com/help/hub/reference/external/GABBX6GZPA8MSZGW";

const WEIGHT_TO_GRAMS: Record<WeightUnit, number> = {
  g: 1,
  kg: 1_000,
  lb: 453.59237,
};

const PRODUCT_CATEGORY_OPTIONS: ReadonlyArray<{ value: FbaProductCategory; label: string }> = [
  { value: "非服装", label: "非服装" },
  { value: "服装", label: "服装" },
  { value: "危险品", label: "危险品 / Hazmat" },
];

const FULFILLMENT_SEASON_OPTIONS: ReadonlyArray<{ value: FulfillmentSeason; label: string }> = [
  { value: "非旺季", label: "非旺季（1/15–10/14）" },
  { value: "旺季", label: "旺季（10/15–1/14）" },
];

const STORAGE_SEASON_OPTIONS: ReadonlyArray<{ value: StorageSeason; label: string }> = [
  { value: "offpeak", label: "1–9月（仓储淡季）" },
  { value: "peak", label: "10–12月（仓储旺季）" },
];

const FREIGHT_OPTION_LABELS: Record<FreightMode, string> = {
  default_sea: "默认普船海派 · ¥12.5/kg",
  sea: "普船海派 · ¥8.2/kg（大森林·美东经济卡派）",
  fastsea: "快船 · ¥13.6/kg（大森林·华南 ZIM 美东卡派）",
  west_air: "美西空运 · ¥60/kg（体积重÷6000）",
  express: "快递 · ¥97/kg（燕文头程专线，顶档价）",
  own: "公司自有-快船海卡 · ¥8/kg（AGL，免入库配置费）",
  own_fast: "公司自有-普船海派 · ¥14/kg（AGL，免入库配置费）",
};

const WEIGHT_BASIS_LABELS: Record<WeightBasis, string> = {
  "actual-only": "按实重计费（该 Size Tier 规则）",
  actual: "按实重计费",
  dimensional: "按体积重计费",
  equal: "实重＝体积重",
};

interface NumericFieldProps {
  id: string;
  label: string;
  unit?: string;
  value: number;
  step?: number | string;
  min?: number;
  max?: number;
  className?: string;
  onChange: (value: number) => void;
}

function NumericField({
  id,
  label,
  unit,
  value,
  step = "any",
  min,
  max,
  className = "",
  onChange,
}: NumericFieldProps) {
  return (
    <label className={`fba-profit__field ${className}`.trim()} htmlFor={id}>
      <span className="fba-profit__field-label">
        {label}{unit && <span className="fba-profit__unit">{unit}</span>}
      </span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(Number.isFinite(next) ? next : 0);
        }}
      />
    </label>
  );
}

interface SelectFieldProps {
  id: string;
  label: string;
  value: string | number;
  children: ReactNode;
  onChange: (value: string) => void;
}

function SelectField({ id, label, value, children, onChange }: SelectFieldProps) {
  return (
    <label className="fba-profit__field" htmlFor={id}>
      <span className="fba-profit__field-label">{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

function SegmentedControl<T extends string>({ label, value, options, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="fba-profit__segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          className="fba-profit__segment"
          type="button"
          aria-pressed={value === option.value}
          key={option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function fixed(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function usd(value: number, digits = 2): string {
  return Number.isFinite(value) ? `$${value.toFixed(digits)}` : "—";
}

function marginTone(value: number): "good" | "warn" | "bad" {
  if (value >= 15) return "good";
  if (value >= 5) return "warn";
  return "bad";
}

function roundInput(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function FbaProfitCalculator() {
  const [input, setInput] = useState<FbaProfitInput>(() => ({ ...DEFAULT_FBA_PROFIT_INPUT }));
  const [referralCategoryIndex, setReferralCategoryIndex] = useState(() => {
    const index = REFERRAL_CATEGORIES.findIndex((category) => category.rate === DEFAULT_FBA_PROFIT_INPUT.referralRate);
    return index >= 0 ? index : 0;
  });

  const result = useMemo(() => calculateFbaProfit(input), [input]);
  const freightChannels = useMemo(() => Object.values(FREIGHT_CHANNELS), []);

  const updateInput = <K extends keyof FbaProfitInput,>(key: K, value: FbaProfitInput[K]) => {
    setInput((current) => ({ ...current, [key]: value }));
  };

  const changeDimensionUnit = (nextUnit: DimensionUnit) => {
    setInput((current) => {
      if (current.dimensionUnit === nextUnit) return current;
      const factor = nextUnit === "in" ? 1 / 2.54 : 2.54;
      return {
        ...current,
        length: roundInput(current.length * factor, 6),
        width: roundInput(current.width * factor, 6),
        height: roundInput(current.height * factor, 6),
        dimensionUnit: nextUnit,
      };
    });
  };

  const changeWeightUnit = (nextUnit: WeightUnit) => {
    setInput((current) => {
      if (current.weightUnit === nextUnit) return current;
      const grams = current.weight * WEIGHT_TO_GRAMS[current.weightUnit];
      return {
        ...current,
        weight: roundInput(grams / WEIGHT_TO_GRAMS[nextUnit], 6),
        weightUnit: nextUnit,
      };
    });
  };

  const changeReferralCategory = (rawIndex: string) => {
    const nextIndex = Number(rawIndex);
    const category = REFERRAL_CATEGORIES[nextIndex];
    if (!category) return;
    setReferralCategoryIndex(nextIndex);
    updateInput("referralRate", category.rate);
  };

  const selectedVolumeWeight = result.carton.selectedVolumeDivisor === 5_000
    ? result.carton.dimensionalWeightKgBy5000
    : result.carton.dimensionalWeightKgBy6000;
  const cartonChargeBasis = Math.abs(result.carton.actualWeightKg - selectedVolumeWeight) < 1e-9
    ? "实重＝体积重"
    : selectedVolumeWeight > result.carton.actualWeightKg ? "按体积重计费" : "按实重计费";
  const storagePeriodLabel = input.storageSeason === "peak" ? "10–12月" : "1–9月";
  const storageSurchargeText = input.productCategory === "危险品"
    ? "$0.00/ft³（危险品使用独立仓储费率）"
    : input.storageUtilizationSurcharge
      ? `${usd(result.storage.utilizationSurchargeRateUsdPerCubicFoot)}/ft³（>30天占比${fixed(input.storageAgedOver30DaysRate * 100, 0)}%）`
      : "$0.00/ft³（不适用/豁免，仅计基础仓储费）";

  return (
    <main className="fba-profit">
      <header className="fba-profit__header">
        <div>
          <div className="fba-profit__eyebrow">Amazon US · FBA 2026</div>
          <h1>亚马逊美国站 FBA 利润测算</h1>
          <p>整合 Size Tier、配送费、仓储费、入库配置费、头程计费重与 7 个物流渠道利润，统一按单件口径比较。</p>
        </div>
        <a className="fba-profit__source-link" href={REFERENCE_SOURCE_URL} target="_blank" rel="noreferrer">
          查看参考模型
        </a>
      </header>

      <div className="fba-profit__page">
        <div className="fba-profit__grid">
          <div className="fba-profit__stack">
            <section className="fba-profit__card" aria-labelledby="fba-profit-product-title">
              <div className="fba-profit__card-head">
                <h2 id="fba-profit-product-title">产品尺寸与重量</h2>
                <span className="fba-profit__card-code" aria-hidden="true">01</span>
              </div>
              <div className="fba-profit__card-body">
                <div className="fba-profit__section">
                  <span className="fba-profit__section-label">尺寸单位</span>
                  <SegmentedControl
                    label="尺寸单位"
                    value={input.dimensionUnit}
                    options={[{ value: "cm", label: "厘米 cm" }, { value: "in", label: "英寸 in" }]}
                    onChange={changeDimensionUnit}
                  />
                </div>
                <div className="fba-profit__section fba-profit__field-grid">
                  <NumericField id="fba-profit-length" label="最长边" unit={input.dimensionUnit} value={input.length} step={0.1} min={0} onChange={(value) => updateInput("length", value)} />
                  <NumericField id="fba-profit-width" label="次长边" unit={input.dimensionUnit} value={input.width} step={0.1} min={0} onChange={(value) => updateInput("width", value)} />
                  <NumericField id="fba-profit-height" label="最短边" unit={input.dimensionUnit} value={input.height} step={0.1} min={0} onChange={(value) => updateInput("height", value)} />
                </div>
                <div className="fba-profit__section">
                  <span className="fba-profit__section-label">重量单位</span>
                  <SegmentedControl
                    label="重量单位"
                    value={input.weightUnit}
                    options={[{ value: "g", label: "克 g" }, { value: "kg", label: "千克 kg" }, { value: "lb", label: "磅 lb" }]}
                    onChange={changeWeightUnit}
                  />
                </div>
                <div className="fba-profit__section fba-profit__field-grid fba-profit__field-grid--two">
                  <NumericField id="fba-profit-weight" label="产品重量" unit={input.weightUnit} value={input.weight} step={input.weightUnit === "g" ? 1 : 0.01} min={0} onChange={(value) => updateInput("weight", value)} />
                  <NumericField id="fba-profit-price" label="US 售价" unit="$" value={input.priceUsd} step={0.01} min={0} onChange={(value) => updateInput("priceUsd", value)} />
                </div>
                <div className="fba-profit__charge-grid" aria-label="单品 FBA 计费重量比较">
                  <div className="fba-profit__charge-card">
                    <span>单品实重</span>
                    <strong>{fixed(result.unit.actualWeightLb, 3)} lb</strong>
                    <small>{fixed(result.unit.actualWeightKg, 3)} kg · 包装后实际重量</small>
                  </div>
                  <div className="fba-profit__charge-card">
                    <span>单品体积重（÷139）</span>
                    <strong>{fixed(result.unit.dimensionalWeightLb, 3)} lb</strong>
                    <small>{fixed(result.unit.dimensionalWeightLb * 0.45359237, 3)} kg · 英寸长×宽×高÷139</small>
                  </div>
                  <div className="fba-profit__charge-card fba-profit__charge-card--selected">
                    <span>FBA 计费重</span>
                    <strong>{fixed(result.unit.billableWeightLb, 3)} lb</strong>
                    <small className="fba-profit__charge-basis">{WEIGHT_BASIS_LABELS[result.unit.weightBasis]}</small>
                  </div>
                </div>
                <p className="fba-profit__hint">FBA 先根据单品包装尺寸和重量确定 Size Tier，再按该 Size Tier 的规则选择实重或体积重计算配送费。</p>
              </div>
            </section>

            <section className="fba-profit__card" aria-labelledby="fba-profit-cost-title">
              <div className="fba-profit__card-head">
                <h2 id="fba-profit-cost-title">成本与汇率</h2>
                <span className="fba-profit__card-code" aria-hidden="true">02</span>
              </div>
              <div className="fba-profit__card-body">
                <div className="fba-profit__field-grid fba-profit__field-grid--two">
                  <NumericField id="fba-profit-cogs" label="采购价（含税）" unit="¥" value={input.cogsRmb} step={0.01} min={0} onChange={(value) => updateInput("cogsRmb", value)} />
                  <NumericField id="fba-profit-fx" label="汇率" unit="¥/$" value={input.exchangeRateRmbPerUsd} step={0.001} min={0} onChange={(value) => updateInput("exchangeRateRmbPerUsd", value)} />
                  <NumericField id="fba-profit-ad-rate" label="广告消耗占比" unit="%" value={roundInput(input.advertisingRate * 100)} step={0.5} min={0} onChange={(value) => updateInput("advertisingRate", value / 100)} />
                  <NumericField id="fba-profit-turnover" label="仓储利用率" unit="周（FBA Dashboard）" value={input.storageTurnoverWeeks} step={1} min={0} onChange={(value) => updateInput("storageTurnoverWeeks", value)} />
                  <SelectField id="fba-profit-storage-surcharge" label="额外仓储利用率附加费" value={input.storageUtilizationSurcharge ? "yes" : "no"} onChange={(value) => updateInput("storageUtilizationSurcharge", value === "yes")}>
                    <option value="no">不适用 / 豁免</option>
                    <option value="yes">适用</option>
                  </SelectField>
                  <NumericField id="fba-profit-aged-rate" label="库龄超过30天库存占比" unit="%" value={roundInput(input.storageAgedOver30DaysRate * 100)} step={1} min={0} max={100} onChange={(value) => updateInput("storageAgedOver30DaysRate", value / 100)} />
                </div>
                <p className="fba-profit__hint">这里只设置基础仓储费之外的额外附加费；选择“不适用 / 豁免”时，基础仓储费仍正常计算。实际仓储利用率以 FBA Dashboard 为准。</p>
                <div className="fba-profit__section fba-profit__field-grid fba-profit__field-grid--two">
                  <NumericField id="fba-profit-refund-rate" label="预计退货率" unit="%" value={roundInput(input.refundRate * 100)} step={0.5} min={0} max={100} onChange={(value) => updateInput("refundRate", value / 100)} />
                  <NumericField id="fba-profit-coupon-rate" label="Coupon 费用率" unit="%" value={roundInput(input.couponRate * 100)} step={0.5} min={0} max={100} onChange={(value) => updateInput("couponRate", value / 100)} />
                </div>
                <p className="fba-profit__hint">Coupon 按比例折减到手售价后再计算佣金；退货率按整单利润的期望损失简化折减，未拆分退货处理费等细项。</p>
              </div>
            </section>

            <section className="fba-profit__card" aria-labelledby="fba-profit-policy-title">
              <div className="fba-profit__card-head">
                <h2 id="fba-profit-policy-title">类目与周期假设</h2>
                <span className="fba-profit__card-code" aria-hidden="true">03</span>
              </div>
              <div className="fba-profit__card-body">
                <div className="fba-profit__section">
                  <span className="fba-profit__section-label">产品类型</span>
                  <SegmentedControl label="产品类型" value={input.productCategory} options={PRODUCT_CATEGORY_OPTIONS} onChange={(value) => updateInput("productCategory", value)} />
                </div>
                <div className="fba-profit__section">
                  <span className="fba-profit__section-label">FBA 配送费周期</span>
                  <SegmentedControl label="FBA 配送费周期" value={input.fulfillmentSeason} options={FULFILLMENT_SEASON_OPTIONS} onChange={(value) => updateInput("fulfillmentSeason", value)} />
                </div>
                <div className="fba-profit__section">
                  <span className="fba-profit__section-label">仓储计费月份</span>
                  <SegmentedControl label="仓储计费月份" value={input.storageSeason} options={STORAGE_SEASON_OPTIONS} onChange={(value) => updateInput("storageSeason", value)} />
                  <p className="fba-profit__hint">仓储费按自然月区分淡旺季，与配送费的旺季日期不同，因此需要单独选择。</p>
                </div>
                <div className="fba-profit__section fba-profit__field-grid fba-profit__field-grid--two">
                  <SelectField id="fba-profit-referral-category" label="亚马逊佣金类目" value={referralCategoryIndex} onChange={changeReferralCategory}>
                    {REFERRAL_CATEGORIES.map((category, index) => (
                      <option value={index} key={`${category.label}-${category.rate}`}>
                        {category.label} · {fixed(category.rate * 100, 0)}%
                      </option>
                    ))}
                  </SelectField>
                  <NumericField id="fba-profit-fuel-rate" label="燃油物流附加费率" unit="%" value={roundInput(input.fuelSurchargeRate * 100)} step={0.1} min={0} onChange={(value) => updateInput("fuelSurchargeRate", value / 100)} />
                </div>
              </div>
            </section>

          </div>

          <section className="fba-profit__card fba-profit__card--freight" aria-labelledby="fba-profit-freight-title">
              <div className="fba-profit__card-head">
                <h2 id="fba-profit-freight-title">头程运费</h2>
                <span className="fba-profit__card-code" aria-hidden="true">04</span>
              </div>
              <div className="fba-profit__card-body">
                <span className="fba-profit__section-label">装箱方法（手动填写三个方向的数量）</span>
                <div className="fba-profit__field-grid">
                  <NumericField className="fba-profit__packing-field" id="fba-profit-pack-length" label="长度方向" unit="个" value={input.packCountLength} step={1} min={1} onChange={(value) => updateInput("packCountLength", value)} />
                  <NumericField className="fba-profit__packing-field" id="fba-profit-pack-width" label="宽度方向" unit="个" value={input.packCountWidth} step={1} min={1} onChange={(value) => updateInput("packCountWidth", value)} />
                  <NumericField className="fba-profit__packing-field" id="fba-profit-pack-height" label="高度方向" unit="层" value={input.packCountHeight} step={1} min={1} onChange={(value) => updateInput("packCountHeight", value)} />
                </div>
                <p className="fba-profit__hint">总装箱数＝长度方向数量 × 宽度方向数量 × 高度层数。产品尺寸、重量或装箱方法变化后，整箱数据自动重算。</p>
                <div className="fba-profit__section fba-profit__field-grid">
                  <NumericField id="fba-profit-carton-tare" label="外箱及填充物重量" unit="kg" value={input.cartonTareKg} step={0.1} min={0} onChange={(value) => updateInput("cartonTareKg", value)} />
                  <NumericField id="fba-profit-margin-length" label="长度包装余量" unit="cm" value={input.packMarginLengthCm} step={0.5} min={0} onChange={(value) => updateInput("packMarginLengthCm", value)} />
                  <NumericField id="fba-profit-margin-width" label="宽度包装余量" unit="cm" value={input.packMarginWidthCm} step={0.5} min={0} onChange={(value) => updateInput("packMarginWidthCm", value)} />
                </div>
                <div className="fba-profit__section fba-profit__field-grid fba-profit__field-grid--two">
                  <NumericField id="fba-profit-margin-height" label="高度包装余量" unit="cm" value={input.packMarginHeightCm} step={0.5} min={0} onChange={(value) => updateInput("packMarginHeightCm", value)} />
                  <NumericField id="fba-profit-carton-limit" label="计划单箱毛重上限" unit="kg，最高 22.68" value={input.plannedCartonWeightLimitKg} step={0.1} min={0.1} max={22.68} onChange={(value) => updateInput("plannedCartonWeightLimitKg", value)} />
                </div>

                <div className="fba-profit__table-wrap">
                  <table className="fba-profit__table" aria-label="产品与整箱装箱数据">
                    <thead><tr><th>项目</th><th>长度</th><th>宽度</th><th>高度</th><th>重量 / 数量</th><th>长+围长</th></tr></thead>
                    <tbody>
                      <tr>
                        <td>单个产品</td>
                        <td>{fixed(result.unit.dimensionsCm[0], 1)} cm</td>
                        <td>{fixed(result.unit.dimensionsCm[1], 1)} cm</td>
                        <td>{fixed(result.unit.dimensionsCm[2], 1)} cm</td>
                        <td>{fixed(result.unit.actualWeightKg, 2)} kg</td>
                        <td>—</td>
                      </tr>
                      <tr>
                        <td>整箱产品</td>
                        <td>{fixed(result.carton.dimensionsCm[0], 1)} cm</td>
                        <td>{fixed(result.carton.dimensionsCm[1], 1)} cm</td>
                        <td>{fixed(result.carton.dimensionsCm[2], 1)} cm</td>
                        <td>{fixed(result.carton.actualWeightKg, 2)} kg</td>
                        <td>{fixed(result.carton.lengthPlusGirthCm, 1)} cm</td>
                      </tr>
                      <tr>
                        <td>装箱方法</td>
                        <td className="fba-profit__method">{result.carton.packingCounts[0]} 个</td>
                        <td className="fba-profit__method">{result.carton.packingCounts[1]} 个</td>
                        <td className="fba-profit__method">{result.carton.packingCounts[2]} 层</td>
                        <td>{result.carton.unitCount} 个</td>
                        <td>自动计算</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="fba-profit__section fba-profit__field-grid fba-profit__field-grid--one">
                  <SelectField id="fba-profit-freight-mode" label="头程渠道（决定体积重除数和计费重）" value={input.selectedFreightMode} onChange={(value) => updateInput("selectedFreightMode", value as FreightMode)}>
                    {freightChannels.map((channel) => <option value={channel.mode} key={channel.mode}>{FREIGHT_OPTION_LABELS[channel.mode]}</option>)}
                  </SelectField>
                </div>
                <div className="fba-profit__charge-grid" aria-label="整箱头程计费重量比较">
                  <div className="fba-profit__charge-card">
                    <span>整箱实重</span>
                    <strong>{fixed(result.carton.actualWeightKg, 2)} kg</strong>
                    <small>{fixed(result.carton.actualWeightKg * 2.20462262, 2)} lb · 商品总重＋外箱及填充物</small>
                  </div>
                  <div className="fba-profit__charge-card">
                    <span>体积重（÷{result.carton.selectedVolumeDivisor}）</span>
                    <strong>{fixed(selectedVolumeWeight, 2)} kg</strong>
                    <small>{fixed(selectedVolumeWeight * 2.20462262, 2)} lb · 外箱三边各加 1 cm 后计算</small>
                  </div>
                  <div className="fba-profit__charge-card fba-profit__charge-card--selected">
                    <span>最终计费重</span>
                    <strong>{fixed(result.carton.selectedBillableWeightKg, 2)} kg</strong>
                    <small className="fba-profit__charge-basis">{cartonChargeBasis}</small>
                  </div>
                </div>
                <p className={`fba-profit__validation ${result.carton.isCompliant ? "" : "fba-profit__validation--bad"}`.trim()} role={result.carton.isCompliant ? "status" : "alert"}>
                  Amazon 校验：{result.carton.isCompliant ? "合规" : result.carton.issues.join("、")}｜标准多件外箱上限 91.44 × 63.5 × 63.5 cm / 22.68 kg
                  {result.carton.effectiveWeightLimitKg < 22.68 && `｜当前计划毛重上限 ${fixed(result.carton.effectiveWeightLimitKg, 2)} kg`}
                </p>
              </div>
          </section>

          <aside className="fba-profit__sticky" aria-label="FBA 利润测算结果" aria-live="polite">
            <section className="fba-profit__card">
              <div className="fba-profit__card-head"><h2>测算结果</h2></div>
              <div className="fba-profit__result-body">
                <div className="fba-profit__tier">{result.unit.sizeTier ?? "暂无法识别 Size Tier"}</div>
                <p className="fba-profit__tier-sub">
                  计费重 {fixed(result.unit.billableWeightLb, 3)} lb · 判断重 {fixed(result.unit.determinationWeightLb, 3)} lb · 体积 {fixed(result.unit.volumeCubicFeet, 4)} ft³ · {result.unit.sizeTierCategory ?? "待补齐有效输入"}
                </p>

                {result.validation.errors.length > 0 && (
                  <div className="fba-profit__validation fba-profit__validation--bad" role="alert">
                    {result.validation.errors.join("；")}
                  </div>
                )}
                {result.validation.warnings.length > 0 && (
                  <div className="fba-profit__validation" role="status">
                    {result.validation.warnings.join("；")}
                  </div>
                )}

                <div className="fba-profit__stats">
                  <div className="fba-profit__stat"><span>仓储基础费率</span><strong>{usd(result.storage.baseRateUsdPerCubicFoot)}/ft³ · {storagePeriodLabel}</strong></div>
                  <div className="fba-profit__stat"><span>额外仓储利用率附加费</span><strong>{storageSurchargeText}</strong></div>
                  <div className="fba-profit__stat"><span>仓储费（单件/月）</span><strong>{usd(result.storage.feeUsdPerUnitPerMonth, 4)}</strong></div>
                  <div className="fba-profit__stat"><span>入库配置服务费</span><strong>{result.selectedChannel.aglInboundFeeExempt ? "$0.00（AGL 免收）" : usd(result.selectedChannel.inboundFeeUsd)}</strong></div>
                  <div className="fba-profit__stat"><span>订单处理 / 配送费（含燃油附加）</span><strong>{usd(result.fees.fulfillmentFeeUsd)}</strong></div>
                  <div className="fba-profit__stat fba-profit__stat--total"><span>FBA 费用合计</span><strong>{usd(result.fees.selectedFbaTotalUsd)}</strong></div>
                </div>

                <div className="fba-profit__divider" />
                <div className="fba-profit__stats">
                  <div className="fba-profit__stat"><span>佣金税率</span><strong>{fixed(input.referralRate * 100, 0)}%</strong></div>
                  <div className="fba-profit__stat"><span>采购成本（折 USD）</span><strong>{usd(result.fees.cogsUsd)}</strong></div>
                  <div className="fba-profit__stat"><span>头程运费（折 USD）</span><strong>{usd(result.selectedChannel.freightUsd)}</strong></div>
                </div>

                <h3 className="fba-profit__margin-title">各头程渠道利润率对比</h3>
                <div className="fba-profit__margin-grid">
                  {freightChannels.map((channel) => {
                    const channelResult = result.channels[channel.mode];
                    const tone = marginTone(channelResult.marginPct);
                    const selected = channel.mode === input.selectedFreightMode;
                    return (
                      <article className={`fba-profit__margin-card fba-profit__margin-card--${tone}${selected ? " fba-profit__margin-card--selected" : ""}`} key={channel.mode}>
                        <span>{channel.label}</span>
                        <strong>{fixed(channelResult.marginPct, 1)}%</strong>
                        <small>净利润 {usd(channelResult.netProfitUsd)} / 件</small>
                      </article>
                    );
                  })}
                </div>

                <div className="fba-profit__note">
                  <strong>假设与限制：</strong>当前模型按 Amazon US 2026-01-15 起生效的 FBA 费率测算；仓储费按自然月区分淡旺季，仓储利用率附加费仅在手动选择“适用”时计入；入库配置费使用参考模型的区间中点，Extra Large 因参考数据缺失按 0 处理；AGL 两个公司自有渠道按免收独立入库配置费处理。广告费按原售价比例扣除，Coupon 先折减售价，退货率按整单利润期望损失简化折减。头程价格、Amazon 账单、低库存费、SIPP、锂电池及其他独立费用可能改变实际利润，请以承运商报价和 Seller Central 账单为准。来源：
                  <a href={REFERENCE_SOURCE_URL} target="_blank" rel="noreferrer">固定版本参考模型</a>、
                  <a href={AMAZON_FBA_SOURCE_URL} target="_blank" rel="noreferrer">Amazon US FBA 费率说明</a>。
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default FbaProfitCalculator;
