
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { AppMode, SessionResult, AnalysisData } from '../types';
import { createBlob } from '../utils/audio-helpers';
import { getUserMicrophoneStream } from '../utils/speechHelper';
import { speakElevenLabs, stopSpeaking } from '../utils/elevenLabsTTS';
import { ExplanationModal } from './AnalysisDetails';

const SKILLS = [
  { id: 'filler', name: 'Füllwörter reduzieren', icon: 'fa-ban', desc: 'Minimiere äh, quasi, halt.' },
  { id: 'metaphor', name: 'Metaphern nutzen', icon: 'fa-image', desc: 'Spreche in starken Bildern.' },
  { id: 'structure', name: 'Klare Struktur', icon: 'fa-list-ol', desc: 'Roter Faden & Überleitungen.' },
  { id: 'emotion', name: 'Emotionale Tiefe', icon: 'fa-heart', desc: 'Nutze Pathos und Modulation.' },
];

const FILLER_WORDS = ['äh', 'ähm', 'hm', 'halt', 'quasi', 'sozusagen', 'eigentlich', 'oder so', 'wirklich'];

interface TrainerSessionProps {
  mode: AppMode;
  onSave: (session: SessionResult) => void;
  addLog: (m: string, l?: any) => void;
}

type SessionState = 'SETUP' | 'RECORDING' | 'ANALYSIS';

