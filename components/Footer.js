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
              <a href="https://t.me/anicity_uz" target="_blank" rel="noreferrer" className="social-icon-btn" aria-label="Telegram Kanalimiz" title="Telegram @anicity_uz">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.77-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
              </a>
              <a href="https://instagram.com/anicity_uz" target="_blank" rel="noreferrer" className="social-icon-btn" aria-label="Instagram" title="Instagram @anicity_uz">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a href="https://youtube.com/@anicity_uz" target="_blank" rel="noreferrer" className="social-icon-btn" aria-label="YouTube" title="YouTube @anicity_uz">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Navigatsiya</h4>
            <ul className="footer-links-list">
              <li><Link href="/">Bosh sahifa</Link></li>
              <li><Link href="/catalog">Anime Katalogi</Link></li>
              <li><Link href="/catalog">Barcha Janrlar</Link></li>
              <li><Link href="/#schedule">Chiqish Jadvali</Link></li>
              <li><Link href="/favorites">Sevimlilar ro‘yxati</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Mashhur Janrlar</h4>
            <ul className="footer-links-list">
              <li><Link href="/catalog?g=Fantastika">Fantastika</Link></li>
              <li><Link href="/catalog?g=Sarguzasht">Sarguzasht</Link></li>
              <li><Link href="/catalog?g=Drama">Drama</Link></li>
              <li><Link href="/catalog?g=Psixologik">Psixologik</Link></li>
              <li><Link href="/catalog?g=Jangari">Jangari & Shonen</Link></li>
            </ul>
          </div>

          {/* Legal / Policy */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Qonuniy & Bog‘lanish</h4>
            <ul className="footer-links-list">
              <li><Link href="/dmca">DMCA & Mualliflik Huquqi</Link></li>
              <li><Link href="/terms">Foydalanish Shartlari</Link></li>
              <li><Link href="/privacy">Maxfiylik Siyosati</Link></li>
              <li><a href="https://t.me/anicity_admin" target="_blank" rel="noreferrer">Telegram Yordam (@anicity_admin)</a></li>
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
