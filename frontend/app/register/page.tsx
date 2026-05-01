// app/register/page.tsx
// Purpose: Registration page with client-side validation and premium UI.

'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import * as api from '@/lib/api';
import { t } from '@/lib/i18n';

interface FieldErrors {
    email?: string;
    username?: string;
    password?: string;
    balance?: string;
}

export default function RegisterPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [balance, setBalance] = useState('');
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState<string | null>(null);

    useEffect(() => {
        if (!isLoading && user) router.push('/dashboard');
    }, [user, isLoading, router]);

    const validate = (): boolean => {
        const errs: FieldErrors = {};
        const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const userRx = /^[a-zA-Z0-9_]{3,20}$/;

        if (!emailRx.test(email)) errs.email = 'Enter a valid email address';
        if (!userRx.test(username)) errs.username = '3–20 characters, letters, numbers & underscores';
        if (password.length < 8) errs.password = 'Minimum 8 characters';
        const bal = parseFloat(balance);
        if (isNaN(bal) || bal < 100 || bal > 1_000_000)
            errs.balance = 'Must be between $100 and $1,000,000';
        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        if (!validate()) return;
        setLoading(true);
        try {
            await api.register(email, username, password, parseFloat(balance));
            router.push('/dashboard');
        } catch (err: any) {
            setError(err?.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = (field: string, hasError?: boolean) => ({
        width: '100%',
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${hasError ? 'rgba(255,77,109,0.5)' :
            focused === field ? 'rgba(0,255,135,0.5)' :
                'rgba(255,255,255,0.08)'
            }`,
        color: '#f0f4ff',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 14,
        padding: '13px 16px',
        outline: 'none',
        transition: 'all 0.2s',
        boxShadow: hasError
            ? '0 0 0 3px rgba(255,77,109,0.06)'
            : focused === field
                ? '0 0 0 3px rgba(0,255,135,0.06)'
                : 'none',
        display: 'block',
    });

    const labelStyle = {
        display: 'block',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        color: '#6b7a99',
        letterSpacing: '0.08em',
        marginBottom: 8,
        textTransform: 'uppercase' as const,
    };

    const hintStyle = {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        marginTop: 6,
        display: 'block',
    };

    const FIELDS = [
        {
            id: 'email', label: t('auth.email'), type: 'email',
            value: email, set: setEmail,
            placeholder: 'you@example.com',
            error: fieldErrors.email, hint: null,
        },
        {
            id: 'username', label: t('auth.username'), type: 'text',
            value: username, set: setUsername,
            placeholder: 'trader_pro',
            error: fieldErrors.username,
            hint: '3–20 characters, letters, numbers & underscores',
        },
        {
            id: 'password', label: t('auth.password'), type: 'password',
            value: password, set: setPassword,
            placeholder: '••••••••',
            error: fieldErrors.password,
            hint: 'Minimum 8 characters',
        },
        {
            id: 'balance', label: 'Starting Virtual Balance ($)', type: 'number',
            value: balance, set: setBalance,
            placeholder: 'e.g. 10000',
            error: fieldErrors.balance,
            hint: 'Choose between $100 and $1,000,000',
        },
    ];

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
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>

            <div style={{
                minHeight: '100vh',
                background: '#080b14',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 24px',
                backgroundImage: `
          linear-gradient(rgba(14,165,233,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(14,165,233,0.03) 1px, transparent 1px)
        `,
                backgroundSize: '48px 48px',
            }}>
                <div style={{
                    position: 'fixed', top: '40%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 500, height: 500, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(14,165,233,0.04) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                <div className="fade-up" style={{ width: '100%', maxWidth: 460 }}>
                    <div style={{
                        background: '#0d1120',
                        border: '1px solid rgba(255,255,255,0.08)',
                        padding: 40,
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                            background: 'linear-gradient(90deg, #0ea5e9, #00ff87)',
                        }} />

                        {/* Logo */}
                        <div style={{ textAlign: 'center', marginBottom: 32 }}>
                            <div style={{
                                fontFamily: 'Cabinet Grotesk, sans-serif',
                                fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em',
                            }}>
                                <span style={{ color: '#00ff87' }}>PAPER</span>
                                <span style={{ color: '#f0f4ff' }}>TRADER</span>
                            </div>
                        </div>

                        <h1 style={{
                            fontFamily: 'Cabinet Grotesk, sans-serif',
                            fontWeight: 800, fontSize: 28, letterSpacing: '-0.03em', marginBottom: 6,
                        }}>
                            Create your account
                        </h1>
                        <p style={{ color: '#6b7a99', fontSize: 14, fontWeight: 500, marginBottom: 32 }}>
                            Start practicing trading today
                        </p>

                        <form onSubmit={handleSubmit} noValidate>
                            {FIELDS.map(f => (
                                <div key={f.id} style={{ marginBottom: 20 }}>
                                    <label htmlFor={f.id} style={labelStyle}>{f.label}</label>
                                    <input
                                        id={f.id}
                                        type={f.type}
                                        required
                                        value={f.value}
                                        onChange={e => { f.set(e.target.value); if (fieldErrors[f.id as keyof FieldErrors]) setFieldErrors(p => ({ ...p, [f.id]: undefined })); }}
                                        onFocus={() => setFocused(f.id)}
                                        onBlur={() => setFocused(null)}
                                        style={inputStyle(f.id, !!f.error)}
                                        placeholder={f.placeholder}
                                        disabled={loading}
                                        min={f.id === 'balance' ? 100 : undefined}
                                        max={f.id === 'balance' ? 1000000 : undefined}
                                    />
                                    {f.error ? (
                                        <span style={{ ...hintStyle, color: '#ff4d6d' }}>⚠ {f.error}</span>
                                    ) : f.hint ? (
                                        <span style={{ ...hintStyle, color: '#6b7a99' }}>{f.hint}</span>
                                    ) : null}
                                </div>
                            ))}

                            {error && (
                                <div style={{
                                    background: 'rgba(255,77,109,0.08)',
                                    border: '1px solid rgba(255,77,109,0.3)',
                                    color: '#ff4d6d',
                                    padding: '10px 14px',
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontSize: 12,
                                    marginBottom: 20,
                                }}>
                                    ⚠ {error}
                                </div>
                            )}

                            <button type="submit" className="submit-btn" disabled={loading} style={{ marginTop: 8 }}>
                                {loading ? <><div className="spinner" /> Creating account...</> : 'Create Account →'}
                            </button>
                        </form>

                        <p style={{ textAlign: 'center', fontSize: 14, color: '#6b7a99', fontWeight: 500, marginTop: 28 }}>
                            Already have an account?{' '}
                            <Link href="/login" style={{
                                color: '#00ff87', textDecoration: 'none', fontWeight: 700,
                            }}>
                                Sign in →
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}