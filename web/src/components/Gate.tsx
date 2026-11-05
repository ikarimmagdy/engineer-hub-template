import { useState, type FormEvent } from 'react';
import type { Brand } from '../lib/data';
import { Logo } from './ui';

// Same session key and ?pass= link as the v4 engine, so an unlocked tab and shared links keep working.
export const GATE_KEY = 'tb-hub-ok';

export function isUnlocked(brand: Brand) {
  const pass = brand.passcode || 'changeme';
  try {
    const qp = new URLSearchParams(location.search).get('pass');
    if (qp && qp === pass) sessionStorage.setItem(GATE_KEY, '1');
    return sessionStorage.getItem(GATE_KEY) === '1';
  } catch {
    return false;
  }
}

export function Gate({ brand, onUnlock }: { brand: Brand; onUnlock: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim() === (brand.passcode || 'changeme')) {
      try { sessionStorage.setItem(GATE_KEY, '1'); } catch { /* storage may be blocked */ }
      onUnlock();
    } else setError('That passcode is not right. Ask your team lead for the current one.');
  };
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-line bg-paper p-8">
        <Logo brand={brand} className="mb-6 h-7 w-auto" />
        <h1 className="text-xl font-semibold">{brand.name} Engineering Hub</h1>
        <p className="mt-1 text-sm text-ink-2">Enter the team passcode to open the hub.</p>
        <label htmlFor="pass" className="mt-6 block text-sm font-medium">Passcode</label>
        <input
          id="pass"
          type="password"
          autoFocus
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          aria-invalid={!!error}
          aria-describedby={error ? 'pass-err' : undefined}
          className="mt-1.5 h-10 w-full rounded-md border border-line-2 bg-sunk px-3 outline-none focus:border-ink"
        />
        {error && <p id="pass-err" className="mt-2 text-sm text-block">{error}</p>}
        <button type="submit" className="mt-4 h-10 w-full rounded-md bg-ink text-sm font-semibold text-paper">Open the hub</button>
        <p className="mt-6 text-xs text-ink-3">A shared passcode checked in the browser keeps casual visitors out. It is not sign-in.</p>
      </form>
    </div>
  );
}
