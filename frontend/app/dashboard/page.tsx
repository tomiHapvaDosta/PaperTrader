// app/dashboard/page.tsx
// Purpose: Main dashboard page — portfolio overview, performance chart,
// positions, recent orders, market overview.
// Depends on: lib/api.ts, lib/i18n.ts, all UI components, PageWrapper.

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
} from 'recharts';
import PageWrapper from '@/components/layout/PageWrapper';
import PriceDisplay from '@/components/ui/PriceDisplay';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import * as api from '@/lib/api';
import type { Portfolio, Order } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Snapshot { total_value: number; created_at: string; }
interface MarketQuote {
    ticker: string; label: string; assetType: string;
    price: number; change: number; changePercent: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MARKET_TICKERS = [
    { ticker: 'AAPL', label: 'Apple', assetType: 'stock' },
    { ticker: 'TSLA', label: 'Tesla', assetType: 'stock' },
    { ticker: 'SPY', label: 'S&P 500', assetType: 'etf' },
    { ticker: 'QQQ', label: 'Nasdaq', assetType: 'etf' },
    { ticker: 'BTC-USD', label: 'Bitcoin', assetType: 'crypto' },
    { ticker: 'ETH-USD', label: 'Ethereum', assetType: 'crypto' },
    { ticker: 'EUR/USD', label: 'EUR/USD', assetType: 'forex' },
    { ticker: 'GC=F', label: 'Gold', assetType: 'commodity' },
];

const RANGES = ['7D', '30D', '90D', 'All'] as const;
type Range = typeof RANGES[number];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function filterSnapshots(snapshots: Snapshot[], range: Range): Snapshot[] {
    if (range === 'All') return snapshots;
    const days = range === '7D' ? 7 : range === '30D' ? 30 : 90;
    const cutoff = Date.now() - days * 86400 * 1000;
    return snapshots.filter(s => new Date(s.created_at).getTime() >= cutoff);
}

function fmtDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtUSD(v: number) {
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function countAssetClasses(positions: Portfolio['positions']): number {
    return new Set(positions.map(p => p.asset_type)).size;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            background: '#0d1120',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '24px 28px',
            position: 'relative',
            overflow: 'hidden',
            transition: 'border-color 0.2s',
        }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,255,135,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
        >
            {children}
        </div>
    );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{
                fontFamily: 'Cabinet Grotesk, sans-serif',
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: '-0.02em',
                color: '#f0f4ff',
            }}>
                {children}
            </h2>
            {action}
        </div>
    );
}

function ViewAllLink({ href }: { href: string }) {
    return (
        <Link href={href} style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: '#6b7a99',
            textDecoration: 'none',
            letterSpacing: '0.06em',
            transition: 'color 0.2s',
        }}
            onMouseEnter={e => (e.currentTarget.style.color = '#00ff87')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6b7a99')}
        >
            VIEW ALL →
        </Link>
    );
}

