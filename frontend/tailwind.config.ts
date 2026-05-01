// tailwind.config.ts
// Purpose: Tailwind configuration with class-based dark mode and custom theme tokens.

import type { Config } from 'tailwindcss';

const config: Config = {
    darkMode: 'class',
    content: [
        './app/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './lib/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Syne', 'sans-serif'],
                mono: ['DM Mono', 'monospace'],
                data: ['DM Mono', 'monospace'],
            },
            colors: {
                green: '#22c55e',
                red: '#ef4444',
                blue: '#3b82f6',
                yellow: '#f59e0b',
            },
        },
    },
    plugins: [],
};

export default config;