'use client';

interface LoadingSpinnerProps {
    size?: 'small' | 'medium' | 'large';
    fullScreen?: boolean;
    text?: string;
    color?: 'primary' | 'white';
}

const sizeMap = {
    small: { spinner: 24, border: 2 },
    medium: { spinner: 36, border: 3 },
    large: { spinner: 48, border: 4 },
};

export default function LoadingSpinner({ 
    size = 'medium', 
    fullScreen = false, 
    text,
    color = 'primary' 
}: LoadingSpinnerProps) {
    const { spinner, border } = sizeMap[size];
    
    const spinnerColor = color === 'white' ? '#fff' : 'var(--yt-text-primary)';
    const borderColor = color === 'white' ? 'rgba(255,255,255,0.2)' : 'var(--yt-border)';
    
    const content = (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
        }}>
            <div style={{
                width: `${spinner}px`,
                height: `${spinner}px`,
                border: `${border}px solid ${borderColor}`,
                borderTop: `${border}px solid ${spinnerColor}`,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
            }} />
            {text && (
                <span style={{
                    fontSize: '14px',
                    color: 'var(--yt-text-secondary)',
                }}>
                    {text}
                </span>
            )}
            <style jsx>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
    
    if (fullScreen) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100vh',
                backgroundColor: 'var(--yt-background)',
            }}>
                {content}
            </div>
        );
    }
    
    return content;
}
