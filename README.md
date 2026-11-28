# 亚马逊库存决策栏

面向 Amazon 美国站运营场景的本地与 Web 计算工具。

## 已完成

- FBA 利润测算（2026 US Size Tier、配送费、仓储费、入库配置费、头程与单件利润一体化）
- FBA 库存成本推演
- 亚马逊利润测算器（运营版）
- 销售推广计划（可增减月份，滚动推演销量、广告、成本、月利润与资金缺口，支持导出含固定参数与公式的 Excel）
- 链接经营评分（六维 100 分、S/A/B/C 链接规划 + Review/Rating 情景推演）
- 货物申报金额（40HQ 装箱排布与单件申报金额）
- 单位标准化、2026 Size Tier、Shipping Weight、体积重诊断
- 2026 普通商品、服装、危险品的非旺季/旺季配送费
- 可调整的 fuel and logistics-related surcharge（默认 3.5%）
- 手动指定三个方向装箱数量、外箱重量/余量与 Amazon 箱规校验
- 默认普船、普船、快船、美西空运、快递及两个 AGL 渠道的头程与利润率对比
- 2026 月仓储费、Storage Utilization Surcharge 与危险品费率
- 老化库存附加费、最低每件费、移除费与批量清货净回收
- 最多 24 个月库存递减推演和继续销售/促销/移除/清货建议
- 库存成本汇总复制、Excel/CSV 导出与打印
- 产品、物流、Amazon费用、退货、广告和促销成本模型
- 美国、加拿大、英国、德国、日本站 Referral Fee 类目自动匹配、分段费率与最低佣金
- 广告订单/自然订单拆分、ACOS/TACOS、预算覆盖与广告安全线
- 盈亏平衡售价、盈亏平衡 ACOS/TACOS 与最大安全 CPC
- 保守/正常/激进三种利润情景模拟和 SKU 运营评级
- 利润驾驶舱、结果复制、Excel/CSV 导出与打印
- 40HQ 六方向整齐装箱比较、箱装产品数量与申报金额计算
- 广告分时分析数据源中心（官方报表下载路径、上传文件/文件夹、CSV/XLSX/XLS/JSON 字段识别）
- 广告报表按日级与小时级分层，明确 Marketing Stream 是真正小时分析数据源
- 广告测算（竞品广告花费/CPC/订单占比区间、ACOS/TACoS、利润安全线与模型质量）

## FBA 利润测算假设与限制

