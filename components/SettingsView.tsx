import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { MicSelector } from './MicSelector';
import { speakElevenLabs, stopSpeaking, getVoiceId, setVoiceId } from '../utils/elevenLabsTTS';

interface SettingsViewProps {
  addLog: (message: string, level: 'info' | 'success' | 'warn' | 'error') => void;
}

const ELEVENLABS_VOICES = [
  { id: 'piTKgcLEGmPE4e6mEKli', name: 'Nicole', desc: 'Weiblich, warm und freundlich' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', desc: 'Weiblich, ruhig und professionell' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', desc: 'Männlich, tief und klar' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', desc: 'Männlich, freundlich und warm' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', desc: 'Weiblich, sanft und ausdrucksvoll' },
];

const SettingsView: React.FC<SettingsViewProps> = ({ addLog }) => {
  const navigate = useNavigate();
  const [testText, setTestText] = useState('Hallo, ich bin deine neue Stimme bei Rhetorix Pro. Wie gefalle ich dir?');
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(getVoiceId());

  useEffect(() => {
    return () => { stopSpeaking(); };
  }, []);

  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoice(voiceId);
    setVoiceId(voiceId);
    const voice = ELEVENLABS_VOICES.find(v => v.id === voiceId);
    addLog(`ElevenLabs-Stimme auf "${voice?.name || voiceId}" geändert.`, 'success');
  };

  const testVoice = async () => {
    if (isPlayingTest) {
      stopSpeaking();
      setIsPlayingTest(false);
      return;
    }
    setIsPlayingTest(true);
    addLog('Generiere Stimm-Vorschau...', 'info');
    try {
      await speakElevenLabs(testText, selectedVoice);
      addLog('Vorschau abgespielt!', 'success');
    } catch (err: any) {
      addLog(`Fehler: ${err?.message || 'Prüfe deine Verbindung.'}`, 'error');
    } finally {
      setIsPlayingTest(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <button 
          onClick={() => navigate('/')} 
          className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-400 hover:text-blue-600 shadow-sm transition-all"
        >
          <i className="fas fa-chevron-left"></i>
        </button>
        <h2 className="text-xl font-black text-gray-900 dark:text-white italic uppercase tracking-tighter">Einstellungen</h2>
        <div className="w-12 h-12"></div>
      </div>

      {/* Intro info card */}
      <div className="p-6 rounded-[2.5rem] bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-xl flex items-center gap-4">
        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-xl shrink-0">
          <i className="fas fa-sliders"></i>
        </div>
        <div>
          <h3 className="font-black uppercase tracking-wider text-xs">Stimmkonfiguration</h3>
          <p className="text-[11px] text-blue-100 leading-relaxed font-semibold mt-1">
            Wähle deine bevorzugte ElevenLabs-Stimme für alle Vorlese-Funktionen in Rhetorix Pro.
          </p>
        </div>
      </div>

      {/* 1. ElevenLabs Stimme */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-md space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
              ElevenLabs Stimme
            </h3>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
            Wird für alle Vorlese-Funktionen in Rhetorix Pro verwendet
          </p>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
            Verfügbare Stimmen
          </label>
          <div className="space-y-2">
            {ELEVENLABS_VOICES.map((v) => (
              <button
                key={v.id}
                onClick={() => handleVoiceChange(v.id)}
                className={`w-full p-4 rounded-2xl border text-left flex items-start justify-between transition-all ${
                  selectedVoice === v.id
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-400 text-emerald-950 dark:text-emerald-300'
                    : 'bg-gray-50 dark:bg-gray-950 border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedVoice === v.id ? 'bg-emerald-600' : 'bg-gray-300'}`}></span>
                    <span className="text-[11px] font-black uppercase tracking-wider">{v.name}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 font-semibold">{v.desc}</p>
                </div>
                {selectedVoice === v.id && (
                  <span className="bg-emerald-600 text-white rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider">
                    Aktiv
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Testfeld */}
        <div className="p-4 rounded-3xl bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 space-y-3">
          <input
            type="text"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Schreibe etwas zum Testhören..."
            className="w-full px-4 py-3 text-xs bg-white dark:bg-gray-900 border border-transparent focus:border-emerald-500/20 rounded-2xl outline-none font-semibold text-gray-700 dark:text-gray-300"
          />
          <button
            onClick={testVoice}
            className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              isPlayingTest
                ? 'bg-red-500 text-white shadow-lg'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
            }`}
          >
            <i className={`fas ${isPlayingTest ? 'fa-square' : 'fa-play'}`}></i>
            {isPlayingTest ? 'Stoppen' : 'Stimme testen'}
          </button>
        </div>
      </div>

      {/* 2. Mikrofon-Auswahl & Pegeltest */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-md space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
            Audio Eingangsgerät
          </h3>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
          Bestimme dein bevorzugtes Mikrofon für Diktate und Sprach-Eingaben
        </p>
        <MicSelector addLog={addLog} />
      </div>

    </div>
  );
};

export default SettingsView;
