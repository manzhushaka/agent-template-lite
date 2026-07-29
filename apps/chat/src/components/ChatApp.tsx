/* The sample image URL is intentionally replaceable by the Builder Skill. */
/* eslint-disable @next/next/no-img-element */
"use client";

import { Bot, Check, CircleAlert, LoaderCircle, MessageSquarePlus, PackageSearch, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { TEMPLATE_AGENT_ID, type DemoCard } from "@template/shared";
import { publicPath } from "@/lib/public-path";
import { browserSessionId, resetBrowserSession } from "@/lib/session";
import { consumeSseStream } from "@/lib/sse";
import { extractCards } from "@/lib/tool-results";

type Message = { id: string; role: "user" | "assistant"; content: string; cards?: DemoCard[]; pending?: boolean; error?: boolean };
type ConfirmationTool = { tool_name?: string; name?: string; tool_args?: Record<string, unknown>; requires_confirmation?: boolean; confirmed?: boolean | null };
type Approval = { runId: string; tools: ConfirmationTool[]; pendingTools: ConfirmationTool[] };

const apiBase = publicPath("/agent-api").replace(/\/$/, "");
const starterPrompts = ["有哪些适合送人的商品？", "推荐一个 200 元以内的商品", "介绍一下你能帮我完成什么"];

function formBody(values: Record<string, unknown>): FormData {
  const body = new FormData();
  Object.entries(values).forEach(([key, value]) => body.append(key, String(value)));
  return body;
}

function createMessage(role: Message["role"], content: string, extra: Partial<Message> = {}): Message {
  return { id: crypto.randomUUID(), role, content, ...extra };
}

/**
 * The Chat shell deliberately knows only Agno events and shared card contracts.
 * EXTENSION: Put business-specific collection flows in separate hooks instead of growing this
 * component; the sample product card demonstrates the smallest supported extension.
 */
export function ChatApp() {
  const [sessionId, setSessionId] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    createMessage("assistant", "你好，我是智能业务助手。你可以直接描述需求，我会基于业务数据给出建议，并在执行有后果的操作前请你确认。"),
  ]);
  const [pending, setPending] = useState(false);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [online, setOnline] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(browserSessionId(localStorage));
    fetch(`${apiBase}/api/health`, { cache: "no-store" }).then((response) => setOnline(response.ok)).catch(() => setOnline(false));
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, approval]);

  const approvalTool = approval?.pendingTools[0];
  const approvalTitle = useMemo(() => {
    const name = approvalTool?.tool_name || approvalTool?.name;
    return name === "confirm_order" ? "确认创建演示订单" : "确认执行操作";
  }, [approvalTool]);

  function updateAssistant(id: string, update: (message: Message) => Message) {
    setMessages((current) => current.map((message) => message.id === id ? update(message) : message));
  }

  async function requestRun(path: string, values: Record<string, unknown>) {
    const response = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: { Accept: "text/event-stream" },
      body: formBody({ ...values, stream: true }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `请求失败（${response.status}）`);
    }
    if (!response.body) throw new Error("浏览器不支持流式响应");

    const assistant = createMessage("assistant", "", { pending: true });
    setMessages((current) => [...current, assistant]);
    const tools = new Map<string, ConfirmationTool & { result?: unknown; tool_call_error?: boolean }>();
    let terminal: Record<string, unknown> | null = null;
    let streamError = "";

    await consumeSseStream(response.body, ({ event, data }) => {
      const payload = data as Record<string, unknown>;
      const name = String(payload.event || event);
      const incoming = [
        ...(Array.isArray(payload.tools) ? payload.tools : []),
        ...(payload.tool ? [payload.tool] : []),
      ] as Array<ConfirmationTool & { tool_call_id?: string; result?: unknown; tool_call_error?: boolean }>;
      incoming.forEach((tool) => tools.set(tool.tool_call_id || `${tool.tool_name}:${JSON.stringify(tool.tool_args || {})}`, tool));
      if (name === "RunContent" && typeof payload.content === "string") {
        updateAssistant(assistant.id, (message) => ({ ...message, content: message.content + payload.content }));
      }
      if (name === "RunError") streamError = String(payload.content || "智能体响应失败");
      if (name === "RunCompleted" || name === "RunPaused") {
        terminal = { ...payload, status: name === "RunPaused" ? "PAUSED" : payload.status || "COMPLETED" };
      }
    });

    if (streamError) throw new Error(streamError);
    if (!terminal) throw new Error("流式响应意外结束");
    const run = terminal as Record<string, unknown>;
    const toolList = [...tools.values()];
    const cards = extractCards(toolList);
    updateAssistant(assistant.id, (message) => ({
      ...message,
      content: message.content || String(run.content || (cards.length ? "业务数据已经准备好。" : "操作已经完成。")),
      cards,
      pending: false,
    }));
    const pendingTools = toolList.filter((tool) => tool.requires_confirmation && tool.confirmed == null);
    if (run.status === "PAUSED" && pendingTools.length) {
      setApproval({ runId: String(run.run_id), tools: toolList, pendingTools });
    }
  }

  async function send(messageOverride?: string) {
    const message = (messageOverride ?? input).trim();
    if (!message || pending || approval || !sessionId) return;
    setInput("");
    setMessages((current) => [...current, createMessage("user", message)]);
    setPending(true);
    try {
      await requestRun(`/agents/${TEMPLATE_AGENT_ID}/runs`, { message, session_id: sessionId });
    } catch (error) {
      setMessages((current) => [...current, createMessage("assistant", `请求失败：${(error as Error).message}`, { error: true })]);
    } finally {
      setPending(false);
    }
  }

  async function resolveApproval(confirmed: boolean) {
    if (!approval || pending) return;
    const current = approval;
    setApproval(null);
    setPending(true);
    setMessages((messages) => [...messages, createMessage("user", confirmed ? "确认执行" : "取消操作")]);
    try {
      const tools = current.tools.map((tool) => tool.requires_confirmation
        ? { ...tool, confirmed, confirmation_note: confirmed ? "用户在 Chat 中明确确认" : "用户在 Chat 中取消" }
        : tool);
      await requestRun(`/agents/${TEMPLATE_AGENT_ID}/runs/${current.runId}/continue`, {
        tools: JSON.stringify(tools),
        session_id: sessionId,
      });
    } catch (error) {
      setMessages((messages) => [...messages, createMessage("assistant", `确认失败：${(error as Error).message}`, { error: true })]);
    } finally {
      setPending(false);
    }
  }

  function startNewSession() {
    setSessionId(resetBrowserSession(localStorage));
    setApproval(null);
    setMessages([createMessage("assistant", "新会话已经开始。请告诉我这次想了解或办理什么。")]);
  }

  return <main className="chat-layout">
    <aside className="chat-sidebar">
      <header className="brand-lockup"><span className="brand-mark"><Sparkles size={18} /></span><div><strong>智能业务助手</strong><small>AGENT WORKSPACE</small></div></header>
      <div className="sidebar-context">
        <span className="eyebrow">LIVE CONVERSATION</span>
        <h1>业务对话</h1>
        <p>面向真实演示数据的工作台。</p>
      </div>
      <div className="sidebar-status"><span className={`status-dot ${online ? "online" : ""}`} /><div><strong>{online ? "AgentOS 已连接" : "AgentOS 连接中"}</strong><small>当前会话已隔离</small></div></div>
      <footer className="sidebar-footer"><div className="trust-note"><ShieldCheck size={17} /><div><strong>受控会话</strong><span>写操作需要人工确认</span></div></div><span className="runtime-label"><Bot size={14} /> Next.js + Agno</span></footer>
    </aside>

    <section className="chat-workspace">
      <header className="chat-header"><div><span className={`status-dot ${online ? "online" : ""}`} /><div><strong>当前会话</strong><small>{sessionId ? `会话 ${sessionId.slice(0, 8)}` : "正在建立会话"}</small></div></div><button className="icon-button" onClick={startNewSession} title="新建会话" aria-label="新建会话"><MessageSquarePlus size={18} /></button></header>
      <div className="message-list" ref={listRef}>
        {messages.map((message) => <article className={`message ${message.role} ${message.error ? "error" : ""}`} key={message.id}>
          <div className="message-label">{message.role === "assistant" ? "AGENT" : "YOU"}</div>
          <div className="message-bubble">{message.content ? <ReactMarkdown>{message.content}</ReactMarkdown> : <span className="typing"><i /><i /><i /></span>}</div>
          {message.cards?.length ? <div className="result-grid">{message.cards.map((card) => card.type === "product"
            ? <section className="result-card product-card" key={`${card.type}-${card.id}`}>
                {card.imageUrl ? <img src={card.imageUrl} alt={card.title} /> : <div className="image-fallback"><PackageSearch /></div>}
                <div><small>推荐商品</small><h2>{card.title}</h2><p>{card.description}</p><footer><strong>{card.price}</strong><span>库存 {card.stock}</span><button onClick={() => void send(`我选择商品 ${card.id}，请按 1 件为我准备订单。`)}>{card.actionLabel || "选择"}</button></footer></div>
              </section>
            : <section className="result-card order-card" key={`${card.type}-${card.id}`}><Check size={22} /><div><small>{card.status}</small><h2>{card.title}</h2><p>{card.description}</p><strong>{card.amount}</strong></div></section>)}</div> : null}
        </article>)}
        {!messages.some((message) => message.role === "user") && <div className="starter-prompts">{starterPrompts.map((prompt) => <button key={prompt} onClick={() => void send(prompt)}>{prompt}</button>)}</div>}
      </div>

      <form className="composer" onSubmit={(event: FormEvent) => { event.preventDefault(); void send(); }}><label className="sr-only" htmlFor="chat-message">输入业务需求</label><textarea id="chat-message" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="输入业务需求..." rows={1} /><button disabled={!input.trim() || pending || Boolean(approval)} aria-label="发送">{pending ? <LoaderCircle className="spin" size={19} /> : <Send size={19} />}</button></form>
    </section>

    {approval && <div className="modal-layer"><button className="modal-scrim" aria-label="关闭" onClick={() => void resolveApproval(false)} /><section className="confirm-dialog" role="dialog" aria-modal="true"><header><span><CircleAlert size={20} /></span><button onClick={() => void resolveApproval(false)} aria-label="取消"><X size={18} /></button></header><small>HUMAN CONFIRMATION</small><h2>{approvalTitle}</h2><p>该操作将写入演示业务数据。请确认信息无误后继续，取消不会产生业务记录。</p><div className="confirm-args">{Object.entries(approvalTool?.tool_args || {}).map(([key, value]) => <div key={key}><span>{key}</span><strong>{String(value)}</strong></div>)}</div><footer><button className="secondary-button" onClick={() => void resolveApproval(false)}>取消</button><button className="primary-button" onClick={() => void resolveApproval(true)}><Check size={16} />确认执行</button></footer></section></div>}
  </main>;
}
