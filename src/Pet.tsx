import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import type { AppState } from './types';

type Mood = 'idle' | 'curious' | 'sleepy' | 'running' | 'happy';

function playSuccessSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(.001, ctx.currentTime + index * .07);
      gain.gain.linearRampToValueAtTime(.075, ctx.currentTime + index * .07 + .015);
      gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + index * .07 + .22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + index * .07); osc.stop(ctx.currentTime + index * .07 + .24);
    });
    window.setTimeout(() => ctx.close(), 700);
  } catch { /* Audio is a progressive enhancement. */ }
}

export default function Pet() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '';
  const name = params.get('name') || '休息一下';
  const color = params.get('color') || '#59CFA8';
  const variant = useMemo(() => [...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 3, [id]);
  const [pending, setPending] = useState(0);
  const [mood, setMood] = useState<Mood>('idle');
  const [bond, setBond] = useState<'none' | 'stretch' | 'snap' | 'break'>('none');
  const [bondStrength, setBondStrength] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const moodTimer = useRef<number | undefined>(undefined);
  const drag = useRef({ active: false, x: 0, y: 0, moved: false });

  useEffect(() => {
    window.desktopAPI.getState().then((s) => setPending(s.pending[id] || 0));
    const stateOff = window.desktopAPI.onState((s: AppState) => setPending(s.pending[id] || 0));
    const alertOff = window.desktopAPI.onPetAlert(() => {
      window.clearTimeout(moodTimer.current); setMood('running');
      moodTimer.current = window.setTimeout(() => setMood('curious'), 5200);
    });
    const bondOff = window.desktopAPI.onPetBond(({ phase, strength = 0 }) => {
      setBond(phase); setBondStrength(strength);
      if (phase === 'snap') window.setTimeout(() => setBond('none'), 650);
      if (phase === 'break') window.setTimeout(() => setBond('none'), 500);
    });
    const expressions = window.setInterval(() => {
      setMood((current) => current === 'idle' ? (Math.random() > .5 ? 'curious' : 'sleepy') : current === 'running' || current === 'happy' ? current : 'idle');
    }, 3800);
    return () => { stateOff(); alertOff(); bondOff(); clearInterval(expressions); window.clearTimeout(moodTimer.current); };
  }, [id]);

  const complete = async () => {
    if (drag.current.moved) { drag.current.moved = false; return; }
    if (pending < 1 || celebrating) return;
    setCelebrating(true); setMood('happy'); playSuccessSound();
    await window.desktopAPI.completeReminder(id);
    window.setTimeout(() => { setCelebrating(false); setMood('idle'); }, 1100);
  };

  const pointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { active: true, x: event.screenX, y: event.screenY, moved: false };
    window.desktopAPI.dragPet({ taskId: id, phase: 'start' });
  };
  const pointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current.active) return;
    const dx = event.screenX - drag.current.x; const dy = event.screenY - drag.current.y;
    if (Math.hypot(dx, dy) > 3) drag.current.moved = true;
    window.desktopAPI.dragPet({ taskId: id, phase: 'move', dx, dy });
  };
  const pointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current.active) return;
    drag.current.active = false; event.currentTarget.releasePointerCapture(event.pointerId);
    window.desktopAPI.dragPet({ taskId: id, phase: 'end' });
  };

  return <div className={`pet-root mood-${mood} bond-${bond} variant-${variant}`} style={{ '--pet-color': color, '--bond-strength': bondStrength } as React.CSSProperties}>
    <div className={`pet-bubble ${pending ? 'visible' : ''}`} onClick={complete}><span>{name}</span><b><Check size={10}/> 点我完成</b></div>
    <button className="pet-character" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onClick={complete} aria-label={pending ? `完成${name}` : name}>
      {pending > 0 && <em>{pending}</em>}
      <svg viewBox="0 0 92 78" role="img" aria-hidden="true">
        <defs><linearGradient id={`body-${id}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" stopOpacity=".34"/><stop offset=".28" stopColor={color}/><stop offset="1" stopColor={color}/></linearGradient></defs>
        <ellipse className="slime-ground" cx="46" cy="70" rx="29" ry="4" fill="#173f34" opacity=".13"/>
        <path className="slime-arm arm-left" d="M18 48 C8 48 8 58 16 59 C20 58 23 54 25 51" fill={color}/>
        <path className="slime-arm arm-right" d="M72 49 C84 46 86 55 78 59 C74 59 70 55 68 52" fill={color}/>
        <path className="slime-body" d="M14 57 C12 43 18 33 28 26 C30 17 36 10 43 12 C46 6 53 8 54 15 C69 18 78 31 79 49 C81 64 70 69 47 69 C24 69 15 66 14 57Z" fill={`url(#body-${id})`}/>
        <path className="slime-tip" d="M42 15 C43 6 51 4 56 9 C51 9 50 13 52 17" fill={color}/>
        <ellipse className="slime-highlight" cx="31" cy="28" rx="11" ry="5" fill="#fff" opacity=".42" transform="rotate(-25 31 28)"/>
        <g className="face">
          <ellipse className="cheek" cx="28" cy="51" rx="5" ry="2.8" fill="#ff8fa1" opacity=".58"/><ellipse className="cheek" cx="65" cy="51" rx="5" ry="2.8" fill="#ff8fa1" opacity=".58"/>
          <g className="eyes"><ellipse cx="34" cy="43" rx="3.4" ry="4.8"/><ellipse cx="59" cy="43" rx="3.4" ry="4.8"/><circle cx="35" cy="41.5" r="1" fill="#fff"/><circle cx="60" cy="41.5" r="1" fill="#fff"/></g>
          <path className="eye-sleep" d="M30 44 Q34 48 38 44 M55 44 Q59 48 63 44"/>
          <path className="mouth normal" d="M41 51 Q47 56 53 51"/><path className="mouth happy" d="M39 50 Q47 61 55 50 Q47 54 39 50"/>
        </g>
        <g className="feet"><ellipse cx="31" cy="66" rx="8" ry="4" fill={color}/><ellipse cx="62" cy="66" rx="8" ry="4" fill={color}/></g>
      </svg>
    </button>
    {celebrating && <div className="celebration"><i>♥</i><i>✦</i><i>●</i><i>✦</i><i>♥</i></div>}
    <div className="goo-thread"/>
  </div>;
}
