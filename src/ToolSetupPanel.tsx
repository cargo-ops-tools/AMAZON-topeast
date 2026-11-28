import { AlertTriangle, Calculator, CheckCircle2, Circle, RotateCcw } from "lucide-react";

export interface ToolRequirement {
  label: string;
  met: boolean;
}

interface ToolSetupPanelProps {
  requirements: ToolRequirement[];
  isDemo: boolean;
  onLoadDemo: () => void;
  onReset: () => void;
  title?: string;
  description?: string;
  demoMessage?: string;
}

export function RequiredBadge({ label = "核心必填" }: { label?: string }) {
  return <span className="tool-required-badge">{label}</span>;
}

function ToolSetupPanel({
  requirements,
  isDemo,
  onLoadDemo,
  onReset,
  title = "输入准备",
  description = "先看必填口径，也可以载入演示数据了解填写方式。",
  demoMessage = "当前为演示数据，仅用于了解填写方式和计算结果，不可直接用于业务决策。",
}: ToolSetupPanelProps) {
  const completed = requirements.filter((item) => item.met).length;

  return (
    <section className={`tool-setup-panel${isDemo ? " is-demo" : ""}`} aria-label={title}>
      <div className="tool-setup-main">
        <div className="tool-setup-copy">
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
        <div className="tool-setup-actions">
          <button type="button" onClick={onLoadDemo}>
            <Calculator size={15} /> 载入演示样板
          </button>
          <button type="button" onClick={onReset}>
            <RotateCcw size={15} /> 恢复默认空白
          </button>
        </div>
      </div>

      {requirements.length > 0 ? (
        <div className="tool-requirement-summary">
          <b>必填进度 {completed}/{requirements.length}</b>
          <div className="tool-requirement-list">
            {requirements.map((item) => (
              <span
                aria-label={`${item.label}：${item.met ? "已完成" : "待填写"}`}
                className={item.met ? "is-met" : "is-missing"}
                key={item.label}
              >
                {item.met ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                {item.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {isDemo ? (
        <div className="tool-demo-warning" role="status">
          <AlertTriangle size={16} />
          <span><b>演示样板：</b>{demoMessage}</span>
        </div>
      ) : null}
    </section>
  );
}

export default ToolSetupPanel;
