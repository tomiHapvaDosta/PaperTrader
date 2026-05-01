// app/markets/page.tsx
// Purpose: Asset browser page — search, filter, sort, and navigate to assets.
// Depends on: lib/api.ts, lib/i18n.ts, all UI components, PageWrapper.

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PageWrapper from '@/components/layout/PageWrapper';
import PriceDisplay from '@/components/ui/PriceDisplay';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { t } from '@/lib/i18n';
import * as api from '@/lib/api';

// ─── Data ─────────────────────────────────────────────────────────────────────

const DEFAULT_ASSETS = [
    { ticker: 'AAPL', name: 'Apple Inc.', assetType: 'stock' },
    { ticker: 'TSLA', name: 'Tesla Inc.', assetType: 'stock' },
    { ticker: 'MSFT', name: 'Microsoft Corp.', assetType: 'stock' },
    { ticker: 'GOOGL', name: 'Alphabet Inc.', assetType: 'stock' },
    { ticker: 'AMZN', name: 'Amazon.com Inc.', assetType: 'stock' },
    { ticker: 'NVDA', name: 'NVIDIA Corp.', assetType: 'stock' },
    { ticker: 'META', name: 'Meta Platforms', assetType: 'stock' },
    { ticker: 'JPM', name: 'JPMorgan Chase', assetType: 'stock' },
    { ticker: 'SPY', name: 'S&P 500 ETF', assetType: 'etf' },
    { ticker: 'QQQ', name: 'Nasdaq 100 ETF', assetType: 'etf' },
    { ticker: 'VTI', name: 'Vanguard Total Market', assetType: 'etf' },
    { ticker: 'IWM', name: 'Russell 2000 ETF', assetType: 'etf' },
    { ticker: 'GLD', name: 'Gold ETF', assetType: 'etf' },
    { ticker: 'TLT', name: '20yr Treasury ETF', assetType: 'etf' },
    { ticker: 'BTC-USD', name: 'Bitcoin', assetType: 'crypto' },
    { ticker: 'ETH-USD', name: 'Ethereum', assetType: 'crypto' },
    { ticker: 'BNB-USD', name: 'BNB', assetType: 'crypto' },
    { ticker: 'SOL-USD', name: 'Solana', assetType: 'crypto' },
    { ticker: 'XRP-USD', name: 'XRP', assetType: 'crypto' },
    { ticker: 'EUR-USD', name: 'Euro / US Dollar', assetType: 'forex' },
    { ticker: 'GBP-USD', name: 'British Pound / USD', assetType: 'forex' },
    { ticker: 'USD-JPY', name: 'US Dollar / Yen', assetType: 'forex' },
    { ticker: 'USD-CHF', name: 'US Dollar / Franc', assetType: 'forex' },
    { ticker: 'GC=F', name: 'Gold Futures', assetType: 'commodity' },
    { ticker: 'CL=F', name: 'Crude Oil Futures', assetType: 'commodity' },
    { ticker: 'SI=F', name: 'Silver Futures', assetType: 'commodity' },
    { ticker: 'NG=F', name: 'Natural Gas Futures', assetType: 'commodity' },
];

const FILTERS = ['All', 'Stocks', 'ETFs', 'Crypto', 'Forex', 'Commodities'] as const;
type Filter = typeof FILTERS[number];

const SORT_OPTIONS = [
    { label: 'Change % ↓', value: 'change_desc' },
    { label: 'Change % ↑', value: 'change_asc' },
    { label: 'Price ↓', value: 'price_desc' },
    { label: 'Price ↑', value: 'price_asc' },
    { label: 'Volume ↓', value: 'vol_desc' },
    { label: 'Volume ↑', value: 'vol_asc' },
];

