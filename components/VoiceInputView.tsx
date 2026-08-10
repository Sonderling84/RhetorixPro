import React, { useState, useEffect } from 'react';
import { AppMode, SessionResult } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { MicSelector } from './MicSelector';

interface VoiceInputViewProps {
  onSave: (session: SessionResult) => void;
  addLog: (message: string, level?: 'info' | 'error' | 'success') => void;
}

const VoiceInputView: React.FC<VoiceInputViewProps> = ({ onSave, addLog }) => {
  const [key1, setKey1] = useState<string>('Control');
  const [key2, setKey2] = useState<string>(' '); // Space by default
  const [isRecordingCustomKeys, setIsRecordingCustomKeys] = useState(false);
  const [audioFeedback, setAudioFeedback] = useState<string | null>(null);
  const [testText, setTestText] = useState('');
  const [autoArchive, setAutoArchive] = useState(true);
  const [isDictatingTest, setIsDictatingTest] = useState(false);

  // Load custom keys on mount
  useEffect(() => {
    const savedKeys = localStorage.getItem('rhetorix_voice_shortcut_keys');
    if (savedKeys) {
      try {
        const parsed = JSON.parse(savedKeys);
        if (parsed.key1 && parsed.key2) {
          setKey1(parsed.key1);
          setKey2(parsed.key2);
        }
      } catch (e) {
        // use default
      }
    }
  }, []);

  // Set keyboard listener during shortcut mapping
  useEffect(() => {
    if (!isRecordingCustomKeys) return;

    const keys: string[] = [];

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const keyName = e.key;

      if (!keys.includes(keyName)) {
        keys.push(keyName);
      }
      
      if (keys.length >= 2) {
        const k1 = keys[0];
        const k2 = keys[1];
        setKey1(k1);
        setKey2(k2);
        localStorage.setItem('rhetorix_voice_shortcut_keys', JSON.stringify({ key1: k1, key2: k2 }));
        addLog(`Neue Tastenkombination festgelegt: ${k1} + ${k2 === ' ' ? 'Leertaste' : k2}`, 'success');
        setIsRecordingCustomKeys(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isRecordingCustomKeys, addLog]);

  // Clean key representation
  const formatKeyName = (key: string) => {
    if (key === ' ') return 'Leertaste ␣';
    if (key === 'Control') return 'Ctrl / Strg';
    if (key === 'Alt') return 'Alt / Option ⌥';
    if (key === 'Meta') return 'Command / Win ⌘';
    if (key === 'Shift') return 'Shift ⇧';
    return key;
  };

  const handleTestDictationToggle = () => {
    if (isDictatingTest) {
      // Dispatch stop
      const stopEvent = new CustomEvent('rhetorix-force-stop-dictation');
      window.dispatchEvent(stopEvent);
      setIsDictatingTest(false);
    } else {
      // Focus on the test area
      const textEl = document.getElementById('test-dictation-textarea');
      if (textEl) {
        textEl.focus();
        // Give a tiny timeout for focus before launching
        setTimeout(() => {
          const triggerEvent = new CustomEvent('rhetorix-force-start-dictation');
          window.dispatchEvent(triggerEvent);
          setIsDictatingTest(true);
        }, 100);
      }
    }
  };

  // Listen to dictation progress to update local state in playground
  useEffect(() => {
    const handleProgress = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail && typeof customEv.detail.text === 'string') {
        // If focused element is our test textarea, sync local view
        const active = document.activeElement;
        if (active && active.id === 'test-dictation-textarea') {
          setTestText((active as HTMLTextAreaElement).value);
        }
      }
    };

    const handleStateChange = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail) {
        setIsDictatingTest(customEv.detail.isActive === true);
      }
    };

    window.addEventListener('rhetorix-dictation-active', handleStateChange);
    window.addEventListener('rhetorix-dictation-text', handleProgress);
    return () => {
      window.removeEventListener('rhetorix-dictation-active', handleStateChange);
      window.removeEventListener('rhetorix-dictation-text', handleProgress);
    };
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Intro Header */}
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-black text-gray-850 dark:text-gray-100 uppercase tracking-tighter italic">Einsprechen via ShortCut</h2>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest mt-1">Überall in der App einsprechen</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
            <i className="fas fa-keyboard text-xl"></i>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-950 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800/60 leading-relaxed text-sm text-gray-600 dark:text-gray-400 space-y-4">
          <p>
            Da das eingebaute Mac-Mikrofon manchmal fehlerhaft oder stumm schaltet, haben wir eine globale <strong>Tastatur-Einsprech-Erweiterung</strong> entwickelt. 
          </p>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
            <span><strong>Wie es funktioniert:</strong> Tippe in ein beliebiges Eingabefeld oder Textfeld (z.B. im Tagebuch, E-Mail Studio, Entwicklungs-Doku). Mache dann die Tastenkombination und spreche frei heraus. Der Text wird live eingetippt!</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            <span><strong>Iframe-Hinweis:</strong> Falls die Spracherkennung blockiert ist, öffne die App einmal im eigenen Tab (Icon oben rechts in der AI Studio Leiste) und gestatte den Mikrofon-Zugriff!</span>
          </div>
        </div>
      </div>

      {/* Shortcut Configuration */}
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl space-y-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 block mb-1">Konfiguration</span>
          <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight italic">Eigene Tasten wählen</h3>
          <p className="text-xs text-gray-400">Drücke zwei beliebige Tasten gleichzeitig, um deine Favoriten-Kombination zu speichern.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 justify-between bg-gray-50 dark:bg-gray-950 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800/40">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white font-black px-4 py-2.5 rounded-xl shadow-md font-mono text-sm min-w-[70px] text-center">
              {formatKeyName(key1)}
            </div>
            <span className="text-gray-400 dark:text-gray-500 font-bold text-lg">+</span>
            <div className="bg-indigo-600 text-white font-black px-4 py-2.5 rounded-xl shadow-md font-mono text-sm min-w-[70px] text-center">
              {formatKeyName(key2)}
            </div>
          </div>

          <button
            onClick={() => {
              setIsRecordingCustomKeys(true);
              addLog("Drücke jetzt nacheinander die 2 Tasten deiner Wunsch-Kombination...", "info");
            }}
            disabled={isRecordingCustomKeys}
            className={`px-6 py-4 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all shadow-md ${isRecordingCustomKeys ? 'bg-red-500 text-white animate-pulse' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-gray-100 dark:border-gray-700'}`}
          >
            {isRecordingCustomKeys ? 'Drücke 2 Tasten...' : 'Kombination ändern'}
          </button>
        </div>

        {isRecordingCustomKeys && (
          <p className="text-xs text-red-500 font-bold flex items-center gap-1.5 animate-pulse bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
            <i className="fas fa-hand-pointer"></i> 
            Warte auf Tastenanschlag... Drücke die beiden gewünschten Tasten gleichzeitig oder nacheinander. (z.B. Control und Leertaste)
          </p>
        )}
      </div>

      {/* Mikrofon-Einstellung */}
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl space-y-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 block mb-1">Eingabe-Hardware</span>
          <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight italic">Mikrofon kalibrieren</h3>
          <p className="text-xs text-gray-400">Verhindert Stumm-Probleme auf deinem Mac: Wähle hier dein aktives Mikrofon und starte einen schnellen Pegeltest.</p>
        </div>
        <MicSelector addLog={addLog} />

        <div className="pt-4 border-t border-gray-100 dark:border-gray-800/40">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('rhetorix-start-mic-test'));
              addLog('Mikrofon-Kalibrierung gestartet — sprich die angezeigten Sätze nach.', 'info');
            }}
            className="w-full sm:w-auto px-6 py-4 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all shadow-md bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center gap-2"
          >
            <i className="fas fa-vial"></i>
            Kalibrierung starten
          </button>
          <p className="text-[10px] text-gray-400 mt-2">Sprich 3 Test-Sätze nach, um zu prüfen ob Mikrofon + Spracherkennung funktionieren.</p>
        </div>
      </div>

      {/* Interactive Testing Playground */}
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl space-y-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 block mb-1">Spielwiese</span>
          <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight italic">Live-Testfeld</h3>
          <p className="text-xs text-gray-400">Klicke in das Textfeld und probiere deine gewählte Kombination aus.</p>
        </div>

        <div className="relative">
          <textarea
            id="test-dictation-textarea"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Klicke hier rein. Halte danach deine Tastenkombination gedrückt (oder drücke sie), und spreche ein..."
            className="w-full h-40 bg-gray-50 dark:bg-gray-950 border border-transparent rounded-[2rem] p-6 text-sm font-medium focus:bg-white dark:focus:bg-gray-900 focus:ring-4 focus:ring-emerald-50 dark:focus:ring-emerald-900/20 outline-none transition-all resize-none shadow-inner text-gray-800 dark:text-white placeholder:text-gray-450 dark:placeholder:text-gray-700"
          />

          <button
            onClick={handleTestDictationToggle}
            className={`absolute bottom-4 right-4 px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 text-[10px] font-black uppercase tracking-wider ${isDictatingTest ? 'bg-red-500 text-white animate-pulse' : 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-gray-750'}`}
          >
            <i className={`fas ${isDictatingTest ? 'fa-stop-circle' : 'fa-microphone'}`}></i>
            {isDictatingTest ? 'Diktat stoppen' : 'Test starten'}
          </button>
        </div>

        {isDictatingTest && (
          <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider">Mikrofon empfängt Daten. Sprich laut und deutlich...</span>
          </div>
        )}

        <div className="flex justify-between items-center pt-2">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-bold">Inhalt unter 'Spracharchiv' speichern?</span>
            <button
              onClick={() => setAutoArchive(!autoArchive)}
              className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 outline-none ${autoArchive ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-750'}`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${autoArchive ? 'translate-x-4' : 'translate-x-0'}`}></div>
            </button>
          </div>

          <button
            disabled={!testText}
            onClick={() => {
              if (autoArchive) {
                onSave({
                  id: Date.now().toString(),
                  timestamp: Date.now(),
                  mode: AppMode.VOICE_INPUT,
                  transcription: testText,
                  correctedText: testText,
                  title: `Direkt-Einsprechung (${new Date().toLocaleDateString('de-DE')})`
                });
                addLog('Diktat erfolgreich archiviert!', 'success');
              } else {
                navigator.clipboard.writeText(testText);
                addLog('Ins Clipboard kopiert!', 'success');
              }
              setTestText('');
            }}
            className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-md ${!testText ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed' : 'bg-gray-900 hover:bg-black'}`}
          >
            {autoArchive ? 'Im Archiv sichern' : 'Kopieren & Leeren'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceInputView;
