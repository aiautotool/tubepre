'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { IoMoonOutline, IoSunnyOutline, IoArrowBack, IoMenuOutline, IoMicOutline, IoMic, IoTimeOutline, IoClose } from 'react-icons/io5';
import RegionSelector from './RegionSelector';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import { Logo, SearchIcon } from '../icons';
import { addSearchHistory, clearSearchHistory, getSearchHistory, removeSearchHistory, SearchHistoryItem } from '../storage';

type SpeechRecognitionResultEvent = Event & {
    results: {
        [index: number]: {
            [index: number]: {
                transcript: string;
            };
        };
    };
};

type SpeechRecognitionInstance = {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    start: () => void;
    stop: () => void;
    onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
    interface Window {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
        KVTubeAndroidVoice?: {
            startVoiceSearch: () => void;
        };
    }
}

export default function Header() {
    const [searchQuery, setSearchQuery] = useState('');
    const [isMobileSearchActive, setIsMobileSearchActive] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const mobileInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const searchBoxRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const { toggleMobileMenu } = useSidebar();

    const runSearch = (rawQuery: string) => {
        const query = rawQuery.trim();
        if (query) {
            addSearchHistory(query);
            setSearchQuery(query);
            setSearchHistory(getSearchHistory());
            setShowHistory(false);
            router.push(`/search?q=${encodeURIComponent(query)}`);
            setIsMobileSearchActive(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        runSearch(searchQuery);
    };

    const handleVoiceSearch = () => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
            return;
        }

        if (window.KVTubeAndroidVoice?.startVoiceSearch) {
            setIsListening(true);
            window.KVTubeAndroidVoice.startVoiceSearch();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            window.alert('Trình duyệt này chưa hỗ trợ tìm kiếm bằng giọng nói.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'vi-VN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            const transcript = event.results[0]?.[0]?.transcript?.trim();
            if (transcript) {
                runSearch(transcript);
            }
        };
        recognition.onerror = () => {
            setIsListening(false);
        };
        recognition.onend = () => {
            setIsListening(false);
            recognitionRef.current = null;
        };

        setIsListening(true);
        recognition.start();
    };

    useEffect(() => {
        const handleAndroidVoiceResult = (event: Event) => {
            const transcript = (event as CustomEvent<{ transcript?: string }>).detail?.transcript?.trim();
            setIsListening(false);
            if (transcript) {
                runSearch(transcript);
            }
        };

        const handleAndroidVoiceListening = (event: Event) => {
            const listening = Boolean((event as CustomEvent<{ listening?: boolean }>).detail?.listening);
            setIsListening(listening);
        };

        const handleAndroidVoiceError = (event: Event) => {
            const message = (event as CustomEvent<{ message?: string }>).detail?.message;
            setIsListening(false);
            if (message) {
                window.alert(message);
            }
        };

        window.addEventListener('kvtube-voice-result', handleAndroidVoiceResult);
        window.addEventListener('kvtube-voice-listening', handleAndroidVoiceListening);
        window.addEventListener('kvtube-voice-error', handleAndroidVoiceError);
        return () => {
            window.removeEventListener('kvtube-voice-result', handleAndroidVoiceResult);
            window.removeEventListener('kvtube-voice-listening', handleAndroidVoiceListening);
            window.removeEventListener('kvtube-voice-error', handleAndroidVoiceError);
        };
    }, []);

    useEffect(() => {
        if (isMobileSearchActive && mobileInputRef.current) {
            mobileInputRef.current.focus();
            setSearchHistory(getSearchHistory());
            setShowHistory(true);
        }
    }, [isMobileSearchActive]);

    useEffect(() => {
        setSearchHistory(getSearchHistory());

        const handlePointerDown = (event: PointerEvent) => {
            if (!searchBoxRef.current?.contains(event.target as Node)) {
                setShowHistory(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => {
            recognitionRef.current?.stop();
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, []);

    const openSearchHistory = () => {
        setSearchHistory(getSearchHistory());
        setShowHistory(true);
    };

    const handleRemoveSearchHistory = (query: string) => {
        removeSearchHistory(query);
        setSearchHistory(getSearchHistory());
    };

    const handleClearSearchHistory = () => {
        clearSearchHistory();
        setSearchHistory([]);
    };

    const renderSearchHistoryDropdown = () => {
        if (!showHistory || searchHistory.length === 0) return null;

        return (
            <div className="search-history-dropdown">
                <div className="search-history-header">
                    <span>Lịch sử tìm kiếm</span>
                    <button type="button" onClick={handleClearSearchHistory}>Xóa tất cả</button>
                </div>
                {searchHistory.map(item => (
                    <div className="search-history-item" key={item.query}>
                        <button
                            type="button"
                            className="search-history-query"
                            onClick={() => runSearch(item.query)}
                        >
                            <IoTimeOutline size={18} />
                            <span>{item.query}</span>
                        </button>
                        <button
                            type="button"
                            className="search-history-remove"
                            onClick={() => handleRemoveSearchHistory(item.query)}
                            title="Xóa"
                        >
                            <IoClose size={18} />
                        </button>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <header className="yt-header">
            {!isMobileSearchActive ? (
                <>
                    {/* Left */}
                    <div className="yt-header-left">
                        <button className="yt-icon-btn hamburger-btn" onClick={() => {
                            toggleMobileMenu();
                        }} title="Menu">
                            <IoMenuOutline size={22} />
                        </button>
                        <Link href="/" style={{ display: 'flex', alignItems: 'center', marginLeft: '12px' }}>
                            <Logo size={24} showText className="hidden-mobile" />
                        </Link>
                    </div>

                    {/* Center Search Pill - Desktop */}
                    <div className="yt-header-center hidden-mobile">
                        <form className="search-container" onSubmit={handleSearch}>
                            <div ref={searchBoxRef} className="search-box-with-history">
                            <div className="search-input-wrapper">
                                <SearchIcon size={18} className="search-input-icon" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Search videos, channels, and more..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={openSearchHistory}
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        className="search-btn"
                                        onClick={() => { setSearchQuery(''); inputRef.current?.focus(); }}
                                        title="Clear"
                                        style={{ color: 'var(--yt-text-secondary)' }}
                                    >
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                        </svg>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="search-btn"
                                    onClick={handleVoiceSearch}
                                    title={isListening ? 'Đang nghe...' : 'Tìm kiếm bằng giọng nói'}
                                    style={{ color: isListening ? '#ff0033' : 'var(--yt-text-secondary)' }}
                                >
                                    {isListening ? <IoMic size={18} /> : <IoMicOutline size={18} />}
                                </button>
                                <button type="submit" className="search-btn" title="Search">
                                    <SearchIcon size={18} />
                                </button>
                            </div>
                            {renderSearchHistoryDropdown()}
                            </div>
                        </form>
                    </div>

                    {/* Right - Region and Theme */}
                    <div className="yt-header-right">
                        <button className="yt-icon-btn visible-mobile" onClick={() => setIsMobileSearchActive(true)} title="Search">
                            <SearchIcon size={22} />
                        </button>
                        <button className="yt-icon-btn" onClick={toggleTheme} title="Toggle Theme">
                            {theme === 'dark' ? <IoSunnyOutline size={22} /> : <IoMoonOutline size={22} />}
                        </button>
                        <RegionSelector />
                    </div>
                </>
            ) : (
                /* Mobile Search Overlay */
                <div className="mobile-search-bar">
                    <button className="mobile-search-back" onClick={() => setIsMobileSearchActive(false)}>
                        <IoArrowBack size={22} />
                    </button>
                    <form className="search-container" onSubmit={handleSearch} style={{ flex: 1 }}>
                        <div ref={searchBoxRef} className="search-box-with-history">
                        <div className="search-input-wrapper">
                            <SearchIcon size={16} className="search-input-icon" />
                            <input
                                ref={mobileInputRef}
                                type="text"
                                placeholder="Search Premium"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={openSearchHistory}
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    className="search-btn"
                                    onClick={() => { setSearchQuery(''); mobileInputRef.current?.focus(); }}
                                    title="Clear"
                                >
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                    </svg>
                                </button>
                            )}
                            <button
                                type="button"
                                className="search-btn"
                                onClick={handleVoiceSearch}
                                title={isListening ? 'Đang nghe...' : 'Tìm kiếm bằng giọng nói'}
                                style={{ color: isListening ? '#ff0033' : 'var(--yt-text-secondary)' }}
                            >
                                {isListening ? <IoMic size={16} /> : <IoMicOutline size={16} />}
                            </button>
                        </div>
                        {renderSearchHistoryDropdown()}
                        </div>
                    </form>
                </div>
            )}
        </header>
    );
}
