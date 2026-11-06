'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';
import { isAdminRole } from '@/lib/roles';

export default function Navbar({ user, profile, logoutAction }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userDropdown, setUserDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menus on outside click or route change
  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setUserDropdown(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/catalog?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  const navLinks = [
    { href: '/', label: 'Bosh sahifa' },
    { href: '/catalog', label: 'Katalog' },
    { href: '/#schedule', label: 'Jadval' },
    { href: '/premium', label: '👑 VIP Obuna' },
  ];

  const isVip = Boolean(profile?.isVip);
  const profileName = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'A';

  return (
    <>
      <header className={`topbar-pro ${scrolled ? 'scrolled' : ''}`}>
        <div className="topbar-inner">
          <div className="topbar-left">
            <button
              className="mobile-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menyuni ochish"
              type="button"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                {mobileOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            <Link href="/" className="brand-pro">
              <Logo size={34} />
              <span className="brand-text">
                Ani<span className="brand-accent">city</span>
              </span>
            </Link>

            <nav className="desktop-nav">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${pathname === item.href ? 'active' : ''}`}
                >
                  {item.label}
                </Link>
              ))}
              {isAdminRole(profile?.role) && (
                <Link href="/admin" className={`nav-link admin-pill ${pathname.startsWith('/admin') ? 'active' : ''}`}>
                  ⚡ Admin
                </Link>
              )}
              {profile?.role === 'assistant_admin' && (
                <Link href="/assistant-admin" className={`nav-link admin-pill ${pathname.startsWith('/assistant-admin') ? 'active' : ''}`}>
                  🛡️ Boshqaruv
                </Link>
              )}
            </nav>
          </div>

          <div className="topbar-right">
            {/* Quick Search Bar */}
            <form onSubmit={handleSearchSubmit} className={`search-bar-pro ${searchOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="search-icon-btn"
                onClick={() => setSearchOpen(!searchOpen)}
                aria-label="Qidirish"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Anime qidirish..."
                className="search-input-pro"
              />
              {searchQuery && (
                <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')} aria-label="Tozalash">
                  ✕
                </button>
              )}
            </form>

            {user ? (
              <div className="user-profile-menu-wrap" ref={dropdownRef}>
                <button
                  type="button"
                  className="user-avatar-trigger"
                  onClick={() => setUserDropdown(!userDropdown)}
                  aria-label="Foydalanuvchi menyusi"
                >
                  <div className={`avatar-circle ${isVip ? 'has-vip-ring' : ''}`}>
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                      : profileName.charAt(0).toUpperCase()}
                  </div>
                  <span className="user-name-label">
                    {profileName}
                  </span>
                  {isVip && <span className="crown-mini" title="VIP A’zo">👑</span>}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="chevron-mini">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {userDropdown && (
                  <div className="user-dropdown-popover">
                    <div className="dropdown-user-header">
                      <div className="dropdown-user-name">{profileName}</div>
                      <div className="dropdown-user-email">{user.email}</div>
                      <div className="dropdown-badge">
                        {isVip ? '👑 VIP A’zo' : 'Oddiy a’zo'}
                      </div>
                    </div>
                    <div className="dropdown-divider" />
                    <Link href="/profile" className="dropdown-item">
                      <span>👤</span> Profilim
                    </Link>
                    <Link href="/profile?edit=1" className="dropdown-item">
                      <span>⚙️</span> Profilni tahrirlash
                    </Link>
                    <Link href="/favorites" className="dropdown-item">
                      <span>🔖</span> Saqlanganlar
                    </Link>
                    <Link href="/history" className="dropdown-item">
                      <span>🕒</span> Ko‘rish tarixi
                    </Link>
                    <Link href="/premium" className="dropdown-item vip-highlight">
                      <span>👑</span> VIP Obuna
                    </Link>
                    {isAdminRole(profile?.role) && (
                      <Link href="/admin" className="dropdown-item admin-highlight">
                        <span>⚡</span> Admin Panel
                      </Link>
                    )}
                    {profile?.role === 'assistant_admin' && (
                      <Link href="/assistant-admin" className="dropdown-item admin-highlight">
                        <span>🛡️</span> Cheklangan boshqaruv
                      </Link>
                    )}
                    <div className="dropdown-divider" />
                    <form action={logoutAction}>
                      <button type="submit" className="dropdown-item logout-btn">
                        <span>🚪</span> Chiqish
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <div className="auth-btns-group">
                <Link href="/login" className="btn-login-nav">
                  Kirish
                </Link>
                <Link href="/register" className="btn-register-nav">
                  Ro‘yxatdan o‘tish
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Drawer (Side Menu) */}
      <div className={`mobile-drawer ${mobileOpen ? 'open' : ''}`}>
        <div className="drawer-overlay" onClick={() => setMobileOpen(false)} />
        <div className="drawer-content">
          <div className="drawer-header">
            <Link href="/" className="brand-pro" onClick={() => setMobileOpen(false)}>
              <Logo size={32} />
              <span className="brand-text">Ani<span className="brand-accent">city</span></span>
            </Link>
            <button className="drawer-close-btn" onClick={() => setMobileOpen(false)} aria-label="Yopish">✕</button>
          </div>

          <div className="drawer-nav">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`drawer-link ${pathname === item.href ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}

            <div className="drawer-divider" />

            {user ? (
              <>
                {profile?.role === 'assistant_admin' && (
                  <Link href="/assistant-admin" className="drawer-link" onClick={() => setMobileOpen(false)}>
                    🛡️ Cheklangan boshqaruv
                  </Link>
                )}
                <Link href="/profile" className="drawer-link" onClick={() => setMobileOpen(false)}>
                  👤 Profilim {isVip && '👑'}
                </Link>
                <Link href="/favorites" className="drawer-link" onClick={() => setMobileOpen(false)}>
                  🔖 Saqlanganlar
                </Link>
                <Link href="/history" className="drawer-link" onClick={() => setMobileOpen(false)}>
                  🕒 Ko‘rish Tarixi
                </Link>
                <Link href="/premium" className="drawer-link vip-highlight" onClick={() => setMobileOpen(false)}>
                  👑 VIP Obuna Rejalari
                </Link>
                {isAdminRole(profile?.role) && (
                  <Link href="/admin" className="drawer-link admin-pill" onClick={() => setMobileOpen(false)}>
                    ⚡ Admin Boshqaruv Paneli
                  </Link>
                )}
                <div style={{ marginTop: 24, padding: '0 8px' }}>
                  <form action={logoutAction}>
                    <button type="submit" className="btn ghost" style={{ width: '100%', minHeight: 44 }}>
                      🚪 Tizimdan Chiqish
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="drawer-auth-buttons">
                <Link href="/login" className="btn primary" style={{ minHeight: 44 }} onClick={() => setMobileOpen(false)}>
                  Kirish
                </Link>
                <Link href="/register" className="btn ghost" style={{ minHeight: 44 }} onClick={() => setMobileOpen(false)}>
                  Ro‘yxatdan o‘tish
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Phones only, <= 768px) */}
      <nav className="mobile-bottom-bar" aria-label="Mobil navigatsiya">
        <Link href="/" className={`bottom-bar-item ${pathname === '/' ? 'active' : ''}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Asosiy</span>
        </Link>

        <Link href="/catalog" className={`bottom-bar-item ${pathname.startsWith('/catalog') ? 'active' : ''}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span>Katalog</span>
        </Link>

        <Link href="/#schedule" className="bottom-bar-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Jadval</span>
        </Link>

        <Link href="/premium" className={`bottom-bar-item ${pathname === '/premium' ? 'active' : ''}`}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>👑</span>
          <span style={{ color: 'var(--accent)' }}>VIP</span>
        </Link>

        <Link href={user ? '/profile' : '/login'} className={`bottom-bar-item ${pathname === '/profile' || pathname === '/login' ? 'active' : ''}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>{user ? 'Profil' : 'Kirish'}</span>
        </Link>
      </nav>
    </>
  );
}
