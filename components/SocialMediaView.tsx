
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

import { AppMode, SessionResult } from '../types';

const SocialMediaView: React.FC<{ 
  addLog: (m: string, l?: any) => void,
  onSave: (s: SessionResult) => void 
}> = ({ addLog, onSave }) => {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [platform, setPlatform] = useState<'TikTok' | 'Instagram' | 'LinkedIn' | 'Twitter'>('TikTok');
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  useEffect(() => {
    const savedInput = localStorage.getItem('rhetorix_autosave_social_input');
    if (savedInput) setInput(savedInput);

    const savedResult = localStorage.getItem('rhetorix_autosave_social_result');
    if (savedResult) setResult(savedResult);

    const savedPlatform = localStorage.getItem('rhetorix_autosave_social_platform');
    if (savedPlatform) setPlatform(savedPlatform as any);
  }, []);

  useEffect(() => {
    if (input) {
      localStorage.setItem('rhetorix_autosave_social_input', input);
      setIsAutoSaving(true);
      const timer = setTimeout(() => setIsAutoSaving(false), 800);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('rhetorix_autosave_social_input');
    }
  }, [input]);

  useEffect(() => {
    if (result) {
      localStorage.setItem('rhetorix_autosave_social_result', result);
    } else {
      localStorage.removeItem('rhetorix_autosave_social_result');
    }
  }, [result]);

  useEffect(() => {
    localStorage.setItem('rhetorix_autosave_social_platform', platform);
  }, [platform]);

  const generateContent = async () => {
    if (!input || isGenerating) return;
    setIsGenerating(true);
    addLog(`Generiere Social Media Content für ${platform}...`, "info");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Erstelle viralen Social Media Content für ${platform} basierend auf dieser Idee: "${input}".
        
        Erstelle:
        1. Einen packenden Hook (Einstieg).
        2. Das Skript oder den Textkörper.
        3. 5 relevante Hashtags.
        4. Eine Idee für das visuelle Element (Video/Bild).
        
        Antworte in strukturiertem Markdown auf DEUTSCH.`
      });

      if (response.text) {
        setResult(response.text);
        addLog("Content erfolgreich generiert!", "success");
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
              <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tighter italic">Social Media Studio</h2>
              {isAutoSaving && (
                <span className="text-[9px] text-emerald-500 font-bold tracking-widest flex items-center gap-1 normal-case font-mono animate-pulse">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
                  gespeichert
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">Viral-Hook & Content Generator</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 flex items-center justify-center shadow-inner">
            <i className="fas fa-hashtag text-xl"></i>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {['TikTok', 'Instagram', 'LinkedIn', 'Twitter'].map(p => (
            <button 
              key={p}
              onClick={() => setPlatform(p as any)}
              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all border whitespace-nowrap ${platform === p ? 'bg-pink-600 border-pink-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-800 border-transparent text-gray-400'}`}
            >
              {p}
            </button>
          ))}
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Beschreibe deine Idee oder kopiere einen Text hierher..."
          className="w-full h-40 bg-gray-50 dark:bg-gray-950 border border-transparent rounded-[2rem] p-6 text-sm font-medium focus:bg-white dark:focus:bg-gray-900 focus:ring-4 focus:ring-pink-50 dark:focus:ring-pink-900/20 outline-none transition-all resize-none shadow-inner text-gray-800 dark:text-pink-400 placeholder:text-gray-400 dark:placeholder:text-gray-700 mb-6"
        />

        <button
          onClick={generateContent}
          disabled={isGenerating || !input}
          className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${isGenerating ? 'bg-gray-400 text-white' : 'bg-pink-600 text-white hover:bg-pink-700'}`}
        >
          {isGenerating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-bolt"></i>}
          {isGenerating ? 'GENERIERE...' : 'VIRAL CONTENT ERSTELLEN'}
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
                    mode: AppMode.SOCIAL_MEDIA,
                    title: `Social Media: ${platform} - ${input.slice(0, 20)}...`,
                    transcription: input,
                    correctedText: result
                  });
                }}
                className="bg-pink-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
              >
                <i className="fas fa-archive"></i> Archiv
              </button>
              <button 
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: 'Rhetorix Pro Social Media Content',
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

export default SocialMediaView;
