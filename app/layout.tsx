import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dolce Vino | Catálogo premium',
  description: 'Catálogo de vinos y bebidas premium por caja cerrada.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
