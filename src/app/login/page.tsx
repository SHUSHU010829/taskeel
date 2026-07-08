'use client';

import { useState } from 'react';
import { ArrowLeft, Diamond, Loader2, Mail, MailCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type OAuthProvider = 'google' | 'github';

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

function GithubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.26.82-.577 0-.285-.01-1.04-.015-2.04-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.73.083-.73 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.303-5.467-1.332-5.467-5.93 0-1.31.469-2.38 1.236-3.22-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23a11.5 11.5 0 0 1 3.003-.404c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.652.242 2.873.118 3.176.77.84 1.235 1.91 1.235 3.22 0 4.61-2.807 5.624-5.48 5.92.43.372.814 1.102.814 2.222 0 1.606-.015 2.898-.015 3.293 0 .32.216.694.825.576C20.565 22.296 24 17.797 24 12.5 24 5.87 18.627.5 12 .5z" />
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);

  async function signInWithOAuth(provider: OAuthProvider) {
    setOauthBusy(provider);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // on success the browser navigates away; only reached on failure
    if (error) {
      setError(error.message);
      setOauthBusy(null);
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-mark">
          <Diamond size={22} fill="currentColor" />
        </div>

        {sent ? (
          <>
            <div className="login-check">
              <MailCheck size={22} />
            </div>
            <h1>看看你的信箱</h1>
            <p className="login-sub">
              登入連結已寄到 <strong>{email}</strong>，
              <br />
              打開信件點一下即可登入。
            </p>
            <div className="login-hint">沒收到？看看垃圾信件匣，或稍等一分鐘。</div>
            <div className="login-actions">
              <button
                type="button"
                className="btn btn-ghost login-back"
                onClick={() => {
                  setSent(false);
                  setError(null);
                }}
              >
                <ArrowLeft size={14} /> 換一個信箱
              </button>
              <button
                type="button"
                className="btn"
                disabled={loading}
                onClick={() => sendMagicLink({ preventDefault() {} } as React.FormEvent)}
              >
                {loading ? '寄送中…' : '重新寄送'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1>登入 Taskeel</h1>
            <p className="login-sub">綁定 git 分支與部署的任務追蹤器</p>

            <div className="login-oauth">
              <button
                type="button"
                className="btn login-provider"
                disabled={oauthBusy !== null}
                onClick={() => signInWithOAuth('google')}
              >
                {oauthBusy === 'google' ? <Loader2 size={15} className="spin" /> : <GoogleMark />}
                使用 Google 繼續
              </button>
              <button
                type="button"
                className="btn login-provider"
                disabled={oauthBusy !== null}
                onClick={() => signInWithOAuth('github')}
              >
                {oauthBusy === 'github' ? <Loader2 size={15} className="spin" /> : <GithubMark />}
                使用 GitHub 繼續
              </button>
            </div>

            <div className="login-divider">
              <span>或用 Email</span>
            </div>

            <form onSubmit={sendMagicLink}>
              <div className="login-field">
                <Mail size={16} className="login-field-icon" />
                <input
                  className="text-input"
                  type="email"
                  required
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary login-submit"
                disabled={loading || !email.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="spin" /> 寄送中…
                  </>
                ) : (
                  '寄送登入連結'
                )}
              </button>
              {error && <div className="login-msg login-error">{error}</div>}
            </form>

            <div className="login-hint">免密碼登入：我們會寄一封含登入連結的信給你。</div>
          </>
        )}
      </div>
    </div>
  );
}
