import React from 'react';
import { Bot, Sun, Moon, RefreshCw, LogOut, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Header({ agentStatus, theme, toggleTheme, onRefreshHealth }) {
  const { user, logout, isAuthenticated } = useAuth();
  const isOnline = agentStatus?.status === 'ok';

  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-icon">
          <Bot size={22} />
        </div>
        <div>
          <h1 className="brand-title">Agent-0 Studio</h1>
          <p className="brand-subtitle">Vertex AI Agent Engine (europe-west3)</p>
        </div>
      </div>

      <div className="header-controls">
        <div className={`status-badge ${isOnline ? 'online' : 'offline'}`} title="Agent Engine Connection Status">
          <span className="status-dot"></span>
          <span>{isOnline ? 'Vertex AI Agent Engine: Active' : 'Offline'}</span>
          <button 
            className="icon-btn" 
            style={{ width: '20px', height: '20px', border: 'none', marginLeft: '4px' }} 
            onClick={onRefreshHealth}
            title="Refresh engine status"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {isAuthenticated && user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.3rem 0.8rem',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.8rem',
              color: 'var(--text-primary)',
            }}>
              {user.picture ? (
                <img 
                  src={user.picture} 
                  alt={user.name || user.email} 
                  style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                />
              ) : (
                <ShieldCheck size={14} color="var(--accent-success)" />
              )}
              <span style={{ fontWeight: 500 }}>{user.name || user.email}</span>
            </div>

            <button 
              className="icon-btn" 
              onClick={logout} 
              title="Sign Out of Google"
              style={{ color: 'var(--accent-error)' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}

        <button 
          className="icon-btn" 
          onClick={toggleTheme} 
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}
