// components/ui/PriceDisplay.tsx
// Purpose: Displays a price value with color coding and monospace font.

interface PriceDisplayProps {
    value: number;
    showSign?: boolean;
    showPercent?: boolean;
    prefix?: string;
    size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
    sm: '12px',
    md: '14px',
    lg: '20px',
};

export default function PriceDisplay({
    value,
    showSign = false,
    showPercent = false,
    prefix = '',
    size = 'md',
}: PriceDisplayProps) {
    const color =
        value > 0 ? 'var(--green)' :
            value < 0 ? 'var(--red)' :
                'var(--text-muted)';

    const formatValue = (v: number): string => {
        const abs = Math.abs(v);
        if (!showPercent && abs < 0.01 && abs > 0) {
            return abs.toFixed(6);
        }
        return abs.toFixed(2);
    };

    const sign = showSign && value > 0 ? '+' : value < 0 ? '-' : '';
    const formatted = `${prefix}${sign}${formatValue(value)}${showPercent ? '%' : ''}`;

    return (
        <span
            style={{
                color,
                fontFamily: 'DM Mono, monospace',
                fontSize: sizeMap[size],
                fontWeight: 400,
            }}
        >
            {formatted}
        </span>
    );
}