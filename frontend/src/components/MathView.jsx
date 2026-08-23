import React, { useState } from 'react';
import { Calculator, Sparkles, Copy, Check, ListOrdered } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { solveMath } from '../services/api';

const SAMPLE_PROBLEMS = [
  "Solve for x: 4x^2 - 16 = 0",
  "Calculate the compound interest on $5,000 at 6% annually for 4 years.",
  "Find the integral of (3x^2 + 2x - 5) dx from 0 to 3.",
  "If a triangle has sides 7, 24, and 25, is it a right triangle? Prove it.",
];

export default function MathView() {
  const [problem, setProblem] = useState('');
  const [showSteps, setShowSteps] = useState(true);
  const [solution, setSolution] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSolve = async (problemToSolve) => {
    const prob = problemToSolve || problem;
    if (!prob.trim() || loading) return;
    setLoading(true);

    try {
      const data = await solveMath({
        problem: prob,
        showSteps,
        userId: 'web_user',
      });
      setSolution(data.response);
    } catch (err) {
      setSolution(`⚠️ **Calculation Error**: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!solution) return;
    navigator.clipboard.writeText(solution);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card">
      <div className="tool-view">
        {/* Left Panel: Problem Input */}
        <div>
          <div className="panel-header">
            <h2 className="panel-title">
              <Calculator size={18} color="var(--accent-primary)" />
              <span>Math Problem / Equation</span>
            </h2>
          </div>

          <textarea
            className="tool-textarea"
            style={{ height: '160px' }}
            placeholder="Enter math problem, algebra, calculus, or arithmetic query..."
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              id="stepsCheckbox"
              checked={showSteps}
              onChange={(e) => setShowSteps(e.target.checked)}
              style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="stepsCheckbox" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Show detailed step-by-step reasoning
            </label>
          </div>

          <button
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginBottom: '1.25rem' }}
            onClick={() => handleSolve()}
            disabled={loading || !problem.trim()}
          >
            {loading ? <div className="spinner" /> : <Sparkles size={16} />}
            <span>{loading ? 'Calculating...' : 'Solve Problem'}</span>
          </button>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              Sample Problems:
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {SAMPLE_PROBLEMS.map((sample, idx) => (
                <button
                  key={idx}
                  className="chip"
                  style={{ textAlign: 'left', borderRadius: 'var(--radius-sm)' }}
                  onClick={() => {
                    setProblem(sample);
                    handleSolve(sample);
                  }}
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Solution */}
        <div>
          <div className="panel-header">
            <h2 className="panel-title">
              <ListOrdered size={18} color="var(--accent-success)" />
              <span>Step-by-Step Solution</span>
            </h2>
            {solution && (
              <button className="icon-btn" onClick={handleCopy} title="Copy Solution">
                {copied ? <Check size={16} color="var(--accent-success)" /> : <Copy size={16} />}
              </button>
            )}
          </div>

          <div className="result-box" style={{ minHeight: '380px' }}>
            {loading ? (
              <div className="empty-state">
                <div className="spinner" style={{ width: '28px', height: '28px' }} />
                <span>Computing reasoning and intermediate steps...</span>
              </div>
            ) : solution ? (
              <MarkdownRenderer content={solution} />
            ) : (
              <div className="empty-state">
                <Calculator size={32} />
                <p>Calculated solution and steps will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
