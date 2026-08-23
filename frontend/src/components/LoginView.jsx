import React, { useState } from 'react';
import { Bot, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export default function LoginView() {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse.credential) {
      setError('No credential received from Google.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await loginWithGoogle(credentialResponse.credential);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google Sign-In was cancelled or failed.');
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 180px)',
      padding: '1rem',
    }}>
      <div className="glass-card" style={{ maxWidth: '460px', width: '100%', padding: '2.5rem', textAlign: 'center' }}>
        <div className="brand-icon" style={{ margin: '0 auto 1.25rem', width: '56px', height: '56px' }}>
          <Bot size={32} />
        </div>

        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.4rem' }}>
          Sign In to Agent-0
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Access restricted to authorized Google accounts (<code style={{ color: 'var(--accent-primary)' }}>iman.rahmani@gmail.com</code>).
        </p>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.85rem 1rem',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-error)',
            fontSize: '0.85rem',
            textAlign: 'left',
            marginBottom: '1.75rem',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', padding: '0.75rem' }}>
              <div className="spinner" />
              <span>Verifying authorization...</span>
            </div>
          ) : (
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="filled_blue"
              size="large"
              shape="pill"
              text="signin_with"
              logo_alignment="left"
            />
          )}
        </div>

        <div style={{
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          alignItems: 'center',
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <ShieldCheck size={14} color="var(--accent-success)" />
            <span>Protected by Google Identity & Vertex AI Reasoning Engine</span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <Sparkles size={14} color="var(--accent-purple)" />
            <span>Connected to Region: europe-west3</span>
          </div>
        </div>
      </div>
    </div>
  );
}
