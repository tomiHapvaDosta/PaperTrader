// components/ui/ErrorMessage.tsx
// Purpose: Displays an error message with optional retry action.

import { t } from '@/lib/i18n';

interface ErrorMessageProps {
    message: string;
    onRetry?: () => void;
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
    return (
        <div
            style={{
                border: '1px solid var(--red)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
            }}
        >
            <span
                style={{
                    color: 'var(--red)',
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '13px',
                }}
            >
                {message}
            </span>
            {onRetry && (
                <button
                    onClick={onRetry}
                    style={{
                        color: 'var(--red)',
                        border: '1px solid var(--red)',
                        background: 'transparent',
                        padding: '4px 12px',
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '11px',
                        letterSpacing: '0.06em',
                        cursor: 'pointer',
                    }}
                >
                    {t('common.retry')}
                </button>
            )}
        </div>
    );
}