import React, { useState } from 'react';
import { FileText, Sparkles, Copy, Check } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { summarizeText } from '../services/api';

const STYLES = [
  { id: 'bullet points', label: 'Bullet Points' },
  { id: 'executive summary', label: 'Executive Summary' },
  { id: 'one-paragraph', label: 'One Paragraph' },
  { id: 'key takeaways', label: 'Key Takeaways' },
];

export default function SummarizeView() {
  const [text, setText] = useState('');
  const [style, setStyle] = useState('bullet points');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSummarize = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);

    try {
      const data = await summarizeText({
        text,
        style,
        userId: 'web_user',
      });
      setSummary(data.response);
    } catch (err) {
      setSummary(`⚠️ **Summarization Error**: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card">
      <div className="tool-view">
        {/* Left Panel: Input */}
        <div>
          <div className="panel-header">
            <h2 className="panel-title">
              <FileText size={18} color="var(--accent-primary)" />
              <span>Source Text</span>
            </h2>
          </div>

          <div className="style-selector">
            {STYLES.map((s) => (
              <button
                key={s.id}
                className={`chip ${style === s.id ? 'active' : ''}`}
                onClick={() => setStyle(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <textarea
            className="tool-textarea"
            placeholder="Paste article, document, or notes here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <button
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={handleSummarize}
            disabled={loading || !text.trim()}
          >
            {loading ? <div className="spinner" /> : <Sparkles size={16} />}
            <span>{loading ? 'Summarizing...' : 'Generate Summary'}</span>
          </button>
        </div>

        {/* Right Panel: Output */}
        <div>
          <div className="panel-header">
            <h2 className="panel-title">
              <Sparkles size={18} color="var(--accent-success)" />
              <span>Summary Output</span>
            </h2>
            {summary && (
              <button className="icon-btn" onClick={handleCopy} title="Copy Summary">
                {copied ? <Check size={16} color="var(--accent-success)" /> : <Copy size={16} />}
              </button>
            )}
          </div>

          <div className="result-box">
            {loading ? (
              <div className="empty-state">
                <div className="spinner" style={{ width: '28px', height: '28px' }} />
                <span>Extracting core insights and synthesizing...</span>
              </div>
            ) : summary ? (
              <MarkdownRenderer content={summary} />
            ) : (
              <div className="empty-state">
                <FileText size={32} />
                <p>Generated summary will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
