
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { getGeminiAI } from '../utils/gemini-client';
import { speakElevenLabs, stopSpeaking } from '../utils/elevenLabsTTS';
import { SessionResult } from '../types';

interface Scenario {
  id: string;
  title: string;
  description: string;
  assistantPrompt: string;
  icon: string;
  color: string;
}

const scenarios: Scenario[] = [
  {
    id: 'doctor',
    title: 'Arztbesuch',
    description: 'Vereinbare einen dringenden Termin oder erkläre deine Symptome.',
    assistantPrompt: 'Du bist ein freundlicher, aber vielbeschäftigter Sprechstundenhilfe in einer Hausarztpraxis. Der User ruft an, um einen Termin zu vereinbaren oder medizinischen Rat zu suchen. Reagiere professionell.',
    icon: 'fa-user-md',
    color: 'text-emerald-600'
  },
  {
    id: 'job-interview',
    title: 'Vorstellungsgespräch',
    description: 'Ein Recruiter ruft dich überraschend für ein erstes Telefoninterview an.',
    assistantPrompt: 'Du bist ein erfahrener IT-Recruiter. Du rufst den User an, um über seine Bewerbung zu sprechen. Sei höflich, frag nach Motivation und Erfahrung, aber bleib kritisch.',
    icon: 'fa-briefcase',
    color: 'text-indigo-600'
  },
  {
    id: 'complaint',
    title: 'Reklamation',
    description: 'Rufe beim Kundenservice an, um dich über ein defektes Produkt zu beschweren.',
    assistantPrompt: 'Du bist ein Mitarbeiter im Kundenservice eines Elektronikmarktes. Der User ist unzufrieden. Versuche den Fall zu klären, aber folge strengen Firmenrichtlinien (keine sofortige Geldrückgabe ohne Prüfung).',
    icon: 'fa-face-frown',
    color: 'text-rose-600'
  },
  {
    id: 'reservation',
    title: 'Restaurant Reservierung',
    description: 'Reserviere einen Tisch für eine große Gruppe zu einer Stoßzeit.',
    assistantPrompt: 'Du bist der gestresste Kellner eines Nobel-Italieners am Freitagabend. Eigentlich ist alles voll, aber wenn der User charmant ist, findest du vielleicht noch einen Platz.',
    icon: 'fa-utensils',
    color: 'text-orange-600'
  }
];

interface Props {
  addLog: (message: string, level: 'info' | 'success' | 'error') => void;
  onSave: (session: SessionResult) => void;
}

enum CallState {
  IDLE,
  CREATE_CUSTOM,
  DIALING,
  RINGING,
  ACTIVE,
  ENDED,
  REVIEW
}

