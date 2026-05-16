const PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

function isAndroidRuntime(): boolean {
    if (typeof window === 'undefined') return false;

    const capacitor = (window as any).Capacitor;
    if (capacitor?.getPlatform?.() === 'android') return true;

    const userAgent = window.navigator.userAgent || '';
    return /Android/i.test(userAgent) && /\bwv\b|Version\/\d+\.\d+/i.test(userAgent);
}

function normalizeApiBase(base: string): string {
    const trimmed = base.trim().replace(/\/+$/, '');
    if (!trimmed) return '';
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

export function getApiBase(): string {
    if (isAndroidRuntime()) {
        return normalizeApiBase(PUBLIC_API_BASE);
    }

    return '';
}

export function apiUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const apiPath = normalizedPath.startsWith('/api/') || normalizedPath === '/api'
        ? normalizedPath.slice('/api'.length) || '/'
        : normalizedPath;
    const apiBase = getApiBase();

    if (!apiBase) {
        return `/api${apiPath === '/' ? '' : apiPath}`;
    }

    return `${apiBase}${apiPath === '/' ? '' : apiPath}`;
}
