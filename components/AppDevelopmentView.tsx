
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { AppMode, SessionResult } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface AppDevelopmentViewProps {
  onSave: (session: SessionResult) => void;
  addLog: (message: string, level?: 'info' | 'error' | 'success') => void;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const AppDevelopmentView: React.FC<AppDevelopmentViewProps> = ({ onSave, addLog }) => {
  const [brainstormText, setBrainstormText] = useState('');
  const [sketch, setSketch] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [masterPrompt, setMasterPrompt] = useState<string | null>(null);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [promptConfig, setPromptConfig] = useState({
    platform: 'Mobile',
    tool: 'Google AI Studio'
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const startVoiceInput = async () => {
    try {
      setIsRecording(true);
      addLog("Brainstorming-Modus aktiv. Sprich frei über deine App-Idee...", "info");
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.0-flash-exp',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "Du bist ein erfahrener App-Entwickler. Transkribiere die Ideen des Nutzers exakt auf DEUTSCH. Hilf ihm, seine Vision zu artikulieren.",
          inputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (msg: LiveServerMessage) => {
            if (msg.serverContent?.inputTranscription) {
              const text = msg.serverContent.inputTranscription.text;
              setBrainstormText(prev => prev + (prev ? " " : "") + text);
            }
          },
          onerror: () => stopVoiceInput(),
          onclose: () => setIsRecording(false)
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
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    addLog("Brainstorming beendet.");
  };

  const generateSketch = async () => {
    if (!brainstormText || isGenerating) return;
    setIsGenerating(true);
    addLog("Analysiere App-Idee und erstelle Skizze...", "info");
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Analysiere folgendes Brainstorming für eine App-Idee und erstelle eine umfassende Skizze. 
        
        Die Antwort MUSS folgende Abschnitte enthalten:
        
        1. **Konzept-Skizze**:
           - Name der App (Kreativer Vorschlag)
           - Kern-Problem & Lösung
           - Hauptfunktionen (Features)
           - Zielgruppe
        
        2. **Machbarkeits-Check & Analyse**:
           - Wie realistisch ist die Umsetzung?
           - Mögliche technische Hürden oder Herausforderungen.
           - Falls es NICHT umsetzbar ist, erkläre warum und schlage eine bessere Alternative vor.
        
        3. **KI-Vorschläge & Anregungen**:
           - Ideen für zusätzliche Features, die die App besser machen könnten.
           - Vorschläge zur Optimierung des Konzepts.
        
        4. **Rückfragen für dich**:
           - Stelle 2-3 gezielte Fragen an den Nutzer, um das Konzept weiter zu schärfen.
        
        Brainstorming: "${brainstormText}"
        
        Antworte in professionellem, strukturiertem Markdown auf DEUTSCH.`
      });

      if (response.text) {
        setSketch(response.text);
        setChatHistory([{ role: 'model', text: response.text }]);
        addLog("App-Analyse erfolgreich erstellt!", "success");
      }
    } catch (err: any) {
      addLog("Fehler bei der Generierung: " + err.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const sendMessage = async () => {
    if (!userInput.trim() || isChatting) return;
    
    const userMsg = userInput.trim();
    setUserInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatting(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // We use a simple chat logic here, passing the history
      const history = chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      const chat = ai.chats.create({
        model: 'gemini-2.0-flash',
        config: {
          systemInstruction: "Du bist ein erfahrener App-Consultant. Hilf dem Nutzer, seine App-Idee zu verfeinern. Beantworte Fragen, gib Anregungen und prüfe die Machbarkeit. Bleib konstruktiv und professionell auf DEUTSCH.",
        },
        history: history
      });

      const response = await chat.sendMessage({ message: userMsg });
      if (response.text) {
        setChatHistory(prev => [...prev, { role: 'model', text: response.text }]);
      }
    } catch (err: any) {
      addLog("Fehler beim Chatten: " + err.message, "error");
    } finally {
      setIsChatting(false);
    }
  };

  const generateMasterPrompt = async () => {
    setIsGeneratingPrompt(true);
    addLog(`Erstelle Master-Prompt für ${promptConfig.tool} (${promptConfig.platform})...`, "info");
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Basierend auf der folgenden App-Analyse und dem Beratungsgespräch, erstelle einen hochoptimierten "Master Prompt". 
        Dieser Prompt soll dazu dienen, eine andere KI (oder Google AI Studio) anzuweisen, diese App tatsächlich zu bauen oder einen funktionsfähigen Prototyp zu erstellen.
        
        ZIEL-PLATTFORM: ${promptConfig.platform}
        ZIEL-TOOL/KI: ${promptConfig.tool}
        
        KONZEPT & DIALOG:
        ${chatHistory.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n\n')}
        
        Der Master Prompt muss:
        1. Alle technischen Anforderungen klar definieren.
        2. Den gewünschten Tech-Stack (passend für ${promptConfig.platform}) vorgeben.
        3. UI/UX Anweisungen enthalten.
        4. Schritt-für-Schritt Anweisungen für die Ziel-KI geben.
        
        Antworte NUR mit dem fertigen Prompt in einem Code-Block, damit er leicht kopiert werden kann. Füge davor eine kurze Erklärung auf DEUTSCH ein.`
      });

      if (response.text) {
        setMasterPrompt(response.text);
        addLog("Master-Prompt erfolgreich generiert!", "success");
      }
    } catch (err: any) {
      addLog("Fehler bei Prompt-Generierung: " + err.message, "error");
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleSave = () => {
    if (!sketch) return;
    const session: SessionResult = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      mode: AppMode.APP_DEV,
      transcription: brainstormText,
      correctedText: chatHistory.map(m => `${m.role === 'user' ? 'Nutzer' : 'KI'}: ${m.text}`).join('\n\n') + 
        (masterPrompt ? `\n\n--- MASTER PROMPT ---\n\n${masterPrompt}` : ''),
      title: "App Skizze: " + (sketch.split('\n')[0].replace('#', '').replace(/\*/g, '').trim() || "Unbenannt")
    };
    onSave(session);
  };

  const handleShare = async () => {
    const fullText = chatHistory.map(m => `${m.role === 'user' ? 'Nutzer' : 'KI'}: ${m.text}`).join('\n\n') + 
      (masterPrompt ? `\n\n--- MASTER PROMPT ---\n\n${masterPrompt}` : '');
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Meine App Idee & Analyse',
          text: fullText,
        });
      } catch (err) {
        addLog("Teilen fehlgeschlagen", "error");
      }
    } else {
      navigator.clipboard.writeText(fullText);
      addLog("In Zwischenablage kopiert!", "success");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tighter italic">App Entwicklung</h2>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">Vom Brainstorming zur Skizze</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
            <i className="fas fa-code text-xl"></i>
          </div>
        </div>

        <div className="relative mb-6">
          <textarea
            value={brainstormText}
            onChange={(e) => setBrainstormText(e.target.value)}
            placeholder="Beschreibe deine App-Idee... (Diktieren oder Tippen)"
            className="w-full h-48 bg-gray-50 dark:bg-gray-950 border border-transparent rounded-[2rem] p-6 text-sm font-medium focus:bg-white dark:focus:bg-gray-900 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/20 outline-none transition-all resize-none shadow-inner text-gray-800 dark:text-indigo-400 placeholder:text-gray-400 dark:placeholder:text-gray-700"
          />
          <button
            onClick={isRecording ? stopVoiceInput : startVoiceInput}
            className={`absolute bottom-4 right-4 w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-lg active:scale-90 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-gray-700'}`}
          >
            <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
          </button>
        </div>

        <button
          onClick={generateSketch}
          disabled={isGenerating || !brainstormText}
          className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${isGenerating ? 'bg-gray-400 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
        >
          {isGenerating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
          {isGenerating ? 'ANALYSYIERE...' : 'SKIZZE & ANALYSE ERSTELLEN'}
        </button>
      </div>

      <AnimatePresence>
        {sketch && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-2xl space-y-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <i className="fas fa-robot"></i>
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-800 dark:text-gray-100">KI-Berater & Analyse</h3>
            </div>

            <div 
              ref={scrollRef}
              className="max-h-[600px] overflow-y-auto space-y-6 pr-2 scrollbar-thin scrollbar-thumb-indigo-100 dark:scrollbar-thumb-indigo-900"
            >
              {chatHistory.map((msg, i) => (
                <div 
                  key={i} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[90%] p-6 rounded-[2rem] ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-100 dark:border-gray-800'
                  }`}>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {isChatting && (
                <div className="flex justify-start">
                  <div className="bg-gray-50 dark:bg-gray-950 p-6 rounded-[2rem] rounded-tl-none border border-gray-100 dark:border-gray-800">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-100"></div>
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-2 pt-4">
              <input 
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Beantworte die Fragen oder stelle eigene..."
                className="flex-1 bg-gray-50 dark:bg-gray-950 border border-transparent rounded-2xl px-6 py-4 text-sm focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/20 outline-none dark:text-white"
              />
              <button 
                onClick={sendMessage}
                disabled={!userInput.trim() || isChatting}
                className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 disabled:opacity-50"
              >
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-100 dark:border-gray-800">
              <button 
                onClick={handleSave}
                className="bg-gray-900 dark:bg-black text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
              >
                <i className="fas fa-save"></i> Speichern
              </button>
              <button 
                onClick={handleShare}
                className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-center gap-2"
              >
                <i className="fas fa-share-alt"></i> Teilen
              </button>
            </div>

            {/* Prompt Generator Section */}
            <div className="pt-8 mt-8 border-t-2 border-dashed border-indigo-100 dark:border-indigo-900/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <i className="fas fa-terminal"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-800 dark:text-gray-100">Master-Prompt Generator</h3>
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase mt-0.5">Erstelle die perfekte Anweisung für den Bau</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block">Ziel-Plattform</label>
                  <div className="flex gap-2">
                    {['Mobile App', 'Web App', 'Desktop PC'].map(p => (
                      <button 
                        key={p}
                        onClick={() => setPromptConfig({...promptConfig, platform: p})}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${promptConfig.platform === p ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-800 border-transparent text-gray-400'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block">KI-Werkzeug</label>
                  <div className="flex gap-2">
                    {['Google AI Studio', 'Claude', 'ChatGPT', 'V0.dev'].map(t => (
                      <button 
                        key={t}
                        onClick={() => setPromptConfig({...promptConfig, tool: t})}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${promptConfig.tool === t ? 'bg-orange-600 border-orange-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-800 border-transparent text-gray-400'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {!masterPrompt ? (
                <button 
                  onClick={generateMasterPrompt}
                  disabled={isGeneratingPrompt}
                  className="w-full py-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  {isGeneratingPrompt ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
                  {isGeneratingPrompt ? 'GENERIERE PROMPT...' : 'MASTER-PROMPT ERSTELLEN'}
                </button>
              ) : (
                <div className="space-y-4 animate-in zoom-in-95">
                  <div className="bg-gray-50 dark:bg-black p-6 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/30">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{masterPrompt}</ReactMarkdown>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        const codeMatch = masterPrompt.match(/```[\s\S]*?```/);
                        const toCopy = codeMatch ? codeMatch[0].replace(/```\w*\n|```/g, '') : masterPrompt;
                        navigator.clipboard.writeText(toCopy);
                        addLog("Prompt in Zwischenablage kopiert!", "success");
                      }}
                      className="flex-1 py-4 bg-gray-900 dark:bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-copy"></i> Prompt Kopieren
                    </button>
                    <button 
                      onClick={() => setMasterPrompt(null)}
                      className="w-14 h-14 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                    >
                      <i className="fas fa-redo"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AppDevelopmentView;

