// app/markets/[ticker]/page.tsx
// Purpose: Asset detail page — live chart, asset info, and trade panel.
// Depends on: lib/api.ts, lib/i18n.ts, all UI components, ConfirmModal.

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ResponsiveContainer, AreaChart, Area, LineChart, Line,
    ComposedChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import PageWrapper from '@/components/layout/PageWrapper';
import PriceDisplay from '@/components/ui/PriceDisplay';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { t } from '@/lib/i18n';
import * as api from '@/lib/api';
import type { Quote, AssetProfile, Candle, Portfolio } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Range = '1D' | '1W' | '1M' | '3M' | '1Y' | 'All';
type ChartType = 'line' | 'candle';
type Side = 'buy' | 'sell';
type OrderType = 'market' | 'limit' | 'stop_loss';
type InputMode = 'shares' | 'usd';

interface FeeEstimate {
    fee: number;
    trade_value: number;
    total_cost: number;
    price: number;
    quantity: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RANGES: Range[] = ['1D', '1W', '1M', '3M', '1Y', 'All'];

const RESOLUTION_MAP: Record<Range, string> = {
    '1D': '5', '1W': '60', '1M': 'D', '3M': 'D', '1Y': 'W', 'All': 'M',
};

function getRangeFrom(range: Range): number {
    const now = Math.floor(Date.now() / 1000);
    switch (range) {
        case '1D': return now - 86400;
        case '1W': return now - 7 * 86400;
        case '1M': return now - 30 * 86400;
        case '3M': return now - 90 * 86400;
        case '1Y': return now - 365 * 86400;
        case 'All': return now - 5 * 365 * 86400;
    }
}

function fmtAxisDate(ts: number, range: Range): string {
    const d = new Date(ts * 1000);
    if (range === '1D') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (range === '1W') return d.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit' });
    if (range === '1Y' || range === 'All') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtUSD(v: number) {
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Custom Tooltips ──────────────────────────────────────────────────────────

function LineTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#0d1120', border: '1px solid rgba(255,255,255,0.1)',
            padding: '10px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
        }}>
            <div style={{ color: '#6b7a99', marginBottom: 4 }}>{label}</div>
            <div style={{ color: '#0ea5e9', fontWeight: 500 }}>{fmtUSD(payload[0]?.value ?? 0)}</div>
        </div>
    );
}

function CandleTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
        <div style={{
            background: '#0d1120', border: '1px solid rgba(255,255,255,0.1)',
            padding: '10px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px',
        }}>
            {[['O', d.open], ['H', d.high], ['L', d.low], ['C', d.close]].map(([k, v]) => (
                <div key={k as string} style={{ display: 'flex', gap: 6 }}>
                    <span style={{ color: '#6b7a99' }}>{k}</span>
                    <span style={{ color: '#f0f4ff' }}>{fmtUSD(v as number)}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
    return (
        <div style={{
            position: 'fixed', bottom: 32, right: 32, zIndex: 300,
            background: type === 'success' ? 'rgba(0,255,135,0.12)' : 'rgba(255,77,109,0.12)',
            border: `1px solid ${type === 'success' ? 'rgba(0,255,135,0.4)' : 'rgba(255,77,109,0.4)'}`,
            color: type === 'success' ? '#00ff87' : '#ff4d6d',
            padding: '14px 20px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 13,
            animation: 'slideIn 0.3s cubic-bezier(0.22,1,0.36,1)',
            maxWidth: 320,
        }}>
            {type === 'success' ? '✓ ' : '⚠ '}{message}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AssetDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    const ticker = decodeURIComponent(params.ticker as string).toUpperCase();
    const assetType = searchParams.get('asset_type') ?? 'stock';

    // ── Data state ──
    const [quote, setQuote] = useState<Quote | null>(null);
    const [profile, setProfile] = useState<AssetProfile | null>(null);
    const [candles, setCandles] = useState<Candle[]>([]);
    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [loading, setLoading] = useState(true);
    const [chartLoading, setChartLoading] = useState(false);
    const [error, setError] = useState('');

    // ── Chart state ──
    const [range, setRange] = useState<Range>('1M');
    const [chartType, setChartType] = useState<ChartType>('line');
    const [descExpanded, setDescExpanded] = useState(false);

    // ── Trade state ──
    const [side, setSide] = useState<Side>('buy');
    const [orderType, setOrderType] = useState<OrderType>('market');
    const [inputMode, setInputMode] = useState<InputMode>('shares');
    const [quantity, setQuantity] = useState('');
    const [limitPrice, setLimitPrice] = useState('');
    const [stopPrice, setStopPrice] = useState('');
    const [feeEst, setFeeEst] = useState<FeeEstimate | null>(null);
    const [feeLoading, setFeeLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [placing, setPlacing] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const quoteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Show toast ──
    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // ── Fetch candles ──
    const fetchCandles = useCallback(async (r: Range) => {
        setChartLoading(true);
        try {
            const from = getRangeFrom(r);
            const to = Math.floor(Date.now() / 1000);
            const data = await api.getCandles(ticker, assetType, from, to, RESOLUTION_MAP[r]);
            setCandles(data);
        } catch { setCandles([]); }
        finally { setChartLoading(false); }
    }, [ticker, assetType]);

    // ── Initial load ──
    const fetchAll = useCallback(async () => {
        try {
            setError('');
            const [q, prof, port] = await Promise.allSettled([
                api.getQuote(ticker, assetType),
                api.getProfile(ticker, assetType),
                api.getPortfolio(),
            ]);
            if (q.status === 'fulfilled') setQuote(q.value);
            else { setError('Ticker not found or unavailable.'); return; }
            if (prof.status === 'fulfilled') setProfile(prof.value);
            if (port.status === 'fulfilled') setPortfolio(port.value);
            await fetchCandles('1M');
        } catch (e: any) {
            setError(e?.message ?? t('common.error'));
        } finally {
            setLoading(false);
        }
    }, [ticker, assetType, fetchCandles]);

    useEffect(() => {
        fetchAll();
        quoteIntervalRef.current = setInterval(async () => {
            try {
                const q = await api.getQuote(ticker, assetType);
                setQuote(q);
            } catch { }
        }, 15_000);
        return () => { if (quoteIntervalRef.current) clearInterval(quoteIntervalRef.current); };
    }, [fetchAll, ticker, assetType]);

    const handleRangeChange = (r: Range) => {
        setRange(r);
        fetchCandles(r);
    };

    // ── Position info ──
    const position = portfolio?.positions.find(p => p.ticker === ticker);
    const cashBalance = portfolio?.cash_balance ?? 0;

    // ── Derived quantity ──
    const currentPrice = quote?.price ?? 0;
    const computedQty = inputMode === 'shares'
        ? parseFloat(quantity) || 0
        : (parseFloat(quantity) || 0) / (currentPrice || 1);
    const tradeValue = computedQty * currentPrice;

    // ── Estimate fee ──
    const handleEstimateFee = async () => {
        if (computedQty <= 0 || !currentPrice) return;
        setFeeLoading(true);
        try {
            const est = await api.estimateFee(ticker, assetType, computedQty, currentPrice);
            setFeeEst(est);
        } catch { showToast('Could not estimate fee', 'error'); }
        finally { setFeeLoading(false); }
    };

    // ── Place order ──
    const handlePlaceOrder = async () => {
        setPlacing(true);
        try {
            await api.placeOrder({
                ticker,
                asset_type: assetType,
                order_type: orderType,
                side,
                quantity: computedQty,
                limit_price: orderType === 'limit' ? parseFloat(limitPrice) : undefined,
                stop_price: orderType === 'stop_loss' ? parseFloat(stopPrice) : undefined,
            });
            setModalOpen(false);
            showToast(t('asset.trade_success'), 'success');
            setQuantity('');
            setFeeEst(null);
            const port = await api.getPortfolio();
            setPortfolio(port);
        } catch (e: any) {
            showToast(e?.message ?? t('common.error'), 'error');
        } finally {
            setPlacing(false);
        }
    };

    // ── Chart data ──
    const chartData = candles.map(c => ({
        time: c.time,
        label: fmtAxisDate(c.time, range),
        price: c.close,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        bullish: c.close >= c.open,
    }));

    const canSubmit = computedQty > 0 && currentPrice > 0 &&
        (side === 'buy' ? tradeValue <= cashBalance : (position?.quantity ?? 0) >= computedQty);

    return (
        <PageWrapper>
            <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700,500&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap');

        @keyframes slideIn {
          from { opacity:0; transform: translateY(16px); }
          to   { opacity:1; transform: translateY(0); }
        }

        .detail-layout {
          display: grid;
          grid-template-columns: 65fr 35fr;
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .detail-layout { grid-template-columns: 1fr; }
          .trade-panel-sticky { position: static !important; }
        }

        .range-btn {
          background: transparent;
          border: none;
          color: #6b7a99;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          padding: 6px 12px;
          cursor: pointer;
          letter-spacing: 0.06em;
          transition: all 0.15s;
          border-bottom: 2px solid transparent;
        }
        .range-btn:hover { color: #f0f4ff; }
        .range-btn.active { color: #0ea5e9; border-bottom-color: #0ea5e9; }

        .chart-type-btn {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.08);
          color: #6b7a99;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          padding: 5px 12px;
          cursor: pointer;
          letter-spacing: 0.06em;
          transition: all 0.15s;
        }
        .chart-type-btn.active {
          background: rgba(14,165,233,0.1);
          border-color: rgba(14,165,233,0.4);
          color: #0ea5e9;
        }

        .side-btn {
          flex: 1;
          padding: 14px;
          border: 1px solid rgba(255,255,255,0.08);
          font-family: 'Cabinet Grotesk', sans-serif;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: all 0.2s;
          background: transparent;
          color: #6b7a99;
        }
        .side-btn.buy.active {
          background: rgba(0,255,135,0.1);
          border-color: rgba(0,255,135,0.5);
          color: #00ff87;
        }
        .side-btn.sell.active {
          background: rgba(255,77,109,0.1);
          border-color: rgba(255,77,109,0.5);
          color: #ff4d6d;
        }

        .trade-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: #f0f4ff;
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          padding: 11px 14px;
          outline: none;
          transition: all 0.2s;
        }
        .trade-input:focus {
          border-color: rgba(0,255,135,0.4);
          box-shadow: 0 0 0 3px rgba(0,255,135,0.05);
        }
        .trade-input::placeholder { color: #6b7a99; }

        .trade-select {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: #f0f4ff;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          padding: 11px 14px;
          outline: none;
          cursor: pointer;
          transition: border-color 0.2s;
          appearance: none;
        }
        .trade-select:focus { border-color: rgba(0,255,135,0.4); }
        .trade-select option { background: #0d1120; }

        .input-mode-btn {
          flex: 1;
          padding: 7px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.08);
          color: #6b7a99;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          cursor: pointer;
          letter-spacing: 0.06em;
          transition: all 0.15s;
        }
        .input-mode-btn.active {
          background: rgba(255,255,255,0.06);
          color: #f0f4ff;
          border-color: rgba(255,255,255,0.2);
        }

        .submit-btn {
          width: 100%;
          padding: 14px;
          border: none;
          font-family: 'Cabinet Grotesk', sans-serif;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.02em;
          clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
        }
        .submit-btn.buy  { background: #00ff87; color: #080b14; }
        .submit-btn.sell { background: #ff4d6d; color: #fff; }
        .submit-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
        .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; clip-path: none; }

        .fee-btn {
          width: 100%;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.1);
          color: #6b7a99;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          padding: 9px;
          cursor: pointer;
          letter-spacing: 0.06em;
          transition: all 0.15s;
        }
        .fee-btn:hover { border-color: rgba(0,255,135,0.3); color: #00ff87; }

        .info-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: #6b7a99;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 6px;
          display: block;
        }
      `}</style>

            {toast && <Toast message={toast.msg} type={toast.type} />}

            <div style={{ maxWidth: 1400, margin: '0 auto' }}>
                {loading ? <LoadingSpinner /> : error ? (
                    <div style={{
                        background: 'rgba(255,77,109,0.08)',
                        border: '1px solid rgba(255,77,109,0.3)',
                        color: '#ff4d6d',
                        padding: '16px 20px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 13,
                    }}>
                        ⚠ {error}
                    </div>
                ) : quote && (
                    <>
                        {/* ── ASSET HEADER ── */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            marginBottom: 32,
                            flexWrap: 'wrap',
                            gap: 20,
                        }}>
                            {/* Left */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <Link href="/markets" style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: 36, height: 36,
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    color: '#6b7a99', textDecoration: 'none',
                                    fontFamily: 'JetBrains Mono, monospace', fontSize: 16,
                                    transition: 'all 0.15s', flexShrink: 0,
                                }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,255,135,0.3)'; (e.currentTarget as HTMLElement).style.color = '#00ff87'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#6b7a99'; }}
                                >
                                    ←
                                </Link>

                                {profile?.logo && (
                                    <img src={profile.logo} alt={ticker}
                                        style={{ width: 40, height: 40, objectFit: 'contain', background: 'rgba(255,255,255,0.04)', padding: 4 }}
                                        onError={e => (e.currentTarget.style.display = 'none')}
                                    />
                                )}

                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                        <h1 style={{
                                            fontFamily: 'Cabinet Grotesk, sans-serif',
                                            fontWeight: 800, fontSize: 'clamp(24px, 4vw, 36px)',
                                            letterSpacing: '-0.03em', lineHeight: 1, color: '#f0f4ff',
                                        }}>
                                            {ticker}
                                        </h1>
                                        <Badge status={assetType as any} />
                                    </div>
                                    {profile?.name && (
                                        <p style={{ color: '#6b7a99', fontWeight: 500, fontSize: 14 }}>
                                            {profile.name}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Right: price */}
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ marginBottom: 6 }}>
                                    <PriceDisplay value={quote.price} prefix="$" size="lg" />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', marginBottom: 4 }}>
                                    <span style={{ color: quote.change >= 0 ? '#00ff87' : '#ff4d6d', fontSize: 16 }}>
                                        {quote.change >= 0 ? '↑' : '↓'}
                                    </span>
                                    <PriceDisplay value={quote.change} showSign prefix="$" />
                                    <PriceDisplay value={quote.change_percent} showSign showPercent />
                                </div>
                                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6b7a99', letterSpacing: '0.06em' }}>
                                    Updated {new Date(quote.updated_at).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>

                        {/* ── TWO COLUMN ── */}
                        <div className="detail-layout">

                            {/* ── LEFT COLUMN ── */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                                {/* Chart */}
                                <div style={{ background: '#0d1120', border: '1px solid rgba(255,255,255,0.08)', padding: 28 }}>
                                    {/* Controls */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {(['line', 'candle'] as ChartType[]).map(ct => (
                                                <button
                                                    key={ct}
                                                    className={`chart-type-btn${chartType === ct ? ' active' : ''}`}
                                                    onClick={() => setChartType(ct)}
                                                >
                                                    {ct === 'line' ? 'LINE' : 'CANDLE'}
                                                </button>
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: 0 }}>
                                            {RANGES.map(r => (
                                                <button
                                                    key={r}
                                                    className={`range-btn${range === r ? ' active' : ''}`}
                                                    onClick={() => handleRangeChange(r)}
                                                >
                                                    {r}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Chart area */}
                                    <div style={{ height: 300, position: 'relative' }}>
                                        {chartLoading ? (
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <LoadingSpinner size="sm" />
                                            </div>
                                        ) : chartData.length < 2 ? (
                                            <div style={{
                                                height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#6b7a99',
                                                border: '1px dashed rgba(255,255,255,0.08)',
                                            }}>
                                                No chart data for this range
                                            </div>
                                        ) : chartType === 'line' ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
                                                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
                                                    <XAxis dataKey="label" tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: '#6b7a99' }} axisLine={false} tickLine={false} />
                                                    <YAxis tickFormatter={v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0))} tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: '#6b7a99' }} axisLine={false} tickLine={false} width={60} domain={['auto', 'auto']} />
                                                    <Tooltip content={<LineTooltip />} />
                                                    <Area type="monotone" dataKey="price" stroke="#0ea5e9" strokeWidth={2} fill="url(#lineGrad)" dot={false} activeDot={{ r: 4, fill: '#0ea5e9', stroke: '#0d1120', strokeWidth: 2 }} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                                    <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
                                                    <XAxis dataKey="label" tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: '#6b7a99' }} axisLine={false} tickLine={false} />
                                                    <YAxis tickFormatter={v => '$' + v.toFixed(0)} tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: '#6b7a99' }} axisLine={false} tickLine={false} width={60} domain={['auto', 'auto']} />
                                                    <Tooltip content={<CandleTooltip />} />
                                                    <Bar dataKey="close" fill="transparent" shape={(props: any) => {
                                                        const { x, y, width, height, payload } = props;
                                                        const bull = payload.bullish;
                                                        const color = bull ? '#00ff87' : '#ff4d6d';
                                                        const bodyH = Math.max(Math.abs(height), 2);
                                                        return (
                                                            <g>
                                                                <rect x={x + width * 0.2} y={bull ? y : y + height} width={width * 0.6} height={bodyH} fill={color} fillOpacity={0.7} rx={1} />
                                                            </g>
                                                        );
                                                    }} />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>

                                {/* Asset Info */}
                                {profile && (
                                    <div style={{ background: '#0d1120', border: '1px solid rgba(255,255,255,0.08)', padding: 28 }}>
                                        <h2 style={{
                                            fontFamily: 'Cabinet Grotesk, sans-serif',
                                            fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', marginBottom: 16,
                                        }}>
                                            About {profile.name || ticker}
                                        </h2>

                                        {profile.description && (
                                            <div style={{ marginBottom: 24 }}>
                                                <p style={{
                                                    color: '#94a3b8', lineHeight: 1.7, fontSize: 14,
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: descExpanded ? undefined : 3,
                                                    WebkitBoxOrient: 'vertical' as any,
                                                    overflow: descExpanded ? 'visible' : 'hidden',
                                                }}>
                                                    {profile.description}
                                                </p>
                                                <button
                                                    onClick={() => setDescExpanded(v => !v)}
                                                    style={{
                                                        background: 'none', border: 'none',
                                                        color: '#0ea5e9', fontFamily: 'JetBrains Mono, monospace',
                                                        fontSize: 11, cursor: 'pointer', marginTop: 8,
                                                        letterSpacing: '0.06em',
                                                    }}
                                                >
                                                    {descExpanded ? 'SHOW LESS ↑' : 'SHOW MORE ↓'}
                                                </button>
                                            </div>
                                        )}

                                        <div style={{
                                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 32px',
                                        }}>
                                            {[
                                                ['Exchange', profile.exchange || '—'],
                                                ['Currency', profile.currency || '—'],
                                                ['Asset Type', assetType],
                                                ['Ticker', ticker],
                                            ].map(([label, value]) => (
                                                <div key={label}>
                                                    <span className="info-label">{label}</span>
                                                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: '#f0f4ff', fontWeight: 500 }}>
                                                        {value}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── RIGHT COLUMN: Trade Panel ── */}
                            <div>
                                <div
                                    className="trade-panel-sticky"
                                    style={{ position: 'sticky', top: 24 }}
                                >
                                    <div style={{ background: '#0d1120', border: '1px solid rgba(255,255,255,0.08)', padding: 24, position: 'relative', overflow: 'hidden' }}>
                                        <div style={{
                                            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                                            background: side === 'buy'
                                                ? 'linear-gradient(90deg, #00ff87, transparent)'
                                                : 'linear-gradient(90deg, #ff4d6d, transparent)',
                                            transition: 'background 0.3s',
                                        }} />

                                        <h2 style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', marginBottom: 20 }}>
                                            Place Order
                                        </h2>

                                        {/* Current position */}
                                        {position && (
                                            <div style={{
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.06)',
                                                padding: '12px 16px',
                                                marginBottom: 20,
                                                fontFamily: 'JetBrains Mono, monospace',
                                                fontSize: 12,
                                            }}>
                                                <div style={{ color: '#6b7a99', marginBottom: 4 }}>YOUR POSITION</div>
                                                <div style={{ color: '#f0f4ff', marginBottom: 4 }}>
                                                    {position.quantity.toFixed(4)} @ {fmtUSD(position.avg_buy_price)}
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <span style={{ color: '#6b7a99' }}>Value:</span>
                                                    <PriceDisplay value={position.position_value} prefix="$" size="sm" />
                                                    <PriceDisplay value={position.pnl} showSign prefix="$" size="sm" />
                                                </div>
                                            </div>
                                        )}

                                        {/* Side toggle */}
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                            <button className={`side-btn buy${side === 'buy' ? ' active' : ''}`} onClick={() => setSide('buy')}>
                                                {t('asset.buy')}
                                            </button>
                                            <button className={`side-btn sell${side === 'sell' ? ' active' : ''}`} onClick={() => setSide('sell')}>
                                                {t('asset.sell')}
                                            </button>
                                        </div>

                                        {/* Order type */}
                                        <div style={{ marginBottom: 16 }}>
                                            <span className="info-label">{t('asset.order_type')}</span>
                                            <select
                                                className="trade-select"
                                                value={orderType}
                                                onChange={e => setOrderType(e.target.value as OrderType)}
                                            >
                                                <option value="market">{t('asset.market')}</option>
                                                <option value="limit">{t('asset.limit')}</option>
                                                <option value="stop_loss">{t('asset.stop_loss')}</option>
                                            </select>
                                        </div>

                                        {/* Input mode */}
                                        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                                            <button className={`input-mode-btn${inputMode === 'shares' ? ' active' : ''}`} onClick={() => setInputMode('shares')}>
                                                SHARES
                                            </button>
                                            <button className={`input-mode-btn${inputMode === 'usd' ? ' active' : ''}`} onClick={() => setInputMode('usd')}>
                                                USD AMOUNT
                                            </button>
                                        </div>

                                        {/* Quantity input */}
                                        <div style={{ marginBottom: 12 }}>
                                            <span className="info-label">
                                                {inputMode === 'shares' ? t('asset.quantity') : t('asset.amount_usd')}
                                            </span>
                                            <input
                                                type="number"
                                                className="trade-input"
                                                min="0"
                                                step="any"
                                                placeholder={inputMode === 'shares' ? '0.00' : '0.00'}
                                                value={quantity}
                                                onChange={e => { setQuantity(e.target.value); setFeeEst(null); }}
                                            />
                                        </div>

                                        {/* Limit price */}
                                        {orderType === 'limit' && (
                                            <div style={{ marginBottom: 12 }}>
                                                <span className="info-label">{t('asset.limit_price')}</span>
                                                <input
                                                    type="number"
                                                    className="trade-input"
                                                    min="0" step="any"
                                                    placeholder={fmtUSD(currentPrice)}
                                                    value={limitPrice}
                                                    onChange={e => setLimitPrice(e.target.value)}
                                                />
                                            </div>
                                        )}

                                        {/* Stop price */}
                                        {orderType === 'stop_loss' && (
                                            <div style={{ marginBottom: 12 }}>
                                                <span className="info-label">{t('asset.stop_price')}</span>
                                                <input
                                                    type="number"
                                                    className="trade-input"
                                                    min="0" step="any"
                                                    placeholder={fmtUSD(currentPrice)}
                                                    value={stopPrice}
                                                    onChange={e => setStopPrice(e.target.value)}
                                                />
                                            </div>
                                        )}

                                        {/* Order summary */}
                                        {computedQty > 0 && (
                                            <div style={{
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.06)',
                                                padding: 14, marginBottom: 12,
                                                fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                                            }}>
                                                {[
                                                    ['Quantity', `${computedQty.toFixed(4)} shares`],
                                                    ['Price', fmtUSD(currentPrice)],
                                                    ['Trade Value', fmtUSD(tradeValue)],
                                                ].map(([k, v]) => (
                                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                        <span style={{ color: '#6b7a99' }}>{k}</span>
                                                        <span style={{ color: '#f0f4ff' }}>{v}</span>
                                                    </div>
                                                ))}

                                                {feeEst ? (
                                                    <>
                                                        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />
                                                        {[
                                                            [t('asset.estimated_fee'), fmtUSD(feeEst.fee)],
                                                            [t('asset.total_cost'), fmtUSD(feeEst.total_cost)],
                                                        ].map(([k, v]) => (
                                                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                                <span style={{ color: '#6b7a99' }}>{k}</span>
                                                                <span style={{ color: '#00ff87', fontWeight: 500 }}>{v}</span>
                                                            </div>
                                                        ))}
                                                    </>
                                                ) : (
                                                    <button className="fee-btn" onClick={handleEstimateFee} disabled={feeLoading} style={{ marginTop: 8 }}>
                                                        {feeLoading ? 'ESTIMATING...' : 'ESTIMATE FEE →'}
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Submit */}
                                        <button
                                            className={`submit-btn ${side}`}
                                            disabled={!canSubmit}
                                            onClick={() => setModalOpen(true)}
                                        >
                                            Preview Order →
                                        </button>

                                        {/* Helper text */}
                                        <div style={{ marginTop: 12, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6b7a99' }}>
                                            {side === 'buy' ? (
                                                <span>Available: <span style={{ color: '#f0f4ff' }}>{fmtUSD(cashBalance)}</span></span>
                                            ) : (
                                                <span>Owned: <span style={{ color: '#f0f4ff' }}>{(position?.quantity ?? 0).toFixed(4)} shares</span></span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── CONFIRM MODAL ── */}
                        <ConfirmModal
                            isOpen={modalOpen}
                            onClose={() => setModalOpen(false)}
                            onConfirm={handlePlaceOrder}
                            title={`Confirm ${side === 'buy' ? 'Buy' : 'Sell'} Order`}
                            data={{
                                ticker,
                                side,
                                quantity: computedQty,
                                price: currentPrice,
                                tradeValue,
                                fee: feeEst?.fee ?? 0,
                                totalCost: feeEst?.total_cost ?? tradeValue,
                            }}
                        />
                    </>
                )}
            </div>
        </PageWrapper>
    );
}