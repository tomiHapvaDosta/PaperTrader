// app/page.tsx
// Purpose: Public landing page — neo-brutalist fintech aesthetic.
// Vibrant, kinetic, premium. Redirects to /dashboard if logged in.

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const TICKER_ITEMS = [
    { sym: 'AAPL', val: '+2.34%', pos: true },
    { sym: 'BTC', val: '+5.12%', pos: true },
    { sym: 'TSLA', val: '-1.87%', pos: false },
    { sym: 'SPY', val: '+0.91%', pos: true },
    { sym: 'ETH', val: '+3.44%', pos: true },
    { sym: 'NVDA', val: '+4.20%', pos: true },
    { sym: 'GOLD', val: '-0.33%', pos: false },
    { sym: 'EUR/USD', val: '+0.15%', pos: true },
    { sym: 'QQQ', val: '+1.22%', pos: true },
    { sym: 'AMZN', val: '-0.76%', pos: false },
];

const FEATURES = [
    {
        icon: (
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
        ),
        title: 'Live Market Data',
        desc: 'Real prices from global markets, updated in real time across every asset class.',
        accent: '#00ff87',
    },
    {
        icon: (
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
        ),
        title: 'Risk-Free Practice',
        desc: 'Trade with virtual money. Make mistakes, learn from them, pay nothing.',
        accent: '#0ea5e9',
    },
    {
        icon: (
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
        ),
        title: 'All Asset Classes',
        desc: 'Stocks, ETFs, crypto, forex and commodities — one platform, zero friction.',
        accent: '#ff4d6d',
    },
];

const STATS = [
    { value: '5+', label: 'Asset Classes' },
    { value: 'Real-Time', label: 'Market Data' },
    { value: '100%', label: 'Risk Free' },
];

