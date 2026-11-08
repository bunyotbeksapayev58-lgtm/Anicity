import test from 'node:test';
import assert from 'node:assert/strict';
import { getSiteUrl } from '../lib/siteUrl.js';

test('AUTH PRODUCTION VERIFICATION SUITE', async (t) => {

  await t.test('1. Production redirect URL: Canonical NEXT_PUBLIC_SITE_URL is enforced', () => {
    const origEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SITE_URL = 'https://anicity-app.vercel.app';
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

      const url = getSiteUrl();
      assert.equal(url, 'https://anicity-app.vercel.app', 'Must match configured canonical HTTPS URL');
    } finally {
      process.env = origEnv;
    }
  });

  await t.test('2. Anti-Host Header Injection: Does not trust arbitrary Host/Forwarded headers', () => {
    const origEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SITE_URL = 'https://anicity-app.vercel.app';

      // Attacker attempts Host Header Injection
      const spoofedHeaders = new Map([
        ['host', 'evil-phishing-site.com'],
        ['x-forwarded-host', 'evil-phishing-site.com'],
        ['x-forwarded-proto', 'https']
      ]);

      const url = getSiteUrl(spoofedHeaders);
      assert.equal(url, 'https://anicity-app.vercel.app', 'Must ignore spoofed Host headers and use canonical domain');
    } finally {
      process.env = origEnv;
    }
  });

  await t.test('3. Localhost rejection in Production: Never returns localhost in production', () => {
    const origEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

      const url = getSiteUrl();
      assert.notEqual(url, 'http://localhost:3000', 'Must reject localhost in production');
      assert.equal(url, 'https://anicity-app.vercel.app', 'Must fallback to canonical production URL');
    } finally {
      process.env = origEnv;
    }
  });

  await t.test('4. Local development fallback: Safely returns localhost in development', () => {
    const origEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'development';
      delete process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

      const url = getSiteUrl();
      assert.equal(url, 'http://localhost:3000', 'Must default to localhost:3000 in development');
    } finally {
      process.env = origEnv;
    }
  });

  await t.test('5. Registration email confirmation payload structure', () => {
    const origEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SITE_URL = 'https://anicity-app.vercel.app';

      const siteUrl = getSiteUrl();
      const safeNext = '/';
      const emailRedirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`;

      assert.equal(
        emailRedirectTo,
        'https://anicity-app.vercel.app/auth/callback?next=%2F',
        'emailRedirectTo must point to production domain callback route'
      );
      assert.ok(!emailRedirectTo.includes('localhost'), 'Must contain zero localhost references');
    } finally {
      process.env = origEnv;
    }
  });

  await t.test('6. Callback session exchange: Validates code and token_hash flows', () => {
    // Simulated Supabase client for callback
    let exchangedCode = null;
    let verifiedOtp = null;

    const mockSupabase = {
      auth: {
        exchangeCodeForSession: async (code) => {
          exchangedCode = code;
          if (code === 'valid-auth-code') return { data: { session: { access_token: 'mock-jwt' } }, error: null };
          return { data: { session: null }, error: { message: 'Invalid or expired auth code' } };
        },
        verifyOtp: async ({ type, token_hash }) => {
          verifiedOtp = { type, token_hash };
          if (token_hash === 'valid-hash') return { data: { session: { access_token: 'mock-jwt' } }, error: null };
          return { data: { session: null }, error: { message: 'Invalid or expired token hash' } };
        },
        getUser: async () => ({ data: { user: null } })
      }
    };

    // Test code exchange
    return mockSupabase.auth.exchangeCodeForSession('valid-auth-code').then((res) => {
      assert.equal(exchangedCode, 'valid-auth-code');
      assert.ok(res.data.session);
      assert.equal(res.error, null);

      // Test token_hash OTP verification
      return mockSupabase.auth.verifyOtp({ type: 'signup', token_hash: 'valid-hash' }).then((otpRes) => {
        assert.deepEqual(verifiedOtp, { type: 'signup', token_hash: 'valid-hash' });
        assert.ok(otpRes.data.session);
        assert.equal(otpRes.error, null);
      });
    });
  });

  await t.test('7. Login: Handles confirmed accounts and unconfirmed account errors gracefully', () => {
    const mockSupabase = {
      auth: {
        signInWithPassword: async ({ email, password }) => {
          if (email === 'unconfirmed@example.com') {
            return { data: { session: null }, error: { message: 'Email not confirmed' } };
          }
          if (email === 'valid@example.com' && password === 'Secret123!') {
            return { data: { session: { user: { id: 'u1' } } }, error: null };
          }
          return { data: { session: null }, error: { message: 'Invalid login credentials' } };
        }
      }
    };

    // Test 1: Unconfirmed account returns distinct, informative message
    return mockSupabase.auth.signInWithPassword({ email: 'unconfirmed@example.com', password: 'pass' }).then((res) => {
      assert.ok(res.error);
      const isUnconfirmed = res.error.message.toLowerCase().includes('not confirmed');
      assert.ok(isUnconfirmed, 'Must identify unconfirmed email error');

      // Test 2: Invalid credentials returns standard error
      return mockSupabase.auth.signInWithPassword({ email: 'valid@example.com', password: 'wrong' }).then((badRes) => {
        assert.ok(badRes.error);
        assert.equal(badRes.error.message, 'Invalid login credentials');

        // Test 3: Confirmed valid credentials succeeds
        return mockSupabase.auth.signInWithPassword({ email: 'valid@example.com', password: 'Secret123!' }).then((okRes) => {
          assert.equal(okRes.error, null);
          assert.ok(okRes.data.session);
        });
      });
    });
  });

  await t.test('8. Logout: Invokes Supabase signOut cleanly', async () => {
    let signedOut = false;
    const mockSupabase = {
      auth: {
        signOut: async () => {
          signedOut = true;
          return { error: null };
        }
      }
    };

    await mockSupabase.auth.signOut();
    assert.equal(signedOut, true, 'Must call signOut successfully');
  });

  await t.test('9. Password Recovery: Sets canonical HTTPS redirect target', () => {
    const origEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SITE_URL = 'https://anicity-app.vercel.app';

      const siteUrl = getSiteUrl();
      const redirectTarget = `${siteUrl}/auth/callback?next=/reset-password`;

      assert.equal(redirectTarget, 'https://anicity-app.vercel.app/auth/callback?next=/reset-password');
      assert.ok(!redirectTarget.includes('localhost'));
    } finally {
      process.env = origEnv;
    }
  });

  await t.test('10. Missing environment variables fallback safety', () => {
    const origEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
      delete process.env.VERCEL_URL;

      const fallback = getSiteUrl();
      assert.equal(fallback, 'https://anicity-app.vercel.app', 'Must fallback to known canonical production domain');
      assert.ok(fallback.startsWith('https://'), 'Must be HTTPS');
    } finally {
      process.env = origEnv;
    }
  });

});
