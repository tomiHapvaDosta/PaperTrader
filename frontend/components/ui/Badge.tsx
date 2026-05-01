// components/ui/Badge.tsx
// Purpose: Status and side badge component with color coding.

type BadgeStatus = 'pending' | 'executed' | 'cancelled' | 'buy' | 'sell';

interface BadgeProps {
    status: BadgeStatus;
}

const badgeStyles: Record<BadgeStatus, { bg: string; color: string; label: string }> = {
    pending: { bg: 'rgba(245,158,11,0.12)', color: 'var(--yellow)', label: 'PENDING' },
    executed: { bg: 'rgba(34,197,94,0.12)', color: 'var(--green)', label: 'EXECUTED' },
    cancelled: { bg: 'rgba(148,163,184,0.12)', color: 'var(--text-muted)', label: 'CANCELLED' },
    buy: { bg: 'rgba(59,130,246,0.12)', color: 'var(--blue)', label: 'BUY' },
    sell: { bg: 'rgba(239,68,68,0.12)', color: 'var(--red)', label: 'SELL' },
};

export default function Badge({ status }: BadgeProps) {
    const { bg, color, label } = badgeStyles[status] ?? badgeStyles.cancelled;

    return (
        <span
            style={{
                background: bg,
                color,
                fontFamily: 'DM Mono, monospace',
                fontSize: '10px',
                letterSpacing: '0.08em',
                fontWeight: 500,
                padding: '2px 8px',
                borderRadius: '2px',
                display: 'inline-block',
            }}
        >
            {label}
        </span>
    );
}