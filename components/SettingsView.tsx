import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI, Modality } from '@google/genai';
import { MicSelector } from './MicSelector';
import { 
  getVoicePreference, 
  saveVoicePreference, 
  VoiceStyle, 
  GeminiVoice 
} from '../utils/speechHelper';
import { decode, decodeAudioData } from '../utils/audio-helpers';

interface SettingsViewProps {
  addLog: (message: string, level: 'info' | 'success' | 'warn' | 'error') => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ addLog }) => {
  const navigate = useNavigate();
  const [pref, setPref] = useState(getVoicePreference());
  const [testText, setTestText] = useState('Hallo, ich bin deine neue Stimme bei Rhetorix Pro. Wie gefalle ich dir?');
  const [isPlayingLocal, setIsPlayingLocal] = useState(false);
  const [isPlayingGemini, setIsPlayingGemini] = useState(false);
  const [activeUtterance, setActiveUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  
  // Clean up any speaking voice on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleStyleChange = (style: VoiceStyle) => {
    const updated = { ...pref, style };
    setPref(updated);
    saveVoicePreference(updated);
    addLog(`Vorlese-Stil auf "${style}" geändert und dauerhaft gespeichert.`, 'success');
  };

  const handleGeminiVoiceChange = (geminiVoice: GeminiVoice) => {
    const updated = { ...pref, geminiVoice };
    setPref(updated);
    saveVoicePreference(updated);
    addLog(`Gemini-Stimme auf "${geminiVoice}" geändert und dauerhaft gespeichert.`, 'success');
  };

  const handleSpeedChange = (speed: number) => {
    const updated = { ...pref, speed };
    setPref(updated);
    saveVoicePreference(updated);
  };

  const testLocalVoice = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      addLog('Sprachausgabe wird von diesem Browser nicht unterstützt.', 'error');
      return;
    }

    window.speechSynthesis.cancel();

    if (isPlayingLocal) {
      setIsPlayingLocal(false);
      return;
    }

    setIsPlayingLocal(true);
    const utter = new SpeechSynthesisUtterance(testText);
    utter.lang = 'de-DE';

    // Apply voice preferences setting
    let baseRate = 0.92;
    let basePitch = 1.0;
    
    switch (pref.style) {
      case 'enthusiastic':
        baseRate = 1.05;
        basePitch = 1.15;
        break;
      case 'formal':
        baseRate = 0.90;
        basePitch = 0.90;
        break;
      case 'emotional':
        baseRate = 0.82;
        basePitch = 1.05;
        break;
      case 'standard':
      default:
        baseRate = 0.92;
        basePitch = 1.0;
        break;
    }
    
    utter.rate = baseRate * pref.speed;
    utter.pitch = basePitch;

    const voices = window.speechSynthesis.getVoices();
    // Use selectGermanVoice matching logic
    const deVoices = voices.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith('de'));
    if (deVoices.length > 0) {
      const best = deVoices.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        const naturalA = nameA.includes('natural') || nameA.includes('premium') || nameA.includes('online');
        const naturalB = nameB.includes('natural') || nameB.includes('premium') || nameB.includes('online');
        if (naturalA && !naturalB) return -1;
        if (!naturalA && naturalB) return 1;

        const preferred = ['katja', 'hedda', 'amelie', 'marlene', 'anna', 'steffi', 'lisa', 'siri', 'yannick', 'stefan'];
        const indexA = preferred.findIndex(n => nameA.includes(n));
        const indexB = preferred.findIndex(n => nameB.includes(n));
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1 && indexB === -1) return -1;
        if (indexA === -1 && indexB !== -1) return 1;
        return 0;
      })[0];
      if (best) utter.voice = best;
    }

    utter.onend = () => {
      setIsPlayingLocal(false);
    };

    utter.onerror = () => {
      setIsPlayingLocal(false);
    };

    setActiveUtterance(utter);
    window.speechSynthesis.speak(utter);
  };

  const testGeminiVoice = async () => {
    if (isPlayingGemini) return;
    setIsPlayingGemini(true);
    addLog(`Generiere Audio-Vorschau mit Gemini-Stimme "${pref.geminiVoice}"...`, 'info');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Hallo Tobias, ich bin deine ausgewählte ${pref.geminiVoice} Stimme von Gemini. Wie gefalle ich dir im neuen Rhetorix Studio?` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: pref.geminiVoice } } },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
        const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => {
          setIsPlayingGemini(false);
          if (ctx.state !== 'closed') ctx.close();
        };
        source.start();
        addLog(`Preview für Gemini "${pref.geminiVoice}" wird abgespielt!`, 'success');
      } else {
        throw new Error('Keine Audiodaten im Gemini Response.');
      }
    } catch (err: any) {
      console.error(err);
      setIsPlayingGemini(false);
      addLog(`Gemini Voice Preview fehlgeschlagen: ${err?.message || 'Prüfe deine Onlineverbindung.'}`, 'error');
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
            Passe das akustische Erlebnis nach deinen Wünschen an. Wähle zwischen systembasierten Emotionsstilen für lokale Texte oder fortschrittlichen Gemini AI-Stimmen.
          </p>
        </div>
      </div>

      {/* 1. Lokale Vorlese-Stimme */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-md space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
              System-Vorlesestimme (Ausdrucksstärke)
            </h3>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
            Verwendet für Text-Optimierer, Diktate, Spiele &amp; Checklisten
          </p>
        </div>

        {/* Emotionsstiele */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
            Stil &amp; Betonung
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'standard', title: 'Standard', desc: 'Ausgeglichen', icon: 'fa-user' },
              { id: 'formal', title: 'Förmlich', desc: 'Respektvoll, tief', icon: 'fa-user-tie' },
              { id: 'emotional', title: 'Emotional', desc: 'Sanft, ruhig', icon: 'fa-heart' },
              { id: 'enthusiastic', title: 'Enthusiastisch', desc: 'Dynamisch, lebendig', icon: 'fa-bolt' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => handleStyleChange(s.id as VoiceStyle)}
                className={`p-4 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                  pref.style === s.id 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100' 
                    : 'bg-gray-50 dark:bg-gray-950 border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <i className={`fas ${s.icon} text-xs`}></i>
                  <span className="text-[10px] font-black uppercase tracking-wider">{s.title}</span>
                </div>
                <span className={`text-[9px] font-semibold opacity-70`}>{s.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Geschwindigkeit */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <span>Sprechgeschwindigkeit</span>
            <span className="text-blue-600 dark:text-blue-400 font-black">{pref.speed.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.7"
            max="1.5"
            step="0.05"
            value={pref.speed}
            onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>

        {/* Testfeld local */}
        <div className="p-4 rounded-3xl bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 space-y-3">
          <input
            type="text"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Schreibe etwas zum Testhören..."
            className="w-full px-4 py-3 text-xs bg-white dark:bg-gray-900 border border-transparent focus:border-blue-500/20 rounded-2xl outline-none font-semibold text-gray-700 dark:text-gray-300"
          />
          <button
            onClick={testLocalVoice}
            className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              isPlayingLocal 
                ? 'bg-red-500 text-white shadow-lg' 
                : 'bg-gray-900 text-white dark:bg-white dark:text-black hover:scale-[101%]'
            }`}
          >
            <i className={`fas ${isPlayingLocal ? 'fa-square' : 'fa-play'}`}></i>
            {isPlayingLocal ? 'Vorlesen stoppen' : 'Systemstimme Testen'}
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

      {/* 3. Chat & Mentor AI-Stimmen */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-md space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
              Gemini AI-Stimmkonfiguration (Premium)
            </h3>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
            Verwendet für den Mentor &amp; Realistische Sprachgenerierung
          </p>
        </div>

        {/* Gemini voices list */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
            Verfügbare Prebuilt-Stimmen
          </label>
          <div className="space-y-2">
            {[
              { name: 'Kore', label: 'Kore (Weiblich)', desc: 'Sehr klar, professionell, standardnaher Klang.' },
              { name: 'Aoede', label: 'Aoede (Weiblich)', desc: 'Warm, melodisch und ideal für längere Vorträge.' },
              { name: 'Charon', label: 'Charon (Männlich)', desc: 'Respektvoll, tief, ideal für gehobene, seriöse Reden.' },
              { name: 'Puck', label: 'Puck (Männlich)', desc: 'Enthusiastisch, sehr lebendig & energisch.' },
              { name: 'Fenrir', label: 'Fenrir (Männlich)', desc: 'Tief, markant und charakterstark.' },
            ].map((v) => (
              <button
                key={v.name}
                onClick={() => handleGeminiVoiceChange(v.name as GeminiVoice)}
                className={`w-full p-4 rounded-2xl border text-left flex items-start justify-between transition-all ${
                  pref.geminiVoice === v.name 
                    ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-400 text-purple-950 dark:text-purple-300' 
                    : 'bg-gray-50 dark:bg-gray-950 border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${pref.geminiVoice === v.name ? 'bg-purple-600' : 'bg-gray-300'}`}></span>
                    <span className="text-[11px] font-black uppercase tracking-wider">{v.label}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 font-semibold">{v.desc}</p>
                </div>
                {pref.geminiVoice === v.name && (
                  <span className="bg-purple-600 text-white rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider">
                    Aktiv
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Gemini test preview */}
        <button
          onClick={testGeminiVoice}
          disabled={isPlayingGemini}
          className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
            isPlayingGemini 
              ? 'bg-purple-300 text-white cursor-not-allowed shadow-inner' 
              : 'bg-purple-600 hover:bg-purple-700 text-white active:scale-98 shadow-md'
          }`}
        >
          {isPlayingGemini ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              Generiere &amp; spiele Audio...
            </>
          ) : (
            <>
              <i className="fas fa-volume-up"></i>
              Gemini AI-Stimme ({pref.geminiVoice}) testen 🎧
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SettingsView;
