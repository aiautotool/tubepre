'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MdPublic, MdCheck } from 'react-icons/md';

const REGIONS = [
    { code: 'VN', label: 'Vietnam', flag: '🇻🇳' },
    { code: 'US', label: 'United States', flag: '🇺🇸' },
    { code: 'JP', label: 'Japan', flag: '🇯🇵' },
    { code: 'KR', label: 'South Korea', flag: '🇰🇷' },
    { code: 'IN', label: 'India', flag: '🇮🇳' },
    { code: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
    { code: 'GLOBAL', label: 'Global', flag: '🌐' },
];

function getRegionCookie(): string {
    if (typeof document === 'undefined') return 'VN';
    const match = document.cookie.match(/(?:^|; )region=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : 'VN';
}

function setRegionCookie(code: string) {
    document.cookie = `region=${encodeURIComponent(code)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax; Secure`;
}

export default function RegionSelector() {
    const [isOpen, setIsOpen] = useState(false);
    const [selected, setSelected] = useState('VN');
    const menuRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        setSelected(getRegionCookie());
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (code: string) => {
        setSelected(code);
        setRegionCookie(code);
        setIsOpen(false);
        // Dispatch custom event for immediate notification
        window.dispatchEvent(new CustomEvent('regionchange', { detail: { region: code } }));
        router.refresh();
    };

    const current = REGIONS.find(r => r.code === selected) || REGIONS[0];

    return (
        <div ref={menuRef} style={{ position: 'relative' }}>
            <button
                className="yt-icon-btn"
                onClick={() => setIsOpen(!isOpen)}
                title={`Region: ${current.label}`}
                style={{ fontSize: '18px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
                <span style={{ fontSize: '20px' }}>{current.flag === '🌐' ? undefined : current.flag}</span>
                {current.flag === '🌐' && <MdPublic size={22} />}
            </button>

            {isOpen && (
                <div className="dropdown-animated" style={{
                    position: 'absolute',
                    top: '44px',
                    right: 0,
                    backgroundColor: 'var(--yt-background)',
                    border: '1px solid var(--yt-border)',
                    borderRadius: '12px',
                    boxShadow: 'var(--yt-shadow-lg)',
                    padding: '8px 0',
                    zIndex: 1000,
                    minWidth: '200px',
                    overflow: 'hidden',
                    transformOrigin: 'top right',
                }}>
                    <div style={{ padding: '8px 16px', fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid var(--yt-border)', marginBottom: '4px', color: 'var(--yt-text-primary)' }}>
                        Select Region
                    </div>
                    {REGIONS.map(r => (
                        <button
                            key={r.code}
                            onClick={() => handleSelect(r.code)}
                            className="format-item-hover"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                width: '100%',
                                padding: '10px 16px',
                                backgroundColor: r.code === selected ? 'var(--yt-hover)' : 'transparent',
                                border: 'none',
                                color: 'var(--yt-text-primary)',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '14px',
                                transition: 'background-color 0.2s'
                            }}
                        >
                            <span style={{ fontSize: '20px' }}>{r.flag}</span>
                            <span style={{ fontWeight: r.code === selected ? '600' : '400', flex: 1 }}>{r.label}</span>
                            {r.code === selected && <MdCheck size={18} style={{ color: 'var(--yt-blue)', flexShrink: 0 }} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
