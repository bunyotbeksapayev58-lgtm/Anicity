import Link from 'next/link';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="footer-pro">
      <div className="footer-glow-divider" />
      <div className="footer-container">
        <div className="footer-grid">
          {/* Brand Col */}
          <div className="footer-brand-col">
            <Link href="/" className="footer-brand">
              <Logo size={36} />
              <span className="brand-text">
                Ani<span className="brand-accent">city</span>
              </span>
            </Link>
            <p className="footer-desc">
              O‘zbekistondagi eng zamonaviy va sifatli anime streaming platformasi.
              Sevimli anime filmlaringiz va seriallaringizni 4K va Full HD sifatda,
              o‘zbek tilidagi subtitrlar bilan tomosha qiling.
            </p>
            <div className="footer-socials">
              <a href="https://t.me" target="_blank" rel="noreferrer" className="social-icon-btn" aria-label="Telegram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.77-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="social-icon-btn" aria-label="Instagram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" className="social-icon-btn" aria-label="YouTube">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              <a href="https://discord.com" target="_blank" rel="noreferrer" className="social-icon-btn" aria-label="Discord">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Navigatsiya</h4>
            <ul className="footer-links-list">
              <li><Link href="/">Bosh sahifa</Link></li>
              <li><Link href="/#catalog">Anime Katalogi</Link></li>
              <li><Link href="/#genres">Barcha Janrlar</Link></li>
              <li><Link href="/#trailers">Treylerlar & Qisqa lavhalar</Link></li>
              <li><Link href="/favorites">Sevimlilar ro‘yxati</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Mashhur Janrlar</h4>
            <ul className="footer-links-list">
              <li><Link href="/?g=Fantastika">Fantastika</Link></li>
              <li><Link href="/?g=Sarguzasht">Sarguzasht</Link></li>
              <li><Link href="/?g=Drama">Drama</Link></li>
              <li><Link href="/?g=Romantika">Romantika</Link></li>
              <li><Link href="/?g=Jangari">Jangari & Shonen</Link></li>
            </ul>
          </div>

          {/* Legal / Policy */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Qonuniy & Bog‘lanish</h4>
            <ul className="footer-links-list">
              <li><a href="#dmca">DMCA & Mualliflik Huquqi</a></li>
              <li><a href="#terms">Foydalanish Shartlari</a></li>
              <li><a href="#privacy">Maxfiylik Siyosati</a></li>
              <li><a href="mailto:support@anicity.uz">Texnik Yordam</a></li>
              <li><span className="footer-badge-safe">🛡️ 100% Xavfsiz Platforma</span></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <p className="copyright-text">
            © {new Date().getFullYear()} <strong>Anicity</strong>. Barcha huquqlar himoyalangan.
            Barcha video va media materiallar rasmiy manbalar va ruxsat etilgan taqdimotlar asosida namoyish etiladi.
          </p>
          <div className="footer-bottom-pills">
            <span className="tech-pill">Next.js 16</span>
            <span className="tech-pill">Supabase</span>
            <span className="tech-pill">4K Ultra HD</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
