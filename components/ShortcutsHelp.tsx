import React, { useState } from 'react';

// Zentrale Liste der globalen Tastaturbefehle — muss zu main.js passen.
interface Shortcut {
  keys: string[];
  label: string;
  icon: string;
}

const DICTATION_SHORTCUTS: Shortcut[] = [
  { keys: ['⇧', 'Leertaste'], label: 'Diktat: starten → stoppen → einfügen (3× drücken)', icon: 'fa-microphone-lines' },
  { keys: ['F5'], label: 'Diktat starten (MacBook-Mikrofontaste)', icon: 'fa-microphone' },
  { keys: ['Leertaste'], label: 'Während Aufnahme: stoppen · im Ergebnis: einfügen', icon: 'fa-stop' },
  { keys: ['Esc'], label: 'Abbrechen / Overlay schließen', icon: 'fa-xmark' },
];

const TEXT_SHORTCUTS: Shortcut[] = [
  { keys: ['F2'], label: 'Markierten Fremdtext → Deutsch übersetzen (Popup + vorlesen)', icon: 'fa-language' },
  { keys: ['F3'], label: 'Markierten Text vorlesen', icon: 'fa-volume-high' },
  { keys: ['F1'], label: 'Letzten Diktat-Text (Original) vorlesen', icon: 'fa-clock-rotate-left' },
];

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="inline-flex items-center justify-center min-w-[1.6rem] px-1.5 py-0.5 rounded-md bg-white/10 border border-white/20 text-[11px] font-bold text-white font-mono shadow-sm">
    {children}
  </kbd>
);

const Row: React.FC<{ s: Shortcut }> = ({ s }) => (
  <div className="flex items-start gap-3 py-1.5">
    <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
      {s.keys.map((k, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-gray-500 text-[10px]">+</span>}
          <Key>{k}</Key>
        </React.Fragment>
      ))}
    </div>
    <div className="flex items-center gap-2 text-xs text-gray-300 leading-snug">
      <i className={`fas ${s.icon} text-indigo-400 text-[11px] w-4 text-center flex-shrink-0`} />
      <span>{s.label}</span>
    </div>
  </div>
);

const ShortcutsHelp: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Aufklapp-Button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Tastaturbefehle anzeigen"
        className={`fixed bottom-20 right-4 z-[60] w-11 h-11 rounded-full flex items-center justify-center shadow-lg border transition-all ${
          open
            ? 'bg-indigo-600 border-indigo-400 text-white'
            : 'bg-gray-900/90 dark:bg-gray-900/90 border-gray-700 text-indigo-300 hover:bg-gray-800'
        }`}
        aria-label="Tastaturbefehle"
      >
        <i className={`fas ${open ? 'fa-xmark' : 'fa-keyboard'} text-base`} />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-[8.5rem] right-4 z-[60] w-[22rem] max-w-[calc(100vw-2rem)] bg-gray-950/97 backdrop-blur-md text-white rounded-2xl border border-indigo-500/25 shadow-[0_20px_50px_rgba(99,102,241,0.25)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <i className="fas fa-keyboard text-indigo-400" />
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Tastaturbefehle</h3>
            </div>
            <button onClick={() => setOpen(false)} className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
              <i className="fas fa-xmark text-[11px]" />
            </button>
          </div>

          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Diktat / Einsprechen</p>
          <div className="divide-y divide-white/5">
            {DICTATION_SHORTCUTS.map((s, i) => <Row key={i} s={s} />)}
          </div>

          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-3 mb-1.5">Text &amp; Übersetzung</p>
          <div className="divide-y divide-white/5">
            {TEXT_SHORTCUTS.map((s, i) => <Row key={i} s={s} />)}
          </div>

          <p className="text-[10px] text-gray-500 italic mt-3 pt-2 border-t border-white/5">
            Übersetzer (F2 &amp; Diktat→Fremdsprache) läuft nur, wenn der <span className="text-emerald-400 font-bold">🌐 AN</span>-Schalter aktiv ist. Zielsprache dann direkt im Aufnahme-Overlay wählen.
          </p>
        </div>
      )}
    </>
  );
};

export default ShortcutsHelp;
