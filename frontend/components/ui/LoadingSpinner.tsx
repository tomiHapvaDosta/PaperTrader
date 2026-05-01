// components/ui/LoadingSpinner.tsx
// Purpose: Loading spinner component. Supports full-page overlay mode.

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    fullPage?: boolean;
}

const sizeMap = { sm: 16, md: 24, lg: 40 };

export default function LoadingSpinner({ size = 'md', fullPage = false }: LoadingSpinnerProps) {
    const px = sizeMap[size];

    const spinner = (
        <svg
            width={px}
            height={px}
            viewBox="0 0 24 24"
            fill="none"
            style={{ animation: 'spin 0.8s linear infinite' }}
        >
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <circle
                cx="12" cy="12" r="10"
                stroke="var(--border)"
                strokeWidth="2"
            />
            <path
                d="M12 2 A10 10 0 0 1 22 12"
                stroke="var(--blue)"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );

    if (fullPage) {
        return (
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg)',
                    zIndex: 100,
                }}
            >
                {spinner}
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            {spinner}
        </div>
    );
}