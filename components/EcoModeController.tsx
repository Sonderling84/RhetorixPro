import { useEffect } from 'react';

// Eco-Mode: Wenn das Hauptfenster minimiert/versteckt ist (Signal aus main via IPC),
// pausiert das Hintergrund-Video und alle Dauer-Animationen werden angehalten.
// Das senkt die GPU-/CPU-Last drastisch, während nur das Einsprechen (eigenes
// Overlay-Fenster + globale Shortcuts) weiterlaufen soll.
const EcoModeController: React.FC = () => {
  useEffect(() => {
    const api = (window as any).electronAPI;
    const apply = (on: boolean) => {
      try {
        document.documentElement.dataset.eco = on ? 'true' : 'false';
        document.querySelectorAll<HTMLVideoElement>('video[data-bg-video]').forEach(v => {
          if (on) { try { v.pause(); } catch { /* */ } }
          else { try { v.play?.().catch(() => {}); } catch { /* */ } }
        });
      } catch { /* */ }
    };
    let cleanup: (() => void) | undefined;
    if (api?.onEcoMode) cleanup = api.onEcoMode(apply);
    return () => { if (cleanup) cleanup(); };
  }, []);
  return null;
};

export default EcoModeController;
