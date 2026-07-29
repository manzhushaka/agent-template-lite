/* The sample image URL is intentionally replaceable by the Builder Skill. */
/* eslint-disable @next/next/no-img-element */
"use client";

import { BadgeDollarSign, Check, CircleAlert, CircleHelp, Gift, LoaderCircle, Menu, MessageSquare, MessageSquarePlus, PackageSearch, Send, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { TEMPLATE_AGENT_ID, type DemoCard } from "@template/shared";
import { restoreConversation, type HistoricalApproval, type HistoricalTool } from "@/lib/chat-history";
import { publicPath } from "@/lib/public-path";
import {
  activateBrowserSession,
  browserSessionId,
  browserSessions,
  rememberBrowserSession,
  resetBrowserSession,
  type BrowserSessionSummary,
} from "@/lib/session";
import { consumeSseStream } from "@/lib/sse";
import { extractCards } from "@/lib/tool-results";

type Message = { id: string; role: "user" | "assistant"; content: string; cards?: DemoCard[]; pending?: boolean; error?: boolean };
type ConfirmationTool = HistoricalTool & { tool_call_id?: string };
type Approval = HistoricalApproval;

const apiBase = publicPath("/agent-api").replace(/\/$/, "");
const starterPrompts = [
  { label: "送礼推荐", prompt: "有哪些适合送人的商品？", icon: Gift },
  { label: "预算选品", prompt: "推荐一个 200 元以内的商品", icon: BadgeDollarSign },
  { label: "能力介绍", prompt: "介绍一下你能帮我完成什么", icon: CircleHelp },
];

function formBody(values: Record<string, unknown>): FormData {
  const body = new FormData();
  Object.entries(values).forEach(([key, value]) => body.append(key, String(value)));
  return body;
}

function createMessage(role: Message["role"], content: string, extra: Partial<Message> = {}): Message {
  return { id: crypto.randomUUID(), role, content, ...extra };
}

function welcomeMessage(content = "你好，我是 manzhushaka-agent。你可以直接描述需求，我会基于业务数据给出建议，并在执行有后果的操作前请你确认。"): Message[] {
  return [createMessage("assistant", content)];
}

function sessionTitle(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized.length > 28 ? `${normalized.slice(0, 28)}...` : normalized;
}

function sessionTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  }
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
}

/**
 * The Chat shell deliberately knows only Agno events and shared card contracts.
 * EXTENSION: Put business-specific collection flows in separate hooks instead of growing this
 * component; the sample product card demonstrates the smallest supported extension.
 */
