import './globals.css';
import Header from '@/components/Header';

export const metadata = {
  title: 'Anicity',
  description: 'Anime tomosha qiling — Anicity',
};

export default function RootLayout({ children }) {
  return (
    <html lang="uz">
      <body>
        <Header />
        <main>{children}</main>
        <footer>© {new Date().getFullYear()} Anicity</footer>
      </body>
    </html>
  );
}
