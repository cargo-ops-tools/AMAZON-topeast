import { useEffect, useRef, useState } from "react";
import {
  BadgeDollarSign,
  Boxes,
  Calculator,
  CalendarRange,
  ChevronRight,
  Clock3,
  CircleDollarSign,
  Images,
  PackageCheck,
  Star,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import AdvertisingEstimator from "./AdvertisingEstimator";
import CargoDeclarationCalculator from "./CargoDeclarationCalculator";
import FbaProfitCalculator from "./FbaProfitCalculator";
import HourlyAdsAnalysis from "./HourlyAdsAnalysis";
import InventoryCostSimulator from "./InventoryCostSimulator";
import ProductImageStudio from "./ProductImageStudio";
import ProfitDecisionDesk from "./ProfitDecisionDesk";
import ProfitSimulator from "./ProfitSimulator";
import ReviewScoreCalculator from "./ReviewScoreCalculator";
import SalesPromotionPlanPage from "./SalesPromotionPlanPage";

const MODULE_IDS = [
  "fba",
  "inventory",
  "product-images",
  "profit",
  "sales-plan",
  "review-score",
  "simulation",
  "cargo-declaration",
  "hourly-ads",
  "advertising-estimator",
] as const;

type ModuleId = (typeof MODULE_IDS)[number];

const LEGACY_MODULE_REDIRECTS: Record<string, ModuleId> = {
  packing: "fba",
  "first-mile": "fba",
};

function moduleFromHash(): ModuleId {
  if (typeof window === "undefined") return "simulation";
  const candidate = window.location.hash.replace(/^#\/?/, "");
  const redirected = LEGACY_MODULE_REDIRECTS[candidate];
  if (redirected) return redirected;
  return MODULE_IDS.includes(candidate as ModuleId) ? (candidate as ModuleId) : "simulation";
}

function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>(moduleFromHash);
  const moduleNavRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const syncFromHash = () => {
      const candidate = window.location.hash.replace(/^#\/?/, "");
      const redirected = LEGACY_MODULE_REDIRECTS[candidate];
      if (redirected) {
        window.history.replaceState(null, "", `#/${redirected}`);
        setActiveModule(redirected);
        return;
      }
      setActiveModule(moduleFromHash());
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (!window.matchMedia("(max-width: 620px)").matches) return;
    const activeButton = moduleNavRef.current?.querySelector<HTMLButtonElement>(".nav-item.active");
    if (activeButton && moduleNavRef.current) {
      moduleNavRef.current.scrollTo({ left: Math.max(0, activeButton.offsetLeft - 8), behavior: "smooth" });
    }
  }, [activeModule]);

  const selectModule = (module: ModuleId) => {
    setActiveModule(module);
    const nextHash = `#/${module}`;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><PackageCheck size={22} /></div>
          <div>
            <strong>亚马逊通用</strong>
            <span>工具箱</span>
          </div>
        </div>

        <nav ref={moduleNavRef} className="module-nav" aria-label="工具板块">
          <span className="nav-label">工具板块</span>
          <button className={`nav-item ${activeModule === "fba" ? "active" : ""}`} type="button" aria-current={activeModule === "fba" ? "page" : undefined} onClick={() => selectModule("fba")}>
            <Calculator size={18} />
            <span><b>FBA 利润测算</b><small>FBA、头程与利润一体化</small></span>
            <ChevronRight size={16} />
          </button>
          <button className={`nav-item ${activeModule === "inventory" ? "active" : ""}`} type="button" aria-current={activeModule === "inventory" ? "page" : undefined} onClick={() => selectModule("inventory")}>
            <Warehouse size={18} />
            <span><b>库存成本推演</b><small>仓储、移除与清货</small></span>
            <ChevronRight size={16} />
          </button>
          <button className={`nav-item ${activeModule === "product-images" ? "active" : ""}`} type="button" aria-current={activeModule === "product-images" ? "page" : undefined} onClick={() => selectModule("product-images")}>
            <Images size={18} />
            <span><b>产品图生成</b><small>参考图改款与方案评审</small></span>
            <ChevronRight size={16} />
          </button>
          <button className={`nav-item ${activeModule === "profit" ? "active" : ""}`} type="button" aria-current={activeModule === "profit" ? "page" : undefined} onClick={() => selectModule("profit")}>
            <CircleDollarSign size={18} />
            <span><b>利润测算器</b><small>运营利润、广告与决策</small></span>
            <ChevronRight size={16} />
          </button>
          <button className={`nav-item ${activeModule === "sales-plan" ? "active" : ""}`} type="button" aria-current={activeModule === "sales-plan" ? "page" : undefined} onClick={() => selectModule("sales-plan")}>
            <CalendarRange size={18} />
            <span><b>销售推广计划</b><small>按月销量、广告与利润</small></span>
            <ChevronRight size={16} />
          </button>
          <button className={`nav-item ${activeModule === "review-score" ? "active" : ""}`} type="button" aria-current={activeModule === "review-score" ? "page" : undefined} onClick={() => selectModule("review-score")}>
            <Star size={18} />
            <span><b>链接经营评分</b><small>S/A/B/C + Review</small></span>
            <ChevronRight size={16} />
          </button>
          <button className={`nav-item ${activeModule === "simulation" ? "active" : ""}`} type="button" aria-current={activeModule === "simulation" ? "page" : undefined} onClick={() => selectModule("simulation")}>
            <TrendingUp size={18} />
            <span><b>推演</b><small>利润、推广与回本决策</small></span>
            <ChevronRight size={16} />
          </button>
          <button className={`nav-item ${activeModule === "cargo-declaration" ? "active" : ""}`} type="button" aria-current={activeModule === "cargo-declaration" ? "page" : undefined} onClick={() => selectModule("cargo-declaration")}>
            <Boxes size={18} />
            <span><b>货物申报金额</b><small>40HQ 装箱与申报</small></span>
            <ChevronRight size={16} />
          </button>
          <button className={`nav-item ${activeModule === "hourly-ads" ? "active" : ""}`} type="button" aria-current={activeModule === "hourly-ads" ? "page" : undefined} onClick={() => selectModule("hourly-ads")}>
            <Clock3 size={18} />
            <span><b>广告分时分析</b><small>报表上传与时段决策</small></span>
            <ChevronRight size={16} />
          </button>
          <button className={`nav-item ${activeModule === "advertising-estimator" ? "active" : ""}`} type="button" aria-current={activeModule === "advertising-estimator" ? "page" : undefined} onClick={() => selectModule("advertising-estimator")}>
            <BadgeDollarSign size={18} />
            <span><b>广告测算</b><small>竞品花费、CPC 与订单占比</small></span>
            <ChevronRight size={16} />
          </button>
        </nav>

        <div className="sidebar-status">
          <span className="status-dot" />
          <div><b>规则版本</b><small>US · 2026</small></div>
        </div>
      </aside>

      <div className="module-screen" hidden={activeModule !== "fba"}><FbaProfitCalculator /></div>
      <div className="module-screen" hidden={activeModule !== "inventory"}><InventoryCostSimulator /></div>
      <ProductImageStudio active={activeModule === "product-images"} />
      <div className="module-screen" hidden={activeModule !== "profit"}><ProfitSimulator /></div>
      <div className="module-screen" hidden={activeModule !== "sales-plan"}><SalesPromotionPlanPage /></div>
      <div className="module-screen" hidden={activeModule !== "review-score"}><ReviewScoreCalculator /></div>
      <div className="module-screen" hidden={activeModule !== "simulation"}><ProfitDecisionDesk /></div>
      <div className="module-screen" hidden={activeModule !== "cargo-declaration"}><CargoDeclarationCalculator /></div>
      <div className="module-screen" hidden={activeModule !== "hourly-ads"}><HourlyAdsAnalysis /></div>
      <div className="module-screen" hidden={activeModule !== "advertising-estimator"}><AdvertisingEstimator /></div>
    </div>
  );
}

export default App;
