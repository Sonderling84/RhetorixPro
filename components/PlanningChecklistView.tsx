import React, { useState, useRef, useEffect } from 'react';
import { getGeminiAI } from '../utils/gemini-client';
import { LogEntry, AppMode } from '../types';
import { dispatchDictation } from '../utils/dictation-events';
import { speakElevenLabs, stopSpeaking } from '../utils/elevenLabsTTS';
import { motion, AnimatePresence } from 'motion/react';

interface PlanningChecklistViewProps {
  onSave: (session: any) => void;
  addLog: (msg: string, level: 'info' | 'error' | 'success') => void;
}

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface ChecklistPhase {
  id: string;
  phaseName: string;
  items: ChecklistItem[];
}

interface Checklist {
  title: string;
  phases: ChecklistPhase[];
}

export const PlanningChecklistView: React.FC<PlanningChecklistViewProps> = ({ onSave, addLog }) => {
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  
  // Custom interactive editing fields
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState('');

  // Speech and visualizer states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioVolume, setAudioVolume] = useState<number>(0);
  const [audioHistory, setAudioHistory] = useState<number[]>(Array(18).fill(15));
  const [isCoPilotReading, setIsCoPilotReading] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState<{phaseIdx: number, itemIdx: number} | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Refs
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const visualContextRef = useRef<AudioContext | null>(null);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);

  useEffect(() => {
    return () => {
      stopDictation();
      stopSpeaking();
    };
  }, []);

  // Synth sounds
  const playChime = (type: 'generate' | 'check' | 'complete' | 'start-mic' | 'stop-mic') => {
    try {
      const audioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new audioCtxClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'start-mic') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'stop-mic') {
        osc.frequency.setValueAtTime(392.00, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(196.00, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'generate') {
        // Cockpit computer startup tone
        osc.frequency.setValueAtTime(350, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'check') {
        // High double-beep conformation click
        osc.frequency.setValueAtTime(950, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
        
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.setValueAtTime(1420, ctx.currentTime + 0.04);
          gain2.gain.setValueAtTime(0.1, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.1);
        }, 60);
      } else if (type === 'complete') {
        // Classic Boeing "Ding-Dong" cabin chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(554.37, ctx.currentTime); // C#5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.7);

        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(440.00, ctx.currentTime + 0.35); // A4
          gain2.gain.setValueAtTime(0.15, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.85);
        }, 280);
      }
    } catch (e) {
      console.warn("Chime blocked:", e);
    }
  };

  // Co-Pilot TTS Engine
  const speakChecklistItem = (text: string) => {
    stopSpeaking();
    speakElevenLabs(text);
  };

  const speakActiveChecklistItem = (pIdx: number, iIdx: number, checklistData: Checklist) => {
    if (!checklistData) return;
    const phase = checklistData.phases[pIdx];
    if (!phase) return;
    const item = phase.items[iIdx];
    if (!item) return;

    setActiveItemIndex({ phaseIdx: pIdx, itemIdx: iIdx });
    speakChecklistItem(`${phase.phaseName}: ${item.text}`);
  };

  const getNextUncheckedItem = (currentPIdx: number, currentIIdx: number, checklistData: Checklist) => {
    // Search from current position
    let i = currentIIdx;
    for (let p = currentPIdx; p < checklistData.phases.length; p++) {
      const phase = checklistData.phases[p];
      for (; i < phase.items.length; i++) {
        if (!phase.items[i].checked) {
          return { phaseIdx: p, itemIdx: i };
        }
      }
      i = 0; // Reset item search index for subsequent phases
    }
    // Search from beginning
    for (let p = 0; p < checklistData.phases.length; p++) {
      const phase = checklistData.phases[p];
      for (let j = 0; j < phase.items.length; j++) {
        if (!phase.items[j].checked) {
          return { phaseIdx: p, itemIdx: j };
        }
      }
    }
    return null;
  };

  // Volume visualization loop
  const updateVolume = () => {
    if (!analyserRef.current) return;
    const array = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(array);
    
    let sum = 0;
    for (let i = 0; i < array.length; i++) {
      sum += array[i];
    }
    const average = sum / array.length;
    const normVolume = Math.min(Math.max((average - 2) / 70, 0), 1);
    
    setAudioVolume(normVolume);
    setAudioHistory(prev => {
      const next = prev.slice(1);
      next.push(15 + normVolume * 85);
      return next;
    });

    if (isRecordingRef.current && !isPausedRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateVolume);
    }
  };

  // Speech input dictation hooks
  const startDictation = async () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      addLog("Dein Browser unterstützt keine Spracherkennung.", "error");
      return;
    }

    try {
      playChime('start-mic');
      setIsRecording(true);
      isRecordingRef.current = true;
      setIsPaused(false);
      isPausedRef.current = false;
      dispatchDictation('', true);
      addLog("Co-Pilot hört zu (Erzähle dein Vorhaben)...", "info");

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
        
        setTimeout(() => {
          if (isRecordingRef.current && !isPausedRef.current) {
            animationFrameRef.current = requestAnimationFrame(updateVolume);
          }
        }, 100);
      } catch (audioErr) {
        console.warn("Visualizer couldn't start, dictation runs anyway:", audioErr);
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
        console.error("Speech error:", event.error);
        if (event.error !== 'no-speech') {
          addLog("Diktat-Unterbrechung: " + event.error, "error");
          stopDictation();
        }
      };

      recognitionRef.current.onend = () => {
        if (isRecordingRef.current && !isPausedRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error("Autoresume error:", e);
          }
        }
      };

      recognitionRef.current.start();
    } catch (err: any) {
      addLog("Mikrofonfehler: " + err.message, "error");
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

  const togglePauseDictation = () => {
    if (!isRecordingRef.current) return;

    if (isPausedRef.current) {
      playChime('start-mic');
      setIsPaused(false);
      isPausedRef.current = false;
      addLog("Co-Pilot hört wieder zu...", "info");
      
      if (analyserRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      }
      
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {}
      }
    } else {
      playChime('stop-mic');
      setIsPaused(true);
      isPausedRef.current = true;
      setAudioVolume(0);
      setAudioHistory(Array(18).fill(15));
      addLog("Sprachaufnahme pausiert.", "info");
      
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
    if (!isRecordingRef.current) return;
    playChime('stop-mic');
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsPaused(false);
    isPausedRef.current = false;
    setAudioVolume(0);
    setAudioHistory(Array(18).fill(15));
    
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
    addLog("Sprachaufnahme beendet.", "info");
  };

  // Generate the actual cockpit checklist via Gemini
  const generateChecklist = async () => {
    if (!inputText.trim()) {
      addLog('Bitte beschreibe zuerst dein Vorhaben!', 'error');
      return;
    }

    setIsGenerating(true);
    addLog('Cockpit-Checkliste wird berechnet...', 'info');
    stopDictation();

    try {
      const ai = await getGeminiAI();
      
      const promptText = `Du bist der Copilot in einem Flugzeugcockpit. Der Pilot hat dir folgende Aufgabe oder Vorhaben beschrieben: "${inputText}".
      
      Erstelle daraus eine hochgradig strukturierte, chronologische, luftfahrtspezifisch präzise Flugzeug-Checkliste (Sicherheits-Checkliste im echten Flugzeug-Tonfall).
      Teile die Schritte in 3 logische Phasen ein (z.B. "PHASE 1: CABIN PREP / VORBEREITUNG", "PHASE 2: RUNWAY IN-FLIGHT / DURCHFÜHRUNG", "PHASE 3: SECURING CABIN / ABSCHLUSS").
      Jeder Schritt soll extrem präzise, kurz und im Cockpit-Format aufgebaut sein (z.B. "Flugplan übermitteln - GEPRÜFT", "Ausrüstung - GESICHERT").
      
      Antworte AUSSCHLIESSLICH im folgenden JSON-Format (keine Markdown Backticks oder Einleitungen):
      {
        "title": "Aussagekräftiger, kraftvoller Checklistentitel",
        "phases": [
          {
            "phaseName": "PHASE 1: PREPARATION",
            "items": ["Schritt 1", "Schritt 2"]
          },
          {
            "phaseName": "PHASE 2: EXECUTION",
            "items": ["Schritt 3", "Schritt 4"]
          },
          {
            "phaseName": "PHASE 3: SECURING",
            "items": ["Schritt 5"]
          }
        ]
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: promptText,
        config: { responseMimeType: "application/json" }
      });

      const rawJson = response.text ? response.text.replace(/```json/g, "").replace(/```/g, "").trim() : "{}";
      const data = JSON.parse(rawJson);

      if (!data.title || !data.phases) {
        throw new Error("Ungültiges Checklist-Format empfangen.");
      }

      // Map raw string list to interactive checklist structure
      const formattedChecklist: Checklist = {
        title: data.title,
        phases: data.phases.map((p: any, idxP: number) => ({
          id: `phase-${idxP}-${Date.now()}`,
          phaseName: p.phaseName,
          items: p.items.map((iString: string, idxI: number) => ({
            id: `item-${idxP}-${idxI}-${Date.now()}`,
            text: iString,
            checked: false
          }))
        }))
      };

      setChecklist(formattedChecklist);
      setIsSaved(false);
      setActiveItemIndex(null);
      playChime('generate');
      addLog('Cockpit-Checkliste erfolgreich initialisiert! Bereit für Takeoff.', 'success');

      // Offer reading out the first point immediately if co-pilot active
      if (isCoPilotReading) {
        setTimeout(() => speakActiveChecklistItem(0, 0, formattedChecklist), 1000);
      }
    } catch (e: any) {
      console.error("Checklist generator error:", e);
      addLog("Cockpit-Computerfehler bei Generierung: " + e.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleCheckItem = (phaseIdx: number, itemIdx: number) => {
    if (!checklist) return;

    const updatedPhases = [...checklist.phases];
    const prevChecked = updatedPhases[phaseIdx].items[itemIdx].checked;
    updatedPhases[phaseIdx].items[itemIdx].checked = !prevChecked;

    const updatedChecklist = { ...checklist, phases: updatedPhases };
    setChecklist(updatedChecklist);

    if (!prevChecked) {
      // Just ticked it on
      playChime('check');
      addLog(`Schritt bestätigt: ${updatedPhases[phaseIdx].items[itemIdx].text}`, 'info');

      // Check if EVERYTHING in the whole list is ticked!
      const allDone = updatedPhases.every(p => p.items.every(i => i.checked));
      if (allDone) {
        setTimeout(() => {
          playChime('complete');
          speakChecklistItem("Checkliste beendet. Alle Systeme bereit für den Abflug!");
          addLog("CHECKLISTE COMPLETED! Exzellente Arbeit, Kapitän.", "success");
        }, 500);
        return;
      }

      // Co-Pilot sequence: Automatically announce next step!
      if (isCoPilotReading) {
        const next = getNextUncheckedItem(phaseIdx, itemIdx, updatedChecklist);
        if (next) {
          setTimeout(() => {
            speakActiveChecklistItem(next.phaseIdx, next.itemIdx, updatedChecklist);
          }, 800);
        } else {
          setActiveItemIndex(null);
        }
      }
    }
  };

  // Co-Pilot trigger button
  const toggleCoPilotReaderHandler = () => {
    const nextVal = !isCoPilotReading;
    setIsCoPilotReading(nextVal);
    if (nextVal) {
      addLog("Co-Pilot Voice Readout aktiv. Copilot liest den aktiven Schritt.", "success");
      if (checklist) {
        // Find first unchecked item and read it
        const firstUnchecked = getNextUncheckedItem(0, 0, checklist);
        if (firstUnchecked) {
          speakActiveChecklistItem(firstUnchecked.phaseIdx, firstUnchecked.itemIdx, checklist);
        }
      }
    } else {
      stopSpeaking();
      setActiveItemIndex(null);
      addLog("Co-Pilot Voice Readout deaktiviert.", "info");
    }
  };

  // Manual list modifications
  const handleEditItemStart = (item: ChecklistItem) => {
    setEditingItemId(item.id);
    setEditingItemText(item.text);
  };

  const handleSaveEditedItem = (phaseIdx: number, itemIdx: number) => {
    if (!checklist || !editingItemText.trim()) return;
    const updatedPhases = [...checklist.phases];
    updatedPhases[phaseIdx].items[itemIdx].text = editingItemText;
    setChecklist({ ...checklist, phases: updatedPhases });
    setEditingItemId(null);
    addLog("Checklisten-Schritt angepasst", "info");
  };

  const handleDeleteItem = (phaseIdx: number, itemIdx: number) => {
    if (!checklist) return;
    const updatedPhases = [...checklist.phases];
    updatedPhases[phaseIdx].items.splice(itemIdx, 1);
    setChecklist({ ...checklist, phases: updatedPhases });
    addLog("Schritt gelöscht", "info");
  };

  const handleAddNewItem = (phaseIdx: number) => {
    if (!checklist) return;
    const updatedPhases = [...checklist.phases];
    updatedPhases[phaseIdx].items.push({
      id: `new-item-${Date.now()}`,
      text: "Neuer Cockpit-Schritt - GEPRÜFT",
      checked: false
    });
    setChecklist({ ...checklist, phases: updatedPhases });
    addLog("Schritt der Checkliste hinzugefügt", "success");
  };

  // Archive session
  const saveChecklistSession = () => {
    if (!checklist) return;
    
    // Construct rich summary
    const totalItems = checklist.phases.reduce((acc, p) => acc + p.items.length, 0);
    const checkedItems = checklist.phases.reduce((acc, p) => acc + p.items.filter(i => i.checked).length, 0);

    onSave({
      id: Date.now().toString(),
      timestamp: Date.now(),
      mode: AppMode.PLANNING,
      transcription: inputText,
      correctedText: `Checkliste: ${checklist.title}\nFortschritt: ${checkedItems}/${totalItems} erledigt.\n\n` + 
        checklist.phases.map(p => `[${p.phaseName}]\n` + p.items.map(i => `${i.checked ? '✓' : '✗'} ${i.text}`).join('\n')).join('\n\n'),
      title: `Planung: ${checklist.title}`
    });
    setIsSaved(true);
    addLog("Checkliste erfolgreich im Archiv abgelegt", "success");
  };

  // Copy to clipboard
  const copyChecklistToClipboard = () => {
    if (!checklist) return;
    const textFormat = `📋 ${checklist.title.toUpperCase()}\n\n` +
      checklist.phases.map(p => `✈️ ${p.phaseName}\n` + p.items.map(i => `${i.checked ? '[x]' : '[ ]'} ${i.text}`).join('\n')).join('\n\n');
    navigator.clipboard.writeText(textFormat);
    addLog("Copilot Checklist in Zwischenablage kopiert!", "success");
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 animate-pulse block mb-2">
            🚀 Pilot-CoPilot Deck
          </span>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none uppercase">
            Checkliste &amp; Planung
          </h2>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mt-1.5">
            Gliedere dein Vorhaben in hochgradig präzise Flieger-Schritte
          </p>
        </div>
      </div>

      {/* Main interactive cards split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left: Planning Entry */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                Schritt 1: Beschreibe dein Vorhaben
              </span>
              {isRecording && (
                <span className="text-[10px] font-black uppercase tracking-widest text-red-500 animate-ping">
                  ● LIVE
                </span>
              )}
            </div>

            {/* Micro input dictation waveform */}
            <AnimatePresence>
              {isRecording && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <span className="text-[10px] font-bold text-purple-700 uppercase tracking-widest">
                      {isPaused ? "Diktat pausiert" : "Sprechprobe aktiv..."}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-end gap-1 h-8 px-2">
                      {audioHistory.map((val, idx) => (
                        <motion.div
                          key={idx}
                          className={`w-1 rounded-full transition-all duration-75 ${
                            isPaused ? 'bg-amber-300' : 'bg-purple-500'
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
              placeholder="z.B.: Ich möchte ein anspruchsvolles Video über KI-Bildgeneratoren mit Midjourney auf YouTube machen und muss alle Schritte strukturieren, Skripte erstellen, testen, schneiden und hochladen..."
              className="w-full h-48 p-5 rounded-3xl bg-gray-50 border-none focus:ring-2 focus:ring-purple-500/20 transition-all resize-none text-sm font-medium text-gray-750 placeholder:text-gray-300"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-end gap-2">
              {isRecording && (
                <button 
                  onClick={togglePauseDictation}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all active:scale-90 ${
                    isPaused ? 'bg-purple-600 animate-bounce' : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                  title={isPaused ? "Diktat fortsetzen" : "Diktat pausieren"}
                >
                  <i className={`fas ${isPaused ? 'fa-microphone' : 'fa-pause'}`}></i>
                </button>
              )}
              
              <button 
                onClick={isRecording ? stopDictation : startDictation}
                className={`px-4 h-12 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-wider text-white shadow-lg transition-all active:scale-90 ${
                  isRecording ? 'bg-red-500' : 'bg-purple-650'
                }`}
              >
                <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
                {isRecording ? "Diktat stop" : "Sprechen"}
              </button>
            </div>

            <button
              onClick={generateChecklist}
              disabled={isGenerating || isRecording}
              className={`w-full py-5 rounded-3xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                isGenerating 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-purple-600 text-white shadow-xl shadow-purple-200 hover:bg-purple-700 active:scale-95'
              }`}
            >
              {isGenerating ? (
                <i className="fas fa-circle-notch animate-spin"></i>
              ) : (
                <i className="fas fa-plane-departure"></i>
              )}
              {isGenerating ? 'Strukturiere...' : 'Checkliste generieren'}
            </button>
          </div>
        </div>

        {/* Right: Checklist output */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-gray-100">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-450 flex items-center gap-1.5">
              <i className="fas fa-plane-arrival"></i> Pilot Screen
            </span>
            {checklist && (
              <div className="flex gap-2">
                {/* Audio Reader Mode */}
                <button
                  onClick={toggleCoPilotReaderHandler}
                  className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                    isCoPilotReading 
                      ? 'bg-amber-500 text-white shadow-md' 
                      : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                  }`}
                  title="Co-Pilot liest den nächsten anstehenden Punkt laut vor"
                >
                  <i className={`fas ${isCoPilotReading ? 'fa-volume-high' : 'fa-volume-xmark'}`}></i>
                  Co-Pilot Vorlesen
                </button>

                <button
                  onClick={copyChecklistToClipboard}
                  className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors"
                  title="Kopieren"
                >
                  <i className="fas fa-copy"></i>
                </button>
                <button
                  onClick={saveChecklistSession}
                  disabled={isSaved}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isSaved ? 'bg-green-500 text-white shadow-lg' : 'bg-slate-50 hover:bg-slate-100 text-slate-500'
                  }`}
                  title={isSaved ? "In Archiv abgelegt" : "Im Archiv ablegen"}
                >
                  <i className={`fas ${isSaved ? 'fa-check' : 'fa-save'}`}></i>
                </button>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {!checklist ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-96 flex flex-col items-center justify-center text-center p-8 text-gray-300"
              >
                <i className="fas fa-plane-slash text-5xl mb-4 opacity-40"></i>
                <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-1">Checklist offline</h4>
                <p className="text-[10px] max-w-xs font-bold uppercase tracking-wider">Erstelle links mithilfe deiner Stimme oder Notiz eine neue Sicherheitscheckliste.</p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Title */}
                <div className="bg-slate-55 flex justify-between items-center rounded-2xl bg-slate-50/40 p-4 border border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <span className="text-amber-500 hover:scale-110 cursor-pointer" onClick={() => playChime('complete')}>
                      <i className="fas fa-gauge-high text-lg"></i>
                    </span>
                    <h3 className="text-sm font-black uppercase text-slate-800 tracking-wide">
                      {checklist.title}
                    </h3>
                  </div>
                  <span className="text-[9px] font-black bg-indigo-50 border border-indigo-100 text-indigo-650 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Ready
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-gray-400">
                    <span>Missions-Fortschritt</span>
                    <span className="text-indigo-600 font-black">
                      {Math.round(
                        (checklist.phases.reduce((acc, p) => acc + p.items.filter(i => i.checked).length, 0) /
                         checklist.phases.reduce((acc, p) => acc + p.items.length, 0)) * 100
                      )}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <motion.div 
                      className="bg-indigo-600 h-full rounded-full"
                      animate={{
                        width: `${
                          (checklist.phases.reduce((acc, p) => acc + p.items.filter(i => i.checked).length, 0) /
                           checklist.phases.reduce((acc, p) => acc + p.items.length, 0)) * 100
                        }%`
                      }}
                    />
                  </div>
                </div>

                {/* Interactive checklist phases */}
                <div className="space-y-6 max-h-[28rem] overflow-y-auto pr-1">
                  {checklist.phases.map((phase, pIdx) => (
                    <div key={phase.id} className="space-y-3">
                      {/* Phase Name Header */}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100/50">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          ✈️ {phase.phaseName}
                        </span>
                        <button
                          onClick={() => handleAddNewItem(pIdx)}
                          className="text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:underline"
                          title="Füge dieser Phase einen Schritt hinzu"
                        >
                          + Schritt
                        </button>
                      </div>

                      <div className="space-y-2">
                        {phase.items.map((item, iIdx) => {
                          const isCurrentlyEdited = editingItemId === item.id;
                          const isCoPilotActiveNode = activeItemIndex && activeItemIndex.phaseIdx === pIdx && activeItemIndex.itemIdx === iIdx;

                          return (
                            <motion.div
                              key={item.id}
                              className={`group p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                                item.checked 
                                  ? 'bg-slate-50/50 border-gray-150/40 opacity-60' 
                                  : isCoPilotActiveNode
                                    ? 'bg-amber-50/50 border-amber-300 shadow-md ring-2 ring-amber-300/20'
                                    : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                {/* Checkbox button */}
                                <button
                                  onClick={() => handleToggleCheckItem(pIdx, iIdx)}
                                  className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                                    item.checked 
                                      ? 'bg-indigo-600 border-indigo-600 text-white' 
                                      : 'border-slate-300 group-hover:border-slate-400 hover:scale-105 bg-white'
                                  }`}
                                >
                                  {item.checked && (
                                    <i className="fas fa-check text-[10px]"></i>
                                  )}
                                </button>

                                {isCurrentlyEdited ? (
                                  <input
                                    type="text"
                                    value={editingItemText}
                                    onChange={(e) => setEditingItemText(e.target.value)}
                                    onBlur={() => handleSaveEditedItem(pIdx, iIdx)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEditedItem(pIdx, iIdx)}
                                    className="border-b border-indigo-400 focus:outline-none bg-transparent text-xs font-semibold text-slate-800 flex-1 py-0.5"
                                    autoFocus
                                  />
                                ) : (
                                  <span 
                                    className={`text-xs font-semibold transition-all select-none ${
                                      item.checked 
                                        ? 'line-through text-slate-400' 
                                        : 'text-slate-800'
                                    }`}
                                  >
                                    {item.text}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => speakChecklistItem(item.text)}
                                  className="w-7 h-7 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-600 flex items-center justify-center"
                                  title="Anhören"
                                >
                                  <i className="fas fa-volume-high text-[10px]"></i>
                                </button>
                                <button
                                  onClick={() => handleEditItemStart(item)}
                                  className="w-7 h-7 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 flex items-center justify-center"
                                  title="Bearbeiten"
                                >
                                  <i className="fas fa-edit text-[10px]"></i>
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(pIdx, iIdx)}
                                  className="w-7 h-7 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-red-500 flex items-center justify-center"
                                  title="Löschen"
                                >
                                  <i className="fas fa-trash-can text-[10px]"></i>
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
