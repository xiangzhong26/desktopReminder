import { Flame, Settings } from 'lucide-react';

export default function Hub() {
  return <div className="hub-root" title="拖动我，一起移动史莱姆">
    <div className="hub-glow"/>
    <div className="campfire"><i/><i/><Flame size={22}/></div>
    <button onClick={() => window.desktopAPI.showMain()} aria-label="打开 MochiMinder"><Settings size={11}/></button>
  </div>;
}
