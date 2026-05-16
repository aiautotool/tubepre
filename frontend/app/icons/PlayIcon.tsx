'use client';

interface IconProps {
    size?: number;
    className?: string;
    style?: React.CSSProperties;
}

export default function PlayIcon({ size = 24, className, style }: IconProps) {
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
            <circle cx="12" cy="12" r="10" fill="#ff0000"/>
            <path d="M9.5 7.5V16.5L17.5 12L9.5 7.5Z" fill="white"/>
        </svg>
    );
}