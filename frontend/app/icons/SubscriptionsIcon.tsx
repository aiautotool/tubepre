'use client';

interface IconProps {
    size?: number;
    className?: string;
    style?: React.CSSProperties;
}

export default function SubscriptionsIcon({ size = 24, className, style }: IconProps) {
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
                d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6ZM6 6V18H18V6H6ZM8 8H10V10H8V8ZM8 12H10V14H8V12ZM12 8H14V10H12V8ZM12 12H14V14H12V12Z" 
                fill="currentColor"
            />
        </svg>
    );
}