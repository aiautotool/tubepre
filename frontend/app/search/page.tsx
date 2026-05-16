import { Suspense } from 'react';
import ClientSearchPage from './ClientSearchPage';

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                backgroundColor: '#0f0f0f',
                color: '#fff',
            }}>
                Searching...
            </div>
        }>
            <ClientSearchPage />
        </Suspense>
    );
}