import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Trash2, Sparkles } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { sendChatMessage } from '../services/api';

const QUICK_PROMPTS = [
  "Solve 3x^2 + 12x - 36 = 0 step-by-step",
  "Summarize the core benefits of deploying AI agents to Vertex AI",
  "Explain quantum computing principles with simple analogies",
];

export default function ChatView({ sessionId, setSessionId }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'agent',
      content: "Hello! I am your **Google ADK Reasoning Agent**. I can summarize complex texts, solve math calculations step-by-step, and engage in multi-turn reasoning conversations. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMessageId = `user_${Date.now()}`;
    const userMessage = { id: userMessageId, role: 'user', content: text };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const data = await sendChatMessage({
        message: text,
        userId: 'web_user',
        sessionId: sessionId,
      });

      const agentMessage = {
        id: `agent_${Date.now()}`,
        role: 'agent',
        content: data.response,
      };

      setMessages((prev) => [...prev, agentMessage]);
    } catch (err) {
      setError(err.message);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'agent',
          content: `⚠️ **Error**: Failed to get response from agent. (${err.message})`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSession = () => {
    const newSessionId = `session_${Math.random().toString(36).substring(2, 9)}`;
    setSessionId(newSessionId);
    setMessages([
      {
        id: 'new_welcome',
        role: 'agent',
        content: "Session reset! Starting a fresh reasoning conversation.",
      },
    ]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="glass-card chat-container">
      <div className="panel-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Session:</span>
          <code style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>{sessionId}</code>
        </div>
        <button className="icon-btn" onClick={handleClearSession} title="Clear Session & Reset Memory">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="messages-list">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-item ${msg.role}`}>
            <div className={`message-avatar ${msg.role}`}>
              {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
            </div>
            <div className="message-bubble">
              <MarkdownRenderer content={msg.content} />
            </div>
          </div>
        ))}

        {loading && (
          <div className="message-item agent">
            <div className="message-avatar agent">
              <Bot size={18} />
            </div>
            <div className="message-bubble" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="spinner" />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Reasoning...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0 1rem 0.75rem', flexWrap: 'wrap' }}>
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              className="chip"
              onClick={() => handleSend(prompt)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Sparkles size={12} />
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div className="chat-input-bar">
        <textarea
          className="chat-input"
          placeholder="Ask a question, request reasoning, or paste text... (Shift+Enter for newline)"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="btn-primary" onClick={() => handleSend()} disabled={loading || !input.trim()}>
          <Send size={16} />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
}
