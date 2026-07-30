import { Check, CircleAlert, X } from "lucide-react";
import type { HistoricalApproval } from "@/lib/chat-history";

interface ConfirmationDialogProps {
  approval: HistoricalApproval;
  onResolve: (confirmed: boolean) => void;
}

export function ConfirmationDialog({ approval, onResolve }: ConfirmationDialogProps) {
  const tool = approval.pendingTools[0];
  const name = tool?.tool_name || tool?.name;
  const title = name === "confirm_order" ? "确认创建演示订单" : "确认执行操作";
  return <div className="modal-layer"><button className="modal-scrim" aria-label="关闭" onClick={() => onResolve(false)} /><section className="confirm-dialog" role="dialog" aria-modal="true"><header><span><CircleAlert size={20} /></span><button onClick={() => onResolve(false)} aria-label="取消"><X size={18} /></button></header><small>HUMAN CONFIRMATION</small><h2>{title}</h2><p>该操作将写入演示业务数据。请确认信息无误后继续，取消不会产生业务记录。</p><div className="confirm-args">{Object.entries(tool?.tool_args || {}).map(([key, value]) => <div key={key}><span>{key}</span><strong>{String(value)}</strong></div>)}</div><footer><button className="secondary-button" onClick={() => onResolve(false)}>取消</button><button className="primary-button" onClick={() => onResolve(true)}><Check size={16} />确认执行</button></footer></section></div>;
}