- 参考并组件化合并自 [rughouse-fba-tools/fba-calculator](https://github.com/rughouse-fba-tools/fba-calculator/tree/f9f2d1bc6cb9f19214e5f0fda021d0eee01ec3ed)，固定来源版本为 `f9f2d1bc6cb9f19214e5f0fda021d0eee01ec3ed`。
- 费率口径为 Amazon US 2026，Size Tier、FBA 配送费、仓储费、入库配置费和头程渠道费率均为前端固定规则；实际费用以 Seller Central 账单和物流商报价为准。
- Coupon 按售价比例折减后再计算佣金；退货按整单利润的期望损失简化折减，未拆分退款佣金、退货处理费和可售库存回流。
- 两个 AGL 公司自有渠道按参考工具口径免计独立入库配置费；其余渠道计入。

## 广告测算模型边界

广告测算用授权样本的广告得分 A、自然得分 O、真实 Clicks、Spend、CPC 代理 b、Total Orders Q 和 Ad Orders，分别校准 `k`、`m` 与 `λ`，再估算竞品点击、CPC、观察期花费、日均花费和广告归因订单比例。每行必须填写唯一 ASIN/编号；重复行只计一次，同编号冲突行整组排除，不同编号但全部字段完全相同的可疑复制数据会降为高风险。

- 系统提供“默认空白样板”和“演示样板”：空白样板只预设 Amazon US、SP 关键词、30 天和 1 件/单，不含业务数字；演示样板持续显示“不可用于决策”。
- 结果区直接显示核心测算准备清单，逐项检查目标 A/O、CPC 代理、观察天数、点击/CPC/订单三类有效样本、站点/渠道/窗口一致性和完整口径确认；缺项时明确说明结果为什么显示“—”。
- 点估算使用中位数，P25 / P50 / P75 为各校准系数组合后的情景边界，不是统计置信区间。
- 整组校准样本必须显式确认站点、渠道、日期区间、归因窗口、报表时区、币种和得分快照口径。系统自动校验站点、渠道与观察天数；其余口径由用户确认。与目标竞品的站点、渠道或观察天数不一致时，核心估算直接阻断，不会只换货币符号后继续计算。
- 模型质量区分“不可计算、已阻断、低可信、参考级、样本达标、高风险”。1–2 个唯一样本为低可信，3–9 个为参考级；至少 10 个且系数离散度受控才标记“样本达标”。
- 范围外推、Ad CVR 达到或超过 100%、系数 P25–P75 跨度过大、跨编号数据完全相同，或广告前单件利润高于售价时进入高风险。最大安全 CPC 只在三个系数均有至少 10 个独立样本且模型为“样本达标”时输出。
- 输入单件售价、总订单、平均每单件数与广告前单件利润后，可补算 Ad CVR、ACOS、TACoS、Break-even ACOS、最大安全 CPC 和广告后利润。
- 0% / 100% 广告订单样本使用 Jeffreys 平滑，避免直接丢弃真实边界样本。
- 真实 Clicks 留空表示未录入，不参与 `k` 校准；报表确认零点击时必须明确填写 `0`，该样本会保留，避免只统计有点击 ASIN 造成幸存者偏差。
- 旧版浏览器样板无法区分“空白 Clicks”和“0 Clicks”，升级后统一迁移为空白并取消旧确认，需人工复核后重新填写和确认。

没有真实校准样本时，页面不将西柚得分直接换算成真实后台数据。西柚得分、模型区间和链接评分都不是 Amazon 官方数据或因果结论。

## 链接经营评分模型

链接经营评分使用透明的六维 100 分模型：内容完整度 20、流量与 Keyword 20、转化竞争力 20、Review 健康度 20、利润与广告承载力 15、风险与合规 5。

- 缺失字段不按 0 分处理，同时单独显示“数据完整度”。
- 评分优先使用同类目、同价格带、同生命周期的相对基准。
- S：≥85、完整度 ≥90%，且已确认链接抑制与 IP/TRO 风险；A：≥75 且完整度 ≥80%；B：≥60%；其余为 C。
- 负利润、链接被抑制或高侵权/TRO 风险会强制降为 C。
- Review/Rating 子工具可推演达到目标显示分所需新增 5 星数，以及当前分数掉档前可承受的新增 1 星数。

Amazon 未公开完整 Rating 权重。前台总 Rating 可能已经包含文字 Review；只有能拆分“文字 Review”和“仅点星 Rating”时才分别录入，避免重复计算。

## 可分享入口

- FBA 利润测算：`#/fba`
- 销售推广计划：`#/sales-plan`
- 广告测算：`#/advertising-estimator`
- 链接经营评分：`#/review-score`

模块状态写入 URL Hash，刷新、浏览器前进/后退和分享链接时可保留当前工具入口。旧的 `#/packing` 与 `#/first-mile` 链接会自动转到 `#/fba`。

## 本地运行

```bash
pnpm install
pnpm dev
```

## 规则来源

- [Amazon Product size tiers](https://sellercentral.amazon.com/help/hub/reference/external/GG5KW835AHDJCH8W)
- [Amazon 2026 US FBA fulfillment fee changes](https://sellercentral.amazon.com/help/hub/reference/external/GABBX6GZPA8MSZGW)
- [Amazon Dimensional weight](https://sellercentral.amazon.com/help/hub/reference/external/G53Z9EKF8VVZVH29)
- [Amazon Monthly inventory storage fees](https://sellercentral.amazon.com/help/hub/reference/external/G3EDYEF6KUCFQTNM)
- [Amazon 2026 US fee changes](https://sellercentral.amazon.com/help/hub/reference/external/G201411300)
- [Amazon Removal and liquidation fees](https://sellercentral.amazon.com/help/hub/reference/external/GZ5Q2VW5WF4JWRGC)
- [Amazon US selling and referral fees](https://sell.amazon.com/pricing)
- [Amazon Canada selling and referral fees](https://sell.amazon.ca/pricing)
- [Amazon UK selling and referral fees](https://sell.amazon.co.uk/pricing)
- [Amazon Germany selling and referral fees](https://sell.amazon.de/preisgestaltung)
- [Amazon Japan selling and referral fees](https://sell.amazon.co.jp/pricing)

## 广告分时分析数据源

广告分时分析入口会展示下载路径和文件检测状态。V1 只在浏览器本地解析用户主动选择的文件，不上传第三方服务器。

### 真正的小时级数据

- Amazon Marketing Stream：通过 Amazon Ads API 获取小时级事件数据，再上传 CSV 或 JSON
- 官方文档：[Marketing Stream](https://advertising.amazon.com/API/docs/en-us/marketing-stream)

### Seller Central 日级补充报表

从 Seller Central 进入：`广告 → 广告活动管理 → 衡量与报告 → Sponsored ads reports`，按需下载：

- Sponsored Products Campaign Report
- Sponsored Products Search Term Report
- Sponsored Products Placement Report
- Sponsored Products Advertised Product Report

这些常规报表通常是日级汇总，不能直接替代小时数据。广告报表 API 文档：[Reporting API 3.0](https://advertising.amazon.com/API/docs/en-us/reporting/3-0/openapi)

### 经营数据补充

从 Seller Central 进入：`报告 → 业务报告 → 按子商品查看详情页面销售量和流量`，下载 Detail Page Sales and Traffic by Child Item，用于辅助判断总流量与广告依赖度。

上传支持：CSV、XLSX、XLS、Marketing Stream JSON；支持多文件和本地文件夹选择。浏览器安全限制下，页面只能显示“当前会话上传文件区”或用户选择的文件夹名称，不能读取任意本地绝对路径。

本工具用于运营预估。Amazon 实际账单以 Seller Central 的产品测量数据和计费结果为准。