const PAGE_SIZE = 20;

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssetRow {
    ticker: string;
    name: string;
    assetType: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    prevPrice?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtLarge(n: number): string {
    if (!n || isNaN(n)) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(0);
}

function filterTypeKey(f: Filter): string {
    const map: Record<Filter, string> = {
        All: 'all', Stocks: 'stock', ETFs: 'etf',
        Crypto: 'crypto', Forex: 'forex', Commodities: 'commodity',
    };
    return map[f];
}

async function batchQuotes(
    assets: typeof DEFAULT_ASSETS,
    batchSize = 5
): Promise<AssetRow[]> {
    const results: AssetRow[] = [];
    for (let i = 0; i < assets.length; i += batchSize) {
        const batch = assets.slice(i, i + batchSize);
        const settled = await Promise.allSettled(
            batch.map(a => api.getQuote(a.ticker, a.assetType))
        );
        settled.forEach((r, idx) => {
            if (r.status === 'fulfilled') {
                const q = r.value;
                results.push({
                    ticker: batch[idx].ticker,
                    name: batch[idx].name,
                    assetType: batch[idx].assetType,
                    price: q.price,
                    change: q.change,
                    changePercent: q.change_percent,
                    volume: q.volume,
                });
            }
        });
    }
    return results;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [rows, setRows] = useState<AssetRow[]>([]);
    const [flashes, setFlashes] = useState<Record<string, 'up' | 'down'>>({});
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState('');
    const [query, setQuery] = useState(searchParams.get('q') ?? '');
    const [filter, setFilter] = useState<Filter>(() => {
        const t = searchParams.get('type') ?? 'all';
        return (FILTERS.find(f => filterTypeKey(f) === t) ?? 'All');
    });
    const [sort, setSort] = useState(searchParams.get('sort') ?? 'change_desc');
    const [page, setPage] = useState(Number(searchParams.get('page') ?? 1));
    const [isSearch, setIsSearch] = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const prevRowsRef = useRef<AssetRow[]>([]);

    // ── URL sync ────────────────────────────────────────────────────────────────
    const syncURL = useCallback((q: string, f: Filter, s: string, p: number) => {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (filterTypeKey(f) !== 'all') params.set('type', filterTypeKey(f));
        if (s !== 'change_desc') params.set('sort', s);
        if (p > 1) params.set('page', String(p));
        router.replace(`/markets${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
    }, [router]);

    // ── Load default quotes ──────────────────────────────────────────────────────
    const loadDefaults = useCallback(async () => {
        try {
            setError('');
            const fresh = await batchQuotes(DEFAULT_ASSETS, 5);

            // Flash changed prices
            const prev = prevRowsRef.current;
            if (prev.length > 0) {
                const newFlashes: Record<string, 'up' | 'down'> = {};
                fresh.forEach(r => {
                    const old = prev.find(p => p.ticker === r.ticker);
                    if (old && old.price !== r.price) {
                        newFlashes[r.ticker] = r.price > old.price ? 'up' : 'down';
                    }
                });
                if (Object.keys(newFlashes).length > 0) {
                    setFlashes(newFlashes);
                    setTimeout(() => setFlashes({}), 800);
                }
            }

            prevRowsRef.current = fresh;
            setRows(fresh);
            setIsSearch(false);
        } catch (e: any) {
            setError(e?.message ?? t('common.error'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDefaults();
        intervalRef.current = setInterval(loadDefaults, 30_000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [loadDefaults]);

    // ── Search debounce ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (query.length < 2) {
            if (isSearch) loadDefaults();
            syncURL(query, filter, sort, 1);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const results = await api.searchAssets(query);
                const mapped: AssetRow[] = results.map(r => ({
                    ticker: r.ticker,
                    name: r.name,
                    assetType: r.asset_type,
                    price: 0, change: 0, changePercent: 0, volume: 0,
                }));
                setRows(mapped);
                setIsSearch(true);
                setPage(1);
            } catch {
                // silently fail search
            } finally {
                setSearching(false);
            }
            syncURL(query, filter, sort, 1);
        }, 500);
    }, [query]);

    // ── Filter/sort/page URL sync ───────────────────────────────────────────────
    useEffect(() => {
        syncURL(query, filter, sort, page);
    }, [filter, sort, page]);

    // ── Derived list ─────────────────────────────────────────────────────────────
    const filtered = rows.filter(r => {
        if (filter === 'All') return true;
        return r.assetType === filterTypeKey(filter);
    });

    const sorted = [...filtered].sort((a, b) => {
        switch (sort) {
            case 'price_desc': return b.price - a.price;
            case 'price_asc': return a.price - b.price;
            case 'change_asc': return a.changePercent - b.changePercent;
            case 'change_desc': return b.changePercent - a.changePercent;
            case 'vol_desc': return b.volume - a.volume;
            case 'vol_asc': return a.volume - b.volume;
            default: return b.changePercent - a.changePercent;
        }
    });

    const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
    const pageSlice = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <PageWrapper>
            <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700,500&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap');

        @keyframes flashUp {
          0%   { background: rgba(0,255,135,0.15); }
          100% { background: transparent; }
        }
        @keyframes flashDown {
          0%   { background: rgba(255,77,109,0.15); }
          100% { background: transparent; }
        }
        .flash-up   { animation: flashUp   0.8s ease-out; }
        .flash-down { animation: flashDown 0.8s ease-out; }

        .asset-row {
          cursor: pointer;
          transition: background 0.15s;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .asset-row:hover { background: rgba(255,255,255,0.03) !important; }
        .asset-row:last-child { border-bottom: none; }

        .filter-tab {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.08);
          color: #6b7a99;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          padding: 7px 14px;
          cursor: pointer;
          transition: all 0.15s;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }
        .filter-tab:hover { color: #f0f4ff; border-color: rgba(255,255,255,0.2); }
        .filter-tab.active {
          background: rgba(14,165,233,0.12);
          border-color: rgba(14,165,233,0.4);
          color: #0ea5e9;
        }

        .trade-btn {
          background: transparent;
          border: 1px solid rgba(0,255,135,0.25);
          color: #00ff87;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          padding: 5px 12px;
          cursor: pointer;
          letter-spacing: 0.06em;
          transition: all 0.15s;
          white-space: nowrap;
          text-decoration: none;
          display: inline-block;
        }
        .trade-btn:hover {
          background: rgba(0,255,135,0.1);
          border-color: rgba(0,255,135,0.5);
        }

        .search-input {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: #f0f4ff;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          padding: 10px 16px 10px 40px;
          outline: none;
          width: 100%;
          transition: all 0.2s;
        }
        .search-input:focus {
          border-color: rgba(0,255,135,0.4);
          background: rgba(255,255,255,0.06);
          box-shadow: 0 0 0 3px rgba(0,255,135,0.05);
        }
        .search-input::placeholder { color: #6b7a99; }

        .sort-select {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: #f0f4ff;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          padding: 8px 12px;
          outline: none;
          cursor: pointer;
          letter-spacing: 0.04em;
          transition: border-color 0.2s;
        }
        .sort-select:focus { border-color: rgba(0,255,135,0.4); }
        .sort-select option { background: #0d1120; }

        th {
          font-family: 'JetBrains Mono', monospace !important;
          font-size: 10px !important;
          color: #6b7a99 !important;
          letter-spacing: 0.08em !important;
          text-transform: uppercase !important;
          padding: 12px 16px !important;
          border-bottom: 1px solid rgba(255,255,255,0.06) !important;
          white-space: nowrap;
          background: #080b14;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        td {
          padding: 14px 16px !important;
          border-bottom: none !important;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          color: #f0f4ff;
        }

        .page-btn {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.08);
          color: #6b7a99;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          padding: 8px 16px;
          cursor: pointer;
          transition: all 0.15s;
          letter-spacing: 0.04em;
        }
        .page-btn:hover:not(:disabled) { border-color: rgba(0,255,135,0.3); color: #00ff87; }
        .page-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .controls-row { flex-direction: column !important; gap: 12px !important; }
          .filter-tabs { overflow-x: auto; padding-bottom: 4px; }
        }
      `}</style>

            <div style={{ maxWidth: 1400, margin: '0 auto' }}>

                {/* ── HEADER ── */}
                <div style={{ marginBottom: 32 }}>
                    <p style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11, color: '#6b7a99',
                        letterSpacing: '0.1em', marginBottom: 6,
                    }}>
            // MARKETS
                    </p>
                    <h1 style={{
                        fontFamily: 'Cabinet Grotesk, sans-serif',
                        fontWeight: 800,
                        fontSize: 'clamp(28px, 4vw, 42px)',
                        letterSpacing: '-0.03em', lineHeight: 1,
                        marginBottom: 6,
                    }}>
                        {t('markets.title')}
                    </h1>
                    <p style={{ color: '#6b7a99', fontWeight: 500, fontSize: 15 }}>
                        Browse and trade global assets
                    </p>
                </div>

                {/* ── CONTROLS ── */}
                <div
                    className="controls-row"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}
                >
                    {/* Search */}
                    <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 400 }}>
                        <svg
                            width="16" height="16"
                            fill="none" stroke="#6b7a99" strokeWidth="2"
                            viewBox="0 0 24 24"
                            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                        >
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            className="search-input"
                            placeholder={t('markets.search_placeholder')}
                            value={query}
                            onChange={e => { setQuery(e.target.value); setPage(1); }}
                        />
                        {query && (
                            <button
                                onClick={() => { setQuery(''); setPage(1); }}
                                style={{
                                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', color: '#6b7a99', cursor: 'pointer',
                                    fontSize: 16, lineHeight: 1,
                                }}
                            >
                                ×
                            </button>
                        )}
                    </div>

                    {/* Right: filters + sort */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div className="filter-tabs" style={{ display: 'flex', gap: 4 }}>
                            {FILTERS.map(f => (
                                <button
                                    key={f}
                                    className={`filter-tab${filter === f ? ' active' : ''}`}
                                    onClick={() => { setFilter(f); setPage(1); }}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        <select
                            className="sort-select"
                            value={sort}
                            onChange={e => setSort(e.target.value)}
                        >
                            {SORT_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* ── TABLE ── */}
                <div style={{
                    background: '#0d1120',
                    border: '1px solid rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                }}>
                    {loading ? (
                        <LoadingSpinner />
                    ) : error ? (
                        <div style={{ padding: 24 }}>
                            <button
                                onClick={loadDefaults}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid rgba(255,77,109,0.3)',
                                    color: '#ff4d6d',
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontSize: 12, padding: '8px 16px', cursor: 'pointer',
                                }}
                            >
                                {error} — {t('common.retry')}
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Searching indicator */}
                            {searching && (
                                <div style={{
                                    padding: '10px 20px',
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontSize: 11, color: '#6b7a99',
                                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                                    display: 'flex', alignItems: 'center', gap: 8,
                                }}>
                                    <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span>
                                    Searching...
                                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                                </div>
                            )}

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: 40 }}>#</th>
                                            <th>Asset</th>
                                            <th className="hide-mobile">Type</th>
                                            <th>Price</th>
                                            <th>Change</th>
                                            <th>Change %</th>
                                            <th className="hide-mobile">Volume</th>
                                            <th style={{ textAlign: 'right' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageSlice.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} style={{ textAlign: 'center', padding: '48px 24px', color: '#6b7a99' }}>
                                                    {query
                                                        ? `No assets found for "${query}"`
                                                        : t('markets.no_results')}
                                                </td>
                                            </tr>
                                        ) : pageSlice.map((row, i) => {
                                            const flash = flashes[row.ticker];
                                            return (
                                                <tr
                                                    key={row.ticker}
                                                    className={`asset-row${flash === 'up' ? ' flash-up' : flash === 'down' ? ' flash-down' : ''}`}
                                                    onClick={() => router.push(`/markets/${row.ticker}`)}
                                                >
                                                    {/* # */}
                                                    <td style={{ color: '#6b7a99', fontSize: 11, width: 40 }}>
                                                        {(page - 1) * PAGE_SIZE + i + 1}
                                                    </td>

                                                    {/* Asset */}
                                                    <td>
                                                        <div style={{
                                                            fontFamily: 'Cabinet Grotesk, sans-serif',
                                                            fontWeight: 800, fontSize: 15, color: '#f0f4ff',
                                                            marginBottom: 2,
                                                        }}>
                                                            {row.ticker}
                                                        </div>
                                                        <div style={{
                                                            fontFamily: 'JetBrains Mono, monospace',
                                                            fontSize: 10, color: '#6b7a99',
                                                            maxWidth: 160, overflow: 'hidden',
                                                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                        }}>
                                                            {row.name}
                                                        </div>
                                                    </td>

                                                    {/* Type */}
                                                    <td className="hide-mobile">
                                                        <Badge status={row.assetType as any} />
                                                    </td>

                                                    {/* Price */}
                                                    <td>
                                                        {row.price > 0
                                                            ? <PriceDisplay value={row.price} prefix="$" />
                                                            : <span style={{ color: '#6b7a99' }}>—</span>
                                                        }
                                                    </td>

                                                    {/* Change */}
                                                    <td>
                                                        {row.price > 0
                                                            ? <PriceDisplay value={row.change} showSign prefix="$" size="sm" />
                                                            : <span style={{ color: '#6b7a99' }}>—</span>
                                                        }
                                                    </td>

                                                    {/* Change % */}
                                                    <td>
                                                        {row.price > 0 ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                <span style={{ color: row.changePercent >= 0 ? '#00ff87' : '#ff4d6d', fontSize: 12 }}>
                                                                    {row.changePercent >= 0 ? '↑' : '↓'}
                                                                </span>
                                                                <PriceDisplay value={row.changePercent} showSign showPercent size="sm" />
                                                            </div>
                                                        ) : <span style={{ color: '#6b7a99' }}>—</span>}
                                                    </td>

                                                    {/* Volume */}
                                                    <td className="hide-mobile" style={{ color: '#6b7a99' }}>
                                                        {fmtLarge(row.volume)}
                                                    </td>

                                                    {/* Action */}
                                                    <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                                        <Link href={`/markets/${row.ticker}`} className="trade-btn">
                                                            TRADE →
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* ── PAGINATION ── */}
                            {sorted.length > PAGE_SIZE && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '16px 20px',
                                    borderTop: '1px solid rgba(255,255,255,0.06)',
                                    flexWrap: 'wrap',
                                    gap: 12,
                                }}>
                                    <span style={{
                                        fontFamily: 'JetBrains Mono, monospace',
                                        fontSize: 11, color: '#6b7a99',
                                    }}>
                                        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} assets
                                    </span>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            className="page-btn"
                                            disabled={page <= 1}
                                            onClick={() => setPage(p => p - 1)}
                                        >
                                            ← Prev
                                        </button>
                                        <button
                                            className="page-btn"
                                            disabled={page >= totalPages}
                                            onClick={() => setPage(p => p + 1)}
                                        >
                                            Next →
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </PageWrapper>
    );
}