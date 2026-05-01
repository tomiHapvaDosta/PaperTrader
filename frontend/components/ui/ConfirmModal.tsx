// components/ui/ConfirmModal.tsx
// Purpose: Trade confirmation modal with full fee breakdown.
// Depends on: lib/i18n.ts

'use client';

import { useEffect } from 'react';
import { t } from '@/lib/i18n';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    data: {
        ticker: string;
        side: 'buy' | 'sell';
        quantity: number;
        price: number;
        tradeValue: number;
        fee: number;
        totalCost: number;
    };
}

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, data }: ConfirmModalProps) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        if (isOpen) document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const rows = [
        { label: t('orders.ticker'), value: data.ticker },
        { label: t('orders.side'), value: data.side.toUpperCase() },
        { label: t('orders.quantity'), value: data.quantity.toString() },
        { label: t('markets.price'), value: `$${data.price.toFixed(2)}` },
        { label: 'Trade Value', value: `$${data.tradeValue.toFixed(2)}` },
        { label: t('asset.estimated_fee'), value: `$${data.fee.toFixed(2)}` },
        { label: t('asset.total_cost'), value: `$${data.totalCost.toFixed(2)}` },
    ];

    const confirmColor = data.side === 'buy' ? 'var(--green)' : 'var(--red)';

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 200,
                padding: 16,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    width: '100%',
                    maxWidth: 400,
                    padding: 24,
                }}
            >
                {/* Title */}
                <div
                    style={{
                        fontFamily: 'Syne, sans-serif',
                        fontWeight: 700,
                        fontSize: 16,
                        marginBottom: 20,
                        color: 'var(--text)',
                    }}
                >
                    {title}
                </div>

                {/* Breakdown table */}
                <div style={{ borderTop: '1px solid var(--border)' }}>
                    {rows.map(({ label, value }) => (
                        <div
                            key={label}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 0',
                                borderBottom: '1px solid var(--border)',
                            }}
                        >
                            <span style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'DM Mono, monospace' }}>
                                {label}
                            </span>
                            <span style={{ color: 'var(--text)', fontSize: 13, fontFamily: 'DM Mono, monospace' }}>
                                {value}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1,
                            padding: '10px 0',
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            color: 'var(--text-muted)',
                            fontFamily: 'DM Mono, monospace',
                            fontSize: 12,
                            letterSpacing: '0.06em',
                            cursor: 'pointer',
                        }}
                    >
                        {t('common.cancel').toUpperCase()}
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            flex: 1,
                            padding: '10px 0',
                            background: 'transparent',
                            border: `1px solid ${confirmColor}`,
                            color: confirmColor,
                            fontFamily: 'DM Mono, monospace',
                            fontSize: 12,
                            letterSpacing: '0.06em',
                            cursor: 'pointer',
                            fontWeight: 500,
                        }}
                    >
                        {t('common.confirm').toUpperCase()}
                    </button>
                </div>
            </div>
        </div>
    );
}