/**
 * Root layout dell'app del daemon BugBay: monta solo la console (a /debugging) e
 * il Toaster. Il widget flottante NON vive qui — viene servito separatamente e
 * iniettato nell'app dell'utente (qualsiasi framework).
 */
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'BugBay Console',
  description: 'Console di triage e fix agentico BugBay (daemon locale).',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen antialiased">
        {children}
        <Toaster theme="dark" position="bottom-right" richColors />
      </body>
    </html>
  );
}