export default function LandingPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (!isLoading && user) router.push('/dashboard');
    }, [user, isLoading, router]);

    const scrollToFeatures = () => {
        document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <>
            <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700,500&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:     #080b14;
          --surf:   #0d1120;
          --surf2:  #111827;
          --border: rgba(255,255,255,0.08);
          --green:  #00ff87;
          --red:    #ff4d6d;
          --blue:   #0ea5e9;
          --text:   #f0f4ff;
          --muted:  #6b7a99;
        }

        body { background: var(--bg); color: var(--text); font-family: 'Cabinet Grotesk', sans-serif; }

        .mono { font-family: 'JetBrains Mono', monospace; }

        /* ── Ticker ── */
        .ticker-wrap {
          overflow: hidden;
          background: var(--surf);
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          padding: 10px 0;
        }
        .ticker-track {
          display: flex;
          gap: 48px;
          width: max-content;
          animation: ticker 28s linear infinite;
        }
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-item {
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.04em;
        }

        /* ── Grid bg ── */
        .grid-bg {
          background-image:
            linear-gradient(rgba(14,165,233,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14,165,233,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        /* ── Glow ── */
        .glow-green { text-shadow: 0 0 40px rgba(0,255,135,0.4); }
        .glow-box-green { box-shadow: 0 0 0 1px rgba(0,255,135,0.3), 0 0 40px rgba(0,255,135,0.08); }
        .glow-box-blue  { box-shadow: 0 0 0 1px rgba(14,165,233,0.3), 0 0 40px rgba(14,165,233,0.08); }
        .glow-box-red   { box-shadow: 0 0 0 1px rgba(255,77,109,0.3), 0 0 40px rgba(255,77,109,0.08); }

        /* ── Animations ── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .fade-up { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both; }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.35s; }
        .delay-4 { animation-delay: 0.5s; }

        @keyframes pulse-border {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1;   }
        }

        /* ── Buttons ── */
        .btn-primary {
          background: var(--green);
          color: #080b14;
          font-family: 'Cabinet Grotesk', sans-serif;
          font-weight: 800;
          font-size: 15px;
          padding: 14px 32px;
          border: none;
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: all 0.2s;
          display: inline-block;
          text-decoration: none;
          clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
        }
        .btn-primary:hover {
          background: #33ffaa;
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0,255,135,0.3);
        }

        .btn-outline {
          background: transparent;
          color: var(--text);
          font-family: 'Cabinet Grotesk', sans-serif;
          font-weight: 700;
          font-size: 15px;
          padding: 13px 32px;
          border: 1px solid rgba(255,255,255,0.2);
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: all 0.2s;
          display: inline-block;
          text-decoration: none;
        }
        .btn-outline:hover {
          border-color: var(--green);
          color: var(--green);
          transform: translateY(-2px);
        }

        /* ── Nav ── */
        nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 40px;
          height: 64px;
          background: rgba(8,11,20,0.8);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border);
        }
        .nav-logo {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-weight: 800;
          font-size: 20px;
          color: var(--green);
          letter-spacing: -0.02em;
          text-decoration: none;
        }
        .nav-logo span { color: var(--text); }

        /* ── Feature card ── */
        .feat-card {
          background: var(--surf);
          border: 1px solid var(--border);
          padding: 32px;
          position: relative;
          transition: transform 0.3s, box-shadow 0.3s;
          overflow: hidden;
        }
        .feat-card::before {
          content: '';
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .feat-card:hover { transform: translateY(-4px); }
        .feat-card:hover::before { opacity: 1; }

        /* ── Stat card ── */
        .stat-val {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-weight: 800;
          font-size: clamp(40px, 6vw, 64px);
          letter-spacing: -0.03em;
          line-height: 1;
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          nav { padding: 0 20px; }
          .hero-btns { flex-direction: column; align-items: stretch; }
          .hero-btns a { text-align: center; }
          .features-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

            {/* ── NAV ── */}
            <nav>
                <a href="/" className="nav-logo">PAPER<span>TRADER</span></a>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Link href="/login" style={{
                        fontFamily: 'Cabinet Grotesk, sans-serif',
                        fontWeight: 700,
                        fontSize: 14,
                        color: 'var(--muted)',
                        textDecoration: 'none',
                        padding: '8px 16px',
                        transition: 'color 0.2s',
                    }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                    >
                        Sign In
                    </Link>
                    <Link href="/register" className="btn-primary" style={{ padding: '9px 20px', fontSize: 14 }}>
                        Get Started
                    </Link>
                </div>
            </nav>

            {/* ── TICKER ── */}
            <div style={{ marginTop: 64 }} className="ticker-wrap">
                <div className="ticker-track">
                    {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
                        <div key={i} className="ticker-item">
                            <span style={{ color: 'var(--muted)' }}>{item.sym}</span>
                            <span style={{ color: item.pos ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                                {item.val}
                            </span>
                            <span style={{ color: 'var(--border)', margin: '0 8px' }}>·</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── HERO ── */}
            <section
                className="grid-bg"
                style={{
                    minHeight: '86vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '80px 24px',
                    position: 'relative',
                    overflow: 'hidden',
                    textAlign: 'center',
                }}
            >
                {/* Radial glow */}
                <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 600, height: 600,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0,255,135,0.06) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                <div
                    className="fade-up"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'rgba(0,255,135,0.08)',
                        border: '1px solid rgba(0,255,135,0.2)',
                        borderRadius: 2,
                        padding: '6px 14px',
                        marginBottom: 32,
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 12,
                        color: 'var(--green)',
                        letterSpacing: '0.06em',
                    }}
                >
                    <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--green)',
                        animation: 'pulse-border 2s ease-in-out infinite',
                        display: 'inline-block',
                    }} />
                    LIVE MARKET DATA · ZERO RISK
                </div>

                <h1
                    className="fade-up delay-1 glow-green"
                    style={{
                        fontFamily: 'Cabinet Grotesk, sans-serif',
                        fontWeight: 800,
                        fontSize: 'clamp(42px, 8vw, 96px)',
                        lineHeight: 0.95,
                        letterSpacing: '-0.04em',
                        maxWidth: 900,
                        marginBottom: 24,
                    }}
                >
                    Practice Trading.<br />
                    <span style={{ color: 'var(--green)' }}>Build Real Skills.</span>
                </h1>

                <p
                    className="fade-up delay-2"
                    style={{
                        fontSize: 'clamp(16px, 2.5vw, 20px)',
                        color: 'var(--muted)',
                        maxWidth: 560,
                        lineHeight: 1.6,
                        marginBottom: 48,
                        fontWeight: 500,
                    }}
                >
                    Paper trade stocks, ETFs, crypto, forex and commodities
                    with live market prices. No real money needed.
                </p>

                <div className="fade-up delay-3 hero-btns" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Link href="/register" className="btn-primary">
                        Start Trading Free →
                    </Link>
                    <button className="btn-outline" onClick={scrollToFeatures}>
                        Learn More
                    </button>
                </div>

                {/* Floating stat pills */}
                <div
                    className="fade-up delay-4"
                    style={{
                        marginTop: 64,
                        display: 'flex',
                        gap: 16,
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                    }}
                >
                    {[
                        { label: 'Total Trades Today', val: '14,823', color: 'var(--green)' },
                        { label: 'Asset Classes', val: '5+', color: 'var(--blue)' },
                        { label: 'Active Traders', val: '2,401', color: 'var(--red)' },
                    ].map(pill => (
                        <div key={pill.label} style={{
                            background: 'var(--surf)',
                            border: '1px solid var(--border)',
                            padding: '10px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                        }}>
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 500, color: pill.color }}>
                                {pill.val}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
                                {pill.label}
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section id="features" style={{ padding: 'clamp(48px, 8vw, 96px) 24px', maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--green)', letterSpacing: '0.12em', marginBottom: 16 }}>
            // WHY PAPERTRADER
                    </p>
                    <h2 style={{
                        fontFamily: 'Cabinet Grotesk, sans-serif',
                        fontWeight: 800,
                        fontSize: 'clamp(32px, 5vw, 56px)',
                        letterSpacing: '-0.03em',
                        lineHeight: 1.05,
                    }}>
                        Everything you need<br />
                        <span style={{ color: 'var(--green)' }}>to learn trading</span>
                    </h2>
                </div>

                <div
                    className="features-grid"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 1,
                        background: 'var(--border)',
                    }}
                >
                    {FEATURES.map((f, i) => (
                        <div
                            key={i}
                            className="feat-card"
                            style={{ background: 'var(--bg)' }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.background = 'var(--surf)';
                                (e.currentTarget as HTMLElement).style.boxShadow = `inset 0 0 0 1px ${f.accent}33`;
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.background = 'var(--bg)';
                                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                            }}
                        >
                            <div style={{
                                width: 56, height: 56,
                                background: `${f.accent}14`,
                                border: `1px solid ${f.accent}33`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 24,
                                color: f.accent,
                                transition: 'all 0.3s',
                            }}>
                                {f.icon}
                            </div>
                            <h3 style={{
                                fontFamily: 'Cabinet Grotesk, sans-serif',
                                fontWeight: 800,
                                fontSize: 22,
                                letterSpacing: '-0.02em',
                                marginBottom: 12,
                            }}>
                                {f.title}
                            </h3>
                            <p style={{ color: 'var(--muted)', lineHeight: 1.7, fontSize: 15, fontWeight: 500 }}>
                                {f.desc}
                            </p>
                            <div style={{
                                marginTop: 28,
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: 11,
                                color: f.accent,
                                letterSpacing: '0.08em',
                                opacity: 0.7,
                            }}>
                                {['01 //', '02 //', '03 //'][i]} FEATURE
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── STATS ── */}
            <section style={{
                background: 'var(--surf)',
                borderTop: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                padding: 'clamp(48px, 8vw, 80px) 24px',
            }}>
                <div
                    className="stats-grid"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 1,
                        maxWidth: 900,
                        margin: '0 auto',
                        background: 'var(--border)',
                    }}
                >
                    {STATS.map((s, i) => (
                        <div
                            key={i}
                            style={{
                                background: 'var(--surf)',
                                padding: '40px 32px',
                                textAlign: 'center',
                            }}
                        >
                            <div
                                className="stat-val"
                                style={{
                                    color: ['var(--green)', 'var(--blue)', 'var(--red)'][i],
                                    marginBottom: 8,
                                }}
                            >
                                {s.value}
                            </div>
                            <div style={{
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: 12,
                                color: 'var(--muted)',
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                            }}>
                                {s.label}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CTA ── */}
            <section style={{
                padding: 'clamp(72px, 10vw, 120px) 24px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
            }}>
                <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 500, height: 500,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0,255,135,0.05) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--green)', letterSpacing: '0.12em', marginBottom: 20 }}>
          // GET STARTED
                </p>
                <h2 style={{
                    fontFamily: 'Cabinet Grotesk, sans-serif',
                    fontWeight: 800,
                    fontSize: 'clamp(36px, 6vw, 72px)',
                    letterSpacing: '-0.03em',
                    lineHeight: 1.05,
                    marginBottom: 20,
                }}>
                    Ready to start?
                </h2>
                <p style={{ color: 'var(--muted)', fontSize: 18, fontWeight: 500, marginBottom: 40, maxWidth: 480, margin: '0 auto 40px' }}>
                    Create your free account and start trading in minutes.
                </p>
                <Link href="/register" className="btn-primary" style={{ fontSize: 16, padding: '16px 40px' }}>
                    Create Free Account →
                </Link>
            </section>

            {/* ── FOOTER ── */}
            <footer style={{
                borderTop: '1px solid var(--border)',
                padding: '24px',
                textAlign: 'center',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12,
                color: 'var(--muted)',
            }}>
                © 2026 PaperTrader. Built for learners.
            </footer>
        </>
    );
}