function EmptyState({ message, cta, href }: { message: string; cta?: string; href?: string }) {
    return (
        <div style={{
            padding: '40px 24px',
            textAlign: 'center',
            border: '1px dashed rgba(255,255,255,0.08)',
        }}>
            <p style={{ color: '#6b7a99', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, marginBottom: cta ? 16 : 0 }}>
                {message}
            </p>
            {cta && href && (
                <Link href={href} style={{
                    display: 'inline-block',
                    marginTop: 12,
                    background: 'transparent',
                    border: '1px solid rgba(0,255,135,0.3)',
                    color: '#00ff87',
                    fontFamily: 'Cabinet Grotesk, sans-serif',
                    fontWeight: 700,
                    fontSize: 13,
                    padding: '8px 20px',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(0,255,135,0.08)';
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                >
                    {cta}
                </Link>
            )}
        </div>
    );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#0d1120',
            border: '1px solid rgba(255,255,255,0.12)',
            padding: '10px 16px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
        }}>
            <div style={{ color: '#6b7a99', marginBottom: 4 }}>{label}</div>
            <div style={{ color: '#00ff87', fontWeight: 500 }}>{fmtUSD(payload[0].value)}</div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const { user } = useAuth();

    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [quotes, setQuotes] = useState<MarketQuote[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [range, setRange] = useState<Range>('30D');
    const [lastUpdate, setLastUpdate] = useState(new Date());

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchAll = useCallback(async () => {
        try {
            setError('');
            const [port, snaps, ords] = await Promise.all([
                api.getPortfolio(),
                api.getSnapshots(90),
                api.getOrders('all', 5, 0),
            ]);
            setPortfolio(port);
            setSnapshots(snaps);
            setOrders(ords.orders);
            setLastUpdate(new Date());

            // Fetch market quotes (best effort — don't fail page if one fails)
            const quoteResults = await Promise.allSettled(
                MARKET_TICKERS.map(t => api.getQuote(t.ticker, t.assetType).then(q => ({
                    ticker: t.ticker,
                    label: t.label,
                    assetType: t.assetType,
                    price: q.price,
                    change: q.change,
                    changePercent: q.change_percent,
                })))
            );
            setQuotes(
                quoteResults
                    .filter((r): r is PromiseFulfilledResult<MarketQuote> => r.status === 'fulfilled')
                    .map(r => r.value)
            );
        } catch (e: any) {
            setError(e?.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
        intervalRef.current = setInterval(fetchAll, 60_000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [fetchAll]);

    const chartData = filterSnapshots(snapshots, range).map(s => ({
        date: fmtDate(s.created_at),
        value: s.total_value,
    }));

    return (
        <PageWrapper>
            <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700,500&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap');

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: rgba(255,255,255,0.06);
        }
        .two-col {
          display: grid;
          grid-template-columns: 60fr 40fr;
          gap: 24px;
        }
        .market-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: rgba(255,255,255,0.06);
        }
        @media (max-width: 1100px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .market-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .two-col { grid-template-columns: 1fr; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .market-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr; }
        }

        .range-btn {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.08);
          color: #6b7a99;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          padding: 6px 14px;
          cursor: pointer;
          transition: all 0.15s;
          letter-spacing: 0.06em;
        }
        .range-btn:hover { border-color: rgba(0,255,135,0.3); color: #00ff87; }
        .range-btn.active {
          background: rgba(0,255,135,0.1);
          border-color: rgba(0,255,135,0.4);
          color: #00ff87;
        }

        .market-card {
          background: #0d1120;
          padding: 20px;
          cursor: pointer;
          transition: background 0.2s;
          text-decoration: none;
          display: block;
        }
        .market-card:hover { background: #111827; }

        .pos-row { transition: background 0.15s; }
        .pos-row:hover td { background: rgba(255,255,255,0.02) !important; }

        .order-item {
          padding: 14px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .order-item:last-child { border-bottom: none; }
      `}</style>

            <div style={{ maxWidth: 1400, margin: '0 auto' }}>

                {/* ── HEADER ── */}
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    marginBottom: 32,
                    flexWrap: 'wrap',
                    gap: 12,
                }}>
                    <div>
                        <p style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 11,
                            color: '#6b7a99',
                            letterSpacing: '0.1em',
                            marginBottom: 6,
                        }}>
              // {t('nav.dashboard').toUpperCase()}
                        </p>
                        <h1 style={{
                            fontFamily: 'Cabinet Grotesk, sans-serif',
                            fontWeight: 800,
                            fontSize: 'clamp(28px, 4vw, 42px)',
                            letterSpacing: '-0.03em',
                            lineHeight: 1,
                        }}>
                            {t('dashboard.title')}
                        </h1>
                        {user?.username && (
                            <p style={{ color: '#6b7a99', marginTop: 6, fontWeight: 500 }}>
                                Welcome back, <span style={{ color: '#f0f4ff' }}>{user.username}</span>
                            </p>
                        )}
                    </div>
                    <div style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11,
                        color: '#6b7a99',
                        letterSpacing: '0.06em',
                    }}>
                        <span style={{
                            display: 'inline-block',
                            width: 6, height: 6, borderRadius: '50%',
                            background: '#00ff87',
                            marginRight: 6,
                            animation: 'pulse-dot 2s ease-in-out infinite',
                            verticalAlign: 'middle',
                        }} />
                        Updated {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        <style>{`
              @keyframes pulse-dot {
                0%,100% { opacity:0.5; transform:scale(1); }
                50% { opacity:1; transform:scale(1.3); }
              }
            `}</style>
                    </div>
                </div>

                {/* ── LOADING / ERROR ── */}
                {loading && <LoadingSpinner />}
                {error && !loading && <ErrorMessage message={error} onRetry={fetchAll} />}

                {!loading && !error && portfolio && (
                    <>
                        {/* ── STAT CARDS ── */}
                        <div className="stats-grid" style={{ marginBottom: 24 }}>

                            {/* Total Value */}
                            <StatCard>
                                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6b7a99', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                                    {t('dashboard.total_value')}
                                </p>
                                <div style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 800, fontSize: 'clamp(22px, 3vw, 32px)', letterSpacing: '-0.03em', color: '#f0f4ff', marginBottom: 8 }}>
                                    {fmtUSD(portfolio.total_value)}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <PriceDisplay value={portfolio.total_pnl} showSign size="sm" prefix="$" />
                                    <PriceDisplay value={portfolio.total_pnl_percent} showSign showPercent size="sm" />
                                </div>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #00ff87, transparent)' }} />
                            </StatCard>

                            {/* Cash Balance */}
                            <StatCard>
                                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6b7a99', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                                    {t('dashboard.cash_balance')}
                                </p>
                                <div style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 800, fontSize: 'clamp(22px, 3vw, 32px)', letterSpacing: '-0.03em', color: '#0ea5e9', marginBottom: 8 }}>
                                    {fmtUSD(portfolio.cash_balance)}
                                </div>
                                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6b7a99' }}>
                                    Starting: {fmtUSD(portfolio.starting_balance)}
                                </p>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #0ea5e9, transparent)' }} />
                            </StatCard>

                            {/* Total P&L */}
                            <StatCard>
                                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6b7a99', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                                    {t('dashboard.total_pnl')}
                                </p>
                                <div style={{ marginBottom: 8 }}>
                                    <PriceDisplay value={portfolio.total_pnl} showSign size="lg" prefix="$" />
                                </div>
                                <PriceDisplay value={portfolio.total_pnl_percent} showSign showPercent size="sm" />
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                                    background: `linear-gradient(90deg, ${portfolio.total_pnl >= 0 ? '#00ff87' : '#ff4d6d'}, transparent)`,
                                }} />
                            </StatCard>

                            {/* Open Positions */}
                            <StatCard>
                                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6b7a99', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                                    {t('dashboard.open_positions')}
                                </p>
                                <div style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 800, fontSize: 'clamp(22px, 3vw, 32px)', letterSpacing: '-0.03em', color: '#f59e0b', marginBottom: 8 }}>
                                    {portfolio.positions.length}
                                </div>
                                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6b7a99' }}>
                                    across {countAssetClasses(portfolio.positions)} asset class{countAssetClasses(portfolio.positions) !== 1 ? 'es' : ''}
                                </p>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #f59e0b, transparent)' }} />
                            </StatCard>

                        </div>

                        {/* ── PERFORMANCE CHART ── */}
                        <div style={{
                            background: '#0d1120',
                            border: '1px solid rgba(255,255,255,0.08)',
                            padding: '28px',
                            marginBottom: 24,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                                <h2 style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>
                                    {t('dashboard.performance')}
                                </h2>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {RANGES.map(r => (
                                        <button
                                            key={r}
                                            className={`range-btn${range === r ? ' active' : ''}`}
                                            onClick={() => setRange(r)}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {chartData.length < 2 ? (
                                <EmptyState message="No performance data yet. Start trading to see your portfolio history." />
                            ) : (
                                <ResponsiveContainer width="100%" height={240}>
                                    <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
                                                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: '#6b7a99' }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            tickFormatter={v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)}
                                            tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: '#6b7a99' }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={56}
                                        />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke="#0ea5e9"
                                            strokeWidth={2}
                                            fill="url(#chartGradient)"
                                            dot={false}
                                            activeDot={{ r: 4, fill: '#0ea5e9', stroke: '#0d1120', strokeWidth: 2 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* ── TWO COLUMN ── */}
                        <div className="two-col" style={{ marginBottom: 24 }}>

                            {/* LEFT: Positions */}
                            <div style={{ background: '#0d1120', border: '1px solid rgba(255,255,255,0.08)', padding: 28 }}>
                                <SectionTitle action={<ViewAllLink href="/markets" />}>
                                    {t('dashboard.open_positions')}
                                </SectionTitle>

                                {portfolio.positions.length === 0 ? (
                                    <EmptyState
                                        message={t('dashboard.no_positions')}
                                        cta="Start Trading"
                                        href="/markets"
                                    />
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr>
                                                    {['Asset', 'Qty', 'Avg Price', 'Current', 'Value', 'P&L'].map(h => (
                                                        <th key={h} style={{
                                                            fontFamily: 'JetBrains Mono, monospace',
                                                            fontSize: 10,
                                                            color: '#6b7a99',
                                                            letterSpacing: '0.08em',
                                                            textTransform: 'uppercase',
                                                            padding: '0 12px 12px 0',
                                                            textAlign: 'left',
                                                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                                                            whiteSpace: 'nowrap',
                                                        }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {portfolio.positions.slice(0, 5).map((pos, i) => (
                                                    <tr key={i} className="pos-row">
                                                        <td style={{ padding: '12px 12px 12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                            <div style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 700, fontSize: 14, color: '#f0f4ff', marginBottom: 3 }}>
                                                                {pos.ticker}
                                                            </div>
                                                            <Badge status={pos.asset_type as any} />
                                                        </td>
                                                        <td style={{ padding: '12px 12px 12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#f0f4ff' }}>
                                                            {pos.quantity.toFixed(4)}
                                                        </td>
                                                        <td style={{ padding: '12px 12px 12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                            <PriceDisplay value={pos.avg_buy_price} prefix="$" />
                                                        </td>
                                                        <td style={{ padding: '12px 12px 12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                            <PriceDisplay value={pos.current_price} prefix="$" />
                                                        </td>
                                                        <td style={{ padding: '12px 12px 12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                            <PriceDisplay value={pos.position_value} prefix="$" />
                                                        </td>
                                                        <td style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                            <div>
                                                                <PriceDisplay value={pos.pnl} showSign prefix="$" size="sm" />
                                                            </div>
                                                            <PriceDisplay value={pos.pnl_percent} showSign showPercent size="sm" />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* RIGHT: Recent Orders */}
                            <div style={{ background: '#0d1120', border: '1px solid rgba(255,255,255,0.08)', padding: 28 }}>
                                <SectionTitle action={<ViewAllLink href="/orders" />}>
                                    {t('dashboard.recent_orders')}
                                </SectionTitle>

                                {orders.length === 0 ? (
                                    <EmptyState message={t('dashboard.no_orders')} />
                                ) : (
                                    <div>
                                        {orders.map((order, i) => (
                                            <div key={i} className="order-item">
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                                                        <span style={{
                                                            fontFamily: 'Cabinet Grotesk, sans-serif',
                                                            fontWeight: 700, fontSize: 15, color: '#f0f4ff',
                                                        }}>
                                                            {order.ticker}
                                                        </span>
                                                        <Badge status={order.side as 'buy' | 'sell'} />
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6b7a99', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                            {order.order_type}
                                                        </span>
                                                        <Badge status={order.status as any} />
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#f0f4ff', marginBottom: 3 }}>
                                                        {fmtUSD(order.price)}
                                                    </div>
                                                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6b7a99' }}>
                                                        {order.quantity} · {relativeTime(order.created_at)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── MARKET OVERVIEW ── */}
                        <div style={{ marginBottom: 8 }}>
                            <div style={{ marginBottom: 20 }}>
                                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6b7a99', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  // TODAY'S SNAPSHOT
                                </p>
                                <h2 style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>
                                    Market Overview
                                </h2>
                            </div>

                            <div className="market-grid">
                                {MARKET_TICKERS.map(({ ticker, label, assetType }) => {
                                    const q = quotes.find(q => q.ticker === ticker);
                                    return (
                                        <Link
                                            key={ticker}
                                            href={`/markets/${ticker}`}
                                            className="market-card"
                                        >
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                                                <div>
                                                    <div style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 800, fontSize: 15, color: '#f0f4ff', marginBottom: 2 }}>
                                                        {ticker}
                                                    </div>
                                                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6b7a99', letterSpacing: '0.04em' }}>
                                                        {label}
                                                    </div>
                                                </div>
                                                <span style={{
                                                    fontFamily: 'JetBrains Mono, monospace',
                                                    fontSize: 9,
                                                    color: '#6b7a99',
                                                    background: 'rgba(255,255,255,0.04)',
                                                    border: '1px solid rgba(255,255,255,0.06)',
                                                    padding: '2px 6px',
                                                    letterSpacing: '0.06em',
                                                    textTransform: 'uppercase',
                                                }}>
                                                    {assetType}
                                                </span>
                                            </div>

                                            {q ? (
                                                <>
                                                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, fontSize: 18, color: '#f0f4ff', marginBottom: 6 }}>
                                                        {fmtUSD(q.price)}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 10 }}>
                                                        <PriceDisplay value={q.change} showSign prefix="$" size="sm" />
                                                        <PriceDisplay value={q.changePercent} showSign showPercent size="sm" />
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6b7a99' }}>
                                                    Loading...
                                                </div>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </PageWrapper>
    );
}