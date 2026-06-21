import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { AppMode, SessionResult } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { createBlob, decode, decodeAudioData } from '../utils/audio-helpers';
import { dispatchDictation } from '../utils/dictation-events';

interface DevLogViewProps {
  onSave: (session: SessionResult) => void;
  addLog: (message: string, level?: 'info' | 'error' | 'success') => void;
}

const DevLogView: React.FC<DevLogViewProps> = ({ onSave, addLog }) => {
  const [inputText, setInputText] = useState('');
  const [correctedLog, setCorrectedLog] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [selectedApp, setSelectedApp] = useState('Meine App');

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const correctedRef = useRef<HTMLDivElement>(null);

  // Auto-save draft
  useEffect(() => {
    const savedDraft = localStorage.getItem('rhetorix_devlog_draft');
    if (savedDraft) setInputText(savedDraft);
    
    const savedApp = localStorage.getItem('rhetorix_devlog_app');
    if (savedApp) setSelectedApp(savedApp);
  }, []);

  useEffect(() => {
    if (inputText) {
      localStorage.setItem('rhetorix_devlog_draft', inputText);
      setIsAutoSaving(true);
      const timer = setTimeout(() => setIsAutoSaving(false), 800);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('rhetorix_devlog_draft');
    }
  }, [inputText]);

  const startVoiceInput = async () => {
    try {
      setIsRecording(true);
      addLog("Transkription für Entwicklungs-Logbücher aktiv. Sprich frei...", "info");
      dispatchDictation('', true);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "Du bist ein technischer Assistent. Transkribiere die gesprochenen Notizen des Nutzers, der gerade ein Softwareprogramm entwickelt, präzise und exakt auf DEUTSCH. Korrigiere keine Struktur, schreibe einfach genau das auf, was gesagt wird.",
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
              const text = msg.serverContent.inputTranscription.text;
              setInputText(prev => {
                const updated = prev + (prev ? " " : "") + text;
                dispatchDictation(updated, true);
                return updated;
              });
            }
          },
          onerror: () => stopVoiceInput(),
          onclose: () => {
            setIsRecording(false);
            dispatchDictation('', false);
          }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      addLog("Mikrofon-Zugriff verweigert", "error");
      setIsRecording(false);
    }
  };

  const stopVoiceInput = () => {
    setIsRecording(false);
    dispatchDictation('', false);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    addLog("Spracheingabe beendet.");
  };

  const applyTemplate = (templateType: string) => {
    let text = '';
    const dateStr = new Date().toLocaleDateString('de-DE');
    switch (templateType) {
      case 'daily':
        text = `## Tagesbericht - ${dateStr}\nArbeite an der App: ${selectedApp}\n\n1. Was ich heute geschafft habe:\n- \n- \n\n2. Aktueller Stand:\n-\n\n3. Technische Details / Frameworks:\n-\n\n4. Hindernisse & Probleme:\n-\n`;
        break;
      case 'feature':
        text = `## Feature-Dokumentation: [Name des Features]\nApp: ${selectedApp}\n\nMotivation & Ziel:\n-\n- \n\nUmgesetzte Schritte:\n- [x] UI Entwurf erstellt\n- [ ] Logik implementiert\n- [ ] Datenbank-Anbindung fertig\n\nHerausforderungen:\n-\n`;
        break;
      case 'bug':
        text = `## Bugfix-Eintrag\nApp: ${selectedApp}\nBeteiligte Komponenten:\n-\n\nFehlerbeschreibung:\n-\n\nRoot Cause (Ursache):\n-\n\nLösung & Behebung:\n- `;
        break;
      case 'idea':
        text = `## Neue Konzept-Idee / Architektur-Entwurf\nApp: ${selectedApp}\n\nKurz-Konzept:\n-\n\nGewünschter Tech-Stack:\n-\n\nMögliche Bibliotheken:\n- `;
        break;
      default:
        break;
    }
    setInputText(text);
    addLog(`Vorlage "${templateType}" geladen.`, "success");
  };

  const generateProfessionalLog = async () => {
    if (!inputText || isGenerating) return;
    setIsGenerating(true);
    addLog("Veredele und strukturiere den Entwicklungsbericht...", "info");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Du bist ein erstklassiger technischer Dokumentar und erfahrener Software-Architekt. Deine Aufgabe ist es, die unstrukturierten Notizen, Gedanken, die Diktier-Rohdaten oder den Tagesbericht des Nutzers über seine Entwicklungsfortschritte zu korrigieren, sauber und professionell zu formulieren und logisch zu strukturieren.

Projekt-Kontext:
- App-Name: ${selectedApp}
- Datum: ${new Date().toLocaleDateString('de-DE')}

Hier sind die Notizen / das Transkript des Nutzers:
"${inputText}"

Bitte erstelle ein wunderschönes, übersichtliches und verständliches Entwickler-Logbuch (Changelog/Dev-Daily) in Markdown auf DEUTSCH. Verwende exzellenten professionellen Entwickler-Fachjargon, aber bleibe präzise.

Halte Dich an diese Struktur (passe sie dynamisch an, falls bestimmte Abschnitte leer sind):
1. 📌 **Zusammenfassung (Executive Summary)**: Ein bis zwei Sätze, was heute gearbeitet wurde.
2. ✅ **Erreichte Milestones & Features**: Strukturierte, klare Aufzählung der geschafften Arbeiten.
3. 🛠️ **Technische Implementierung & Code-Details**: Erwähne vorgenommene Code-Strukturen, Komponenten, Hooks, APIs oder Datenbank-Tabellen.
4. 🔍 **Behobene Bugs & Herausforderungen**: Welche Hürden wurden gemeistert, welche Probleme identifiziert und gelöst?
5. 📋 **Nächste konkrete Entwicklungsschritte**: Fokus für die nächste Arbeits-Session oder To-Dos.

Antworte ausschließlich mit dem fertig formulierten Markdown-Dokument. Schreibe keine einleitenden Höflichkeitsflrasen vorweg ("Hier ist dein Bericht") oder abschließende Kommentare.`
      });

      if (response.text) {
        setCorrectedLog(response.text);
        addLog("Entwicklungsbericht erfolgreich veredelt!", "success");
        setTimeout(() => {
          correctedRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err: any) {
      addLog("Fehler bei der Veredelung: " + err.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const triggerTTS = async () => {
    if (!correctedLog || isPlaying) return;
    setIsPlaying(true);
    addLog("Generiere professionelles Voice-Over...", "info");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Clear markdown formatting slightly for a more fluent reading experience
      const cleanText = correctedLog
        .replace(/[*#`_\-]/g, ' ')
        .replace(/\n+/g, ' \n ')
        .substring(0, 1500); // safety length

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Lies diesen Entwicklungsbericht professionell vor: ${cleanText}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
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
          setIsPlaying(false);
          if (ctx.state !== 'closed') ctx.close();
        };
        source.start();
      } else {
        setIsPlaying(false);
        addLog("Keine Sprachdaten erhalten", "error");
      }
    } catch (err: any) {
      setIsPlaying(false);
      addLog("Audio-Generierung fehlgeschlagen: " + err.message, "error");
    }
  };

  const handleSave = () => {
    if (!inputText) return;
    const finalDocument = correctedLog || `### Rohentwurf - ${selectedApp}\n\n${inputText}`;
    
    // Create first line as a title
    let computedTitle = `Entwicklung: ${selectedApp}`;
    if (correctedLog) {
      const lines = correctedLog.split('\n');
      const foundTitle = lines.find(l => l.includes('###') || l.includes('##') || l.includes('#'));
      if (foundTitle) {
        computedTitle = foundTitle.replace(/[#*]/g, '').trim();
      }
    }

    const session: SessionResult = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      mode: AppMode.DEV_LOG,
      transcription: inputText,
      correctedText: finalDocument,
      title: computedTitle
    };

    onSave(session);
    setInputText('');
    setCorrectedLog(null);
    localStorage.removeItem('rhetorix_devlog_draft');
    addLog(`Bericht im Archiv unter "${computedTitle}" abgespeichert.`, "success");
  };

  const handleShare = async () => {
    const textToShare = correctedLog || inputText;
    if (!textToShare) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Entwicklungs-Bericht: ${selectedApp}`,
          text: textToShare,
        });
      } catch (err) {
        // ignore abort
      }
    } else {
      navigator.clipboard.writeText(textToShare);
      addLog("Bericht in die Zwischenablage kopiert!", "success");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header section */}
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tighter italic">Entwicklungs-Doku</h2>
              {isAutoSaving && (
                <span className="text-[9px] text-indigo-500 font-bold tracking-widest flex items-center gap-1 normal-case font-mono animate-pulse">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full inline-block"></span>
                  Entwurf gesichert
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest mt-1">Tagesablauf & Fortschritts-Archiv</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
            <i className="fas fa-laptop-code text-xl"></i>
          </div>
        </div>

        {/* Selected App Configuration */}
        <div className="space-y-2 mb-6">
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block">Aktuelles Projekt / App</label>
          <div className="flex gap-2">
            <input 
              type="text"
              value={selectedApp}
              onChange={(e) => {
                setSelectedApp(e.target.value);
                localStorage.setItem('rhetorix_devlog_app', e.target.value);
              }}
              placeholder="z.B. Rhetorix Pro, Sixt Verhandlung, MyApp..."
              className="flex-1 bg-gray-50 dark:bg-gray-950 border border-transparent rounded-2xl px-6 py-4 text-sm font-medium focus:bg-white dark:focus:bg-gray-900 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/20 outline-none text-gray-800 dark:text-white"
            />
          </div>
        </div>

        {/* Template Quick Selection */}
        <div className="mb-6">
          <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-2 block">Vorlagen-Schnellauswahl</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button 
              onClick={() => applyTemplate('daily')}
              className="py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-[10px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/40 flex items-center justify-center gap-1.5"
            >
              <i className="fas fa-calendar-day"></i> Tagesbericht
            </button>
            <button 
              onClick={() => applyTemplate('feature')}
              className="py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-[10px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all border border-transparent hover:border-emerald-100 dark:hover:border-emerald-900/40 flex items-center justify-center gap-1.5"
            >
              <i className="fas fa-puzzle-piece"></i> Feature
            </button>
            <button 
              onClick={() => applyTemplate('bug')}
              className="py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-[10px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 transition-all border border-transparent hover:border-rose-100 dark:hover:border-rose-900/40 flex items-center justify-center gap-1.5"
            >
              <i className="fas fa-bug"></i> Bugfix
            </button>
            <button 
              onClick={() => applyTemplate('idea')}
              className="py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-[10px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 dark:hover:text-orange-400 transition-all border border-transparent hover:border-orange-100 dark:hover:border-orange-900/40 flex items-center justify-center gap-1.5"
            >
              <i className="fas fa-lightbulb"></i> Idee
            </button>
          </div>
        </div>

        {/* Input Text Box with Audio Dictation */}
        <div className="relative mb-6">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Beschreibe, was du getan hast, an welchem Bug du dran warst oder welche Features du implementiert hast. Nutze Tastatur oder Diktier-Mikrofon..."
            className="w-full h-56 bg-gray-50 dark:bg-gray-950 border border-transparent rounded-[2rem] p-6 text-sm font-medium focus:bg-white dark:focus:bg-gray-900 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/20 outline-none transition-all resize-none shadow-inner text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-700"
          />
          <button
            onClick={isRecording ? stopVoiceInput : startVoiceInput}
            className={`absolute bottom-4 right-4 w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-lg active:scale-90 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-gray-700'}`}
            title={isRecording ? "Sprachaufnahme stoppen" : "Entwicklungs-Notizen diktieren"}
          >
            <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
          </button>
        </div>

        {/* Action Button to generate polished document */}
        <button
          onClick={generateProfessionalLog}
          disabled={isGenerating || !inputText}
          className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${isGenerating ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
        >
          {isGenerating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
          {isGenerating ? 'VEREDELE PROZESS...' : 'BERICHT VEREDELN & STRUKTURIEREN'}
        </button>
      </div>

      {/* Output / Results card */}
      <AnimatePresence>
        {correctedLog && (
          <motion.div
            ref={correctedRef}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-2xl space-y-6"
          >
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <i className="fas fa-align-left"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-800 dark:text-gray-100">Archiv-Fassung</h3>
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase mt-0.5">Sauber &amp; professionell formatiert</p>
                </div>
              </div>
              <button
                onClick={triggerTTS}
                disabled={isPlaying}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isPlaying ? 'bg-indigo-50 text-indigo-300' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 active:scale-90 border border-indigo-100 dark:border-indigo-800'}`}
                title="Bericht professionell vorlesen lassen"
              >
                <i className={`fas ${isPlaying ? 'fa-spinner fa-spin' : 'fa-volume-high'}`}></i>
              </button>
            </div>

            {/* Polished log display */}
            <div className="bg-gray-50 dark:bg-gray-950 p-6 sm:p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-inner max-h-[500px] overflow-y-auto scrollbar-thin dark:text-gray-100">
              <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                <ReactMarkdown>{correctedLog}</ReactMarkdown>
              </div>
            </div>

            {/* Secondary actions: Save & Share */}
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-100 dark:border-gray-800">
              <button 
                onClick={handleSave}
                className="bg-gray-900 dark:bg-black text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
              >
                <i className="fas fa-circle-check"></i> Im Archiv speichern
              </button>
              <button 
                onClick={handleShare}
                className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-center gap-2"
              >
                <i className="fas fa-share-nodes"></i> Teilen / Kopieren
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DevLogView;
