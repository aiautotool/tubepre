import type { Metadata } from 'next';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import './globals.css';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import HamburgerMenu from './components/HamburgerMenu';
import MainContent from './components/MainContent';
import { PlayerProvider } from './context/PlayerContext';

export const metadata: Metadata = {
  title: 'Premium',
  description: 'A modern YouTube-like video streaming platform with background playback',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Premium',
    startupImage: [
      {
        url: '/icons/icon-512x512.png',
        media: '(device-width: 1024px)',
      },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'theme-color': '#ff0000',
  },
};

export const viewport = {
  themeColor: '#000000',
};

import { ThemeProvider } from './context/ThemeContext';
import { SidebarProvider } from './context/SidebarContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'dark';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <SidebarProvider>
            <PlayerProvider>
              <Header />
              <Sidebar />
              <HamburgerMenu />
              <MainContent>
                {children}
              </MainContent>
              <MobileNav />
            </PlayerProvider>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
