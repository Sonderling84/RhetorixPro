
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { AppMode, SessionResult, AnalysisData } from '../types';
import { createBlob } from '../utils/audio-helpers';
import { speakElevenLabs, stopSpeaking } from '../utils/elevenLabsTTS';
import { ExplanationModal } from './AnalysisDetails';
import { dispatchDictation } from '../utils/dictation-events';
import { getUserMicrophoneStream } from '../utils/speechHelper';

interface DiaryViewProps {
  onSave: (session: SessionResult) => void;
  addLog: (m: string, l?: any) => void;
}

const DiaryView: React.FC<DiaryViewProps> = ({ onSave, addLog }) => {
  const [isActive, setIsActive] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [optimizedText, setOptimizedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisData | null>(null);
  const [activeLexiconTerm, setActiveLexiconTerm] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Restore draft on mount
  useEffect(() => {
    const savedTranscription = localStorage.getItem('rhetorix_autosave_diary_transcription');
    if (savedTranscription) setTranscription(savedTranscription);

    const savedOtp = localStorage.getItem('rhetorix_autosave_diary_optimized');
    if (savedOtp) setOptimizedText(savedOtp);
  }, []);

  // Save changes automatically
  useEffect(() => {
    if (transcription) {
      localStorage.setItem('rhetorix_autosave_diary_transcription', transcription);
      setIsAutoSaving(true);
      const timer = setTimeout(() => setIsAutoSaving(false), 800);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('rhetorix_autosave_diary_transcription');
    }
  }, [transcription]);

  useEffect(() => {
    if (optimizedText) {
      localStorage.setItem('rhetorix_autosave_diary_optimized', optimizedText);
      setIsAutoSaving(true);
      const timer = setTimeout(() => setIsAutoSaving(false), 800);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('rhetorix_autosave_diary_optimized');
    }
  }, [optimizedText]);

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [transcription]);

  const startRecording = async () => {
    try {
      setIsActive(true);
      setTranscription('');
      setOptimizedText('');
      setLastAnalysis(null);
      dispatchDictation('', true);
      addLog("Authentischer Gedankenfluss aktiv...");

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      streamRef.current = await getUserMicrophoneStream();

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.0-flash-exp',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "Transkribiere JEDES Wort exakt. Behalte Pausenmarker, Füllwörter und Selbstkorrekturen bei. Dies ist ein ehrlicher Gedankenfluss-Entwurf.",
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
              const newText = msg.serverContent!.inputTranscription!.text;
              setTranscription(prev => {
                const updated = prev + (prev ? " " : "") + newText;
                dispatchDictation(updated, true);
                return updated;
              });
            }
          },
          onerror: () => stopRecording(),
          onclose: () => setIsActive(false)
        }
      });
    } catch (err) {
      addLog("Mikrofon-Fehler", "error");
      setIsActive(false);
    }
  };

  const stopRecording = () => {
    setIsActive(false);
    dispatchDictation('', false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const analyzeDiary = async () => {
    if (!transcription) return;
    setIsProcessing(true);
    addLog("Linguistische Tiefenanalyse der Gedanken...");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Analysiere diesen Gedankenfluss (Original-Transkript): "${transcription}".
        1. Untersuche die Authentizität und Sprechmuster.
        2. Erstelle eine tiefgreifende philosophische Reflexion.
        
        Antworte NUR mit JSON: {
          "rhetoricScore": number,
          "complexity": "Einfach" | "Mittel" | "Komplex",
          "strengths": string[],
          "improvements": string[],
          "summary": string,
          "stylisticDevices": string[],
          "explanationForKids": string (Die philosophische Essenz),
          "detailedAdvice": string
        }`,
        config: { responseMimeType: "application/json" }
      });
      
      const analysis = JSON.parse(response.text || '{}');
      setLastAnalysis(analysis);
      addLog("Reflexion erstellt.", "success");
    } catch (e) {
      addLog("Analyse fehlgeschlagen", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const optimizeDiaryText = async () => {
    if (!transcription) return;
    setIsOptimizing(true);
    addLog("Veredelung für das Archiv...");
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Überführe diesen Gedankenfluss in einen literarisch perfekten Tagebucheintrag. Korrigiere alle Sprechfehler, aber bewahre die Emotion: "${transcription}"`
      });
      setOptimizedText(response.text || '');
      addLog("Archiv-Version bereit.", "success");
    } catch (e) {
      addLog("Veredelung fehlgeschlagen", "error");
    } finally {
      setIsOptimizing(false);
    }
  };

  const readAloud = async () => {
    const textToRead = optimizedText || transcription;
    if (!textToRead || isPlaying) return;

    setIsPlaying(true);
    addLog("Generiere Sprachausgabe...");
    try {
      await speakElevenLabs(textToRead);
    } catch (err) {
      addLog("Vorlesen fehlgeschlagen", "error");
    } finally {
      setIsPlaying(false);
    }
  };

  const saveDiary = () => {
    const timestamp = Date.now();
    onSave({
      id: Math.random().toString(36).substr(2, 9),
      timestamp,
      mode: AppMode.DIARY,
      transcription,
      correctedText: optimizedText,
      analysis: lastAnalysis || undefined,
      title: `Ehrliche Reflexion: ${new Date(timestamp).toLocaleDateString('de-DE')}`
    });
    setTranscription('');
    setOptimizedText('');
    setLastAnalysis(null);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {activeLexiconTerm && <ExplanationModal term={activeLexiconTerm} onClose={() => setActiveLexiconTerm(null)} />}
      
      <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl overflow-hidden relative">
        <div className="flex justify-between items-center mb-10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-gray-900 italic uppercase tracking-tighter leading-none">KI TAGEBUCH</h2>
              {isAutoSaving && (
                <span className="text-[9px] text-emerald-500 font-bold tracking-widest flex items-center gap-1 normal-case font-mono animate-pulse">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
                  gespeichert
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em] mt-2">100% Authentisch</p>
          </div>
          <div className="bg-rose-50 text-rose-500 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border border-rose-100">
            <i className="fas fa-feather-pointed text-xl"></i>
          </div>
        </div>

        <div className="flex flex-col items-center pb-6">
          <button 
            onClick={isActive ? stopRecording : startRecording}
            className={`w-32 h-32 rounded-full flex items-center justify-center text-white text-4xl shadow-2xl transition-all active:scale-90 ${isActive ? 'bg-red-500 animate-pulse border-4 border-red-100' : 'bg-rose-500'}`}
          >
            <i className={`fas ${isActive ? 'fa-stop' : 'fa-microphone'}`}></i>
          </button>
          <div className="mt-8 text-center">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">{isActive ? 'SYSTEM ERFASST ALLES' : 'ZUM SPRECHEN TIPPEN'}</p>
          </div>
        </div>
      </div>

      {(transcription || optimizedText) && (
        <div className="bg-white rounded-[3rem] p-8 shadow-2xl border border-gray-100 flex flex-col gap-6 animate-in slide-in-from-bottom-8">
          <div className="flex justify-between items-center">
            <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.4em]">
              {optimizedText ? 'ARCHIV-FASSUNG' : 'GEDANKENFLUSS'}
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={readAloud} 
                disabled={isPlaying}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isPlaying ? 'bg-rose-50 text-rose-200' : 'bg-rose-50 text-rose-600 active:scale-90 border border-rose-100'}`}
              >
                <i className={`fas ${isPlaying ? 'fa-spinner fa-spin' : 'fa-volume-high'}`}></i>
              </button>
              {!optimizedText && (
                <button 
                  onClick={optimizeDiaryText} 
                  disabled={isOptimizing}
                  className="text-[9px] font-black bg-rose-50 text-rose-600 px-3 py-1.5 rounded-xl border border-rose-100 hover:bg-rose-100 transition-all flex items-center gap-2"
                >
                  {isOptimizing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sparkles"></i>}
                  VEREDELN
                </button>
              )}
            </div>
          </div>
          
          <div className="max-h-56 overflow-y-auto custom-scrollbar">
            <p className="text-gray-900 text-lg leading-relaxed font-medium tracking-normal italic">
              {optimizedText || transcription}
            </p>
            <div ref={transcriptEndRef} />
          </div>

          <div className="flex gap-3 pt-6 border-t border-gray-100">
            {!lastAnalysis && (
              <button 
                onClick={analyzeDiary}
                disabled={isProcessing}
                className="flex-[2] bg-blue-600 text-white font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3"
              >
                {isProcessing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-brain-circuit"></i>}
                TIEFENANALYSE
              </button>
            )}
            <button 
              onClick={saveDiary}
              className="flex-1 bg-gray-900 text-white font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all"
            >
              SICHERN
            </button>
          </div>
        </div>
      )}

      {lastAnalysis && (
        <div className="bg-white p-8 rounded-[3.5rem] border border-rose-50 shadow-2xl animate-in slide-in-from-bottom-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <i className="fas fa-microscope text-rose-400"></i>
            <h3 className="font-black text-gray-900 text-[10px] uppercase tracking-[0.4em]">Analyse-Gutachten</h3>
          </div>
          
          <div className="bg-rose-50/40 p-7 rounded-[2.5rem] border border-rose-100/50">
            <p className="text-base text-rose-950 leading-relaxed font-bold italic">
              "{lastAnalysis.explanationForKids || lastAnalysis.summary}"
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {lastAnalysis.stylisticDevices.map((d, i) => (
              <button 
                key={i} 
                onClick={() => setActiveLexiconTerm(d)} 
                className="bg-white border border-rose-50 px-4 py-2 rounded-xl text-[10px] font-black text-rose-800 uppercase italic shadow-sm flex items-center gap-2"
              >
                {d} <i className="fas fa-circle-question text-rose-200"></i>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DiaryView;
