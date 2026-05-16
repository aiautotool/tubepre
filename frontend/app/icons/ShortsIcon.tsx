'use client';

interface IconProps {
    size?: number;
    className?: string;
    style?: React.CSSProperties;
}

export default function ShortsIcon({ size = 24, className, style }: IconProps) {
    return (
        <svg 
            width={size} 
            height={size} 
            viewBox="0 0 24 24" 
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={style}
        >
            <rect x="2" y="4" width="20" height="16" rx="4" fill="#ff0000"/>
            <path d="M10 8L16 12L10 16V8Z" fill="white"/>
        </svg>
    );
}