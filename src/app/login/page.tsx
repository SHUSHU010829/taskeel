'use client';

import { useState } from 'react';
import { ArrowLeft, Diamond, Loader2, Mail, MailCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { GoogleMark } from '@/components/ProviderMarks';

type OAuthProvider = 'google' | 'github';

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
