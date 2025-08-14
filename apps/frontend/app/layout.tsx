import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ 
  subsets: ['latin'], 
  variable: '--font-mono' 
});

export const metadata: Metadata = {
  title: 'Shadow - AI Coding Agent',
  description: 'An autonomous background developer that understands, analyzes, and contributes to existing codebases through intelligent automation.',
  keywords: ['AI', 'coding', 'agent', 'automation', 'development'],
  authors: [{ name: 'Shadow Team' }],
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-shadow-950 text-shadow-50 antialiased`}>
        {children}
        <Toaster 
          position="top-right"
          toastOptions={{
            className: 'bg-shadow-800 text-shadow-50 border border-shadow-700',
            duration: 4000,
          }}
        />
      </body>
    </html>
  );
}