const TrainerSession: React.FC<TrainerSessionProps> = ({ mode, onSave, addLog }) => {
  const [sessionState, setSessionState] = useState<SessionState>('SETUP');
  const [topic, setTopic] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [bioFeedbackEnabled, setBioFeedbackEnabled] = useState(false);
  
  const [isActive, setIsActive] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisData | null>(null);
  const [activeLexiconTerm, setActiveLexiconTerm] = useState<string | null>(null);
  const [previousAttempt, setPreviousAttempt] = useState<SessionResult | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const lastProcessedWordCount = useRef(0);
  const lastWordRef = useRef<string>('');

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [transcription]);

  // Zerlegt das Transkript in Blöcke von ca. 50 Wörtern für bessere Lesbarkeit
  const transcriptionBlocks = useMemo(() => {
    const words = transcription.split(/\s+/).filter(w => w.length > 0);
    const blocks: string[] = [];
    const blockSize = 50;
    
    for (let i = 0; i < words.length; i += blockSize) {
      blocks.push(words.slice(i, i + blockSize).join(' '));
    }
    return blocks;
  }, [transcription]);

  const playBiofeedbackSignal = (type: 'filler' | 'repetition') => {
    if (!bioFeedbackEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      
      if (type === 'filler') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      } else {
        osc.frequency.setValueAtTime(1320, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        setTimeout(() => {
           if (ctx.state === 'closed') return;
           const osc2 = ctx.createOscillator();
           const gain2 = ctx.createGain();
           osc2.type = 'sine';
           osc2.frequency.setValueAtTime(1320, ctx.currentTime);
           gain2.gain.setValueAtTime(0, ctx.currentTime);
           gain2.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.005);
           gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
           osc2.connect(gain2); gain2.connect(ctx.destination);
           osc2.start(); osc2.stop(ctx.currentTime + 0.06);
        }, 80);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
      setTimeout(() => { if (ctx.state !== 'closed') ctx.close(); }, 300);
    } catch (e) { console.error(e); }
  };

  const startRecording = async () => {
    if (!topic) {
        addLog("Bitte gib zuerst ein Thema ein!", "error");
        return;
    }
    try {
      setIsActive(true);
      setSessionState('RECORDING');
      setTranscription('');
      lastProcessedWordCount.current = 0;
      lastWordRef.current = '';
      
      const skillName = SKILLS.find(s => s.id === selectedSkill)?.name || 'Allgemein';
      addLog(`Training gestartet: "${topic}"`);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      streamRef.current = await getUserMicrophoneStream();

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.0-flash-exp',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `Du bist ein Echtzeit-Rhetorik-Protokollant. Transkribiere EXAKT was du hörst auf Deutsch. Behalte Füllwörter wie "äh", "ähm", "quasi" unbedingt im Text bei.`,
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            const source = audioContextRef.current!.createMediaStreamSource(streamRef.current!);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: (msg: LiveServerMessage) => {
            if (msg.serverContent?.inputTranscription) {
              const newText = msg.serverContent.inputTranscription.text;
              setTranscription(prev => {
                  const updated = prev + (prev ? " " : "") + newText;
                  if (bioFeedbackEnabled) {
                      const words = updated.toLowerCase().split(/\s+/);
                      const newWords = words.slice(lastProcessedWordCount.current);
                      newWords.forEach(w => {
                          const clean = w.replace(/[.,!?]/g, '');
                          if (!clean) return;
                          if (FILLER_WORDS.includes(clean)) playBiofeedbackSignal('filler');
                          else if (clean === lastWordRef.current && clean.length > 1) playBiofeedbackSignal('repetition');
                          lastWordRef.current = clean;
                      });
                      lastProcessedWordCount.current = words.length;
                  }
                  return updated;
              });
            }
          },
          onerror: () => stopRecording(),
          onclose: () => setIsActive(false)
        }
      });
    } catch (err) {
      setIsActive(false);
      setSessionState('SETUP');
    }
  };

  const stopRecording = () => {
    setIsActive(false);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') { audioContextRef.current.close(); audioContextRef.current = null; }
  };

  const startAnalysis = async () => {
    if (!transcription) return;
    setIsProcessing(true);
    addLog("KI-Mentor führt forensische Tiefenanalyse durch...");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const skillName = SKILLS.find(s => s.id === selectedSkill)?.name;
      
      let progressContext = "";
      if (previousAttempt) {
        progressContext = `VERGLEICH ERFORDERLICH: Dies ist ein zweiter Versuch zum Thema "${topic}". Der erste Versuch hatte einen Score von ${previousAttempt.analysis?.rhetoricScore}/100. Analysiere präzise, ob sich der Redner verbessert hat.`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash', // Pro Modell für maximale Tiefe
        contents: `Du bist ein Weltklasse-Rhetorik-Experte. Analysiere dieses Transkript mit maximaler wissenschaftlicher Tiefe. 
        Thema: "${topic}". Fokus: "${skillName || 'Allgemein'}".
        Transkript: "${transcription}"
        
        ${progressContext}

        Deine Analyse muss folgende Kriterien erfüllen:
        1. Forensische Untersuchung der Satzstruktur (Anakoluth, Hypotaxe vs Parataxe).
        2. Psychologische Wirkung der Wortwahl.
        3. Detaillierte Liste ALLER genutzten Stilmittel (Alliteration, Metapher, etc.).
        
        Antworte NUR mit JSON: {
          "rhetoricScore": number (0-100),
          "complexity": "Einfach" | "Mittel" | "Komplex",
          "strengths": string[] (mind. 3 detaillierte Punkte),
          "improvements": string[] (mind. 3 konkrete Korrekturvorschläge),
          "summary": string (eine prägnante Zusammenfassung),
          "stylisticDevices": string[] (alle erkannten Figuren),
          "explanationForKids": string (Die Kernessenz für ein Kind erklärt),
          "detailedAdvice": string (ein langer, tiefgehender Coaching-Absatz),
          "progressFeedback": string (falls Vergleich möglich, sonst leer),
          "nextTrainingTask": string (eine Hausaufgabe)
        }`,
        config: { 
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 4000 } // Erlaube dem Modell zu "denken" für bessere Qualität
        }
      });
      
      const analysis = JSON.parse(response.text || '{}');
      setLastAnalysis(analysis);
      setSessionState('ANALYSIS');
      addLog("Tiefenanalyse abgeschlossen.", "success");
    } catch (e) {
      addLog("Analyse fehlgeschlagen", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const repeatTopic = () => {
      if (transcription && lastAnalysis) {
          setPreviousAttempt({
              id: 'temp-' + Date.now(),
              timestamp: Date.now(),
              mode,
              transcription,
              analysis: lastAnalysis,
              title: topic
          });
      }
      setSessionState('SETUP');
      setTranscription('');
      setLastAnalysis(null);
  };

  const handleSave = () => {
    onSave({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      mode,
      transcription,
      analysis: lastAnalysis || undefined,
      title: `Training: ${topic}`
    });
    setSessionState('SETUP');
    setTopic('');
    setPreviousAttempt(null);
  };

  const readAloud = async (text: string) => {
    if (!text || isPlaying) return;
    setIsPlaying(true);
    try {
      await speakElevenLabs(text);
    } catch (err) {
      // handled by elevenLabsTTS fallback
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6 relative">
      {activeLexiconTerm && <ExplanationModal term={activeLexiconTerm} onClose={() => setActiveLexiconTerm(null)} />}

      {sessionState === 'SETUP' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 pb-10">
          <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl">
             <h2 className="text-2xl font-black text-gray-900 italic uppercase tracking-tighter mb-6">Trainings-Setup</h2>
             
             {previousAttempt && (
                 <div className="bg-blue-50 p-5 rounded-3xl mb-6 border border-blue-100 flex items-center gap-4">
                     <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <i className="fas fa-rotate-right"></i>
                     </div>
                     <div>
                        <p className="text-[10px] font-black uppercase text-blue-800 tracking-widest">Wiederholungs-Modus</p>
                        <p className="text-sm font-bold text-blue-900">Letzter Score: {previousAttempt.analysis?.rhetoricScore} / 100 Punkten</p>
                     </div>
                 </div>
             )}

             <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block">Thema / Fragestellung</label>
                <textarea 
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="Worum geht es heute?"
                    className="w-full h-24 bg-gray-50 rounded-2xl p-5 text-sm font-medium focus:ring-4 focus:ring-blue-50 outline-none transition-all resize-none border-none shadow-inner"
                />

                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div>
                        <p className="text-[10px] font-black uppercase text-gray-800 tracking-wider">Multi-Tone Biofeedback</p>
                        <p className="text-[9px] text-gray-400">Sinus (Füllwort) | Doppel-Blip (Wiederholung)</p>
                    </div>
                    <button 
                        onClick={() => setBioFeedbackEnabled(!bioFeedbackEnabled)}
                        className={`w-12 h-6 rounded-full transition-all relative ${bioFeedbackEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${bioFeedbackEnabled ? 'left-7' : 'left-1'}`}></div>
                    </button>
                </div>

                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block pt-2">Fokus-Skill</label>
                <div className="grid grid-cols-2 gap-2">
                    {SKILLS.map(skill => (
                        <button 
                            key={skill.id}
                            onClick={() => setSelectedSkill(selectedSkill === skill.id ? null : skill.id)}
                            className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${selectedSkill === skill.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-gray-50 border-transparent text-gray-600'}`}
                        >
                            <i className={`fas ${skill.icon} text-xs`}></i>
                            <span className="text-[10px] font-black uppercase">{skill.name}</span>
                        </button>
                    ))}
                </div>
             </div>

             <button 
                onClick={startRecording}
                disabled={!topic}
                className="w-full mt-8 bg-blue-600 text-white font-black py-5 rounded-[2rem] shadow-xl active:scale-95 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
             >
                AUFNAHME STARTEN
             </button>
          </div>
        </div>
      )}

      {sessionState === 'RECORDING' && (
          <div className="flex-1 flex flex-col items-center animate-in fade-in pt-6">
              <div className="mb-8 relative scale-110">
                  <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
                  <button 
                    onClick={stopRecording}
                    className="w-32 h-32 rounded-full bg-red-500 text-white text-3xl shadow-2xl relative z-10 border-4 border-red-100 active:scale-90 transition-all"
                  >
                    <i className="fas fa-stop"></i>
                  </button>
              </div>
              <h2 className="text-xl font-black italic text-gray-900 uppercase tracking-tighter mb-1">{topic}</h2>
              <div className="flex items-center gap-2 justify-center mb-8">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">System hört zu...</p>
              </div>
              
              <div className="flex-1 w-full max-w-sm space-y-4 overflow-y-auto px-1 pb-10 custom-scrollbar">
                  {transcriptionBlocks.length === 0 ? (
                      <div className="bg-white/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-dashed border-gray-200 text-center italic text-gray-400 text-sm">
                          Starte jetzt deine Rede...
                      </div>
                  ) : (
                      transcriptionBlocks.map((block, bIdx) => (
                          <div key={bIdx} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm animate-in slide-in-from-bottom-4 duration-500 relative">
                              <span className="absolute -top-2 -right-2 bg-gray-100 text-[8px] font-black text-gray-400 px-2 py-1 rounded-full border border-gray-200">
                                  PART {bIdx + 1}
                              </span>
                              <p className="text-sm font-bold text-gray-800 leading-relaxed italic">
                                {block.split(' ').map((word, i) => {
                                    const clean = word.toLowerCase().replace(/[.,!?]/g, '');
                                    const isFiller = FILLER_WORDS.includes(clean);
                                    return (
                                        <span key={i} className={isFiller ? 'text-red-500 underline decoration-red-200 underline-offset-4' : ''}>
                                            {word}{' '}
                                        </span>
                                    );
                                })}
                              </p>
                          </div>
                      ))
                  )}
                  <div ref={transcriptEndRef} />
              </div>
              
              {!isActive && transcription && (
                  <div className="fixed bottom-24 left-4 right-4 animate-in slide-in-from-bottom-10">
                      <button 
                        onClick={startAnalysis}
                        disabled={isProcessing}
                        className="w-full bg-gray-900 text-white py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        {isProcessing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
                        TIEFENANALYSE ERSTELLEN
                      </button>
                  </div>
              )}
          </div>
      )}

      {sessionState === 'ANALYSIS' && lastAnalysis && (
        <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700 pb-20">
          <div className="bg-white p-8 rounded-[3.5rem] border border-gray-100 shadow-xl space-y-8">
            <div className="flex flex-col items-center text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mb-2">Gesamt-Performance</p>
              <div className="relative inline-flex items-center justify-center p-1 rounded-full bg-gradient-to-tr from-blue-600 to-emerald-400 shadow-2xl">
                 <div className="bg-white rounded-full p-6 flex flex-col items-center min-w-[140px]">
                    <span className="text-4xl font-black text-gray-900 tracking-tighter">{lastAnalysis.rhetoricScore}</span>
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">VON 100 PUNKTEN</span>
                 </div>
              </div>
            </div>

            {lastAnalysis.progressFeedback && (
                <div className="bg-emerald-50 p-6 rounded-[2.5rem] border border-emerald-100">
                    <h4 className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <i className="fas fa-chart-line"></i> Fortschritts-Check
                    </h4>
                    <p className="text-sm font-bold text-emerald-950 leading-relaxed italic">"{lastAnalysis.progressFeedback}"</p>
                </div>
            )}

            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">KI-Coach Deep Dive</h3>
              <div className="bg-gray-50 p-7 rounded-[2.5rem] border border-gray-100 relative">
                <p className="text-sm text-gray-900 leading-relaxed font-bold italic">"{lastAnalysis.detailedAdvice || lastAnalysis.summary}"</p>
                <button 
                  onClick={() => readAloud(lastAnalysis.detailedAdvice || lastAnalysis.summary)} 
                  className="mt-6 bg-white border border-gray-200 px-5 py-3 rounded-2xl text-blue-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-sm active:scale-95 transition-all"
                >
                  <i className="fas fa-play"></i> COACHING-AUDIO
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-50/50 p-6 rounded-[2.5rem] border border-emerald-100">
                <h4 className="text-[9px] font-black text-emerald-800 uppercase mb-4 flex items-center gap-2">
                    <i className="fas fa-bolt"></i> Stärken
                </h4>
                <ul className="text-[10px] text-emerald-900 space-y-3 font-bold">
                  {lastAnalysis.strengths?.map((s, i) => <li key={i} className="flex gap-2 leading-tight"><span>•</span> {s}</li>)}
                </ul>
              </div>
              <div className="bg-red-50/50 p-6 rounded-[2.5rem] border border-red-100">
                <h4 className="text-[9px] font-black text-red-800 uppercase mb-4 flex items-center gap-2">
                    <i className="fas fa-compass"></i> Fokus
                </h4>
                <ul className="text-[10px] text-red-900 space-y-3 font-bold">
                  {lastAnalysis.improvements?.map((im, i) => <li key={i} className="flex gap-2 leading-tight"><span>•</span> {im}</li>)}
                </ul>
              </div>
            </div>

            <div className="bg-gray-900 p-8 rounded-[3rem] text-white shadow-2xl">
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-3 italic">Nächste Herausforderung</p>
                <p className="text-lg font-black italic tracking-tight leading-tight mb-4">"{lastAnalysis.nextTrainingTask || 'Einfach weiter so!'}"</p>
                <div className="flex gap-2">
                    {lastAnalysis.stylisticDevices.slice(0, 3).map((d, i) => (
                        <span key={i} onClick={() => setActiveLexiconTerm(d)} className="bg-white/10 text-[8px] font-black uppercase px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1 cursor-pointer">
                            {d} <i className="fas fa-circle-question opacity-50"></i>
                        </span>
                    ))}
                </div>
            </div>

            <div className="flex gap-3 pt-4">
                <button onClick={repeatTopic} className="flex-1 bg-blue-100 text-blue-700 font-black py-5 rounded-[2rem] text-[10px] uppercase tracking-widest active:scale-95 transition-all border border-blue-200">WIEDERHOLEN</button>
                <button onClick={handleSave} className="flex-1 bg-gray-900 text-white font-black py-5 rounded-[2rem] text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl">ARCHIVIEREN</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainerSession;