export function ChatApp() {
  const [sessionId, setSessionId] = useState("");
  const [currentTitle, setCurrentTitle] = useState("新会话");
  const [sessions, setSessions] = useState<BrowserSessionSummary[]>([]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(welcomeMessage);
  const [pending, setPending] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [online, setOnline] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const historyRequestRef = useRef(0);

  const loadSession = useCallback(async (id: string) => {
    const requestId = ++historyRequestRef.current;
    setSessionLoading(true);
    setApproval(null);
    try {
      const response = await fetch(`${apiBase}/sessions/${encodeURIComponent(id)}/runs?type=agent`, {
        cache: "no-store",
      });
      if (requestId !== historyRequestRef.current) return;
      if (response.status === 404) {
        setMessages(welcomeMessage());
        return;
      }
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const detail = body && typeof body === "object" && "detail" in body
          ? String((body as { detail: unknown }).detail)
          : `请求失败（${response.status}）`;
        throw new Error(detail);
      }
      const restored = restoreConversation(await response.json());
      if (requestId !== historyRequestRef.current) return;
      setMessages(restored.messages.length ? restored.messages : welcomeMessage());
      setApproval(restored.approval);
    } catch (error) {
      if (requestId !== historyRequestRef.current) return;
      setMessages(welcomeMessage(`历史会话加载失败：${(error as Error).message}`));
    } finally {
      if (requestId === historyRequestRef.current) setSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    const activeSessionId = browserSessionId(localStorage);
    const storedSessions = browserSessions(localStorage);
    setSessionId(activeSessionId);
    setSessions(storedSessions);
    setCurrentTitle(storedSessions.find((session) => session.id === activeSessionId)?.title || "当前会话");
    void loadSession(activeSessionId);
    fetch(`${apiBase}/api/health`, { cache: "no-store" }).then((response) => setOnline(response.ok)).catch(() => setOnline(false));
  }, [loadSession]);

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
    if (!message || pending || sessionLoading || approval || !sessionId) return;
    setInput("");
    setMessages((current) => [...current, createMessage("user", message)]);
    const currentSession = sessions.find((session) => session.id === sessionId);
    const title = currentSession && !["新会话", "当前会话"].includes(currentSession.title)
      ? currentSession.title
      : sessionTitle(message);
    const updatedSessions = rememberBrowserSession(localStorage, {
      id: sessionId,
      title,
      updatedAt: new Date().toISOString(),
    });
    setSessions(updatedSessions);
    setCurrentTitle(title);
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
    if (pending) return;
    const created = resetBrowserSession(localStorage);
    ++historyRequestRef.current;
    setSessionId(created);
    setCurrentTitle("新会话");
    setSessions(browserSessions(localStorage));
    setSessionLoading(false);
    setApproval(null);
    setMessages(welcomeMessage("新会话已经开始。请告诉我这次想了解或办理什么。"));
    setSidebarOpen(false);
  }

  function openSession(session: BrowserSessionSummary) {
    if (pending || session.id === sessionId) {
      setSidebarOpen(false);
      return;
    }
    activateBrowserSession(localStorage, session.id);
    setSessionId(session.id);
    setCurrentTitle(session.title);
    setSidebarOpen(false);
    void loadSession(session.id);
  }

  return <main className="chat-layout">
    <aside className={`chat-sidebar ${sidebarOpen ? "open" : ""}`}>
      <header className="brand-lockup">
        <span className="brand-mark"><img src={publicPath("/brand-mark.png")} alt="" /></span>
        <div><strong>manzhushaka-agent</strong><small>AGENT WORKSPACE</small></div>
        <button className="icon-button sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="关闭导航"><X size={19} /></button>
      </header>

      <button className="new-chat-button" type="button" onClick={startNewSession} disabled={pending}><MessageSquarePlus size={17} />新建会话</button>

      <nav className="sidebar-section" aria-label="常用对话">
        <p>常用对话</p>
        {starterPrompts.map((prompt) => <button type="button" key={prompt.label} onClick={() => { setSidebarOpen(false); void send(prompt.prompt); }}><prompt.icon size={17} /><span>{prompt.label}</span></button>)}
      </nav>

      <section className="session-history" aria-label="历史会话">
        <header><span>历史会话</span>{sessionLoading && <LoaderCircle className="spin" size={13} aria-label="正在加载会话" />}</header>
        <div className="session-history-list">
          {sessions.length ? sessions.map((session) => <button
            className={session.id === sessionId ? "active" : ""}
            type="button"
            key={session.id}
            disabled={pending}
            onClick={() => openSession(session)}
            aria-current={session.id === sessionId ? "page" : undefined}
          >
            <MessageSquare size={15} />
            <span><strong>{session.title}</strong><small>{sessionTime(session.updatedAt)}</small></span>
          </button>) : <p>暂无历史会话</p>}
        </div>
      </section>

      <div className="sidebar-status"><span className={`status-dot ${online ? "online" : ""}`} /><div><strong>{online ? "AgentOS 已连接" : "AgentOS 连接中"}</strong><small>当前会话已隔离</small></div></div>
    </aside>

    {sidebarOpen && <button className="chat-scrim" type="button" onClick={() => setSidebarOpen(false)} aria-label="关闭导航" />}

    <section className="chat-workspace">
      <header className="chat-header">
        <button className="icon-button menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="打开导航"><Menu size={20} /></button>
        <div className="conversation-title"><strong>{currentTitle}</strong><small><span className={`status-dot ${online ? "online" : ""}`} />{sessionId ? `会话 ${sessionId.slice(0, 8)}` : "正在建立会话"}</small></div>
        <button className="icon-button" type="button" onClick={startNewSession} disabled={pending} title="新建会话" aria-label="新建会话"><MessageSquarePlus size={18} /></button>
      </header>

      <div className="message-list" ref={listRef}>
        <div className="conversation-stream">
          {messages.map((message) => <article className={`message ${message.role} ${message.error ? "error" : ""}`} key={message.id}>
            {message.role === "assistant" && <span className="message-avatar"><img src={publicPath("/brand-mark.png")} alt="" /></span>}
            <div className="message-body">
              <div className="message-label">{message.role === "assistant" ? "manzhushaka-agent" : "你"}</div>
              <div className="message-bubble">{message.content ? <ReactMarkdown>{message.content}</ReactMarkdown> : <span className="typing"><i /><i /><i /></span>}</div>
              {message.cards?.length ? <div className="result-grid">{message.cards.map((card) => card.type === "product"
                ? <section className="result-card product-card" key={`${card.type}-${card.id}`}>
                    {card.imageUrl ? <img src={card.imageUrl} alt={card.title} /> : <div className="image-fallback"><PackageSearch /></div>}
                    <div><small>推荐商品</small><h2>{card.title}</h2><p>{card.description}</p><footer><strong>{card.price}</strong><span>库存 {card.stock}</span><button onClick={() => void send(`我选择商品 ${card.id}，请按 1 件为我准备订单。`)}>{card.actionLabel || "选择"}</button></footer></div>
                  </section>
                : <section className="result-card order-card" key={`${card.type}-${card.id}`}><Check size={22} /><div><small>{card.status}</small><h2>{card.title}</h2><p>{card.description}</p><strong>{card.amount}</strong></div></section>)}</div> : null}
            </div>
          </article>)}

          {!messages.some((message) => message.role === "user") && <div className="starter-prompts">{starterPrompts.map((prompt) => <button type="button" key={prompt.label} onClick={() => void send(prompt.prompt)}><span><prompt.icon size={17} /></span><div><strong>{prompt.label}</strong><small>{prompt.prompt}</small></div></button>)}</div>}
        </div>
      </div>

      <footer className="composer-wrap">
        <form className="composer" onSubmit={(event: FormEvent) => { event.preventDefault(); void send(); }}><label className="sr-only" htmlFor="chat-message">输入业务需求</label><textarea id="chat-message" value={input} disabled={sessionLoading} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={sessionLoading ? "正在加载会话..." : "输入业务需求..."} rows={1} /><button disabled={!input.trim() || pending || sessionLoading || Boolean(approval)} aria-label="发送">{pending || sessionLoading ? <LoaderCircle className="spin" size={19} /> : <Send size={19} />}</button></form>
        <p>重要操作会在执行前请你确认</p>
      </footer>
    </section>

    {approval && <div className="modal-layer"><button className="modal-scrim" aria-label="关闭" onClick={() => void resolveApproval(false)} /><section className="confirm-dialog" role="dialog" aria-modal="true"><header><span><CircleAlert size={20} /></span><button onClick={() => void resolveApproval(false)} aria-label="取消"><X size={18} /></button></header><small>HUMAN CONFIRMATION</small><h2>{approvalTitle}</h2><p>该操作将写入演示业务数据。请确认信息无误后继续，取消不会产生业务记录。</p><div className="confirm-args">{Object.entries(approvalTool?.tool_args || {}).map(([key, value]) => <div key={key}><span>{key}</span><strong>{String(value)}</strong></div>)}</div><footer><button className="secondary-button" onClick={() => void resolveApproval(false)}>取消</button><button className="primary-button" onClick={() => void resolveApproval(true)}><Check size={16} />确认执行</button></footer></section></div>}
  </main>;
}
