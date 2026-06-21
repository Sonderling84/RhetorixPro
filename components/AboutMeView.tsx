import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { AppMode, SessionResult } from '../types';
import { dispatchDictation } from '../utils/dictation-events';

interface AboutMeViewProps {
  onSave: (session: SessionResult) => void;
  addLog: (message: string, type: 'info' | 'success' | 'error') => void;
  sessions: SessionResult[];
}

type Step = 'IDLE' | 'RECORDING' | 'REVIEW' | 'ANALYSIS' | 'IMPORT';

const AboutMeView: React.FC<AboutMeViewProps> = ({ onSave, addLog, sessions }) => {
  const [step, setStep] = useState<Step>('IDLE');
  const [transcript, setTranscript] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [analysisType, setAnalysisType] = useState<'SINGLE' | 'FULL'>('FULL');
  
  const recognitionRef = useRef<any>(null);
  const reflections = sessions.filter(s => s.mode === AppMode.ABOUT_ME);

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window)) {
      addLog("Dein Browser unterstützt keine Spracherkennung.", "error");
      return;
    }

    setTranscript('');
    setInterimTranscript('');
    setStep('RECORDING');
    dispatchDictation('', true);

    const Recognition = (window as any).webkitSpeechRecognition;
    recognitionRef.current = new Recognition();
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
        setTranscript(prev => prev + (prev ? " " : "") + finalText);
      }
      setInterimTranscript(interimText);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      addLog("Mikrofon oder Sprach-Fehler", "error");
      stopRecording();
    };

    recognitionRef.current.start();
    addLog("Aufnahme gestartet...", "info");
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    dispatchDictation('', false);
    setStep('REVIEW');
    addLog("Reflexion bereit zum Check.", "success");
    setInterimTranscript('');
  };

  const saveReflection = () => {
    const session: SessionResult = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      mode: AppMode.ABOUT_ME,
      transcription: transcript,
      title: "Selbstreflexion: " + new Date().toLocaleDateString()
    };
    onSave(session);
    addLog("Reflexion gespeichert", "success");
    setStep('IDLE');
  };

  const getImmediateFeedback = async () => {
    if (!transcript) {
      addLog("Kein Text zum Analysieren.", "error");
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisType('SINGLE');
    setStep('ANALYSIS');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Ich habe folgende Selbstreflexion diktiert: "${transcript}". Gib mir ein kurzes, wertschätzendes und tiefgründiges Feedback dazu (max 3 Sätze). Antworte auf Deutsch.`,
      });
      setAnalysis(response.text || "Kein Feedback möglich.");
    } catch (error) {
      addLog("Feedback-Fehler", "error");
      setStep('REVIEW');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeCharacter = async () => {
    if (reflections.length === 0) {
      addLog("Noch keine Reflexionen zum Analysieren vorhanden.", "error");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisType('FULL');
    setStep('ANALYSIS');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const allContent = reflections.map(r => r.transcription).join("\n---\n");
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Hier sind meine bisherigen Selbstreflexionen:\n\n${allContent}\n\nAnalysiere mein "Ich", meinen Charakter und meine Denkweisen basierend auf diesen Texten. Erstelle ein psychologisches Profil, erkenne Muster und gib mir wertvolle Impulse für meine Weiterentwicklung. Antworte strukturiert und empathisch auf Deutsch.`,
      });
      
      setAnalysis(response.text || "Analyse fehlgeschlagen.");
    } catch (error) {
      addLog("Fehler bei der Analyse", "error");
      setStep('IDLE');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="mb-12 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-full text-rose-600 mb-6 shadow-sm">
          <i className="fas fa-user-astronaut text-4xl"></i>
        </div>
        <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">Über Mich</h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium mt-2">Dein Raum für Selbstreflexion & Charakter-Analyse.</p>
      </header>

      <AnimatePresence mode="wait">
        {step === 'IDLE' && (
          <motion.div 
            key="idle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid md:grid-cols-2 gap-8"
          >
            <button 
              onClick={startRecording}
              className="bg-white dark:bg-gray-900 p-12 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:border-rose-200 dark:hover:border-rose-900 transition-all group text-center"
            >
              <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-3xl flex items-center justify-center text-rose-600 mx-auto mb-6 group-hover:scale-110 transition-transform">
                <i className="fas fa-microphone text-3xl"></i>
              </div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase italic">Reflektieren</h2>
              <p className="text-gray-400 mt-2">Halte eine neue Erkenntnis fest.</p>
            </button>

            <button 
              onClick={() => {
                setTranscript('');
                setStep('IMPORT');
              }}
              className="bg-white dark:bg-gray-900 p-12 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:border-amber-200 dark:hover:border-amber-900 transition-all group text-center"
            >
              <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-3xl flex items-center justify-center text-amber-600 mx-auto mb-6 group-hover:scale-110 transition-transform">
                <i className="fas fa-file-alt text-3xl"></i>
              </div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase italic">Text einfügen</h2>
              <p className="text-gray-400 mt-2">Füge bereits geschriebene Texte ein.</p>
            </button>

            <button 
              onClick={analyzeCharacter}
              className="bg-white dark:bg-gray-900 p-12 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:border-indigo-200 dark:hover:border-indigo-900 transition-all group text-center"
            >
              <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl flex items-center justify-center text-indigo-600 mx-auto mb-6 group-hover:scale-110 transition-transform">
                <i className="fas fa-brain text-3xl"></i>
              </div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase italic">Psycho-Analyse</h2>
              <p className="text-gray-400 mt-2">Analysiere dein gesammeltes "Ich".</p>
              <div className="mt-4 inline-block px-3 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-bold">
                {reflections.length} Einträge vorhanden
              </div>
            </button>
          </motion.div>
        )}

        {step === 'IMPORT' && (
          <motion.div 
            key="import"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white dark:bg-gray-900 p-12 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase italic mb-6 flex items-center gap-3">
              <i className="fas fa-paste text-amber-500"></i>
              Text-Import
            </h2>
            <textarea 
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full h-64 bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl p-6 text-gray-700 dark:text-gray-200 font-medium focus:ring-2 focus:ring-amber-500 transition-all mb-8"
              placeholder="Füge hier deinen Text über dich, deinen Charakter oder deine Gedanken ein..."
            />
            <div className="flex gap-4">
              <button 
                onClick={() => setStep('IDLE')}
                className="flex-1 px-8 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                Abbrechen
              </button>
              <button 
                onClick={saveReflection}
                disabled={!transcript.trim()}
                className="flex-[2] bg-amber-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-amber-700 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Zum Profil hinzufügen
              </button>
            </div>
          </motion.div>
        )}

        {step === 'RECORDING' && (
          <motion.div 
            key="recording"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white dark:bg-gray-900 p-12 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-2xl text-center"
          >
            <div className="relative w-32 h-32 mx-auto mb-8">
              <div className="absolute inset-0 bg-rose-500/20 rounded-full animate-ping"></div>
              <div className="relative w-full h-full bg-rose-500 rounded-full flex items-center justify-center text-white shadow-lg">
                <i className="fas fa-microphone text-4xl"></i>
              </div>
            </div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase italic mb-4">Ich höre zu...</h2>
            <div className="bg-rose-50 dark:bg-rose-900/40 p-10 rounded-[2.5rem] border-2 border-rose-100 dark:border-rose-800/50 mb-8 min-h-[160px] flex items-center justify-center relative overflow-hidden backdrop-blur-md">
              <div className="absolute top-0 right-0 p-4">
                <div className="flex gap-1">
                  {[1,2,3].map(i => (
                    <motion.div 
                      key={i}
                      animate={{ height: [8, 16, 8] }}
                      transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                      className="w-1 bg-rose-400 rounded-full"
                    />
                  ))}
                </div>
              </div>
              <p className="text-rose-900 dark:text-rose-100 font-bold italic leading-relaxed text-lg">
                {transcript || interimTranscript ? (
                  <>
                    <span className="opacity-100">{transcript}</span>
                    <span className="opacity-40 ml-1">{interimTranscript}</span>
                  </>
                ) : "Sprich einfach aus, was dich gerade bewegt..."}
              </p>
            </div>
            <button 
              onClick={stopRecording}
              className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-10 py-4 rounded-full font-black uppercase tracking-widest hover:scale-105 transition-transform"
            >
              Aufnahme beenden
            </button>
          </motion.div>
        )}

        {step === 'REVIEW' && (
          <motion.div 
            key="review"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white dark:bg-gray-900 p-12 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase italic mb-6 flex items-center gap-3">
              <i className="fas fa-pen-nib text-rose-500"></i>
              Deine Erkenntnis
            </h2>
            <textarea 
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full h-48 bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl p-6 text-gray-700 dark:text-gray-200 font-medium focus:ring-2 focus:ring-rose-500 transition-all mb-8"
              placeholder="Was hast du über dich gelernt?"
            />
            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <button 
                  onClick={() => setStep('IDLE')}
                  className="flex-1 px-8 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                >
                  Verwerfen
                </button>
                <button 
                  onClick={getImmediateFeedback}
                  className="flex-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-magic"></i> Feedback
                </button>
              </div>
              <button 
                onClick={saveReflection}
                className="w-full bg-rose-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-rose-700 shadow-lg shadow-rose-500/20 transition-all"
              >
                In meinem "Ich" speichern
              </button>
            </div>
          </motion.div>
        )}

        {step === 'ANALYSIS' && (
          <motion.div 
            key="analysis"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-gray-900 p-12 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase italic flex items-center gap-3">
                <i className={`fas ${analysisType === 'SINGLE' ? 'fa-magic' : 'fa-brain'} ${analysisType === 'SINGLE' ? 'text-rose-500' : 'text-indigo-500'}`}></i>
                {analysisType === 'SINGLE' ? 'KI Feedback' : 'Charakter-Analyse'}
              </h2>
              <button 
                onClick={() => setStep(analysisType === 'SINGLE' ? 'REVIEW' : 'IDLE')}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            {isAnalyzing ? (
              <div className="py-20 text-center">
                <div className={`w-16 h-16 border-4 ${analysisType === 'SINGLE' ? 'border-rose-500' : 'border-indigo-500'} border-t-transparent rounded-full animate-spin mx-auto mb-6`}></div>
                <p className="text-gray-500 font-bold animate-pulse">KI analysiert...</p>
              </div>
            ) : (
              <div className="prose dark:prose-invert max-w-none">
                <div className={`${analysisType === 'SINGLE' ? 'bg-rose-50 dark:bg-rose-900/10' : 'bg-indigo-50 dark:bg-indigo-900/20'} p-8 rounded-3xl text-gray-700 dark:text-gray-200 font-medium leading-relaxed whitespace-pre-wrap shadow-inner`}>
                  {analysis}
                </div>
                <div className="mt-8 flex gap-4 justify-center">
                  {analysisType === 'SINGLE' && (
                    <button 
                      onClick={saveReflection}
                      className="bg-rose-600 text-white px-10 py-4 rounded-full font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-rose-500/20"
                    >
                      Speichern & Fertig
                    </button>
                  )}
                  <button 
                    onClick={() => setStep(analysisType === 'SINGLE' ? 'REVIEW' : 'IDLE')}
                    className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-200 px-10 py-4 rounded-full font-black uppercase tracking-widest hover:scale-105 transition-transform"
                  >
                    {analysisType === 'SINGLE' ? 'Zurück zum Text' : 'Zurück zur Übersicht'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {step === 'IDLE' && reflections.length > 0 && (
        <div className="mt-16">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">Letzte Erkenntnisse</h3>
          <div className="space-y-4">
            {reflections.slice(-3).reverse().map((ref, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-start gap-4">
                <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center text-rose-600 shrink-0">
                  <i className="fas fa-check text-xs"></i>
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-200 font-medium line-clamp-2 italic">"{ref.transcription}"</p>
                  <span className="text-[10px] font-bold text-gray-400 uppercase mt-2 block">
                    {new Date(ref.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AboutMeView;
