
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HashRouter as Router, Routes, Route, useNavigate, Link, useLocation } from 'react-router-dom';
import { AppMode, SessionResult, LogEntry } from './types';
import TrainerSession from './components/TrainerSession';
import PromptShowcase from './components/PromptShowcase';
import LegalView from './components/LegalView';
import HistoryView from './components/HistoryView';
import LogView from './components/LogView';
import TemplatesView from './components/TemplatesView';
import DictationView from './components/DictationView';
import ChallengeView from './components/ChallengeView';
import DiaryView from './components/DiaryView';
import TextOptimizer from './components/TextOptimizer';
import AuthorView from './components/AuthorView';
import PoliticalSpeechView from './components/PoliticalSpeechView';
import AppDevelopmentView from './components/AppDevelopmentView';
import DevLogView from './components/DevLogView';
import VoiceInputView from './components/VoiceInputView';
import GlobalDictationOverlay from './components/GlobalDictationOverlay';
import ShortcutsHelp from './components/ShortcutsHelp';
import TranslatorToggle from './components/TranslatorToggle';
import EcoModeController from './components/EcoModeController';
import { syncVoiceToMain } from './utils/elevenLabsTTS';
import SocialMediaView from './components/SocialMediaView';
import BusinessPitchView from './components/BusinessPitchView';
import PhoneSimulationView from './components/PhoneSimulationView';
import EmailStudioView from './components/EmailStudioView';
import AboutMeView from './components/AboutMeView';
import TasksView from './components/TasksView';
import HelpView from './components/HelpView';
import YouTubeView from './components/YouTubeView';
import { PlanningChecklistView } from './components/PlanningChecklistView';
import SettingsView from './components/SettingsView';
import AnalyticsView from './components/AnalyticsView';
import SkillTrainingView from './components/SkillTrainingView';
import { UserStats } from './types';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<SessionResult[]>(() => {
    const saved = localStorage.getItem('rhetorix_sessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [userStats, setUserStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('rhetorix_stats');
    return saved ? JSON.parse(saved) : { xp: 0, level: 1, completedSessions: 0, streak: 0 };
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('rhetorix_darkmode');
    return saved === null ? true : saved === 'true';
  });
  const [bgAsset, setBgAsset] = useState<string | null>(() => {
    return localStorage.getItem('rhetorix_bg_asset');
  });
  const [bgAssetType, setBgAssetType] = useState<'video' | 'image' | null>(() => {
    return localStorage.getItem('rhetorix_bg_asset_type') as ('video' | 'image' | null);
  });
  const [globalTranscript, setGlobalTranscript] = useState('');
  const [isGlobalDictating, setIsGlobalDictating] = useState(false);
  const [isBgHovered, setIsBgHovered] = useState(false);
  const [isMicOpen, setIsMicOpen] = useState(false);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState(() => localStorage.getItem('rhetorix_selected_mic_id') || '');
  const micDropdownRef = useRef<HTMLDivElement>(null);
  const [bgOpacity, setBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('rhetorix_bg_opacity');
    return saved ? Math.min(100, Math.max(20, parseInt(saved, 10))) : 100;
  });

  useEffect(() => {
    const handleDictationEvent = (e: any) => {
      const { transcript, isDictating } = e.detail;
      setGlobalTranscript(transcript);
      setIsGlobalDictating(isDictating);
    };
    window.addEventListener('rhetorix-dictation', handleDictationEvent);
    return () => window.removeEventListener('rhetorix-dictation', handleDictationEvent);
  }, []);

  // Mic-Geräte laden
  const loadMicDevices = async () => {
    try {
      // Permission sicherstellen
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      const all = await navigator.mediaDevices.enumerateDevices();
      setMicDevices(all.filter(d => d.kind === 'audioinput'));
    } catch { /* */ }
  };

  const handleMicSelect = (deviceId: string) => {
    setSelectedMicId(deviceId);
    localStorage.setItem('rhetorix_selected_mic_id', deviceId);
    setIsMicOpen(false);
    addLog(`Mikrofon gewechselt: ${micDevices.find(d => d.deviceId === deviceId)?.label || 'Unbekannt'}`, 'success');
  };

  // Click-outside schließt Mic-Dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (micDropdownRef.current && !micDropdownRef.current.contains(e.target as Node)) {
        setIsMicOpen(false);
      }
    };
    if (isMicOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMicOpen]);

  useEffect(() => {
    localStorage.setItem('rhetorix_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('rhetorix_bg_opacity', bgOpacity.toString());
  }, [bgOpacity]);

  useEffect(() => {
    localStorage.setItem('rhetorix_darkmode', String(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('rhetorix_stats', JSON.stringify(userStats));
  }, [userStats]);

  const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) { // 20MB limit
        addLog("Datei zu groß (Max 20MB)", "error");
        return;
      }
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setBgAsset(result);
        setBgAssetType(type);
        localStorage.setItem('rhetorix_bg_asset', result);
        localStorage.setItem('rhetorix_bg_asset_type', type);
        addLog(`${type === 'video' ? 'Hintergrundvideo' : 'Hintergrundbild'} hochgeladen`, "success");
      };
      reader.readAsDataURL(file);
    }
  };

  const removeBgAsset = () => {
    setBgAsset(null);
    setBgAssetType(null);
    localStorage.removeItem('rhetorix_bg_asset');
    localStorage.removeItem('rhetorix_bg_asset_type');
    addLog("Hintergrund entfernt", "info");
  };

  const addLog = (message: string, level: LogEntry['level'] = 'info') => {
    setLogs(prev => [{ timestamp: Date.now(), message, level }, ...prev].slice(0, 100));
  };

  const addXP = (amount: number) => {
    setUserStats(prev => {
      const newXP = prev.xp + amount;
      const newLevel = Math.floor(newXP / 1000) + 1;
      if (newLevel > prev.level) {
        addLog(`LEVEL UP! Du bist jetzt Level ${newLevel}!`, 'success');
      }
      return {
        ...prev,
        xp: newXP,
        level: newLevel,
        completedSessions: prev.completedSessions + 1
      };
    });
  };

  const saveSession = (session: SessionResult) => {
    setSessions(prev => [session, ...prev]);
    addXP(150);
    addLog(`Eintrag "${session.title}" gespeichert. +150 XP`, 'success');
  };

  return (
    <Router>
      <AppContent 
        sessions={sessions} 
        logs={logs} 
        isDarkMode={isDarkMode} 
        setIsDarkMode={setIsDarkMode} 
        bgAsset={bgAsset} 
        bgAssetType={bgAssetType} 
        bgOpacity={bgOpacity} 
        handleAssetUpload={handleAssetUpload} 
        removeBgAsset={removeBgAsset} 
        isBgHovered={isBgHovered} 
        setIsBgHovered={setIsBgHovered} 
        isMicOpen={isMicOpen} 
        setIsMicOpen={setIsMicOpen} 
        loadMicDevices={loadMicDevices} 
        micDevices={micDevices} 
        handleMicSelect={handleMicSelect} 
        selectedMicId={selectedMicId} 
        micDropdownRef={micDropdownRef} 
        setBgOpacity={setBgOpacity} 
        globalTranscript={globalTranscript} 
        isGlobalDictating={isGlobalDictating} 
        addLog={addLog} 
        saveSession={saveSession} 
      />
    </Router>
  );
};

