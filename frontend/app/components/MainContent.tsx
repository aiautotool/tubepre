'use client';

import { useSidebar } from '../context/SidebarContext';
import { ReactNode } from 'react';

export default function MainContent({ children }: { children: ReactNode }) {
    const { isSidebarOpen } = useSidebar();
    
    return (
        <main className={`yt-main-content ${isSidebarOpen ? 'sidebar-open' : ''}`}>
            {children}
        </main>
    );
}