const PhoneSimulationView: React.FC<Props> = ({ addLog, onSave }) => {
  const navigate = useNavigate();
  const [state, setState] = useState<CallState>(CallState.IDLE);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  
  // Custom Scenario States
  const [customTitle, setCustomTitle] = useState('');
  const [customGoal, setCustomGoal] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Restore custom setup on mount
  useEffect(() => {
    const savedTitle = localStorage.getItem('rhetorix_autosave_phone_title');
    if (savedTitle) setCustomTitle(savedTitle);

    const savedGoal = localStorage.getItem('rhetorix_autosave_phone_goal');
    if (savedGoal) setCustomGoal(savedGoal);
  }, []);

  // Save changes automatically
  useEffect(() => {
    if (customTitle) {
      localStorage.setItem('rhetorix_autosave_phone_title', customTitle);
      setIsAutoSaving(true);
      const timer = setTimeout(() => setIsAutoSaving(false), 800);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('rhetorix_autosave_phone_title');
    }
  }, [customTitle]);

  useEffect(() => {
    if (customGoal) {
      localStorage.setItem('rhetorix_autosave_phone_goal', customGoal);
      setIsAutoSaving(true);
      const timer = setTimeout(() => setIsAutoSaving(false), 800);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('rhetorix_autosave_phone_goal');
    }
  }, [customGoal]);

  const [transcript, setTranscript] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const audioQueue = useRef<string[]>([]);
  const isPlayingAudio = useRef(false);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const processAudioQueue = () => {
    if (audioQueue.current.length > 0 && !isPlayingAudio.current) {
      const next = audioQueue.current.shift();
      if (next) {
        isPlayingAudio.current = true;
        setIsAiSpeaking(true);
        speakElevenLabs(next).then(() => {
          isPlayingAudio.current = false;
          setIsAiSpeaking(false);
          processAudioQueue();
        }).catch(() => {
          isPlayingAudio.current = false;
          setIsAiSpeaking(false);
          processAudioQueue();
        });
      }
    } else if (audioQueue.current.length === 0 && !isPlayingAudio.current) {
      if (state === CallState.ACTIVE) startListening();
    }
  };

  useEffect(() => {
    let interval: any;
    if (state === CallState.ACTIVE) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [state]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playRingtone = () => {
    const ctx = getAudioContext();
    
    const playTone = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.05); // Lo-fi ringtone
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
      oscillatorRef.current = osc;
    };

    const interval = setInterval(playTone, 3000);
    playTone();
    return interval;
  };

  const startCall = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setState(CallState.DIALING);
    addLog(`Anruf bei "${scenario.title}" wird aufgebaut...`, 'info');
    
    setTimeout(() => {
      setState(CallState.RINGING);
      const ringInterval = playRingtone();
      
      setTimeout(() => {
        clearInterval(ringInterval);
        setState(CallState.ACTIVE);
        addLog("Gespräch angenommen.", "success");
        const greeting = scenario.id === 'custom' 
          ? "Hallo? Hier ist die Gegenstelle, wie kann ich Ihnen bei Ihrem Anliegen helfen?"
          : "Hallo? Sprechstundenhilfe Praxis Dr. Müller hier, wie kann ich Ihnen helfen?";
        aiResponse(greeting, true);
      }, 4500);
    }, 1500);
  };

  const startCustomCall = () => {
    if (!customTitle || !customGoal) {
      addLog("Bitte fülle alle Felder aus.", "error");
      return;
    }
    const customScenario: Scenario = {
      id: 'custom',
      title: customTitle,
      description: 'Selbst erstellte Situation',
      assistantPrompt: `Du bist die Gegenstelle in folgendem Anruf-Szenario: ${customTitle}. Das Ziel des Gespräches ist: ${customGoal}. Verhalte dich authentisch.`,
      icon: 'fa-user-pen',
      color: 'text-indigo-600'
    };
    startCall(customScenario);
  };

  const aiResponse = async (initialText?: string, isGreeting = false) => {
    if (isGreeting) {
      setTranscript([{ role: 'ai', text: initialText || "" }]);
      speak(initialText || "");
      return;
    }

    setIsProcessing(true);
    try {
      const ai = await getGeminiAI();

      const prompt = `
        Szenario: ${selectedScenario?.title}
        Kontext: ${selectedScenario?.assistantPrompt}
        
        Bisheriger Gesprächsverlauf:
        ${transcript.map(t => `${t.role === 'user' ? 'Anrufer' : 'Gegenstelle'}: ${t.text}`).join('\n')}
        
        Reagiere jetzt als die Gegenstelle am Telefon. 
        WICHTIG: Bleib kurz angebunden, wie in einem echten Telefonat. Keine langen Erklärungen. 
        Wenn das Gespräch beendet scheint, verabschiede dich kurz.
      `;

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt
      });
      const response = result.text || "";
      setTranscript(prev => [...prev, { role: 'ai', text: response }]);
      speak(response);
    } catch (e) {
      console.error(e);
      addLog("KI Fehler beim Anruf", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const speak = async (text: string) => {
    stopSpeaking();
    audioQueue.current.push(text);
    processAudioQueue();
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) return;
    const Recognition = (window as any).webkitSpeechRecognition;
    recognitionRef.current = new Recognition();
    recognitionRef.current.lang = 'de-DE';
    recognitionRef.current.continuous = false;
    
    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);
    
    recognitionRef.current.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(prev => [...prev, { role: 'user', text }]);
      aiResponse();
    };
    
    recognitionRef.current.start();
  };

  const endCall = () => {
    setState(CallState.ENDED);
    if (recognitionRef.current) recognitionRef.current.stop();
    stopSpeaking();
    addLog("Anruf beendet.", "info");
    analyzeCall();
  };

  const analyzeCall = async () => {
    setIsProcessing(true);
    try {
      const ai = await getGeminiAI();

      const prompt = `
        Analysiere dieses Telefonat akribisch und kritisch.
        Szenario: ${selectedScenario?.title}
        Verlauf:
        ${transcript.map(t => `${t.role}: ${t.text}`).join('\n')}
        
        Bewerte:
        1. Höflichkeit & Etikette
        2. Zielerreichung (Wurde das Anliegen gelöst?)
        3. Rhetorik & Deutlichkeit
        
        Gib konkrete Tipps zur Verbesserung. Antworte in Markdown.
      `;

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt
      });
      const analysisText = result.text || "";
      setAnalysis(analysisText);
      setState(CallState.REVIEW);
      
      onSave({
        id: String(Date.now()),
        timestamp: Date.now(),
        mode: (selectedScenario?.id === 'custom' ? 'PHONE_CUSTOM' : 'PHONE_SIM') as any,
        title: `Telefon-Training: ${selectedScenario?.title}`,
        transcription: transcript.map(t => `${t.role}: ${t.text}`).join('\n'),
        analysis: {
          summary: analysisText,
          rhetoricScore: 0,
          complexity: 'Mittel',
          strengths: [],
          improvements: [],
          stylisticDevices: []
        }
      });
    } catch (e) {
      addLog("Analyse fehlgeschlagen", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-24">
      <AnimatePresence mode="wait">
        {state === CallState.IDLE && (
          <motion.div
            key="selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => navigate('/')} className="w-10 h-10 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-all">
                <i className="fas fa-chevron-left"></i>
              </button>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">Telefon-Training</h2>
            </div>

            <div className="grid gap-4">
              <button
                onClick={() => setState(CallState.CREATE_CUSTOM)}
                className="bg-indigo-600 p-6 rounded-[2.5rem] shadow-lg hover:shadow-xl transition-all text-left flex items-center gap-6 group"
              >
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition-transform">
                  <i className="fas fa-plus text-xl"></i>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white uppercase tracking-tight italic">Eigene Situation</h3>
                  <p className="text-indigo-100 text-xs mt-1">Erstelle einen individuellen Übungsanruf.</p>
                </div>
                <i className="fas fa-magic text-white/50 group-hover:text-white transition-colors"></i>
              </button>

              <div className="h-4"></div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-6 italic">Vorlagen</p>

              {scenarios.map(s => (
                <button
                  key={s.id}
                  onClick={() => startCall(s)}
                  className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:border-blue-100 dark:hover:border-blue-900 transition-all text-left flex items-center gap-6 group"
                >
                  <div className={`w-14 h-14 bg-gray-50 dark:bg-gray-800/50 rounded-2xl flex items-center justify-center ${s.color} shadow-inner group-hover:scale-110 transition-transform`}>
                    <i className={`fas ${s.icon} text-xl`}></i>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">{s.title}</h3>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">{s.description}</p>
                  </div>
                  <i className="fas fa-phone text-gray-200 dark:text-gray-800 group-hover:text-blue-400 transition-colors"></i>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {state === CallState.CREATE_CUSTOM && (
          <motion.div
            key="custom-creator"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-2xl"
          >
            <div className="flex items-center gap-4">
              <button onClick={() => setState(CallState.IDLE)} className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-all shadow-inner">
                <i className="fas fa-chevron-left"></i>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase italic tracking-tight">Situation erstellen</h3>
                  {isAutoSaving && (
                    <span className="text-[9px] text-emerald-500 font-bold tracking-widest flex items-center gap-1 normal-case font-mono animate-pulse">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
                      gespeichert
                    </span>
                  )}
                </div>
                <p className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest">Definiere deinen Anruf</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-4 italic">Gegenstelle (Wer geht ran?)</label>
                <input 
                  type="text"
                  placeholder="z.B. Vermieter, Finanzamt, Behörde..."
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-[1.5rem] p-5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 shadow-inner"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-4 italic">Szenario / Ziel des Anrufs</label>
                <textarea 
                  placeholder="Beschreibe kurz die Situation und was du erreichen willst..."
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  rows={4}
                  className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-[1.5rem] p-5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 shadow-inner resize-none"
                />
              </div>

              <button
                onClick={startCustomCall}
                className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 active:scale-95"
              >
                <i className="fas fa-phone-flip animate-bounce"></i>
                Anruf starten
              </button>
            </div>
          </motion.div>
        )}

        {(state === CallState.DIALING || state === CallState.RINGING || state === CallState.ACTIVE) && (
          <motion.div
            key="calling"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="fixed inset-0 z-[100] bg-gray-900/95 backdrop-blur-2xl flex flex-col items-center justify-between py-20 px-6 text-white"
          >
            <div className="text-center space-y-4">
              <div className="relative">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-blue-500 rounded-full blur-3xl opacity-30"
                ></motion.div>
                <div className="w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center mx-auto ring-4 ring-white/10 relative z-10 overflow-hidden shadow-2xl">
                  {isListening ? (
                    <motion.div 
                      animate={{ scale: [1, 1.5, 1] }} 
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-full h-full bg-emerald-500/20 absolute"
                    ></motion.div>
                  ) : isProcessing ? (
                    <motion.div 
                      animate={{ rotate: 360 }} 
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-full h-full border-4 border-blue-500/20 border-t-blue-500 absolute rounded-full"
                    ></motion.div>
                  ) : null}
                  <i className={`fas ${selectedScenario?.icon || 'fa-phone'} text-5xl text-blue-400 relative z-20`}></i>
                </div>
              </div>
              
              <div className="pt-4">
                <h3 className="text-3xl font-black uppercase tracking-tighter italic text-white drop-shadow-lg">{selectedScenario?.title}</h3>
                <p className="text-blue-400 font-mono text-sm tracking-widest uppercase mt-2 font-bold">
                  {state === CallState.DIALING ? 'Wähle...' : state === CallState.RINGING ? 'Es läutet...' : formatTime(timer)}
                </p>
                <div className="flex gap-1 justify-center mt-4">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={isAiSpeaking ? { height: [4, 16, 4] } : { height: 4 }}
                      transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                      className="w-1 bg-blue-400 rounded-full"
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="w-full max-w-sm bg-black/40 rounded-[2.5rem] p-6 border border-white/5 h-64 overflow-y-auto flex flex-col gap-4 shadow-inner backdrop-blur-xl">
              {transcript.map((t, i) => (
                <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm font-medium ${t.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-200'}`}>
                    {t.text}
                  </div>
                </div>
              ))}
              {isProcessing && <div className="text-xs text-blue-400 animate-pulse">Gegenstelle schreibt...</div>}
              {isListening && <div className="text-xs text-emerald-400 animate-pulse font-bold uppercase tracking-widest text-center mt-2">Du bist dran - sprich jetzt</div>}
            </div>

            <div className="flex flex-col items-center gap-8">
              <button
                onClick={endCall}
                className="w-20 h-20 bg-rose-600 rounded-full flex items-center justify-center shadow-2xl hover:bg-rose-700 transition-all group active:scale-95"
              >
                <i className="fas fa-phone-slash text-3xl group-hover:rotate-12 transition-transform"></i>
              </button>
              <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em]">Hardened Security Call</p>
            </div>
          </motion.div>
        )}

        {state === CallState.REVIEW && (
          <motion.div
            key="review"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-gray-900 rounded-[3rem] p-8 border border-gray-100 dark:border-gray-800 shadow-2xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
                  <i className="fas fa-file-invoice text-2xl"></i>
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase italic tracking-tight">Call Analyse</h3>
                  <p className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest">Akribisch & Kritisch bewertet</p>
                </div>
              </div>

              <div className="prose dark:prose-invert max-w-none text-sm text-gray-600 dark:text-gray-400 font-medium">
                <div dangerouslySetInnerHTML={{ __html: analysis?.replace(/\n/g, '<br/>') || '' }} />
              </div>

              <button
                onClick={() => setState(CallState.IDLE)}
                className="w-full mt-12 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 hover:text-white transition-all shadow-sm"
              >
                Neues Training starten
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PhoneSimulationView;
