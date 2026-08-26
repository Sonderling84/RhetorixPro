import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { MicSelector } from './MicSelector';
import { speakElevenLabs, stopSpeaking, getVoiceId, setVoiceId } from '../utils/elevenLabsTTS';
import { buildReport, downloadReport, saveReport, setTrackingEnabled, trackingEnabled } from '../utils/webAnalytics';

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

  // Tracking / Statistik
  const [trackOn, setTrackOn] = useState<boolean>(() => trackingEnabled());
  const [stats, setStats] = useState<any>(() => buildReport());
  const [savingReport, setSavingReport] = useState(false);
  const refreshStats = () => setStats(buildReport());

  useEffect(() => {
    return () => { stopSpeaking(); };
  }, []);

  useEffect(() => { refreshStats(); }, []);

  const toggleTracking = () => {
    const next = !trackOn;
    setTrackingEnabled(next);
    setTrackOn(next);
    addLog(next ? 'Tracking aktiviert.' : 'Tracking deaktiviert (Opt-out).', next ? 'success' : 'info');
  };

  const handleDownloadReport = () => {
    downloadReport();
    addLog('Statistik-Bericht als JSON heruntergeladen.', 'success');
  };

  const handleSaveReport = async () => {
    setSavingReport(true);
    addLog('Speichere Statistik-Bericht...', 'info');
    try {
      const r = await saveReport();
      if (r.ok && r.where === 'google-drive') addLog(`Bericht in Google Drive gespeichert${r.detail ? ` (${r.detail})` : ''}.`, 'success');
      else if (r.ok) addLog('Bericht an den konfigurierten Endpoint gesendet.', 'success');
      else addLog(r.detail || 'Kein Backend erreichbar — Bericht wurde heruntergeladen.', 'warn');
    } catch (e: any) {
      addLog(`Fehler beim Speichern: ${e?.message || 'unbekannt'}`, 'error');
    } finally {
      setSavingReport(false);
    }
  };

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

      {/* 3. Statistik & Datenschutz */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-md space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></span>
          <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
            Statistik &amp; Datenschutz
          </h3>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
          Anonymes First-Party-Tracking (Seitenaufrufe, Klicks, Sessions) — keine Fremd-Cookies, kein Google Analytics. Zustimmung per Banner, hier jederzeit widerrufbar.
        </p>

        {/* Live-Kennzahlen */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Sessions', value: stats?.totals?.sessions ?? 0 },
            { label: 'Seitenaufrufe', value: stats?.totals?.pageviews ?? 0 },
            { label: 'Klicks', value: stats?.totals?.clicks ?? 0 },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 text-center">
              <div className="text-lg font-black text-violet-600 dark:text-violet-400 tabular-nums">{s.value}</div>
              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tracking an/aus */}
        <button
          onClick={toggleTracking}
          className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${
            trackOn
              ? 'bg-violet-50 dark:bg-violet-950/20 border-violet-400 text-violet-950 dark:text-violet-300'
              : 'bg-gray-50 dark:bg-gray-950 border-transparent text-gray-500'
          }`}
        >
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider">
              Tracking {trackOn ? 'aktiv' : 'deaktiviert'}
            </div>
            <p className="text-[10px] text-gray-400 mt-1 font-semibold">
              {trackOn ? 'Zähle Aufrufe & Klicks auf diesem Gerät.' : 'Keine Zustimmung — es werden keine Daten erfasst.'}
            </p>
          </div>
          <span className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-all ${trackOn ? 'bg-violet-600 justify-end' : 'bg-gray-300 dark:bg-gray-700 justify-start'}`}>
            <span className="w-5 h-5 rounded-full bg-white shadow"></span>
          </span>
        </button>

        {/* Aktionen */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleDownloadReport}
            className="py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
          >
            <i className="fas fa-download"></i> JSON-Bericht
          </button>
          <button
            onClick={handleSaveReport}
            disabled={savingReport}
            className="py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 bg-violet-600 text-white hover:bg-violet-700 shadow-md disabled:opacity-60 transition-all"
          >
            <i className={`fas ${savingReport ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}`}></i>
            {savingReport ? 'Speichere...' : 'In Drive sichern'}
          </button>
        </div>
        <p className="text-[9px] text-gray-400 dark:text-gray-500 font-semibold leading-relaxed">
          „In Drive sichern" nutzt die Google-Drive-Verbindung der Desktop-/Server-Version. Ohne Backend
          wird der Bericht stattdessen heruntergeladen. Details &amp; n8n-Anbindung: siehe TRACKING.md.
        </p>
      </div>

    </div>
  );
};

export default SettingsView;
