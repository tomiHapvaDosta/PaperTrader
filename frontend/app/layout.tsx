// app/layout.tsx
// Purpose: Root layout. Wraps app with AuthProvider, applies fonts,
// handles dark mode class with no flash on load.

import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth';
import '@/app/globals.css';

export const metadata: Metadata = {
    title: 'PaperTrader',
    description: 'Practice investing with real market data and virtual money.',
};

// Inline script: runs before React hydration to set .dark class immediately.
// Prevents flash of wrong theme.
const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('pt_theme');
    var isDark = stored ? stored === 'dark' : true;
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch(e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeScript }} />
            </head>
            <body>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}