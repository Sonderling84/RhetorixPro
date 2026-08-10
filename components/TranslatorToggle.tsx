import React, { useEffect, useState } from 'react';

// Master-Schalter für den Übersetzer. Standard: AUS.
// Steuert BEIDE Richtungen: Diktat→Fremdsprache (Overlay) und F2 (Fremdtext→Deutsch, Main-Prozess).
export const TRANSLATOR_ACTIVE_KEY = 'rhetorix_translator_active';

export function isTranslatorActive(): boolean {
  try { return localStorage.getItem(TRANSLATOR_ACTIVE_KEY) === 'true'; } catch { return false; }
}

const TranslatorToggle: React.FC = () => {
  const [active, setActive] = useState<boolean>(() => isTranslatorActive());

  // Beim Mounten den gespeicherten Zustand an den Main-Prozess melden (für F2-Gate)
  useEffect(() => {
    (window as any).electronAPI?.setTranslatorActive?.(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const next = !active;
    setActive(next);
    try { localStorage.setItem(TRANSLATOR_ACTIVE_KEY, String(next)); } catch { /* */ }
    (window as any).electronAPI?.setTranslatorActive?.(next);
    // Andere Fenster (Overlay) informieren, ohne auf 'storage' angewiesen zu sein
    window.dispatchEvent(new CustomEvent('rhetorix-translator-active', { detail: { active: next } }));
  };

  return (
    <button
      onClick={toggle}
      title={active ? 'Übersetzer ist AN — klicken zum Ausschalten' : 'Übersetzer ist AUS — klicken zum Aktivieren'}
      aria-label="Übersetzer an/aus"
      className={`fixed bottom-20 right-[4.75rem] z-[60] h-11 px-3 rounded-full flex items-center gap-2 shadow-lg border transition-all ${
        active
          ? 'bg-emerald-600 border-emerald-400 text-white'
          : 'bg-gray-900/90 border-gray-700 text-gray-400 hover:bg-gray-800'
      }`}
    >
      <i className={`fas fa-language text-base ${active ? '' : 'opacity-70'}`} />
      <span className="text-[11px] font-black uppercase tracking-wider">{active ? 'AN' : 'AUS'}</span>
    </button>
  );
};

export default TranslatorToggle;
