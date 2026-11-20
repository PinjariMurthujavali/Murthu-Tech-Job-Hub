import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const CHANNEL_URL = 'https://www.youtube.com/@Syntaxsolver-u5m';

export default function SubscribeGate({ children }: { children: React.ReactNode }) {
  const { user, loading, subscribed, verifySubscription, setAuthModalOpen } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  if (loading) return <div className="p-10 text-center text-slate-400">Loading...</div>;
  if (user?.role === 'admin' || subscribed) return <>{children}</>;

  const verify = async () => {
    setBusy(true);
    setMsg('');
    try {
      const ok = await verifySubscription();
      if (!ok) setMsg('Subscription kanipinchaledu. Subscribe chesi malli Verify nokkandi.');
    } catch {
      setMsg('Verify fail ayindi. Malli try cheyyandi.');
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h2 className="mb-3 text-2xl font-bold">Jobs unlock cheyyandi 🔓</h2>
      {!user ? (
        <>
          <p className="mb-5 text-slate-400">Mundu Google tho login avvandi.</p>
          <button onClick={() => setAuthModalOpen(true)} className="rounded-lg bg-blue-600 px-5 py-2 font-semibold">
            Login with Google
          </button>
        </>
      ) : (
        <>
          <p className="mb-5 text-slate-400">
            Mana YouTube channel ki Subscribe cheyyandi, tarvata Verify nokkandi. Jobs anni free.
          </p>
          <a href={CHANNEL_URL} target="_blank" rel="noreferrer"
             className="mb-3 block rounded-lg bg-red-600 px-5 py-2 font-semibold">
            1. Subscribe on YouTube
          </a>
          <button onClick={verify} disabled={busy}
                  className="w-full rounded-lg bg-green-600 px-5 py-2 font-semibold disabled:opacity-50">
            {busy ? 'Checking...' : '2. Verify Subscription'}
          </button>
          {msg && <p className="mt-3 text-sm text-amber-400">{msg}</p>}
        </>
      )}
    </div>
  );
}