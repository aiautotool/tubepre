'use client';

interface LogoProps {
    size?: number;
    showText?: boolean;
    className?: string;
}

export default function Logo({ size = 24, showText = true, className }: LogoProps) {
    return (
        <div 
            className={className}
            style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
            }}
        >
            {/* Play Button Icon */}
            <svg 
                width={size} 
                height={size} 
                viewBox="0 0 32 32" 
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ flexShrink: 0 }}
            >
                <circle cx="16" cy="16" r="15" fill="#ff0000"/>
                <path d="M12 10L22 16L12 22V10Z" fill="white"/>
            </svg>
            
            {/* Text */}
            {showText && (
                <span style={{ 
                    fontSize: '18px', 
                    fontWeight: '700', 
                    letterSpacing: '-0.5px',
                    fontFamily: 'YouTube Sans, Roboto, Arial, sans-serif',
                    color: 'var(--yt-text-primary)',
                }}>
                    Premium
                </span>
            )}
        </div>
    );
}
