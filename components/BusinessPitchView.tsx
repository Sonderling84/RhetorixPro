
import React, { useState, useEffect } from 'react';
import { getGeminiAI } from '../utils/gemini-client';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

import { AppMode, SessionResult } from '../types';

const BusinessPitchView: React.FC<{ 
  addLog: (m: string, l?: any) => void,
  onSave: (s: SessionResult) => void 
}> = ({ addLog, onSave }) => {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState<'Pitch Deck' | 'SWOT' | 'Outreach' | 'Business Check'>('Business Check');
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  useEffect(() => {
    const savedInput = localStorage.getItem('rhetorix_autosave_pitch_input');
    if (savedInput) setInput(savedInput);

    const savedResult = localStorage.getItem('rhetorix_autosave_pitch_result');
    if (savedResult) setResult(savedResult);

    const savedMode = localStorage.getItem('rhetorix_autosave_pitch_mode');
    if (savedMode) setMode(savedMode as any);
  }, []);

  useEffect(() => {
    if (input) {
      localStorage.setItem('rhetorix_autosave_pitch_input', input);
      setIsAutoSaving(true);
      const timer = setTimeout(() => setIsAutoSaving(false), 800);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('rhetorix_autosave_pitch_input');
    }
  }, [input]);

  useEffect(() => {
    if (result) {
      localStorage.setItem('rhetorix_autosave_pitch_result', result);
    } else {
      localStorage.removeItem('rhetorix_autosave_pitch_result');
    }
  }, [result]);

  useEffect(() => {
    localStorage.setItem('rhetorix_autosave_pitch_mode', mode);
  }, [mode]);

  const generateContent = async () => {
    if (!input || isGenerating) return;
    setIsGenerating(true);
    addLog(`Generiere ${mode} Analyse...`, "info");

    try {
      const ai = await getGeminiAI();
      
      let systemPrompt = "";
      let tools: any[] = [];

      if (mode === 'Business Check') {
        tools = [{ googleSearch: {} }];
        systemPrompt = `Du bist ein erfahrener Venture Capital Analyst und Unternehmensberater. 
        Analysiere die folgende Geschäftsidee extrem tiefgehend und fundiert.
        
        DEINE AUFGABE:
        1. MARKT-ANALYSE: Nutze Google Search für aktuelle Trends, Wettbewerber und Marktgrößen (TAM, SAM, SOM).
        2. FINANZ-MODELL (RECHNUNGEN): Erstelle eine fundierte Schätzung für:
           - Customer Acquisition Cost (CAC) vs. Lifetime Value (LTV).
           - Break-Even-Point Analyse (ab wann ist das Business profitabel?).
           - Umsatzprognose für Jahr 1-3 basierend auf realistischen Annahmen.
           - Benötigtes Startkapital (Burn Rate, Runway).
        3. RISIKO-CHECK: Identifiziere die 3 größten "Kill-Faktoren" und wie man sie umgeht.
        4. SKALIERBARKEIT: Wie gut lässt sich das Modell vervielfältigen?
        
        WICHTIG: Sei kritisch, ehrlich und nutze echte Zahlen/Daten wo möglich. Keine vagen Floskeln.
        
        IDEE: "${input}"
        
        Antworte in strukturiertem Markdown auf DEUTSCH mit klaren Überschriften und Tabellen für die Rechnungen.`;
      } else {
        systemPrompt = `Erstelle eine professionelle Business-Analyse im Modus "${mode}" basierend auf dieser Idee: "${input}".
        
        Falls Pitch Deck: Erstelle eine 10-Folien-Struktur.
        Falls SWOT: Erstelle eine detaillierte Stärken, Schwächen, Chancen, Risiken Analyse.
        Falls Outreach: Erstelle 3 personalisierte E-Mail/LinkedIn Vorlagen.
        
        Antworte in strukturiertem Markdown auf DEUTSCH.`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: systemPrompt,
        config: {
          tools: tools
        }
      });

      if (response.text) {
        setResult(response.text);
        addLog("Analyse erfolgreich erstellt!", "success");
      }
    } catch (err: any) {
      addLog("Fehler: " + err.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tighter italic">Business & Pitch Studio</h2>
              {isAutoSaving && (
                <span className="text-[9px] text-emerald-500 font-bold tracking-widest flex items-center gap-1 normal-case font-mono animate-pulse">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
                  gespeichert
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">Investoren-Präsentation & SWOT</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
            <i className="fas fa-briefcase text-xl"></i>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {['Business Check', 'Pitch Deck', 'SWOT', 'Outreach'].map(m => (
            <button 
              key={m}
              onClick={() => setMode(m as any)}
              className={`flex-1 min-w-[120px] py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${mode === m ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-800 border-transparent text-gray-400'}`}
            >
              {m}
            </button>
          ))}
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Beschreibe dein Business-Modell oder deine Idee..."
          className="w-full h-40 bg-gray-50 dark:bg-gray-950 border border-transparent rounded-[2rem] p-6 text-sm font-medium focus:bg-white dark:focus:bg-gray-900 focus:ring-4 focus:ring-emerald-50 dark:focus:ring-emerald-900/20 outline-none transition-all resize-none shadow-inner text-gray-800 dark:text-emerald-400 placeholder:text-gray-400 dark:placeholder:text-gray-700 mb-6"
        />

        <button
          onClick={generateContent}
          disabled={isGenerating || !input}
          className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${isGenerating ? 'bg-gray-400 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
        >
          {isGenerating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-chart-line"></i>}
          {isGenerating ? 'ANALYSIERE...' : 'BUSINESS ANALYSE ERSTELLEN'}
        </button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-2xl"
          >
            <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(result);
                  addLog("In Zwischenablage kopiert!", "success");
                }}
                className="bg-gray-900 dark:bg-black text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
              >
                <i className="fas fa-copy"></i> Kopieren
              </button>
              <button 
                onClick={() => {
                  onSave({
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    mode: AppMode.BUSINESS_PITCH,
                    title: `Business: ${mode} - ${input.slice(0, 20)}...`,
                    transcription: input,
                    correctedText: result
                  });
                }}
                className="bg-emerald-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
              >
                <i className="fas fa-archive"></i> Archiv
              </button>
              <button 
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: 'Rhetorix Pro Business Analysis',
                      text: result,
                    }).catch(() => {
                      addLog("Teilen fehlgeschlagen", "error");
                    });
                  } else {
                    navigator.clipboard.writeText(result);
                    addLog("Teilen nicht unterstützt, in Zwischenablage kopiert", "info");
                  }
                }}
                className="bg-blue-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
              >
                <i className="fas fa-share-alt"></i> Teilen
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BusinessPitchView;
