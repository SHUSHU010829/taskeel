'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
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
        <h1>Taskeel</h1>
        <p className="login-sub">綁定 git 分支與部署的任務追蹤器</p>

        {sent ? (
          <div className="login-msg">
            登入連結已寄到 <strong>{email}</strong>。<br />
            打開信件點擊即可登入。
          </div>
        ) : (
          <form onSubmit={sendMagicLink}>
            <input
              className="text-input"
              type="email"
              required
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? '寄送中…' : '寄送登入連結'}
            </button>
            {error && (
              <div className="login-msg" style={{ color: '#EB5757' }}>
                {error}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
