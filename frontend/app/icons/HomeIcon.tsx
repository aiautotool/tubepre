'use client';

interface IconProps {
    size?: number;
    className?: string;
    style?: React.CSSProperties;
}

export default function HomeIcon({ size = 24, className, style }: IconProps) {
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
            <path 
                d="M10 20V14H14V20H19V10H21L12 3L3 10H5V20H10Z" 
                fill="currentColor"
            />
        </svg>
    );
}