/* The sample image URL is intentionally replaceable by the Builder Skill. */
/* eslint-disable @next/next/no-img-element */
"use client";

import { BadgeDollarSign, CircleHelp, Gift, LoaderCircle, Menu, MessageSquare, MessageSquarePlus, Pencil, Send, Trash2, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { TEMPLATE_AGENT_ID, type DemoCard } from "@template/shared";
import { CardRenderer } from "@/components/cards/CardRenderer";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { streamAgentRun } from "@/lib/agent-run";
import { restoreConversation, type HistoricalApproval } from "@/lib/chat-history";
import { publicPath } from "@/lib/public-path";
import type { BrowserSessionSummary } from "@/lib/session";
import { createUuid } from "@/lib/uuid";

type Message = { id: string; role: "user" | "assistant"; content: string; cards?: DemoCard[]; pending?: boolean; error?: boolean };
type Approval = HistoricalApproval;

const apiBase = publicPath("/agent-api").replace(/\/$/, "");
const sessionApi = publicPath("/api/chat/sessions").replace(/\/$/, "");
const starterPrompts = [
  { label: "送礼推荐", prompt: "有哪些适合送人的商品？", icon: Gift },
  { label: "预算选品", prompt: "推荐一个 200 元以内的商品", icon: BadgeDollarSign },
  { label: "能力介绍", prompt: "介绍一下你能帮我完成什么", icon: CircleHelp },
];

function createMessage(role: Message["role"], content: string, extra: Partial<Message> = {}): Message {
  return { id: createUuid(), role, content, ...extra };
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
    async function initialize() {
      setSessionLoading(true);
      try {
        const response = await fetch(publicPath("/api/chat/bootstrap"), { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || "会话初始化失败");
        let storedSessions = Array.isArray(body.sessions) ? body.sessions as BrowserSessionSummary[] : [];
        if (!storedSessions.length) {
          const createdResponse = await fetch(sessionApi, { method: "POST" });
          const created = await createdResponse.json();
          if (!createdResponse.ok) throw new Error(created.message || "会话创建失败");
          storedSessions = [created];
        }
        const active = storedSessions[0];
        setSessions(storedSessions);
        setSessionId(active.id);
        setCurrentTitle(active.title);
        await loadSession(active.id);
      } catch (initializeError) {
        setMessages(welcomeMessage(`会话初始化失败：${(initializeError as Error).message}`));
      } finally {
        setSessionLoading(false);
      }
    }
    void initialize();
    fetch(`${apiBase}/api/health`, { cache: "no-store" }).then((response) => setOnline(response.ok)).catch(() => setOnline(false));
  }, [loadSession]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, approval]);

  function updateAssistant(id: string, update: (message: Message) => Message) {
    setMessages((current) => current.map((message) => message.id === id ? update(message) : message));
  }

  async function requestRun(path: string, values: Record<string, unknown>) {
    const assistant = createMessage("assistant", "", { pending: true });
    setMessages((current) => [...current, assistant]);
    const run = await streamAgentRun(`${apiBase}${path}`, values, (content) => {
      updateAssistant(assistant.id, (message) => ({ ...message, content: message.content + content }));
    });
    updateAssistant(assistant.id, (message) => ({
      ...message,
      content: message.content || run.content,
      cards: run.cards,
      pending: false,
    }));
    const pendingTools = run.tools.filter((tool) => tool.requires_confirmation && tool.confirmed == null);
    if (run.status === "PAUSED" && pendingTools.length) {
      setApproval({ runId: run.runId, tools: run.tools, pendingTools });
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
    const updatedAt = new Date().toISOString();
    setSessions((current) => [{ id: sessionId, title, updatedAt }, ...current.filter((session) => session.id !== sessionId)]);
    setCurrentTitle(title);
    if (title !== currentSession?.title) {
      void fetch(`${sessionApi}/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
    }
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

  async function startNewSession() {
    if (pending) return;
    setSessionLoading(true);
    try {
      const response = await fetch(sessionApi, { method: "POST" });
      const created = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(created.message || "会话创建失败");
      ++historyRequestRef.current;
      setSessionId(created.id);
      setCurrentTitle(created.title);
      setSessions((current) => [created, ...current]);
      setApproval(null);
      setMessages(welcomeMessage("新会话已经开始。请告诉我这次想了解或办理什么。"));
      setSidebarOpen(false);
    } catch (createError) {
      setMessages((current) => [...current, createMessage("assistant", `会话创建失败：${(createError as Error).message}`, { error: true })]);
    } finally {
      setSessionLoading(false);
    }
  }

  function openSession(session: BrowserSessionSummary) {
    if (pending || session.id === sessionId) {
      setSidebarOpen(false);
      return;
    }
    setSessionId(session.id);
    setCurrentTitle(session.title);
    setSidebarOpen(false);
    void loadSession(session.id);
  }

  async function renameSession(session: BrowserSessionSummary) {
    const title = window.prompt("新的会话名称", session.title)?.trim();
    if (!title || title === session.title) return;
    const response = await fetch(`${sessionApi}/${encodeURIComponent(session.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title }) });
    if (!response.ok) return;
    setSessions((current) => current.map((item) => item.id === session.id ? { ...item, title, updatedAt: new Date().toISOString() } : item));
    if (session.id === sessionId) setCurrentTitle(title);
  }

  async function deleteSession(session: BrowserSessionSummary) {
    if (!window.confirm(`删除会话“${session.title}”及其全部记录？`)) return;
    const response = await fetch(`${sessionApi}/${encodeURIComponent(session.id)}`, { method: "DELETE" });
    if (!response.ok) return;
    const remaining = sessions.filter((item) => item.id !== session.id);
    setSessions(remaining);
    if (session.id === sessionId) {
      if (remaining.length) openSession(remaining[0]);
      else await startNewSession();
    }
  }

  return <main className="chat-layout">
    <aside className={`chat-sidebar ${sidebarOpen ? "open" : ""}`}>
      <header className="brand-lockup">
        <span className="brand-mark"><img src={publicPath("/brand-mark.png")} alt="" /></span>
        <div><strong>manzhushaka-agent</strong><small>AGENT WORKSPACE</small></div>
        <button className="icon-button sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="关闭导航"><X size={19} /></button>
      </header>

      <button className="new-chat-button" type="button" onClick={() => void startNewSession()} disabled={pending}><MessageSquarePlus size={17} />新建会话</button>

      <nav className="sidebar-section" aria-label="常用对话">
        <p>常用对话</p>
        {starterPrompts.map((prompt) => <button type="button" key={prompt.label} disabled={pending || sessionLoading || Boolean(approval)} onClick={() => { setSidebarOpen(false); void send(prompt.prompt); }}><prompt.icon size={17} /><span>{prompt.label}</span></button>)}
      </nav>

      <section className="session-history" aria-label="历史会话">
        <header><span>历史会话</span>{sessionLoading && <LoaderCircle className="spin" size={13} aria-label="正在加载会话" />}</header>
        <div className="session-history-list">
          {sessions.length ? sessions.map((session) => <div className={`session-row ${session.id === sessionId ? "active" : ""}`} key={session.id}><button className="session-open" type="button" disabled={pending} onClick={() => openSession(session)} aria-current={session.id === sessionId ? "page" : undefined}><MessageSquare size={15} /><span><strong>{session.title}</strong><small>{sessionTime(session.updatedAt)}</small></span></button><div className="session-actions"><button type="button" onClick={() => void renameSession(session)} title="重命名" aria-label={`重命名 ${session.title}`}><Pencil size={13} /></button><button type="button" onClick={() => void deleteSession(session)} title="删除" aria-label={`删除 ${session.title}`}><Trash2 size={13} /></button></div></div>) : <p>暂无历史会话</p>}
        </div>
      </section>

      <div className="sidebar-status"><span className={`status-dot ${online ? "online" : ""}`} /><div><strong>{online ? "AgentOS 已连接" : "AgentOS 连接中"}</strong><small>当前会话已隔离</small></div></div>
    </aside>

    {sidebarOpen && <button className="chat-scrim" type="button" onClick={() => setSidebarOpen(false)} aria-label="关闭导航" />}

    <section className="chat-workspace">
      <header className="chat-header">
        <button className="icon-button menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="打开导航"><Menu size={20} /></button>
        <div className="conversation-title"><strong>{currentTitle}</strong><small><span className={`status-dot ${online ? "online" : ""}`} />{sessionId ? `会话 ${sessionId.slice(0, 8)}` : "正在建立会话"}</small></div>
        <button className="icon-button" type="button" onClick={() => void startNewSession()} disabled={pending} title="新建会话" aria-label="新建会话"><MessageSquarePlus size={18} /></button>
      </header>

      <div className="message-list" ref={listRef}>
        <div className="conversation-stream">
          {messages.map((message) => <article className={`message ${message.role} ${message.error ? "error" : ""}`} key={message.id}>
            {message.role === "assistant" && <span className="message-avatar"><img src={publicPath("/brand-mark.png")} alt="" /></span>}
            <div className="message-body">
              <div className="message-label">{message.role === "assistant" ? "manzhushaka-agent" : "你"}</div>
              <div className="message-bubble">{message.content ? <ReactMarkdown>{message.content}</ReactMarkdown> : <span className="typing"><i /><i /><i /></span>}</div>
              {message.cards?.length ? <div className="result-grid">{message.cards.map((card) => <CardRenderer key={`${card.type}-${card.id}`} card={card} onSelectProduct={(sku) => void send(`我选择商品 ${sku}，请按 1 件为我准备订单。`)} />)}</div> : null}
            </div>
          </article>)}

          {!messages.some((message) => message.role === "user") && <div className="starter-prompts">{starterPrompts.map((prompt) => <button type="button" key={prompt.label} disabled={pending || sessionLoading || Boolean(approval)} onClick={() => void send(prompt.prompt)}><span><prompt.icon size={17} /></span><div><strong>{prompt.label}</strong><small>{prompt.prompt}</small></div></button>)}</div>}
        </div>
      </div>

      <footer className="composer-wrap">
        <form className="composer" onSubmit={(event: FormEvent) => { event.preventDefault(); void send(); }}><label className="sr-only" htmlFor="chat-message">输入业务需求</label><textarea id="chat-message" value={input} disabled={sessionLoading} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={sessionLoading ? "正在加载会话..." : "输入业务需求..."} rows={1} /><button disabled={!input.trim() || pending || sessionLoading || Boolean(approval)} aria-label="发送">{pending || sessionLoading ? <LoaderCircle className="spin" size={19} /> : <Send size={19} />}</button></form>
        <p>重要操作会在执行前请你确认</p>
      </footer>
    </section>

    {approval && <ConfirmationDialog approval={approval} onResolve={(confirmed) => void resolveApproval(confirmed)} />}
  </main>;
}
