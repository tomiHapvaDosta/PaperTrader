// app/forgot-password/page.tsx
// Purpose: Forgot password page — v1 shows success message without sending email.

'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { t } from '@/lib/i18n';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // Simulate network delay — no actual email sent in v1
        await new Promise(r => setTimeout(r, 800));
        setLoading(false);
        setSubmitted(true);
    };

    return (
        <>
            <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700,500&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080b14; color: #f0f4ff; font-family: 'Cabinet Grotesk', sans-serif; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(8,11,20,0.3);
          border-top-color: #080b14;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        input:-webkit-autofill,
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: #f0f4ff;
          -webkit-box-shadow: 0 0 0px 1000px #0d1120 inset;
        }
        .submit-btn {
          width: 100%;
          background: #00ff87;
          color: #080b14;
          border: none;
          padding: 14px;
          font-family: 'Cabinet Grotesk', sans-serif;
          font-weight: 800;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
        }
        .submit-btn:hover:not(:disabled) {
          background: #33ffaa;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(0,255,135,0.25);
        }
        .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        @keyframes checkPop {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        .check-pop { animation: checkPop 0.5s cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>

            <div style={{
                minHeight: '100vh',
                background: '#080b14',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                backgroundImage: `
          linear-gradient(rgba(14,165,233,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(14,165,233,0.03) 1px, transparent 1px)
        `,
                backgroundSize: '48px 48px',
            }}>
                <div style={{
                    position: 'fixed', top: '40%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 400, height: 400, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0,255,135,0.04) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                <div className="fade-up" style={{ width: '100%', maxWidth: 420 }}>
                    <div style={{
                        background: '#0d1120',
                        border: '1px solid rgba(255,255,255,0.08)',
                        padding: 40,
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                            background: 'linear-gradient(90deg, #f59e0b, #ff4d6d)',
                        }} />

                        {/* Back link */}
                        <Link href="/login" style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 12,
                            color: '#6b7a99',
                            textDecoration: 'none',
                            letterSpacing: '0.04em',
                            marginBottom: 32,
                            transition: 'color 0.2s',
                        }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#00ff87')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#6b7a99')}
                        >
                            ← {t('auth.back_to_login')}
                        </Link>

                        {!submitted ? (
                            <>
                                <h1 style={{
                                    fontFamily: 'Cabinet Grotesk, sans-serif',
                                    fontWeight: 800, fontSize: 28, letterSpacing: '-0.03em', marginBottom: 8,
                                }}>
                                    {t('auth.reset_password')}
                                </h1>
                                <p style={{ color: '#6b7a99', fontSize: 14, fontWeight: 500, marginBottom: 32, lineHeight: 1.6 }}>
                                    Enter your email and we'll send reset instructions.
                                </p>

                                <form onSubmit={handleSubmit}>
                                    <div style={{ marginBottom: 24 }}>
                                        <label style={{
                                            display: 'block',
                                            fontFamily: 'JetBrains Mono, monospace',
                                            fontSize: 11, color: '#6b7a99',
                                            letterSpacing: '0.08em', marginBottom: 8,
                                            textTransform: 'uppercase',
                                        }}>
                                            {t('auth.email')}
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            onFocus={() => setFocused(true)}
                                            onBlur={() => setFocused(false)}
                                            disabled={loading}
                                            placeholder="you@example.com"
                                            style={{
                                                width: '100%',
                                                background: 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${focused ? 'rgba(0,255,135,0.5)' : 'rgba(255,255,255,0.08)'}`,
                                                color: '#f0f4ff',
                                                fontFamily: 'JetBrains Mono, monospace',
                                                fontSize: 14,
                                                padding: '13px 16px',
                                                outline: 'none',
                                                transition: 'all 0.2s',
                                                boxShadow: focused ? '0 0 0 3px rgba(0,255,135,0.06)' : 'none',
                                                display: 'block',
                                            }}
                                        />
                                    </div>

                                    <button type="submit" className="submit-btn" disabled={loading}>
                                        {loading ? <><div className="spinner" /> Sending...</> : 'Send Reset Link →'}
                                    </button>
                                </form>
                            </>
                        ) : (
                            /* Success state */
                            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                <div className="check-pop" style={{
                                    width: 64, height: 64,
                                    background: 'rgba(0,255,135,0.1)',
                                    border: '1px solid rgba(0,255,135,0.3)',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 24px',
                                }}>
                                    <svg width="28" height="28" fill="none" stroke="#00ff87" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>

                                <h2 style={{
                                    fontFamily: 'Cabinet Grotesk, sans-serif',
                                    fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', marginBottom: 12,
                                }}>
                                    Check your inbox
                                </h2>
                                <p style={{
                                    color: '#6b7a99', fontSize: 14, lineHeight: 1.7,
                                    fontWeight: 500, marginBottom: 32,
                                }}>
                                    If an account exists with that email, you will receive reset instructions shortly.
                                </p>

                                <Link href="/login" style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    color: '#f0f4ff',
                                    fontFamily: 'Cabinet Grotesk, sans-serif',
                                    fontWeight: 700,
                                    fontSize: 14,
                                    padding: '12px 28px',
                                    textDecoration: 'none',
                                    transition: 'all 0.2s',
                                    letterSpacing: '0.01em',
                                }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,255,135,0.4)';
                                        (e.currentTarget as HTMLElement).style.color = '#00ff87';
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
                                        (e.currentTarget as HTMLElement).style.color = '#f0f4ff';
                                    }}
                                >
                                    ← {t('auth.back_to_login')}
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}