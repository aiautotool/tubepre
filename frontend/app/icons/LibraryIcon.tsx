'use client';

interface IconProps {
    size?: number;
    className?: string;
    style?: React.CSSProperties;
}

export default function LibraryIcon({ size = 24, className, style }: IconProps) {
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
                d="M4 6H2V20C2 21.1 2.9 22 4 22H18V20H4V6ZM20 2H8C6.9 2 6 2.9 6 4V16C6 17.1 6.9 18 8 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H8V4H20V16ZM10 9H12V14H10V9ZM14 9H18V14H14V9Z" 
                fill="currentColor"
            />
        </svg>
    );
}