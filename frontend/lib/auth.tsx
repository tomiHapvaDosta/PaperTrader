'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import * as api from './api';

interface User {
    id: number;
    email: string;
    username: string;
}

interface AuthContextValue {
    user: User | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

interface LoginResponse {
    user: User;
}

export const AuthContext = createContext<AuthContextValue>({
    user: null,
    isLoading: true,
    login: async () => {},
    logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                await api.getPortfolio();

                const stored = sessionStorage.getItem('pt_user');
                if (stored) {
                    setUser(JSON.parse(stored));
                } else {
                    setUser(null);
                }
            } catch {
                setUser(null);
                sessionStorage.removeItem('pt_user');
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = async (email: string, password: string) => {
        const res = (await api.login(email, password)) as LoginResponse;

        if (!res?.user) {
            throw new Error('Invalid login response');
        }

        const userData: User = res.user;
        setUser(userData);
        sessionStorage.setItem('pt_user', JSON.stringify(userData));
    };

    const logout = async () => {
        await api.logout();
        setUser(null);
        sessionStorage.removeItem('pt_user');
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
