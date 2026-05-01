// components/layout/PageWrapper.tsx
// Purpose: Wraps all protected pages. Handles auth check and renders Navbar.
// Depends on: lib/auth.ts, components/layout/Navbar.tsx

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Navbar from './Navbar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface PageWrapperProps {
    children: React.ReactNode;
}

export default function PageWrapper({ children }: PageWrapperProps) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && user === null) {
            router.push('/login');
        }
    }, [isLoading, user, router]);

    if (isLoading) {
        return <LoadingSpinner fullPage />;
    }

    if (!user) {
        return null;
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 py-6">
                {children}
            </main>
        </div>
    );
}