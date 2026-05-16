'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface SidebarContextType {
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    openSidebar: () => void;
    closeSidebar: () => void;
    isMobileMenuOpen: boolean;
    toggleMobileMenu: () => void;
    openMobileMenu: () => void;
    closeMobileMenu: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
    // Sidebar is open by default on desktop (hidden on mobile via CSS)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);
    const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
    const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

    const toggleMobileMenu = useCallback(() => setIsMobileMenuOpen(prev => !prev), []);
    const openMobileMenu = useCallback(() => setIsMobileMenuOpen(true), []);
    const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMobileMenuOpen]);

    return (
        <SidebarContext.Provider value={{ 
            isSidebarOpen, toggleSidebar, openSidebar, closeSidebar,
            isMobileMenuOpen, toggleMobileMenu, openMobileMenu, closeMobileMenu
        }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (context === undefined) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
}
