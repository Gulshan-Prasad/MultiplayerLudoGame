import { useState, useEffect } from 'react';
import { TURN_TIMER_SECONDS } from '../data/constants';

function CooldownBarButton({
  onClick,
  disabled = false,
  turnTimer = 0,
  cooldownActive = true,
  fillColor = 'var(--blue)',
  className = '',
  children,
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!cooldownActive) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [cooldownActive, turnTimer]);

  const totalMs = TURN_TIMER_SECONDS * 1000;
  const elapsed = turnTimer ? now - turnTimer : 0;
  const remaining = Math.max(0, totalMs - elapsed);
  const pct = cooldownActive ? Math.min(100, (remaining / totalMs) * 100) : 100;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative overflow-hidden h-9 sm:h-10 px-3 sm:px-4 rounded-lg select-none font-bold text-xs sm:text-sm text-white ${className}`}
      style={{
        background: 'var(--wood-dark)',
        border: '3px solid var(--wood-shadow)',
        boxShadow: '4px 4px 0 var(--wood-shadow)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
      }}
    >
      <span
        className="absolute inset-y-0 left-0 transition-[width] duration-200 ease-linear"
        style={{
          width: `${pct}%`,
          backgroundColor: fillColor,
          boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.25), inset 0 -3px 0 rgba(0,0,0,0.2)',
        }}
      />
      <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
        {children}
      </span>
    </button>
  );
}

export default CooldownBarButton;
