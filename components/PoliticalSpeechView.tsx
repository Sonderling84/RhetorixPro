import React, { useState, useEffect, useRef } from 'react';
import { Modality, LiveServerMessage } from '@google/genai';
import { getGeminiAI } from '../utils/gemini-client';
import { motion, AnimatePresence } from 'motion/react';
import { dispatchDictation } from '../utils/dictation-events';
import { createBlob } from '../utils/audio-helpers';
import { getUserMicrophoneStream } from '../utils/speechHelper';
import { speakElevenLabs, stopSpeaking } from '../utils/elevenLabsTTS';

enum Step {
  INPUT = 'input',
  OPTIMIZING = 'optimizing',
  SCRIPT = 'script',
  PERFORMING = 'performing',
  ANALYZING = 'analyzing',
  RESULT = 'result'
}

import { AppMode, SessionResult } from '../types';

const PoliticalSpeechView: React.FC<{ 
  addLog: (m: string, l?: any) => void,
  onSave: (s: SessionResult) => void 
}> = ({ addLog, onSave }) => {
  const [step, setStep] = useState<Step>(Step.INPUT);
  const [rawText, setRawText] = useState('');
  const [optimizedScript, setOptimizedScript] = useState('');
  const [performanceTranscript, setPerformanceTranscript] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReadingAloud, setIsReadingAloud] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [scrollSpeed, setScrollSpeed] = useState(2); // Default speed
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<any>(null);

  // Restore draft on mount
  useEffect(() => {
    const savedRaw = localStorage.getItem('rhetorix_autosave_political_raw');
    if (savedRaw) setRawText(savedRaw);

    const savedOtp = localStorage.getItem('rhetorix_autosave_political_opt');
    if (savedOtp) setOptimizedScript(savedOtp);

    const savedPerf = localStorage.getItem('rhetorix_autosave_political_perf');
    if (savedPerf) setPerformanceTranscript(savedPerf);

    const savedStep = localStorage.getItem('rhetorix_autosave_political_step');
    if (savedStep) setStep(savedStep as Step);
  }, []);

  // Save changes automatically
  useEffect(() => {
    if (rawText) {
      localStorage.setItem('rhetorix_autosave_political_raw', rawText);
      setIsAutoSaving(true);
      const timer = setTimeout(() => setIsAutoSaving(false), 800);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('rhetorix_autosave_political_raw');
    }
  }, [rawText]);

  useEffect(() => {
    if (optimizedScript) {
      localStorage.setItem('rhetorix_autosave_political_opt', optimizedScript);
    } else {
      localStorage.removeItem('rhetorix_autosave_political_opt');
    }
  }, [optimizedScript]);

  useEffect(() => {
    if (performanceTranscript) {
      localStorage.setItem('rhetorix_autosave_political_perf', performanceTranscript);
    } else {
      localStorage.removeItem('rhetorix_autosave_political_perf');
    }
  }, [performanceTranscript]);

  useEffect(() => {
    localStorage.setItem('rhetorix_autosave_political_step', step);
  }, [step]);

  useEffect(() => {
    if (step === Step.PERFORMING && isAutoScrolling) {
      scrollIntervalRef.current = setInterval(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop += 1;
        }
      }, 100 / scrollSpeed);
    } else {
      clearInterval(scrollIntervalRef.current);
    }
    return () => clearInterval(scrollIntervalRef.current);
  }, [step, isAutoScrolling, scrollSpeed]);
  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    try {
      setIsRecording(true);
      dispatchDictation('', true);
      addLog("Aufnahme gestartet...");

      const ai = await getGeminiAI();
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      streamRef.current = await getUserMicrophoneStream();

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.0-flash',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "Transkribiere den Nutzer präzise auf Deutsch.",
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            const source = audioContextRef.current!.createMediaStreamSource(streamRef.current!);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(s => {
                sessionRef.current = s;
                s.sendRealtimeInput({ audio: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: (msg: LiveServerMessage) => {
            if (msg.serverContent?.inputTranscription) {
              const newText = msg.serverContent!.inputTranscription!.text;
              if (step === Step.INPUT) {
                setRawText(prev => {
                  const updated = prev + (prev ? " " : "") + newText;
                  dispatchDictation(updated, true);
                  return updated;
                });
              } else if (step === Step.PERFORMING) {
                setPerformanceTranscript(prev => {
                  const updated = prev + (prev ? " " : "") + newText;
                  dispatchDictation(updated, true);
                  return updated;
                });
              }
            }
          },
          onerror: () => stopRecording(),
          onclose: () => setIsRecording(false)
        }
      });
    } catch (err) {
      addLog("Mikrofon-Fehler", "error");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    dispatchDictation('', false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
  };

  const optimizeSpeech = async () => {
    if (!rawText || rawText.length < 10) {
      addLog("Bitte diktiere zuerst einen längeren Text.", "error");
      return;
    }
    setIsProcessing(true);
    setStep(Step.OPTIMIZING);
    addLog("Optimiere Rede-Entwurf...", "info");

    try {
      const ai = await getGeminiAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Du bist ein Weltklasse-Redenschreiber für Spitzenpolitiker. 
        Wandle diesen rohen Text in ein professionelles, rhetorisch brillantes politisches Rede-Skript um. 
        
        ANFORDERUNGEN:
        - Nutze rhetorische Stilmittel (Anaphern, Metaphern, Klimax, Antithese).
        - Füge explizite Pausen-Marker ein: [PAUSE - 2s].
        - Strukturiere es in: Packende Einleitung, Argumentations-Hauptteil, Emotionaler Schluss.
        - Der Ton: Überzeugend, staatsmännisch, inspirierend.
        - Sprache: Deutsch.
        
        ROH-TEXT: ${rawText}`,
      });

      if (!response.text) throw new Error("Keine Antwort von der KI erhalten.");
      setOptimizedScript(response.text);
      setStep(Step.SCRIPT);
      addLog("Rede-Skript erstellt!", "success");
    } catch (err: any) {
      console.error("Optimization Error:", err);
      addLog("Fehler bei Optimierung: " + err.message, "error");
      setStep(Step.INPUT);
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzePerformance = async () => {
    setIsProcessing(true);
    setStep(Step.ANALYZING);
    addLog("Analysiere deinen Vortrag akribisch...", "info");

    try {
      const ai = await getGeminiAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Du bist ein hochkritischer Rhetorik-Professor und Performance-Coach. 
        Analysiere diesen politischen Vortrag basierend auf dem Skript und dem tatsächlichen Transkript der Performance. 
        
        DEINE ANALYSE MUSS SEIN:
        - Akribisch (detailverliebt)
        - Kritisch (schone den Redner nicht)
        - Komplex (betrachte Wortwahl, Rhythmus, Abweichungen vom Skript)
        
        BEWERTUNGSKRITERIEN:
        1. Texttreue vs. Improvisation (War die Abweichung sinnvoll?)
        2. Rhetorische Wirkung (Kam die Botschaft an?)
        3. Wortwahl & Präzision
        
        WICHTIG: Füge ein Feld "peopleFeedback" hinzu. 
        - Wenn das Rating >= 85 ist: "Das Volk ist begeistert und folgt dir!"
        - Wenn das Rating zwischen 70-84 ist: "Das Volk hört zu, ist aber noch skeptisch."
        - Wenn das Rating < 70 ist: "Das Volk wendet sich ab. Du musst härter an dir arbeiten."

        Antworte STRENG im JSON Format:
        {
          "rating": "0-100",
          "summary": "Detaillierte fachliche Zusammenfassung",
          "critique": ["Akribischer Kritikpunkt 1", "Akribischer Kritikpunkt 2", "Akribischer Kritikpunkt 3"],
          "improvements": ["Komplexer Verbesserungsvorschlag 1", "Komplexer Verbesserungsvorschlag 2"],
          "reward": "Ein prestigeträchtiger Titel (z.B. 'Der neue Cicero' oder 'Hinterbänkler')",
          "peopleFeedback": "Feedback vom Volk"
        }

        SKRIPT: ${optimizedScript}
        PERFORMANCE: ${performanceTranscript}`,
        config: { responseMimeType: 'application/json' }
      });

      const data = JSON.parse(response.text || '{}');
      setAnalysis(data);
      setStep(Step.RESULT);
      addLog("Detaillierte Analyse abgeschlossen!", "success");
    } catch (err: any) {
      console.error("Analysis Error:", err);
      addLog("Fehler bei Analyse: " + err.message, "error");
      setStep(Step.SCRIPT);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    addLog("Datei heruntergeladen. Du kannst sie jetzt in Google Drive hochladen.", "success");
  };

  const readAloud = async (textToRead: string) => {
    if (!textToRead || isReadingAloud) return;
    setIsReadingAloud(true);
    addLog("Generiere Audio-Vorschau...", "info");

    try {
      await speakElevenLabs(textToRead);
      addLog("Audio bereit!", "success");
    } catch (err: any) {
      addLog("Fehler bei Audio-Generierung: " + err.message, "error");
    } finally {
      setIsReadingAloud(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <AnimatePresence mode="wait">
        {step === Step.INPUT && (
          <motion.div 
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl space-y-6"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">1. Rede diktieren</h2>
                {isAutoSaving && (
                  <span className="text-[9px] text-emerald-500 font-bold tracking-widest flex items-center gap-1 normal-case font-mono animate-pulse">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
                    gespeichert
                  </span>
                )}
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center"><i className="fas fa-microphone text-xl"></i></div>
            </div>
            <p className="text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-widest">Sprich frei über dein politisches Anliegen.</p>
            
            <textarea 
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="Diktieren oder hier tippen..."
              className="w-full h-64 bg-gray-50 dark:bg-gray-950 rounded-[2rem] p-8 text-lg font-medium focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 outline-none transition-all resize-none border-none text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-700"
            />

            <div className="flex gap-4">
              <button 
                onClick={() => readAloud(rawText)}
                disabled={!rawText || isReadingAloud}
                className="flex-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 py-5 rounded-2xl font-black text-xs uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/30 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <i className="fas fa-volume-high"></i> VORLESEN
              </button>
              <button 
                onClick={toggleRecording}
                className={`flex-[2] py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-900 dark:bg-black text-white'}`}
              >
                <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
                {isRecording ? 'STOPP' : 'DIKTIEREN STARTEN'}
              </button>
              <button 
                onClick={optimizeSpeech}
                disabled={!rawText || isProcessing}
                className="flex-[2] bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50"
              >
                SKRIPT ERSTELLEN
              </button>
            </div>
          </motion.div>
        )}

        {step === Step.OPTIMIZING && (
          <motion.div 
            key="optimizing"
            className="flex flex-col items-center justify-center py-20 space-y-6"
          >
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 animate-spin">
              <i className="fas fa-wand-magic-sparkles text-3xl"></i>
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tighter text-gray-900 dark:text-white">KI optimiert deine Rede...</h3>
          </motion.div>
        )}

        {step === Step.SCRIPT && (
          <motion.div 
            key="script"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl space-y-6"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">2. Dein Rede-Skript</h2>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center"><i className="fas fa-scroll text-xl"></i></div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-950 p-8 rounded-[2rem] text-lg leading-relaxed font-serif whitespace-pre-wrap max-h-[500px] overflow-y-auto border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-300">
              {optimizedScript}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => readAloud(optimizedScript)}
                disabled={isReadingAloud}
                className="flex-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 py-6 rounded-2xl font-black text-sm uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/30 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                {isReadingAloud ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-volume-high"></i>}
                {isReadingAloud ? 'GENERIERE AUDIO...' : 'VORLESEN LASSEN'}
              </button>
              <button 
                onClick={() => downloadText(optimizedScript, 'politische-rede-skript.txt')}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 py-6 rounded-2xl font-black text-sm uppercase tracking-widest border border-gray-200 dark:border-gray-700 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <i className="fas fa-download"></i> DOWNLOAD
              </button>
              <button 
                onClick={() => {
                  onSave({
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    mode: AppMode.TRAINER,
                    title: `Politische Rede Skript: ${rawText.slice(0, 20)}...`,
                    transcription: rawText,
                    correctedText: optimizedScript
                  });
                }}
                className="flex-1 bg-blue-600 text-white py-6 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <i className="fas fa-archive"></i> SPEICHERN
              </button>
              <button 
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: 'Rhetorix Pro Rede-Skript',
                      text: optimizedScript,
                    }).catch(() => {
                      addLog("Teilen fehlgeschlagen", "error");
                    });
                  } else {
                    navigator.clipboard.writeText(optimizedScript);
                    addLog("In Zwischenablage kopiert", "info");
                  }
                }}
                className="flex-1 bg-indigo-600 text-white py-6 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <i className="fas fa-share-alt"></i> TEILEN
              </button>
              <button 
                onClick={() => setStep(Step.PERFORMING)}
                className="flex-[2] bg-gray-900 dark:bg-black text-white py-6 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <i className="fas fa-play"></i> JETZT VORTRAGEN
              </button>
            </div>
          </motion.div>
        )}

        {step === Step.PERFORMING && (
          <motion.div 
            key="performing"
            className="bg-gray-900 dark:bg-black text-white p-10 rounded-[3rem] shadow-2xl space-y-8 text-center relative overflow-hidden"
          >
            <div className="space-y-2">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-blue-400">3. Dein Auftritt</h2>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-[0.3em]">Trage deine Rede jetzt leidenschaftlich vor.</p>
            </div>

            {/* Teleprompter Display */}
            <div className="relative group">
              <div 
                ref={scrollRef}
                className="bg-white/5 dark:bg-white/5 p-12 rounded-[2.5rem] h-[400px] overflow-y-auto text-left border border-white/10 relative scroll-smooth"
              >
                <div className="absolute top-1/2 left-0 right-0 h-12 bg-blue-500/10 border-y border-blue-500/20 pointer-events-none -translate-y-1/2 z-10"></div>
                <div className="text-3xl font-bold leading-relaxed text-gray-300 whitespace-pre-wrap py-40">
                  {optimizedScript}
                </div>
              </div>
              
              {/* Speed Control Overlay */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xl px-6 py-4 rounded-2xl border border-white/10 flex items-center gap-6 z-20 w-[80%]">
                <div className="flex items-center gap-3 flex-1">
                  <i className="fas fa-gauge-high text-blue-400 text-xs"></i>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="10" 
                    step="0.5"
                    value={scrollSpeed}
                    onChange={(e) => setScrollSpeed(parseFloat(e.target.value))}
                    className="flex-1 accent-blue-500 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
                  />
                  <span className="text-[10px] font-black w-8 text-blue-400">{scrollSpeed}x</span>
                </div>
                <button 
                  onClick={() => setIsAutoScrolling(!isAutoScrolling)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isAutoScrolling ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400'}`}
                >
                  <i className={`fas ${isAutoScrolling ? 'fa-pause' : 'fa-play'}`}></i>
                </button>
              </div>
            </div>

            <div className="bg-blue-500/5 p-6 rounded-[2rem] text-left italic text-gray-500 text-sm border border-blue-500/10">
              <span className="text-blue-400 font-black uppercase text-[10px] block mb-2 tracking-widest">Live Transkript:</span>
              {performanceTranscript || "Höre zu... fange an zu sprechen!"}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={toggleRecording}
                className={`flex-1 py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 ${isRecording ? 'bg-red-500' : 'bg-blue-600'}`}
              >
                {isRecording ? 'AUFNAHME STOPPEN' : 'STARTEN'}
              </button>
              <button 
                onClick={analyzePerformance}
                disabled={!performanceTranscript || isRecording}
                className="flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-30"
              >
                ANALYSE STARTEN
              </button>
            </div>
          </motion.div>
        )}

        {step === Step.ANALYZING && (
          <motion.div 
            key="analyzing"
            className="flex flex-col items-center justify-center py-20 space-y-6"
          >
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-bounce">
              <i className="fas fa-microchip text-3xl"></i>
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tighter text-gray-900 dark:text-white">KI wertet deinen Vortrag aus...</h3>
          </motion.div>
        )}

        {step === Step.RESULT && analysis && (
          <motion.div 
            key="result"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-gray-900 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl text-center space-y-6">
              <div className="inline-block px-6 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
                {analysis.reward}
              </div>
              <div className="text-7xl font-black text-gray-900 dark:text-white italic tracking-tighter">
                {analysis.rating}<span className="text-blue-600 dark:text-blue-400 text-3xl">/100</span>
              </div>
              <div className={`text-sm font-black uppercase tracking-widest ${parseInt(analysis.rating) >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {analysis.peopleFeedback}
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tight text-gray-900 dark:text-white">{analysis.summary}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-lg">
                <h3 className="text-sm font-black uppercase tracking-widest text-red-500 dark:text-red-400 mb-4 flex items-center gap-2">
                  <i className="fas fa-bolt"></i> Kritische Analyse
                </h3>
                <ul className="space-y-3">
                  {analysis.critique.map((item: string, i: number) => (
                    <li key={i} className="text-sm font-medium text-gray-600 dark:text-gray-400 flex gap-3">
                      <span className="text-red-200 dark:text-red-900">•</span> {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-lg">
                <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500 dark:text-emerald-400 mb-4 flex items-center gap-2">
                  <i className="fas fa-star"></i> Verbesserungen
                </h3>
                <ul className="space-y-3">
                  {analysis.improvements.map((item: string, i: number) => (
                    <li key={i} className="text-sm font-medium text-gray-600 dark:text-gray-400 flex gap-3">
                      <span className="text-emerald-200 dark:text-emerald-900">•</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <button 
                onClick={() => downloadText(`Rating: ${analysis.rating}/100\n\n${analysis.summary}\n\nKritik:\n${analysis.critique.join('\n')}\n\nVerbesserungen:\n${analysis.improvements.join('\n')}`, 'rede-analyse.txt')}
                className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 py-6 rounded-2xl font-black text-sm uppercase tracking-widest border border-gray-200 dark:border-gray-700 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <i className="fas fa-download"></i>
              </button>
              <button 
                onClick={() => {
                  onSave({
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    mode: AppMode.TRAINER,
                    title: `Politische Rede Analyse: ${rawText.slice(0, 20)}...`,
                    transcription: performanceTranscript,
                    correctedText: optimizedScript,
                    analysis: {
                      rhetoricScore: parseInt(analysis.rating),
                      complexity: 'Komplex',
                      strengths: analysis.reward ? [analysis.reward] : [],
                      improvements: analysis.improvements,
                      summary: analysis.summary,
                      stylisticDevices: []
                    }
                  });
                }}
                className="bg-blue-600 text-white py-6 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <i className="fas fa-archive"></i> SPEICHERN
              </button>
              <button 
                onClick={() => {
                  const shareText = `Meine politische Rede auf Rhetorix Pro!\nRating: ${analysis.rating}/100\n${analysis.summary}\n\nSkript:\n${optimizedScript}`;
                  if (navigator.share) {
                    navigator.share({
                      title: 'Rhetorix Pro Rede-Analyse',
                      text: shareText,
                    }).catch(() => {
                      addLog("Teilen fehlgeschlagen", "error");
                    });
                  } else {
                    navigator.clipboard.writeText(shareText);
                    addLog("In Zwischenablage kopiert", "info");
                  }
                }}
                className="bg-indigo-600 text-white py-6 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <i className="fas fa-share-alt"></i> TEILEN
              </button>
            </div>

            <button 
              onClick={() => {
                setStep(Step.INPUT);
                setRawText('');
                setPerformanceTranscript('');
                setAnalysis(null);
              }}
              className="w-full bg-gray-900 dark:bg-black text-white py-6 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95"
            >
              NEUE REDE STARTEN
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PoliticalSpeechView;
