// lib/api.ts
// Purpose: Central API client. All HTTP calls to the Go backend go through here.
// No other file should call fetch() directly.

const API_BASE_URL = 'http://localhost:8080/api/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderRequest {
    ticker: string;
    asset_type: string;
    order_type: 'market' | 'limit' | 'stop_loss';
    side: 'buy' | 'sell';
    quantity?: number;
    amount_usd?: number;
    limit_price?: number;
    stop_price?: number;
}

export interface Quote {
    ticker: string;
    price: number;
    change: number;
    change_percent: number;
    high: number;
    low: number;
    open: number;
    previous_close: number;
    volume: number;
    asset_type: string;
    updated_at: string;
}

export interface Candle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface AssetProfile {
    ticker: string;
    name: string;
    asset_type: string;
    exchange: string;
    currency: string;
    description: string;
    logo: string;
}

export interface SearchResult {
    ticker: string;
    name: string;
    asset_type: string;
    exchange: string;
}

export interface Position {
    ticker: string;
    asset_type: string;
    quantity: number;
    avg_buy_price: number;
    current_price: number;
    position_value: number;
    pnl: number;
    pnl_percent: number;
}

export interface Order {
    id: number;
    user_id: number;
    ticker: string;
    asset_type: string;
    order_type: string;
    side: string;
    quantity: number;
    price: number;
    limit_price?: number;
    stop_price?: number;
    status: string;
    fee: number;
    executed_at?: string;
    created_at: string;
}

export interface Portfolio {
    cash_balance: number;
    starting_balance: number;
    total_value: number;
    total_pnl: number;
    total_pnl_percent: number;
    positions: Position[];
}

// ─── Error class ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
    constructor(public message: string, public status: number) {
        super(message);
        this.name = 'ApiError';
    }
}

// ─── Base fetch ───────────────────────────────────────────────────────────────

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers ?? {}),
        },
    });

    const body = await res.json();

    if (!body.success) {
        throw new ApiError(body.error ?? 'Unknown error', res.status);
    }

    return body.data as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const register = (email: string, username: string, password: string, starting_balance: number) =>
    apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, password, starting_balance }),
    });

export const login = (email: string, password: string) =>
    apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });

export const logout = () =>
    apiFetch('/auth/logout', { method: 'POST' });

// ─── Portfolio ────────────────────────────────────────────────────────────────

export const getPortfolio = () =>
    apiFetch<Portfolio>('/portfolio');

export const getSnapshots = (days = 30) =>
    apiFetch<{ total_value: number; created_at: string }[]>(`/portfolio/snapshots?days=${days}`);

// ─── Positions ────────────────────────────────────────────────────────────────

export const getPositions = () =>
    apiFetch<Position[]>('/positions');

// ─── Orders ───────────────────────────────────────────────────────────────────

export const getOrders = (status = 'all', limit = 50, offset = 0) =>
    apiFetch<{ orders: Order[]; total: number; limit: number; offset: number }>(
        `/orders?status=${status}&limit=${limit}&offset=${offset}`
    );

export const placeOrder = (orderRequest: OrderRequest) =>
    apiFetch<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify(orderRequest),
    });

export const cancelOrder = (id: number) =>
    apiFetch(`/orders/${id}`, { method: 'DELETE' });

// ─── Market ───────────────────────────────────────────────────────────────────

export const getQuote = (ticker: string, assetType: string) =>
    apiFetch<Quote>(`/market/quote/${ticker}?asset_type=${assetType}`);

export const getCandles = (ticker: string, assetType: string, from: number, to: number, resolution: string) =>
    apiFetch<Candle[]>(`/market/candles/${ticker}?asset_type=${assetType}&from=${from}&to=${to}&resolution=${resolution}`);

export const searchAssets = (query: string) =>
    apiFetch<SearchResult[]>(`/market/search?q=${encodeURIComponent(query)}`);

export const getProfile = (ticker: string, assetType: string) =>
    apiFetch<AssetProfile>(`/market/profile/${ticker}?asset_type=${assetType}`);

// ─── Fees ─────────────────────────────────────────────────────────────────────

export const estimateFee = (ticker: string, assetType: string, quantity: number, price?: number) => {
    const params = new URLSearchParams({ ticker, asset_type: assetType, quantity: String(quantity) });
    if (price !== undefined) params.set('price', String(price));
    return apiFetch<{
        ticker: string;
        quantity: number;
        price: number;
        trade_value: number;
        fee: number;
        total_cost: number;
    }>(`/fees/estimate?${params.toString()}`);
};