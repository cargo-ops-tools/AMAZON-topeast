import SalesPromotionPlan from "./SalesPromotionPlan";

function SalesPromotionPlanPage() {
  return (
    <main className="main-content sales-plan-main">
      <header className="topbar sales-plan-topbar">
        <div>
          <div className="eyebrow">运营规划 · SALES PROMOTION PLAN</div>
          <h1>销售推广计划</h1>
          <p>按月规划销量、广告、成本与利润推进节奏</p>
        </div>
      </header>

      <div className="sales-plan-page">
        <SalesPromotionPlan />
      </div>
    </main>
  );
}

export default SalesPromotionPlanPage;
