
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { LogEntry, AppMode, AnalysisData } from '../types';
import { dispatchDictation } from '../utils/dictation-events';
import { decode, decodeAudioData } from '../utils/audio-helpers';
import { applyVoiceStyleToUtterance } from '../utils/speechHelper';
import { motion, AnimatePresence } from 'motion/react';
import { GLOSSARY, ExplanationModal } from './AnalysisDetails';

interface TextOptimizerProps {
  onSave: (session: any) => void;
  addLog: (message: string, level: LogEntry['level']) => void;
}

const TextOptimizer: React.FC<TextOptimizerProps> = ({ onSave, addLog }) => {
  const [inputText, setInputText] = useState('');
  const [optimizedText, setOptimizedText] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Restore draft on mount
  useEffect(() => {
    const savedText = localStorage.getItem('rhetorix_autosave_text_optimizer_input');
    if (savedText) {
      setInputText(savedText);
    }
    const savedOptimized = localStorage.getItem('rhetorix_autosave_text_optimizer_opt');
    if (savedOptimized) {
      setOptimizedText(savedOptimized);
    }
  }, []);

  // Save changes automatically
  useEffect(() => {
    if (inputText) {
      localStorage.setItem('rhetorix_autosave_text_optimizer_input', inputText);
      setIsAutoSaving(true);
      const timer = setTimeout(() => setIsAutoSaving(false), 800);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('rhetorix_autosave_text_optimizer_input');
    }
  }, [inputText]);

  useEffect(() => {
    if (optimizedText) {
      localStorage.setItem('rhetorix_autosave_text_optimizer_opt', optimizedText);
    } else {
      localStorage.removeItem('rhetorix_autosave_text_optimizer_opt');
    }
  }, [optimizedText]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [tone, setTone] = useState<'professional' | 'creative' | 'simple' | 'persuasive' | 'human' | 'journalist' | 'coding' | 'grammar' | 'prompt'>('professional');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSpeakingOriginal, setIsSpeakingOriginal] = useState(false);
  const [isSpeakingOptimized, setIsSpeakingOptimized] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTerm, setActiveTerm] = useState<string | null>(null);
  
  // Real-time audio waveform visualizer states and refs
  const [audioVolume, setAudioVolume] = useState<number>(0);
  const [audioHistory, setAudioHistory] = useState<number[]>(Array(18).fill(15));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const visualContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume context if suspended (browser policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const playBeep = (type: 'start' | 'pause' | 'stop') => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'start') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'pause') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(392.00, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'stop') {
        osc.frequency.setValueAtTime(392.00, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(196.00, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {
      console.warn("Chime playback blocked or not supported:", e);
    }
  };

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
      audioSourceRef.current = null;
    }
    setIsSpeakingOriginal(false);
    setIsSpeakingOptimized(false);
    setIsLoadingAudio(false);
    window.speechSynthesis.cancel();
  };

  const speak = (text: string, type: 'original' | 'optimized') => {
    // If already playing THIS specific type, just stop it
    if ((type === 'original' && isSpeakingOriginal) || (type === 'optimized' && isSpeakingOptimized)) {
      stopAudio();
      return;
    }

    // Stop anything else currently playing
    stopAudio();

    if (type === 'original') setIsSpeakingOriginal(true);
    else setIsSpeakingOptimized(true);

    try {
      window.speechSynthesis.cancel();
      // Resume if browser's SpeechSynthesis engine got muted/suspended
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'de-DE';
      applyVoiceStyleToUtterance(utter);

      utter.onend = () => {
        setIsSpeakingOriginal(false);
        setIsSpeakingOptimized(false);
      };

      utter.onerror = (err) => {
        console.error("SpeechSynthesisUtterance error:", err);
        setIsSpeakingOriginal(false);
        setIsSpeakingOptimized(false);
      };

      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.error("Native SpeechSynthesis error:", e);
      setIsSpeakingOriginal(false);
      setIsSpeakingOptimized(false);
    }
  };

  const updateVolume = () => {
    if (!analyserRef.current) return;
    const array = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(array);
    
    // Calculate average volume
    let values = 0;
    const length = array.length;
    for (let i = 0; i < length; i++) {
      values += array[i];
    }
    const average = values / length;
    
    // Normalize and scale volume beautifully
    // Speaking voice: average is about 10-60.
    const normVolume = Math.min(Math.max((average - 2) / 70, 0), 1);
    
    setAudioVolume(normVolume);
    setAudioHistory(prev => {
      const next = prev.slice(1);
      // Min height is 15% for styling so it always looks like a beautiful idle wave even when quiet
      next.push(15 + normVolume * 85);
      return next;
    });

    if (isRecordingRef.current && !isPausedRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateVolume);
    }
  };

  const startDictation = async () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      addLog("Dein Browser unterstützt keine Spracherkennung.", "error");
      return;
    }

    try {
      playBeep('start');
      setIsRecording(true);
      isRecordingRef.current = true;
      setIsPaused(false);
      isPausedRef.current = false;
      dispatchDictation('', true);
      addLog("Diktat gestartet (Sprich jetzt)...", "info");

      // Start volume visualizer
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        const audioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new audioCtxClass();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64; 
        source.connect(analyser);
        
        analyserRef.current = analyser;
        visualContextRef.current = audioContext;
        
        // Start animation loop
        setTimeout(() => {
          if (isRecordingRef.current && !isPausedRef.current) {
            animationFrameRef.current = requestAnimationFrame(updateVolume);
          }
        }, 100);
      } catch (audioErr: any) {
        console.warn("Volume visualizer could not start (SpeechRecognition might still work):", audioErr);
      }

      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'de-DE';
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript;
          } else {
            interimText += event.results[i][0].transcript;
          }
        }

        if (finalText) {
          setInputText(prev => {
            const updated = prev + (prev ? " " : "") + finalText;
            dispatchDictation(updated, true);
            return updated;
          });
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error !== 'no-speech') {
          addLog("Spracherkennungs-Fehler: " + event.error, "error");
          stopDictation();
        }
      };

      recognitionRef.current.onend = () => {
        if (isRecordingRef.current && !isPausedRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error("Fehler beim automatischen Fortsetzen:", e);
          }
        } else if (!isRecordingRef.current) {
          setIsRecording(false);
          setIsPaused(false);
          setAudioVolume(0);
          setAudioHistory(Array(18).fill(15));
        }
      };

      recognitionRef.current.start();
    } catch (err: any) {
      addLog("Mikrofon-Fehler: " + err.message, "error");
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

  const togglePauseDictation = () => {
    if (!isRecordingRef.current) return;

    if (isPausedRef.current) {
      playBeep('start');
      setIsPaused(false);
      isPausedRef.current = false;
      addLog("Diktat fortgesetzt...", "info");
      
      // Resume visualizer animation
      if (analyserRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      }
      
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Fehler beim Fortsetzen des Diktats:", e);
        }
      }
    } else {
      playBeep('pause');
      setIsPaused(true);
      isPausedRef.current = true;
      setAudioVolume(0);
      setAudioHistory(Array(18).fill(15));
      addLog("Diktat pausiert.", "info");
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    }
  };

  const stopDictation = () => {
    playBeep('stop');
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsPaused(false);
    isPausedRef.current = false;
    setAudioVolume(0);
    setAudioHistory(Array(18).fill(15));
    dispatchDictation('', false);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(t => t.stop());
      } catch (err) {}
      streamRef.current = null;
    }
    
    if (visualContextRef.current && visualContextRef.current.state !== 'closed') {
      try {
        visualContextRef.current.close();
      } catch (err) {}
      visualContextRef.current = null;
    }
    
    analyserRef.current = null;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    addLog("Diktat beendet.", "info");
  };

  const handleOptimize = async () => {
    if (!inputText.trim()) {
      addLog('Bitte gib zuerst einen Text ein.', 'error');
      return;
    }

    setIsOptimizing(true);
    addLog('Text wird veredelt...', 'info');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      let systemInstruction = `Du bist ein Rhetorik-Experte. Veredle und optimiere den folgenden Text. Der Tonfall soll ${tone} sein. Gib nur den optimierten Text zurück, absolut ohne Kommentare oder Einleitungen. Sei präzise und elegant.`;
      
      if (isSaved) setIsSaved(false); // Reset saved state on new optimization
      
      if (tone === 'grammar') {
        systemInstruction = "Du bist ein Lektor. Analysiere den folgenden Text AUSSCHLIESSLICH auf Grammatik-, Rechtschreib- und Interpunktionsfehler. Gib den korrigierten Text zurück und markiere Korrekturen (z.B. durch Fettdruck oder [Korrektur]). Gib am Ende eine kurze Liste der gefundenen Fehlerkategorien an.";
      } else if (tone === 'human') {
        systemInstruction = "Schreibe den Text so um, dass er absolut menschlich, authentisch und natürlich wirkt. Vermeide typische KI-Floskeln, sei nahbar und lebendig. Gib nur den Text zurück.";
      } else if (tone === 'journalist') {
        systemInstruction = "Wandle den Text in eine präzise, neugierige und professionelle Fragestellung um, die man einem Journalisten oder Experten stellen würde. Fokus auf Relevanz und Tiefe. Gib nur die Frage(n) zurück.";
      } else if (tone === 'coding') {
        systemInstruction = "Wandle den Text in eine strukturierte, technische Prompt-Anleitung für einen Coding-Agenten (wie GitHub Copilot oder Cursor) um. Nutze klare Anweisungen, Kontext und technische Präzision. Gib nur den Prompt zurück.";
      } else if (tone === 'prompt') {
        systemInstruction = `Du bist ein Rhetorik- und Textexperte. Veredle, formuliere um oder passe den Text exakt basierend auf dieser spezifischen Benutzeranweisung an: "${customPrompt.trim() || 'Veredle den Text und schleife die sprachlichen Kanten ab.'}". Gib ausnahmslos ausschließlich den resultierenden, veredelten Text zurück. Keine Einleitungen, keine Erklärungen und keine Kommentare.`;
      }

      // Using Flash for speed as user complained about "taking forever"
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `${systemInstruction}\n\nText: ${inputText}`,
      });

      const result = response.text || '';
      if (!result) throw new Error("Keine Antwort von der KI erhalten.");
      setOptimizedText(result);
      addLog('Veredelung abgeschlossen!', 'success');
    } catch (error: any) {
      console.error('Optimization error:', error);
      addLog('Fehler bei der Textoptimierung: ' + error.message, 'error');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      addLog('Bitte gib zuerst einen Text ein, um eine Auswertung zu erstellen.', 'error');
      return;
    }

    setIsAnalyzing(true);
    addLog('Rhetorik-Analyse wird erstellt...', 'info');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || '' });
      
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Analysiere diesen Text hinsichtlich Rhetorik, Füllwort-Dichte, Ausdrucksstärke und Satzbau: "${inputText}".
        
        Antworte AUSSCHLIESSLICH im folgenden JSON-Format (ohne Markdown, keine Backticks):
        {
          "rhetoricScore": number (0 bis 100),
          "complexity": "Einfach" | "Mittel" | "Komplex",
          "strengths": ["Stärke 1", "Stärke 2"],
          "improvements": ["Verbesserung 1", "Verbesserung 2"],
          "summary": "Kurze Zusammenfassung der rhetorischen Wirkung",
          "stylisticDevices": ["Metapher", "Alliteration"] (Wähle passende Begriffe aus: Alliteration, Anapher, Metapher, Parallelismus, Klimax, Füllwort-Dichte, Palilogie, Anakoluth, Pleonasmus oder eigene),
          "detailedAdvice": "Der detaillierte Rat zur Verbesserung",
          "nextTrainingTask": "Die nächste Trainingsaufgabe"
        }`,
        config: { responseMimeType: "application/json" }
      });

      const cleanText = response.text ? response.text.replace(/```json/g, "").replace(/```/g, "").trim() : "{}";
      const parsedAnalysis = JSON.parse(cleanText) as AnalysisData;
      setAnalysis(parsedAnalysis);
      addLog('Auswertung abgeschlossen!', 'success');
    } catch (error: any) {
      console.error('Analysis error:', error);
      addLog('Fehler bei der Auswertung: ' + error.message, 'error');
    } finally {
      setIsAnalyzing(false);
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
    addLog("Datei heruntergeladen.", "success");
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(optimizedText);
    addLog('In Zwischenablage kopiert!', 'success');
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputText(prev => prev + (prev ? "\n\n" : "") + text);
        addLog("Notiz eingefügt", "success");
      }
    } catch (err) {
      addLog("Einfügen fehlgeschlagen (Berechtigung?)", "error");
    }
  };

  const handleReset = () => {
    stopAudio();
    setInputText('');
    setOptimizedText('');
    setCustomPrompt('');
    setIsSaved(false);
    setAnalysis(null);
    dispatchDictation('', true);
    addLog("Bereit für die nächste Textveredelung! Gib einen neuen Text ein.", "success");
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 shadow-inner">
            <i className="fas fa-wand-magic-sparkles text-xl"></i>
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight italic">Text Optimierer</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">KI-gestützte Rhetorik-Veredelung</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1 flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span>Dein Rohtext</span>
                {isAutoSaving && (
                  <span className="text-[9px] text-emerald-500 font-bold tracking-widest flex items-center gap-1 normal-case font-mono animate-pulse">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
                    gespeichert
                  </span>
                )}
              </span>
              {inputText && (
                <button 
                  onClick={() => speak(inputText, 'original')}
                  disabled={isLoadingAudio && !isSpeakingOriginal}
                  className={`text-purple-600 hover:text-purple-700 transition-all flex items-center gap-1 font-bold ${isLoadingAudio && !isSpeakingOriginal ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoadingAudio && isSpeakingOriginal ? (
                    <i className="fas fa-circle-notch animate-spin"></i>
                  ) : (
                    <i className={`fas ${isSpeakingOriginal ? 'fa-stop-circle text-red-500' : 'fa-play-circle'}`}></i>
                  )}
                  {isSpeakingOriginal ? 'Stoppen' : 'Vorlesen'}
                </button>
              )}
            </label>
            <AnimatePresence>
              {isRecording && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/20 border border-purple-100/50 dark:border-purple-900/40 flex items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="relative flex items-center justify-center w-4 h-4">
                        <span className={`absolute inline-flex h-3 w-3 rounded-full opacity-75 ${isPaused ? 'bg-amber-400' : 'bg-red-500 animate-ping'}`}></span>
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPaused ? 'bg-amber-500' : 'bg-red-600'}`}></span>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">
                          {isPaused ? "Diktat Pausiert" : "Diktat Aktiv"}
                        </p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                          {isPaused ? "Pause beenden" : "Spreche jetzt..."}
                        </p>
                      </div>
                    </div>

                    {/* Dynamic Real-time Waveform */}
                    <div className="flex items-end gap-1 h-8 px-2">
                      {audioHistory.map((val, idx) => (
                        <motion.div
                          key={idx}
                          className={`w-1 rounded-full transition-all duration-75 ${
                            isPaused 
                              ? 'bg-amber-300 dark:bg-amber-600' 
                              : 'bg-purple-500 dark:bg-purple-400'
                          }`}
                          style={{ height: `${val}%` }}
                          animate={{
                            height: isPaused ? '15%' : `${val}%`,
                            opacity: isPaused ? 0.4 : 1
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Schreibe oder kopiere deinen Text hier hinein..."
              className="w-full h-40 p-5 rounded-3xl bg-gray-50 border-none focus:ring-2 focus:ring-purple-500/20 transition-all resize-none text-sm font-medium text-gray-700 placeholder:text-gray-300"
            />
            <div className="absolute bottom-4 right-4 flex gap-2">
              <button 
                onClick={pasteFromClipboard}
                className="w-12 h-12 rounded-2xl bg-white text-purple-600 shadow-lg border border-gray-100 flex items-center justify-center transition-all active:scale-90"
                title="Notiz einfügen"
              >
                <i className="fas fa-paste"></i>
              </button>
              
              {isRecording && (
                <button 
                  onClick={togglePauseDictation}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all active:scale-90 ${
                    isPaused 
                      ? 'bg-purple-600 animate-bounce' 
                      : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                  title={isPaused ? "Diktat fortsetzen" : "Diktat pausieren"}
                >
                  <i className={`fas ${isPaused ? 'fa-microphone' : 'fa-pause'}`}></i>
                </button>
              )}
              
              <button 
                onClick={isRecording ? stopDictation : startDictation}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all active:scale-90 ${
                  isRecording 
                    ? 'bg-red-500' 
                    : 'bg-purple-600'
                }`}
                title={isRecording ? "Diktat beenden" : "Diktat starten"}
              >
                <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(['professional', 'creative', 'simple', 'persuasive', 'human', 'journalist', 'coding', 'grammar', 'prompt'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  tone === t 
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-200' 
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
              >
                {t === 'professional' ? 'Professionell' : 
                 t === 'creative' ? 'Kreativ' : 
                 t === 'simple' ? 'Einfach' : 
                 t === 'persuasive' ? 'Überzeugend' :
                 t === 'human' ? 'Menschlich' :
                 t === 'journalist' ? 'Journalist' : 
                 t === 'grammar' ? 'Fehler-Check' : 
                 t === 'coding' ? 'Coding Agent' : 'Eigener Prompt ✍️'}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {tone === 'prompt' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 rounded-3xl bg-purple-50/50 border border-purple-100/40 space-y-2 mt-2">
                  <label className="text-[10px] font-black text-purple-600 uppercase tracking-widest block ml-1">
                    Deine Veredelungs-Anweisung (Eigener Prompt)
                  </label>
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="z.B. 'Umschreiben in gehobenes Deutsch', 'Als kurzen, packenden LinkedIn-Post umformulieren', 'Füge Metaphern hinzu'..."
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-xs font-semibold text-gray-700 placeholder:text-gray-300"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleOptimize}
              disabled={isOptimizing || isAnalyzing}
              className={`py-5 rounded-3xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                isOptimizing 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-purple-600 text-white shadow-xl shadow-purple-100 active:scale-95 hover:bg-purple-700'
              }`}
            >
              {isOptimizing ? (
                <i className="fas fa-circle-notch animate-spin"></i>
              ) : (
                <i className="fas fa-bolt"></i>
              )}
              {isOptimizing ? 'läuft...' : 'Text Optimieren'}
            </button>

            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || isOptimizing}
              className={`py-5 rounded-3xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                isAnalyzing
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-indigo-100 active:scale-95 hover:from-blue-700 hover:to-indigo-700'
              }`}
            >
              {isAnalyzing ? (
                <i className="fas fa-circle-notch animate-spin"></i>
              ) : (
                <i className="fas fa-chart-line"></i>
              )}
              {isAnalyzing ? 'Analyse...' : 'Auswertung machen'}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {optimizedText && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-purple-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-purple-200 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <i className="fas fa-sparkles text-8xl"></i>
            </div>
            
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => speak(optimizedText, 'optimized')}
                  disabled={isLoadingAudio && !isSpeakingOptimized}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                    isSpeakingOptimized 
                      ? 'bg-white text-purple-600 shadow-lg' 
                      : 'bg-white/20 hover:bg-white/30 text-white'
                  } ${isLoadingAudio && !isSpeakingOptimized ? 'opacity-50' : ''}`}
                >
                  {isLoadingAudio && isSpeakingOptimized ? (
                    <i className="fas fa-circle-notch animate-spin"></i>
                  ) : (
                    <i className={`fas ${isSpeakingOptimized ? 'fa-stop' : 'fa-play'}`}></i>
                  )}
                </button>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-1">Veredeltes Ergebnis</h3>
                  <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest">
                    {isSpeakingOptimized ? 'Wird vorgelesen...' : (tone === 'professional' ? 'Professionelle Brillanz' : tone === 'prompt' ? `Eigener Prompt: "${customPrompt.slice(0, 25)}${customPrompt.length > 25 ? '...' : ''}"` : tone)}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    onSave({
                      id: Date.now().toString(),
                      timestamp: Date.now(),
                      mode: AppMode.TEXT_OPTIMIZER,
                      transcription: inputText,
                      correctedText: optimizedText,
                      title: `Veredelung: ${inputText.slice(0, 20)}...`
                    });
                    setIsSaved(true);
                    addLog("Text im Archiv gespeichert.", "success");
                  }}
                  disabled={isSaved}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isSaved ? 'bg-green-500 text-white shadow-lg' : 'bg-white/20 hover:bg-white/30 text-white'
                  }`}
                  title={isSaved ? "Bereits gespeichert" : "Speichern"}
                >
                  <i className={`fas ${isSaved ? 'fa-check' : 'fa-save'}`}></i>
                </button>
                <button 
                  onClick={async () => {
                    const shareData = {
                      title: 'Rhetorix Pro: Optimierter Text',
                      text: `Original: ${inputText}\n\nVeredelt: ${optimizedText}`
                    };
                    if (navigator.share) {
                      try {
                        await navigator.share(shareData);
                        addLog("Erfolgreich geteilt!", "success");
                      } catch (e) {}
                    } else {
                      copyToClipboard();
                      addLog("Link kopiert!", "success");
                    }
                  }}
                  className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  title="Teilen"
                >
                  <i className="fas fa-share-nodes"></i>
                </button>
                <button 
                  onClick={() => downloadText(optimizedText, 'veredelung.txt')}
                  className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  title="Herunterladen"
                >
                  <i className="fas fa-file-export"></i>
                </button>
                <button 
                  onClick={copyToClipboard}
                  className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  title="Kopieren"
                >
                  <i className="fas fa-copy"></i>
                </button>
              </div>
            </div>

            <div className="bg-white/10 rounded-[1.5rem] p-6 backdrop-blur-sm border border-white/10 relative z-10 shadow-inner">
              <p className="text-base font-medium leading-relaxed italic text-purple-50">
                "{optimizedText}"
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {optimizedText && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col sm:flex-row justify-center items-center gap-3 mt-6 pb-2"
          >
            <button
              onClick={handleReset}
              className="px-8 py-4 w-full sm:w-auto bg-gray-900 hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-gray-950 font-black text-xs uppercase tracking-[0.2em] rounded-3xl shadow-xl hover:scale-[102%] active:scale-98 transition-all flex items-center justify-center gap-2 border border-gray-850 dark:border-gray-200"
            >
              <i className="fas fa-arrows-rotate"></i>
              Anderen Text veredeln (Neu starten)
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-6 mt-6 overflow-hidden"
          >
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <i className="fas fa-chart-bar text-lg"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-800">Rhetorische Auswertung</h3>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Detailliertes Feedback deiner Sprechleistung</p>
                </div>
              </div>
              
              <button 
                onClick={() => setAnalysis(null)} 
                className="text-gray-300 hover:text-gray-500 transition-colors"
                title="Auswertung schließen"
              >
                <i className="fas fa-times-circle text-xl"></i>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Score card */}
              <div className="bg-slate-50 p-6 rounded-[2rem] flex flex-col items-center justify-center text-center border border-gray-100/50">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Rhetorik-Score</span>
                <div className="relative flex items-center justify-center w-24 h-24 rounded-full border-4 border-indigo-100">
                  <span className="text-3xl font-black italic text-indigo-600 tracking-tighter">{analysis.rhetoricScore}/100</span>
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-3">Komplexität: <span className="text-indigo-600 font-black">{analysis.complexity}</span></span>
              </div>

              {/* Strengths card */}
              <div className="bg-emerald-50/40 p-6 rounded-[2rem] border border-emerald-100/30">
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-3 block flex items-center gap-2">
                  <i className="fas fa-circle-check"></i> Deine Stärken
                </span>
                <ul className="space-y-2 text-xs font-semibold text-gray-650">
                  {analysis.strengths.map((s, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-emerald-500">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Improvements card */}
              <div className="bg-rose-50/40 p-6 rounded-[2rem] border border-rose-100/30">
                <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-3 block flex items-center gap-2">
                  <i className="fas fa-circle-exclamation"></i> Vorschläge
                </span>
                <ul className="space-y-2 text-xs font-semibold text-gray-655">
                  {analysis.improvements.map((im, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-rose-400">•</span>
                      <span>{im}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Stylistic devices */}
            <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100/40">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Gefundene Stilmittel & Faktoren (Tippe für Erklärung)</span>
              <div className="flex flex-wrap gap-2">
                {analysis.stylisticDevices.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTerm(d)}
                    className="bg-white text-[10px] font-black uppercase tracking-widest text-indigo-600 px-4 py-2 rounded-xl shadow-sm border border-indigo-50/50 hover:bg-indigo-50 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <i className="fas fa-book-sparkles text-[8px]"></i>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* General Advice */}
            <div className="bg-indigo-50/20 p-6 rounded-[2rem] border border-indigo-100/20">
              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-2 block">Auswertung & Fazit</span>
              <p className="text-xs font-medium text-gray-600 leading-relaxed italic">
                "{analysis.summary}"
              </p>
              {analysis.detailedAdvice && (
                <p className="text-xs text-gray-500 font-medium mt-3 leading-relaxed">
                  {analysis.detailedAdvice}
                </p>
              )}
              {analysis.nextTrainingTask && (
                <div className="mt-4 pt-4 border-t border-indigo-100/20">
                  <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1.5 block">Nächste Übungsaufgabe</span>
                  <p className="text-xs font-bold text-gray-700">{analysis.nextTrainingTask}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTerm && (
        <ExplanationModal term={activeTerm} onClose={() => setActiveTerm(null)} />
      )}
    </div>
  );
};

export default TextOptimizer;
