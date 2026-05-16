'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    MdClose,
    MdEmojiEvents,
    MdHistory,
    MdHomeFilled,
    MdKeyboardArrowRight,
    MdKeyboardArrowUp,
    MdMusicNote,
    MdOutlineNewspaper,
    MdOutlineSlowMotionVideo,
    MdOutlineSubscriptions,
    MdPlaylistPlay,
} from 'react-icons/md';
import { PiGameControllerBold } from 'react-icons/pi';
import { useSidebar } from '../context/SidebarContext';
import { type ReactNode, useEffect, useState } from 'react';

export default function HamburgerMenu() {
    const pathname = usePathname();
    const router = useRouter();
    const { isMobileMenuOpen, closeMobileMenu } = useSidebar();
    const [category, setCategory] = useState('');

    const primaryItems = [
        { icon: <MdHomeFilled size={30} />, label: 'Trang chủ', path: '/' },
        { icon: <MdOutlineSlowMotionVideo size={30} />, label: 'Shorts', path: '/shorts' },
        { icon: <MdOutlineSubscriptions size={30} />, label: 'Kênh đăng ký', path: '/feed/subscriptions' },
    ];

    const userItems = [
        { icon: <MdHistory size={30} />, label: 'Video đã xem', path: '/feed/library' },
        { icon: <MdPlaylistPlay size={30} />, label: 'Danh sách phát', path: '/feed/library' },
    ];

    const exploreItems = [
        { icon: <MdMusicNote size={30} />, label: 'Âm nhạc', path: '/?category=Music', category: 'Music' },
        { icon: <PiGameControllerBold size={30} />, label: 'Trò chơi', path: '/?category=Gaming', category: 'Gaming' },
        { icon: <MdOutlineNewspaper size={30} />, label: 'Tin tức', path: '/?category=News', category: 'News' },
        { icon: <MdEmojiEvents size={30} />, label: 'Thể thao', path: '/?category=Sports', category: 'Sports' },
    ];

    const isItemActive = (item: { path: string; category?: string }) => {
        if (item.category) {
            return pathname === '/' && category === item.category;
        }
        return pathname === item.path && !item.category;
    };

    // Close menu on route change
    useEffect(() => {
        closeMobileMenu();
        setCategory(new URLSearchParams(window.location.search).get('category') || '');
    }, [pathname, closeMobileMenu]);

    const handleNavClick = (item: { path: string; category?: string }) => {
        closeMobileMenu();

        if (!item.category) return;

        setCategory(item.category);
        window.dispatchEvent(new CustomEvent('categorychange', { detail: { category: item.category } }));
        router.push(`/?category=${encodeURIComponent(item.category)}`);
    };

    const renderNavItem = (item: { icon: ReactNode; label: string; path: string; category?: string }) => {
        const isActive = isItemActive(item);

        return (
            <Link
                key={item.label}
                href={item.path}
                className={`drawer-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item)}
            >
                <div className="drawer-nav-icon">
                    {item.icon}
                </div>
                <span className="drawer-nav-label">
                    {item.label}
                </span>
            </Link>
        );
    };

    return (
        <>
            {/* Backdrop */}
            <div 
                className={`drawer-backdrop ${isMobileMenuOpen ? 'open' : ''}`}
                onClick={closeMobileMenu}
            />

            {/* Menu Drawer */}
            <div className={`hamburger-drawer ${isMobileMenuOpen ? 'open' : ''}`}>
                <div className="drawer-header">
                    <button className="yt-icon-btn" onClick={closeMobileMenu} title="Close Menu">
                        <MdClose size={24} />
                    </button>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px' }} onClick={closeMobileMenu}>
                        <span style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.5px', fontFamily: 'YouTube Sans, Roboto, Arial, sans-serif' }}>Premium</span>
                    </Link>
                </div>

                <div className="drawer-content">
                    {primaryItems.map(renderNavItem)}

                    <div className="drawer-divider" />
                    <Link href="/feed/library" className="drawer-section-heading" onClick={closeMobileMenu}>
                        <span>Bạn</span>
                        <MdKeyboardArrowRight size={26} />
                    </Link>
                    {userItems.map(renderNavItem)}

                    <div className="drawer-divider" />
                    <div className="drawer-section-heading drawer-section-heading-static">
                        <span>Khám phá</span>
                    </div>
                    {exploreItems.map(renderNavItem)}
                    <button type="button" className="drawer-nav-item drawer-collapse-item" onClick={closeMobileMenu}>
                        <div className="drawer-nav-icon">
                            <MdKeyboardArrowUp size={30} />
                        </div>
                        <span className="drawer-nav-label">Ẩn bớt</span>
                    </button>
                </div>
            </div>
        </>
    );
}
