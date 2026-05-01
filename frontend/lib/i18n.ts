// lib/i18n.ts
// Purpose: Simple i18n utility. Resolves translation keys from locales/en.json.
// Structured for future multi-language support without refactoring.

import en from '@/locales/en.json';

type TranslationDict = { [key: string]: string | TranslationDict };

const locales: Record<string, TranslationDict> = { en };

// Hardcoded to 'en' for now — can be made dynamic (localStorage/context) later
let currentLocale = 'en';

export function setLocale(locale: string): void {
    if (locales[locale]) currentLocale = locale;
}

export function t(key: string): string {
    const dict = locales[currentLocale] ?? locales['en'];
    const parts = key.split('.');
    let current: TranslationDict | string = dict;

    for (const part of parts) {
        if (typeof current !== 'object' || current === null) return key;
        current = (current as TranslationDict)[part];
        if (current === undefined) return key;
    }

    return typeof current === 'string' ? current : key;
}

export function useTranslation() {
    return t;
}