const AppContent: React.FC<any> = ({
  sessions, logs, isDarkMode, setIsDarkMode, bgAsset, bgAssetType, bgOpacity, 
  handleAssetUpload, removeBgAsset, isBgHovered, setIsBgHovered, 
  isMicOpen, setIsMicOpen, loadMicDevices, micDevices, handleMicSelect, 
  selectedMicId, micDropdownRef, setBgOpacity, globalTranscript, 
  isGlobalDictating, addLog, saveSession
}) => {
  const location = useLocation();
  const isOverlayMode = location.pathname === '/dictation-overlay';

  // Transparenter Hintergrund für das Overlay-Fenster (überschreibt body CSS)
  useEffect(() => {
    if (isOverlayMode) {
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';
    }
  }, [isOverlayMode]);

  // Gespeicherte Vorlese-Stimme beim Start an den Main-Prozess melden (für F1/F2/F3)
  useEffect(() => {
    if (!isOverlayMode) syncVoiceToMain();
  }, [isOverlayMode]);

  if (isOverlayMode) {
    return (
      <div style={{ background: 'transparent' }} className="w-screen h-screen overflow-hidden flex items-end justify-center p-2">
        <GlobalDictationOverlay isStandalone={true} />
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col pb-20 transition-colors duration-500 relative overflow-hidden">
        {bgAsset && bgAssetType === 'video' && (
          <video
            src={bgAsset}
            autoPlay
            loop
            muted
            playsInline
            data-bg-video
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
            style={{ opacity: bgOpacity / 100 }}
          />
        )}
        {bgAsset && bgAssetType === 'image' && (
          <div
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
            style={{ backgroundImage: `url(${bgAsset})`, backgroundPosition: 'center', backgroundSize: 'cover', opacity: bgOpacity / 100 }}
          />
        )}
        {/* Dezenter Hintergrund-Effekt: zeigt selten Beispiel-Prompts (nur auf der Startseite) */}
        <PromptShowcase active={location.pathname === '/'} />
        <header className="glass sticky top-0 z-50 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 text-blue-600 flex items-center justify-center">
              <i className="fas fa-robot text-lg"></i>
            </div>
            <div>
               <h1 className="text-lg font-black tracking-tighter text-gray-900 dark:text-white leading-none uppercase">RHETORIX <span className="text-blue-600">PRO</span></h1>
               <p className="text-[8px] font-bold text-blue-600 tracking-widest uppercase mt-0.5">Tobias Ganster</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="relative"
              onMouseEnter={() => setIsBgHovered(true)}
              onMouseLeave={() => setIsBgHovered(false)}
            >
              <label 
                title="Hintergrund hochladen (Video oder Bild)"
                className="p-2 text-gray-400 hover:text-blue-600 transition-colors cursor-pointer block"
              >
                <i className="fas fa-image"></i>
                <input type="file" accept="video/mp4,video/quicktime,image/*" onChange={handleAssetUpload} className="hidden" />
              </label>

              <AnimatePresence>
                {isBgHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute top-full mt-2 right-0 w-52 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl p-3 z-[60]"
                  >
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1">
                      <i className="fas fa-eye"></i> Live-Vorschau
                    </p>
                    {bgAsset ? (
                      <div className="space-y-2">
                        <div className="w-full h-28 rounded-xl bg-gray-100 dark:bg-gray-950 overflow-hidden relative border border-gray-200 dark:border-gray-800 shadow-inner">
                          {bgAssetType === 'video' ? (
                            <video 
                              src={bgAsset} 
                              className="w-full h-full object-cover" 
                              muted 
                              autoPlay 
                              loop 
                              playsInline 
                            />
                          ) : (
                            <div 
                              className="w-full h-full bg-cover bg-center" 
                              style={{ backgroundImage: `url(${bgAsset})` }}
                            />
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-extrabold text-center uppercase tracking-normal mb-1">
                          {bgAssetType === 'video' ? '🎬 Hintergrundvideo' : '🖼️ Hintergrundbild'}
                        </p>
                        
                        {/* Opacity slider */}
                        <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
                          <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                            <span>💡 Deckkraft</span>
                            <span className="text-blue-500 font-black">{bgOpacity}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="20" 
                            max="100" 
                            value={bgOpacity} 
                            onChange={(e) => setBgOpacity(parseInt(e.target.value, 10))}
                            className="w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-24 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center text-center p-2">
                        <i className="fas fa-cloud-arrow-up text-gray-300 dark:text-gray-700 mb-1 text-base"></i>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold leading-normal">
                          Kein Hintergrund aktiv.<br />Klicken zum Hochladen.
                        </span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {bgAsset && (
              <button 
                title="Hintergrund entfernen"
                onClick={removeBgAsset} className="p-2 text-rose-400 hover:text-rose-600 transition-colors"
              >
                <i className="fas fa-trash-can"></i>
              </button>
            )}
            {/* Mikrofon-Auswahl Dropdown */}
            <div className="relative" ref={micDropdownRef}>
              <button
                title="Soundeingang wählen"
                onClick={() => { setIsMicOpen(!isMicOpen); if (!isMicOpen) loadMicDevices(); }}
                className={`p-2 rounded-xl transition-all ${isMicOpen ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-blue-600'}`}
              >
                <i className="fas fa-microphone"></i>
              </button>
              <AnimatePresence>
                {isMicOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute top-full mt-2 right-0 w-72 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl p-3 z-[60]"
                  >
                    <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1.5">
                      <i className="fas fa-microphone"></i> Soundeingang
                    </p>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {micDevices.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2 text-center">Lade Geräte...</p>
                      ) : (
                        micDevices.map(d => {
                          const label = d.label || `Mikrofon (${d.deviceId.slice(0, 5)}...)`;
                          const isVirtual = /virtual|ndi|loopback|blackhole/i.test(label);
                          const isSelected = d.deviceId === selectedMicId;
                          return (
                            <button
                              key={d.deviceId}
                              onClick={() => handleMicSelect(d.deviceId)}
                              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : isVirtual
                                    ? 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                              }`}
                            >
                              <i className={`fas ${isSelected ? 'fa-check-circle' : isVirtual ? 'fa-ghost' : 'fa-microphone'} text-[10px] shrink-0`}></i>
                              <span className="truncate">{isVirtual ? `${label} (virtuell)` : label}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <p className="text-[9px] text-gray-400 dark:text-gray-500 text-center">
                        <i className="fas fa-info-circle mr-1"></i>Virtuelle Geräte liefern kein echtes Audio
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              title={isDarkMode ? "Licht an" : "Licht aus"}
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.4)]' : 'bg-gray-100 text-gray-600'}`}
            >
              <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>
            <Link
              to="/settings"
              title="Einstellungen & Sprachkonfiguration"
              className="p-2 text-yellow-500 hover:text-yellow-300 transition-colors"
            >
              <i className="fas fa-cog text-lg"></i>
            </Link>
            <Link
              to="/help"
              title="Hilfe & Anleitung"
              className="p-2 text-yellow-500 hover:text-yellow-300 transition-colors"
            >
              <i className="fas fa-circle-question text-lg"></i>
            </Link>
            <Link
              to="/logs"
              title="System Terminal (Aktivitäts-Log)"
              className="p-2 text-yellow-500 hover:text-yellow-300 transition-colors"
            >
              <i className="fas fa-microchip text-lg"></i>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 relative z-10">
          <Routes>
            <Route path="/" element={<HomeMenu />} />
            <Route path="/text-hub" element={<TextHub />} />
            <Route path="/train" element={<TrainerSession mode={AppMode.TRAINER} onSave={saveSession} addLog={addLog} />} />
            <Route path="/brainstorm" element={<TrainerSession mode={AppMode.BRAINSTORM} onSave={saveSession} addLog={addLog} />} />
            <Route path="/diary" element={<DiaryView onSave={saveSession} addLog={addLog} />} />
            <Route path="/templates" element={<TemplatesView onSave={saveSession} addLog={addLog} />} />
            <Route path="/dictation" element={<DictationView onSave={saveSession} addLog={addLog} />} />
            <Route path="/challenge" element={<ChallengeView onSave={saveSession} addLog={addLog} sessions={sessions} />} />
            <Route path="/history" element={<HistoryView sessions={sessions} addLog={addLog} />} />
            <Route path="/logs" element={<LogView logs={logs} />} />
            <Route path="/text-optimize" element={<TextOptimizer addLog={addLog} onSave={saveSession} />} />
            <Route path="/author" element={<AuthorView addLog={addLog} onSave={saveSession} />} />
            <Route path="/political-speech" element={<PoliticalSpeechView addLog={addLog} onSave={saveSession} />} />
            <Route path="/app-dev" element={<AppDevelopmentView onSave={saveSession} addLog={addLog} />} />
            <Route path="/dev-log" element={<DevLogView onSave={saveSession} addLog={addLog} />} />
            <Route path="/social-media" element={<SocialMediaView addLog={addLog} onSave={saveSession} />} />
            <Route path="/business-pitch" element={<BusinessPitchView addLog={addLog} onSave={saveSession} />} />
            <Route path="/phone-simulation" element={<PhoneSimulationView addLog={addLog} onSave={saveSession} />} />
            <Route path="/email-studio" element={<EmailStudioView onSave={saveSession} addLog={addLog} />} />
            <Route path="/about-me" element={<AboutMeView onSave={saveSession} addLog={addLog} sessions={sessions} />} />
            <Route path="/youtube" element={<YouTubeView onSave={saveSession} addLog={addLog} />} />
            <Route path="/planning" element={<PlanningChecklistView onSave={saveSession} addLog={addLog} />} />
            <Route path="/tasks" element={<TasksView />} />
            <Route path="/help" element={<HelpView />} />
            <Route path="/impressum" element={<LegalView focus="impressum" />} />
            <Route path="/datenschutz" element={<LegalView focus="datenschutz" />} />
            <Route path="/settings" element={<SettingsView addLog={addLog} />} />
            <Route path="/analytics" element={<AnalyticsView sessions={sessions} />} />
            <Route path="/einsprechen" element={<VoiceInputView onSave={saveSession} addLog={addLog} />} />
            <Route path="/skill-training" element={<SkillTrainingView />} />
          </Routes>
        </main>

        <GlobalDictationOverlay />
        <EcoModeController />
        <TranslatorToggle />
        <ShortcutsHelp />

        <nav className="glass fixed bottom-0 left-0 right-0 h-16 border-t border-gray-100 dark:border-gray-800 flex items-center justify-around safe-bottom z-50">
          <NavLink to="/" icon="fa-house" label="Start" />
          <NavLink to="/einsprechen" icon="fa-microphone-lines" label="Diktat" />
          <NavLink to="/text-hub" icon="fa-pen-nib" label="Studio" />
          <NavLink to="/tasks" icon="fa-list-check" label="Aufgaben" />
          <NavLink to="/challenge" icon="fa-gamepad" label="Spiel" />
          <NavLink to="/settings" icon="fa-cog" label="Settings" />
        </nav>

        {isGlobalDictating && (
          <div className="fixed bottom-20 left-4 right-4 z-[60] animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-6 rounded-[2.5rem] border border-blue-100 dark:border-blue-900 shadow-2xl flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shrink-0 animate-pulse">
                <i className="fas fa-microphone"></i>
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Live Diktat</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 italic line-clamp-2 leading-tight">
                  {globalTranscript || "Höre zu..."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};

const NavLink: React.FC<{ to: string, icon: string, label: string }> = ({ to, icon, label }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === to;
  const labelText = to === '/challenge' ? 'Verhör' : label;

  return (
    <button 
      onClick={() => navigate(to)}
      className={`flex flex-col items-center justify-center w-full h-full transition-all ${isActive ? 'text-blue-600 scale-110' : 'text-gray-400 dark:text-gray-500'}`}
    >
      <i className={`fas ${to === '/challenge' ? 'fa-handcuffs' : icon} text-lg mb-1`}></i>
      <span className="text-[9px] font-black uppercase tracking-widest">{labelText}</span>
    </button>
  );
};

const HomeMenu: React.FC = () => {
  const navigate = useNavigate();
  const [stats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('rhetorix_stats');
    return saved ? JSON.parse(saved) : { xp: 0, level: 1 };
  });

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in-95 duration-700 px-4 pb-24">
      <div className="text-center space-y-3 mb-2">
        <div className="w-20 h-20 text-blue-600 flex items-center justify-center mx-auto animate-float">
          <i className="fas fa-robot text-3xl"></i>
        </div>
        <h1 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-white italic uppercase">Rhetorix <span className="text-blue-600">Pro</span></h1>
        <p className="text-blue-600 font-bold text-[10px] uppercase tracking-[0.3em]">Tobias Ganster</p>
      </div>

      <div 
        onClick={() => navigate('/skill-training')} 
        className="w-full max-w-2xl bg-gradient-to-r from-emerald-500 via-teal-600 to-indigo-600 p-6 rounded-[2.5rem] flex flex-col sm:flex-row items-center justify-between gap-5 cursor-pointer hover:scale-[1.02] transition-all group shadow-xl text-white"
      >
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md text-white rounded-[1.25rem] flex items-center justify-center shrink-0 shadow-lg group-hover:rotate-12 transition-transform">
            <i className="fas fa-graduation-cap text-2xl"></i>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-white/35 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest">KATEGORIE</span>
              <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest">Skill Training</p>
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tight">Rhetorik &amp; Stimme</h3>
            <p className="text-xs text-emerald-50 font-medium">Verhör, Telefon-Simulation &amp; Politische Reden.</p>
          </div>
        </div>
        
        {/* Dynamic mini-tracker indicator within the card */}
        <div className="flex items-center gap-3 bg-white/10 px-4 py-2.5 rounded-2xl border border-white/10 shrink-0">
          <div className="text-right">
            <p className="text-[9px] font-extrabold uppercase text-emerald-100 tracking-wider">Level {stats.level}</p>
            <p className="text-[11px] font-black italic tracking-tighter">{stats.xp} XP</p>
          </div>
          <i className="fas fa-chevron-right text-white/50 group-hover:translate-x-1 transition-transform"></i>
        </div>
      </div>

      {/* EINSPRECHEN — Hauptfeature */}
      <div
        onClick={() => navigate('/einsprechen')}
        className="w-full max-w-2xl bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 p-6 rounded-[2.5rem] flex flex-col sm:flex-row items-center justify-between gap-5 cursor-pointer hover:scale-[1.02] transition-all group shadow-xl text-black"
      >
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-black/20 backdrop-filter backdrop-blur-md text-black rounded-[1.25rem] flex items-center justify-center shrink-0 shadow-lg group-hover:rotate-12 transition-transform">
            <i className="fas fa-microphone-lines text-2xl"></i>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-black/25 text-black text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest">DIKTAT</span>
              <p className="text-[10px] font-bold text-black/70 uppercase tracking-widest">Sprache → Text</p>
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tight">Einsprechen</h3>
            <p className="text-xs text-black/70 font-medium">Text per Stimme diktieren — sofort transkribiert.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-black/10 px-4 py-2.5 rounded-2xl border border-black/10 shrink-0">
          <div className="text-right">
            <p className="text-[9px] font-extrabold uppercase text-black/70 tracking-wider">Ctrl+Space</p>
            <p className="text-[11px] font-black italic tracking-tighter">Global</p>
          </div>
          <i className="fas fa-chevron-right text-black/50 group-hover:translate-x-1 transition-transform"></i>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        <button
          onClick={() => navigate('/youtube')}
          className="group relative overflow-hidden bg-white dark:bg-gray-900 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:border-red-200 dark:hover:border-red-900 transition-all active:scale-95 text-left flex flex-col gap-6"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 dark:bg-red-950/30 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-3xl flex items-center justify-center text-red-600 shadow-inner relative z-10">
            <i className="fab fa-youtube text-3xl"></i>
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-red-600 uppercase tracking-tight italic">YouTube Studio</h2>
            <p className="text-red-400 dark:text-red-500/70 text-sm font-medium mt-2">Ganze Video-Skripte planen, anpassen & SEO optimieren.</p>
          </div>
        </button>

        <button 
          onClick={() => navigate('/email-studio')}
          className="group relative overflow-hidden bg-white dark:bg-gray-900 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:border-blue-200 dark:hover:border-blue-900 transition-all active:scale-95 text-left flex flex-col gap-6"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-950/30 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center text-blue-600 shadow-inner relative z-10">
            <i className="fas fa-envelope text-3xl"></i>
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-blue-600 uppercase tracking-tight italic">E-Mail an...</h2>
            <p className="text-blue-400 dark:text-blue-500/70 text-sm font-medium mt-2">Diktieren, optimieren & via Gmail versenden.</p>
          </div>
        </button>

        <button 
          onClick={() => navigate('/text-optimize')}
          className="group relative overflow-hidden bg-white dark:bg-gray-900 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:border-amber-200 dark:hover:border-amber-900 transition-all active:scale-95 text-left flex flex-col gap-6"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 dark:bg-amber-950/30 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-3xl flex items-center justify-center text-amber-600 shadow-inner relative z-10">
            <i className="fas fa-wand-magic-sparkles text-3xl"></i>
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-amber-600 uppercase tracking-tight italic">Text Optimierer</h2>
            <p className="text-amber-400 dark:text-amber-500/70 text-sm font-medium mt-2">Verhandlungen (z.B. Sixt), Briefe & Texte veredeln.</p>
          </div>
        </button>

        <button 
          onClick={() => { localStorage.setItem('rhetorix_author_mode_pref', 'true'); navigate('/challenge'); }}
          className="group relative overflow-hidden bg-white dark:bg-gray-900 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:border-red-200 dark:hover:border-red-900 transition-all active:scale-95 text-left flex flex-col gap-6"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 dark:bg-red-950/30 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-3xl flex items-center justify-center text-red-600 shadow-inner relative z-10">
            <i className="fas fa-book-sparkles text-3xl"></i>
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-red-600 uppercase tracking-tight italic">Paradoxon</h2>
            <p className="text-red-400 dark:text-red-500/70 text-sm font-medium mt-2">Das Dritte Testament: Diktieren, Optimieren & Kapitel ordnen.</p>
          </div>
        </button>

        <button 
          onClick={() => navigate('/about-me')}
          className="group relative overflow-hidden bg-white dark:bg-gray-900 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:border-rose-200 dark:hover:border-rose-900 transition-all active:scale-95 text-left flex flex-col gap-6"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 dark:bg-rose-950/30 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-3xl flex items-center justify-center text-rose-600 shadow-inner relative z-10">
            <i className="fas fa-user-astronaut text-3xl"></i>
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-rose-600 uppercase tracking-tight italic">Über Mich</h2>
            <p className="text-rose-400 dark:text-rose-500/70 text-sm font-medium mt-2">Selbstreflexion & Charakter-Analyse.</p>
          </div>
        </button>

        <button 
          onClick={() => navigate('/planning')}
          className="group relative overflow-hidden bg-white dark:bg-gray-900 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:border-amber-200 dark:hover:border-amber-900 transition-all active:scale-95 text-left flex flex-col gap-6"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 dark:bg-amber-950/30 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-3xl flex items-center justify-center text-amber-600 shadow-inner relative z-10">
            <i className="fas fa-list-check text-3xl"></i>
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-amber-600 uppercase tracking-tight italic">Planung &amp; Checkliste</h2>
            <p className="text-amber-400 dark:text-amber-500/70 text-sm font-medium mt-2">Flugzeug-Sicherheitschecklisten generieren &amp; im Cockpit vorlesen.</p>
          </div>
        </button>

        <button 
          onClick={() => navigate('/dev-log')}
          className="group relative overflow-hidden bg-white dark:bg-gray-900 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:border-indigo-200 dark:hover:border-indigo-900 transition-all active:scale-95 text-left flex flex-col gap-6"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-950/30 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl flex items-center justify-center text-indigo-600 shadow-inner relative z-10">
            <i className="fas fa-laptop-code text-3xl"></i>
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-indigo-600 uppercase tracking-tight italic">Entwicklungs-Doku</h2>
            <p className="text-indigo-400 dark:text-indigo-500/70 text-sm font-medium mt-2">Diktieren, sauber/ordentlich korrigieren &amp; im Archiv speichern.</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/settings')}
          className="group relative overflow-hidden bg-white dark:bg-gray-900 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:border-yellow-200 dark:hover:border-yellow-900 transition-all active:scale-95 text-left flex flex-col gap-6"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-50 dark:bg-yellow-950/30 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
          <div className="w-16 h-16 bg-yellow-50 dark:bg-yellow-900/20 rounded-3xl flex items-center justify-center text-yellow-500 shadow-inner relative z-10">
            <i className="fas fa-cog text-3xl"></i>
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-yellow-500 uppercase tracking-tight italic">Einstellungen</h2>
            <p className="text-yellow-400 dark:text-yellow-500/70 text-sm font-medium mt-2">Sprache, Mikrofon, API-Keys &amp; App konfigurieren.</p>
          </div>
        </button>
      </div>

      <div className="pt-12 text-center opacity-60">
         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-relaxed">
           Diese App wurde programmiert von <br/>
           <span className="text-blue-600">Tobias Ganster</span> • <a href="https://tobiasganster.com" target="_blank" rel="noopener noreferrer" className="hover:underline">tobiasganster.com</a>
         </p>
      </div>
    </div>
  );
};

const TextHub: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700">
      <div className="flex items-center justify-between px-2">
        <button onClick={() => navigate('/')} className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-400 hover:text-blue-600 shadow-sm transition-all">
          <i className="fas fa-chevron-left"></i>
        </button>
        <h2 className="text-xl font-black text-gray-900 dark:text-white italic uppercase tracking-tighter">Text Studio</h2>
        <div className="w-12 h-12"></div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <button 
          onClick={() => navigate('/youtube')}
          className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:border-red-100 dark:hover:border-red-900 transition-all text-left flex items-center gap-6 group"
        >
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-3xl flex items-center justify-center text-red-600 shadow-inner group-hover:scale-110 transition-transform">
            <i className="fab fa-youtube text-2xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight italic">YouTube Studio</h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs font-medium mt-1">Strukturiere ganze Drehbücher (Hooks, Hauptteil & CTA).</p>
          </div>
          <i className="fas fa-chevron-right text-gray-200 dark:text-gray-800 group-hover:text-red-400 transition-colors"></i>
        </button>

        <button 
          onClick={() => navigate('/political-speech')}
          className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:border-orange-100 dark:hover:border-orange-900 transition-all text-left flex items-center gap-6 group"
        >
          <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 rounded-3xl flex items-center justify-center text-orange-600 shadow-inner group-hover:scale-110 transition-transform">
            <i className="fas fa-microphone-lines text-2xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight italic">Politische Rede</h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs font-medium mt-1">Diktieren, optimieren & Performance-Analyse.</p>
          </div>
          <i className="fas fa-chevron-right text-gray-200 dark:text-gray-800 group-hover:text-orange-400 transition-colors"></i>
        </button>

        <button 
          onClick={() => navigate('/author')}
          className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:border-blue-100 dark:hover:border-blue-900 transition-all text-left flex items-center gap-6 group"
        >
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center text-blue-600 shadow-inner group-hover:scale-110 transition-transform">
            <i className="fas fa-book-open text-2xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight italic">KI Autor Studio</h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs font-medium mt-1">Schreibe ganze Bücher mit Google Drive Anbindung.</p>
          </div>
          <i className="fas fa-chevron-right text-gray-200 dark:text-gray-800 group-hover:text-blue-400 transition-colors"></i>
        </button>

        <button 
          onClick={() => navigate('/text-optimize')}
          className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:border-purple-100 dark:hover:border-purple-900 transition-all text-left flex items-center gap-6 group"
        >
          <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/20 rounded-3xl flex items-center justify-center text-purple-600 shadow-inner group-hover:scale-110 transition-transform">
            <i className="fas fa-wand-magic-sparkles text-2xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight italic">Text Veredelung</h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs font-medium mt-1">Optimiere einzelne Texte für maximale Wirkung.</p>
          </div>
          <i className="fas fa-chevron-right text-gray-200 dark:text-gray-800 group-hover:text-purple-400 transition-colors"></i>
        </button>

        <button 
          onClick={() => navigate('/email-studio')}
          className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:border-blue-100 dark:hover:border-blue-900 transition-all text-left flex items-center gap-6 group"
        >
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center text-blue-600 shadow-inner group-hover:scale-110 transition-transform">
            <i className="fas fa-envelope text-2xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight italic">E-Mail Studio</h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs font-medium mt-1">Diktieren, optimieren & via Gmail versenden.</p>
          </div>
          <i className="fas fa-chevron-right text-gray-200 dark:text-gray-800 group-hover:text-blue-400 transition-colors"></i>
        </button>

        <button 
          onClick={() => navigate('/about-me')}
          className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:border-rose-100 dark:hover:border-rose-900 transition-all text-left flex items-center gap-6 group"
        >
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-3xl flex items-center justify-center text-rose-600 shadow-inner group-hover:scale-110 transition-transform">
            <i className="fas fa-user-astronaut text-2xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight italic">Über Mich</h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs font-medium mt-1">Selbstreflexion & Charakter-Analyse.</p>
          </div>
          <i className="fas fa-chevron-right text-gray-200 dark:text-gray-800 group-hover:text-rose-400 transition-colors"></i>
        </button>

        <button 
          onClick={() => navigate('/planning')}
          className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:border-amber-100 dark:hover:border-amber-900 transition-all text-left flex items-center gap-6 group"
        >
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-3xl flex items-center justify-center text-amber-600 shadow-inner group-hover:scale-110 transition-transform">
            <i className="fas fa-list-check text-2xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight italic">Planung &amp; Checkliste</h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs font-medium mt-1">Automatische Ablauf-Aufgliederung und Co-Pilot Vorlesemethode.</p>
          </div>
          <i className="fas fa-chevron-right text-gray-200 dark:text-gray-800 group-hover:text-amber-400 transition-colors"></i>
        </button>

        <button 
          onClick={() => navigate('/help')}
          className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-lg hover:shadow-2xl transition-all text-left flex items-center gap-6 group"
        >
          <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition-transform">
            <i className="fas fa-book text-2xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black text-white uppercase tracking-tight italic">App-Anleitung</h3>
            <p className="text-indigo-100 text-xs font-medium mt-1">Alle Funktionen & Tipps im Überblick.</p>
          </div>
          <i className="fas fa-chevron-right text-white/50 group-hover:text-white transition-colors"></i>
        </button>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MenuCard icon="fa-code" title="App Entwicklung" desc="Brainstorming & Skizze" color="bg-white dark:bg-gray-900 text-indigo-600" onClick={() => navigate('/app-dev')} />
          <MenuCard icon="fa-laptop-code" title="Entwicklungs-Doku" desc="Prozess-Archiv" color="bg-white dark:bg-gray-900 text-blue-600" onClick={() => navigate('/dev-log')} />
          <MenuCard icon="fa-book" title="Tagebuch" desc="Gedankenfluss" color="bg-white dark:bg-gray-900 text-rose-600" onClick={() => navigate('/diary')} />
          <MenuCard icon="fa-microphone" title="Einsprechen (Shortcut)" desc="Tastatur-Diktat" color="bg-white dark:bg-gray-900 text-emerald-600" onClick={() => navigate('/einsprechen')} />
        </div>
      </div>
    </div>
  );
};

const MenuCard: React.FC<{ icon: string, title: string, desc: string, color: string, onClick: () => void }> = ({ icon, title, desc, color, onClick }) => (
  <button onClick={onClick} className={`${color} p-5 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm text-left active:scale-95 transition-all flex flex-col items-start gap-3`}>
    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner bg-gray-50 dark:bg-gray-800`}><i className={`fas ${icon} text-lg`}></i></div>
    <div>
      <h3 className="font-black text-gray-800 dark:text-gray-200 text-[11px] uppercase tracking-wider leading-tight">{title}</h3>
      <p className="text-[9px] text-gray-400 dark:text-gray-500 font-medium mt-0.5">{desc}</p>
    </div>
  </button>
);

export default App;
