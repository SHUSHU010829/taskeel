'use client';

import { useState } from 'react';
import { Diamond, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { GoogleMark } from '@/components/ProviderMarks';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // on success the browser navigates away; only reached on failure
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-mark">
          <Diamond size={22} fill="currentColor" />
        </div>
        <h1>登入 Taskeel</h1>
        <p className="login-sub">綁定 git 分支與部署的任務追蹤器</p>

        <div className="login-oauth">
          <button
            type="button"
            className="btn login-provider"
            disabled={busy}
            onClick={signInWithGoogle}
          >
            {busy ? <Loader2 size={15} className="spin" /> : <GoogleMark />}
            使用 Google 繼續
          </button>
        </div>

        {error && <div className="login-msg login-error">{error}</div>}

        <div className="login-hint">使用 Google 帳號登入，免密碼。</div>
      </div>
    </div>
  );
}
