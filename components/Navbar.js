'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';
import { isAdminRole } from '@/lib/roles';

export default function Navbar({ user, profile, logoutAction }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  const navLinks = [
    { href: '/', label: 'Bosh sahifa' },
    { href: '/#catalog', label: 'Katalog' },
    { href: '/#genres', label: 'Janrlar' },
    { href: '/#trailers', label: 'Treylerlar' },
  ];

  return (
    <>
      <header className={`topbar-pro ${scrolled ? 'scrolled' : ''}`}>
        <div className="topbar-inner">
          <div className="topbar-left">
            <button
              className="mobile-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menyu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            <Link href="/" className="brand-pro">
              <Logo size={36} />
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
              {user && (
                <>
                  <Link href="/favorites" className={`nav-link ${pathname === '/favorites' ? 'active' : ''}`}>
                    Sevimlilar
                  </Link>
                  <Link href="/history" className={`nav-link ${pathname === '/history' ? 'active' : ''}`}>
                    Tarix
                  </Link>
                </>
              )}
              {isAdminRole(profile?.role) && (
                <Link href="/admin" className={`nav-link admin-pill ${pathname.startsWith('/admin') ? 'active' : ''}`}>
                  ⚡ Admin
                </Link>
              )}
            </nav>
          </div>

          <div className="topbar-right">
            {/* Inline Quick Search */}
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
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Anime, qahramon yoki janr..."
                className="search-input-pro"
              />
              {searchQuery && (
                <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')}>
                  ✕
                </button>
              )}
            </form>

            {user ? (
              <div className="user-profile-menu">
                <div className="user-avatar-badge" title={profile?.username || user.email}>
                  <div className="avatar-circle">
                    {(profile?.username || user.email || 'A').charAt(0).toUpperCase()}
                  </div>
                  <span className="user-name-label">{profile?.username || user.email?.split('@')[0]}</span>
                </div>
                <form action={logoutAction}>
                  <button className="btn-logout-pro" title="Hisobdan chiqish" aria-label="Chiqish">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </button>
                </form>
              </div>
            ) : (
              <div className="auth-buttons-pro">
                <Link href="/login" className="btn-login-pro">
                  Kirish
                </Link>
                <Link href="/register" className="btn-register-pro">
                  Ro‘yxatdan o‘tish
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <div className={`mobile-drawer ${mobileOpen ? 'open' : ''}`}>
        <div className="drawer-overlay" onClick={() => setMobileOpen(false)} />
        <div className="drawer-content">
          <div className="drawer-header">
            <Link href="/" className="brand-pro" onClick={() => setMobileOpen(false)}>
              <Logo size={32} />
              <span className="brand-text">
                Ani<span className="brand-accent">city</span>
              </span>
            </Link>
            <button className="drawer-close" onClick={() => setMobileOpen(false)}>
              ✕
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="mobile-search-form">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Anime qidirish..."
              className="mobile-search-input"
            />
            <button type="submit" className="mobile-search-btn">
              Qidirish
            </button>
          </form>

          <nav className="mobile-nav-list">
            <Link href="/" className="mobile-nav-item" onClick={() => setMobileOpen(false)}>
              🏠 Bosh sahifa
            </Link>
            <Link href="/#catalog" className="mobile-nav-item" onClick={() => setMobileOpen(false)}>
              🎬 Anime Katalogi
            </Link>
            <Link href="/#genres" className="mobile-nav-item" onClick={() => setMobileOpen(false)}>
              🏷️ Janrlar
            </Link>
            <Link href="/#trailers" className="mobile-nav-item" onClick={() => setMobileOpen(false)}>
              🎞️ Treylerlar va Lavhalar
            </Link>
            {user && (
              <>
                <Link href="/favorites" className="mobile-nav-item" onClick={() => setMobileOpen(false)}>
                  ❤️ Sevimlilar
                </Link>
                <Link href="/history" className="mobile-nav-item" onClick={() => setMobileOpen(false)}>
                  🕒 Ko‘rilganlar Tarixi
                </Link>
              </>
            )}
            {isAdminRole(profile?.role) && (
              <Link href="/admin" className="mobile-nav-item admin" onClick={() => setMobileOpen(false)}>
                ⚡ Admin Panel
              </Link>
            )}
          </nav>

          <div className="drawer-footer">
            {user ? (
              <div className="drawer-user-info">
                <div className="drawer-user-name">
                  👤 {profile?.username || user.email}
                  <span className="drawer-role-badge">{profile?.role || 'user'}</span>
                </div>
                <form action={logoutAction} className="drawer-logout-form">
                  <button className="btn-logout-full">Chiqish</button>
                </form>
              </div>
            ) : (
              <div className="drawer-auth-btns">
                <Link href="/login" className="btn-login-pro" onClick={() => setMobileOpen(false)}>
                  Kirish
                </Link>
                <Link href="/register" className="btn-register-pro" onClick={() => setMobileOpen(false)}>
                  Ro‘yxatdan o‘tish
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
