import './globals.css';
import Header from '@/components/Header';

export const metadata = {
  title: 'Yozora',
  description: 'Anime tomosha qiling — Yozora',
};

export default function RootLayout({ children }) {
  return (
    <html lang="uz">
      <body>
        <Header />
        <main>{children}</main>
        <footer>© {new Date().getFullYear()} Yozora</footer>
      </body>
    </html>
  );
}
