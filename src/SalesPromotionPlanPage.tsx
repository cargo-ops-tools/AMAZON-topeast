import SalesPromotionPlan from "./SalesPromotionPlan";

function SalesPromotionPlanPage() {
  return (
    <main className="main-content sales-plan-main">
      <header className="topbar sales-plan-topbar">
        <div>
          <div className="eyebrow">运营规划 · SALES PROMOTION PLAN</div>
          <h1>销售推广计划</h1>
          <p>12个月销量、广告、库存与利润推进节奏</p>
        </div>
      </header>

      <div className="sales-plan-page">
        <SalesPromotionPlan />
      </div>
    </main>
  );
}

export default SalesPromotionPlanPage;
