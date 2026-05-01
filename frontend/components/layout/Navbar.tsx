// components/layout/Navbar.tsx
// Purpose: Top navigation bar for all protected pages.
// Depends on: lib/auth.ts, lib/i18n.ts

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';

const NAV_LINKS = [
    { href: '/dashboard', key: 'nav.dashboard' },
    { href: '/markets', key: 'nav.markets' },
    { href: '/orders', key: 'nav.orders' },
    { href: '/settings', key: 'nav.settings' },
];

export default function Navbar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const [dark, setDark] = useState(() => {
        if (typeof window === 'undefined') {
            return true;
        }

        const stored = localStorage.getItem('pt_theme');
        return stored ? stored === 'dark' : true;
    });
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark);
    }, [dark]);

    const toggleTheme = () => {
        const next = !dark;
        setDark(next);
        localStorage.setItem('pt_theme', next ? 'dark' : 'light');
    };

    return (
        <nav
            style={{
                background: 'var(--surface)',
                borderBottom: '1px solid var(--border)',
            }}
            className="sticky top-0 z-50"
        >
            <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between gap-6">

                {/* Logo */}
                <Link
                    href="/dashboard"
                    className="font-bold text-base tracking-tight shrink-0"
                    style={{ color: 'var(--blue)', fontFamily: 'Syne, sans-serif' }}
                >
                    PAPERTRADER
                </Link>

                {/* Desktop nav links */}
                <div className="hidden md:flex items-center gap-1 flex-1">
                    {NAV_LINKS.map(({ href, key }) => {
                        const active = pathname === href || pathname.startsWith(href + '/');
                        return (
                            <Link
                                key={href}
                                href={href}
                                className="px-3 py-1 text-xs font-medium tracking-wider uppercase transition-colors"
                                style={{
                                    color: active ? 'var(--blue)' : 'var(--text-muted)',
                                    background: active ? 'rgba(59,130,246,0.08)' : 'transparent',
                                    fontFamily: 'DM Mono, monospace',
                                    letterSpacing: '0.06em',
                                }}
                            >
                                {t(key)}
                            </Link>
                        );
                    })}
                </div>

                {/* Right side — desktop */}
                <div className="hidden md:flex items-center gap-3">
                    {/* Username */}
                    {user?.username && (
                        <span
                            className="text-xs"
                            style={{ color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}
                        >
                            {user.username}
                        </span>
                    )}

                    {/* Theme toggle */}
                    <button
                        onClick={toggleTheme}
                        className="w-7 h-7 flex items-center justify-center transition-colors"
                        style={{
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border)',
                        }}
                        title={dark ? t('settings.light_mode') : t('settings.dark_mode')}
                    >
                        {dark ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" />
                                <line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" />
                                <line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                            </svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                        )}
                    </button>

                    {/* Logout */}
                    <button
                        onClick={logout}
                        className="px-3 py-1 text-xs font-medium tracking-wider uppercase transition-colors"
                        style={{
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border)',
                            fontFamily: 'DM Mono, monospace',
                        }}
                    >
                        {t('nav.logout')}
                    </button>
                </div>

                {/* Mobile hamburger */}
                <button
                    className="md:hidden w-8 h-8 flex flex-col items-center justify-center gap-1.5"
                    onClick={() => setMenuOpen(v => !v)}
                    aria-label="Toggle menu"
                >
                    <span style={{ width: 18, height: 1, background: 'var(--text)', display: 'block' }} />
                    <span style={{ width: 18, height: 1, background: 'var(--text)', display: 'block' }} />
                    <span style={{ width: 12, height: 1, background: 'var(--text)', display: 'block' }} />
                </button>
            </div>

            {/* Mobile menu */}
            {menuOpen && (
                <div
                    className="md:hidden px-4 pb-4 flex flex-col gap-1"
                    style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
                >
                    {NAV_LINKS.map(({ href, key }) => (
                        <Link
                            key={href}
                            href={href}
                            onClick={() => setMenuOpen(false)}
                            className="py-2 text-xs font-medium tracking-wider uppercase"
                            style={{
                                color: pathname === href ? 'var(--blue)' : 'var(--text-muted)',
                                fontFamily: 'DM Mono, monospace',
                            }}
                        >
                            {t(key)}
                        </Link>
                    ))}
                    <div className="flex items-center gap-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                        <button
                            onClick={toggleTheme}
                            className="text-xs"
                            style={{ color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}
                        >
                            {dark ? t('settings.light_mode') : t('settings.dark_mode')}
                        </button>
                        <button
                            onClick={logout}
                            className="text-xs"
                            style={{ color: 'var(--red)', fontFamily: 'DM Mono, monospace' }}
                        >
                            {t('nav.logout')}
                        </button>
                    </div>
                </div>
            )}
        </nav>
    );
}
