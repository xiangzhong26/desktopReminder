import { useEffect, useState } from 'react';
import { Check, Settings } from 'lucide-react';
import type { AppState } from './types';

export default function Pet() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '';
  const name = params.get('name') || '休息一下';
  const color = params.get('color') || '#59CFA8';
  const [pending, setPending] = useState(0);
  const [alerting, setAlerting] = useState(false);

  useEffect(() => {
    window.desktopAPI.getState().then((s) => setPending(s.pending[id] || 0));
    const stateOff = window.desktopAPI.onState((s: AppState) => setPending(s.pending[id] || 0));
    const alertOff = window.desktopAPI.onPetAlert(() => { setAlerting(true); setTimeout(() => setAlerting(false), 5200); });
    return () => { stateOff(); alertOff(); };
  }, [id]);

  const complete = async () => { if (pending > 0) await window.desktopAPI.completeReminder(id); };
  return <div className={`pet-root ${alerting ? 'alerting' : ''}`} style={{ '--pet-color': color } as React.CSSProperties}>
    <div className={`pet-bubble ${pending ? 'visible' : ''}`} onClick={complete}><span>{name}</span><b><Check size={13}/> 完成</b></div>
    <button className="pet-settings" onClick={() => window.desktopAPI.showMain()} aria-label="打开设置"><Settings size={13}/></button>
    <button className="pet-character" onClick={complete} aria-label={pending ? `完成${name}` : name}>
      {pending > 0 && <em>{pending}</em>}
      <div className="pet-shine"/><div className="pet-eyes"><i/><i/></div><div className="pet-smile"/>
    </button>
    <div className="pet-shadow"/>
  </div>;
}
