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
    { href: '/premium', label: '👑 VIP Premium' },
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
              {isAdminRole(profile?.role) && (
                <Link href="/admin" className={`nav-link admin-pill ${pathname.startsWith('/admin') ? 'active' : ''}`}>
                  ⚡ Admin
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
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Anime qidirish..."
                className="search-input-pro"
              />
              {searchQuery && (
                <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')}>
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
                  <div className="avatar-circle">
                    {(profile?.username || user.email || 'A').charAt(0).toUpperCase()}
                  </div>
                  <span className="user-name-label">
                    {profile?.username || user.email?.split('@')[0]}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {userDropdown && (
                  <div className="user-dropdown-popover">
                    <div className="dropdown-user-header">
                      <div className="dropdown-user-name">{profile?.username || user.email?.split('@')[0]}</div>
                      <div className="dropdown-user-email">{user.email}</div>
                      <div className="dropdown-badge">
                        {profile?.subscription_plan === 'vip' ? '👑 VIP A’zo' : 'Oddiy a’zo'}
                      </div>
                    </div>
                    <div className="dropdown-divider" />
                    <Link href="/profile" className="dropdown-item">
                      <span>👤</span> Profilim
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

      {/* Mobile Drawer */}
      <div className={`mobile-drawer ${mobileOpen ? 'open' : ''}`}>
        <div className="drawer-overlay" onClick={() => setMobileOpen(false)} />
        <div className="drawer-content">
          <div className="drawer-header">
            <Link href="/" className="brand-pro" onClick={() => setMobileOpen(false)}>
              <Logo size={32} />
              <span className="brand-text">Ani<span className="brand-accent">city</span></span>
            </Link>
            <button className="drawer-close-btn" onClick={() => setMobileOpen(false)}>✕</button>
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
            {user ? (
              <>
                <Link href="/profile" className="drawer-link" onClick={() => setMobileOpen(false)}>
                  👤 Profilim
                </Link>
                <Link href="/favorites" className="drawer-link" onClick={() => setMobileOpen(false)}>
                  🔖 Saqlanganlar
                </Link>
                <Link href="/history" className="drawer-link" onClick={() => setMobileOpen(false)}>
                  🕒 Tarix
                </Link>
                {isAdminRole(profile?.role) && (
                  <Link href="/admin" className="drawer-link admin-pill" onClick={() => setMobileOpen(false)}>
                    ⚡ Admin Panel
                  </Link>
                )}
                <div style={{ marginTop: 20 }}>
                  <form action={logoutAction}>
                    <button className="btn ghost" style={{ width: '100%' }}>Chiqish</button>
                  </form>
                </div>
              </>
            ) : (
              <div className="drawer-auth-buttons">
                <Link href="/login" className="btn primary" onClick={() => setMobileOpen(false)}>Kirish</Link>
                <Link href="/register" className="btn ghost" onClick={() => setMobileOpen(false)}>Ro‘yxatdan o‘tish</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
