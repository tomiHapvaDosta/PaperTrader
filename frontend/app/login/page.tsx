// app/login/page.tsx
// Purpose: Login page — premium neo-brutalist auth card.

'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';

export default function LoginPage() {
    const { user, isLoading, login } = useAuth();
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState<string | null>(null);

    useEffect(() => {
        if (!isLoading && user) router.push('/dashboard');
    }, [user, isLoading, router]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            router.push('/dashboard');
        } catch (err: any) {
            setError(err?.message || t('auth.invalid_credentials'));
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = (field: string) => ({
        width: '100%',
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${focused === field ? 'rgba(0,255,135,0.5)' : 'rgba(255,255,255,0.08)'}`,
        color: '#f0f4ff',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 14,
        padding: '13px 16px',
        outline: 'none',
        transition: 'all 0.2s',
        boxShadow: focused === field ? '0 0 0 3px rgba(0,255,135,0.06)' : 'none',
        display: 'block',
    });

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
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: #f0f4ff;
          -webkit-box-shadow: 0 0 0px 1000px #0d1120 inset;
          transition: background-color 5000s ease-in-out 0s;
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
          letter-spacing: 0.02em;
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

        @keyframes pulse-dot {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.3); }
        }
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

                {/* Glow */}
                <div style={{
                    position: 'fixed', top: '40%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 400, height: 400, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0,255,135,0.05) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                <div className="fade-up" style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
                    {/* Card */}
                    <div style={{
                        background: '#0d1120',
                        border: '1px solid rgba(255,255,255,0.08)',
                        padding: 40,
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        {/* Top accent line */}
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                            background: 'linear-gradient(90deg, var(--green, #00ff87), #0ea5e9)',
                        }} />

                        {/* Logo */}
                        <div style={{ marginBottom: 32, textAlign: 'center' }}>
                            <div style={{
                                fontFamily: 'Cabinet Grotesk, sans-serif',
                                fontWeight: 800,
                                fontSize: 22,
                                letterSpacing: '-0.02em',
                                marginBottom: 4,
                            }}>
                                <span style={{ color: '#00ff87' }}>PAPER</span>
                                <span style={{ color: '#f0f4ff' }}>TRADER</span>
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                marginTop: 4,
                            }}>
                                <div style={{
                                    width: 6, height: 6, borderRadius: '50%', background: '#00ff87',
                                    animation: 'pulse-dot 2s ease-in-out infinite',
                                }} />
                                <span style={{
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontSize: 10,
                                    color: '#6b7a99',
                                    letterSpacing: '0.1em',
                                }}>
                                    MARKETS OPEN
                                </span>
                            </div>
                        </div>

                        <h1 style={{
                            fontFamily: 'Cabinet Grotesk, sans-serif',
                            fontWeight: 800,
                            fontSize: 28,
                            letterSpacing: '-0.03em',
                            marginBottom: 6,
                        }}>
                            {t('auth.login')}
                        </h1>
                        <p style={{ color: '#6b7a99', fontSize: 14, fontWeight: 500, marginBottom: 32 }}>
                            Sign in to your account
                        </p>

                        <form onSubmit={handleSubmit}>
                            {/* Email */}
                            <div style={{ marginBottom: 16 }}>
                                <label style={{
                                    display: 'block',
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontSize: 11,
                                    color: '#6b7a99',
                                    letterSpacing: '0.08em',
                                    marginBottom: 8,
                                    textTransform: 'uppercase',
                                }}>
                                    {t('auth.email')}
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    onFocus={() => setFocused('email')}
                                    onBlur={() => setFocused(null)}
                                    style={inputStyle('email')}
                                    placeholder="you@example.com"
                                    disabled={loading}
                                />
                            </div>

                            {/* Password */}
                            <div style={{ marginBottom: 8 }}>
                                <label style={{
                                    display: 'block',
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontSize: 11,
                                    color: '#6b7a99',
                                    letterSpacing: '0.08em',
                                    marginBottom: 8,
                                    textTransform: 'uppercase',
                                }}>
                                    {t('auth.password')}
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    onFocus={() => setFocused('password')}
                                    onBlur={() => setFocused(null)}
                                    style={inputStyle('password')}
                                    placeholder="••••••••"
                                    disabled={loading}
                                />
                            </div>

                            {/* Forgot password */}
                            <div style={{ textAlign: 'right', marginBottom: 24 }}>
                                <Link href="/forgot-password" style={{
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontSize: 11,
                                    color: '#6b7a99',
                                    textDecoration: 'none',
                                    letterSpacing: '0.04em',
                                    transition: 'color 0.2s',
                                }}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#00ff87')}
                                    onMouseLeave={e => (e.currentTarget.style.color = '#6b7a99')}
                                >
                                    {t('auth.forgot_password')}
                                </Link>
                            </div>

                            {/* Error */}
                            {error && (
                                <div style={{
                                    background: 'rgba(255,77,109,0.08)',
                                    border: '1px solid rgba(255,77,109,0.3)',
                                    color: '#ff4d6d',
                                    padding: '10px 14px',
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontSize: 12,
                                    marginBottom: 20,
                                    letterSpacing: '0.02em',
                                }}>
                                    ⚠ {error}
                                </div>
                            )}

                            <button type="submit" className="submit-btn" disabled={loading}>
                                {loading ? <><div className="spinner" /> Signing in...</> : 'Sign In →'}
                            </button>
                        </form>

                        {/* Divider */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 16,
                            margin: '28px 0',
                        }}>
                            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6b7a99' }}>
                                OR
                            </span>
                            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                        </div>

                        <p style={{ textAlign: 'center', fontSize: 14, color: '#6b7a99', fontWeight: 500 }}>
                            Don't have an account?{' '}
                            <Link href="/register" style={{
                                color: '#00ff87',
                                textDecoration: 'none',
                                fontWeight: 700,
                                transition: 'opacity 0.2s',
                            }}
                                onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                            >
                                Create one →
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}