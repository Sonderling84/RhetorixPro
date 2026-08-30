
import React, { useState, useEffect } from 'react';
import { getGeminiAI } from '../utils/gemini-client';
import { AppMode, SessionResult } from '../types';

interface TemplatesViewProps {
  onSave: (session: SessionResult) => void;
  addLog: (m: string, l?: any) => void;
}

const TemplatesView: React.FC<TemplatesViewProps> = ({ onSave, addLog }) => {
  const [topic, setTopic] = useState('');
  const [type, setType] = useState<'YouTube' | 'TikTok' | 'Instagram' | 'Facebook'>('YouTube');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  useEffect(() => {
    const savedTopic = localStorage.getItem('rhetorix_autosave_templates_topic');
    if (savedTopic) setTopic(savedTopic);

    const savedType = localStorage.getItem('rhetorix_autosave_templates_type');
    if (savedType) setType(savedType as any);

    const savedResult = localStorage.getItem('rhetorix_autosave_templates_result');
    if (savedResult) setResult(savedResult);
  }, []);

  useEffect(() => {
    if (topic) {
      localStorage.setItem('rhetorix_autosave_templates_topic', topic);
      setIsAutoSaving(true);
      const timer = setTimeout(() => setIsAutoSaving(false), 800);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('rhetorix_autosave_templates_topic');
    }
  }, [topic]);

  useEffect(() => {
    localStorage.setItem('rhetorix_autosave_templates_type', type);
  }, [type]);

  useEffect(() => {
    if (result) {
      localStorage.setItem('rhetorix_autosave_templates_result', result);
    } else {
      localStorage.removeItem('rhetorix_autosave_templates_result');
    }
  }, [result]);

  const generateTemplate = async () => {
    if (!topic) return;
    setIsGenerating(true);
    addLog(`Generiere ${type} Skript für: "${topic}"...`);

    try {
      const ai = await getGeminiAI();
      const prompt = `Erstelle ein professionelles ${type}-Skript/Beschreibung für das Thema: "${topic}". 
      Inklusive Struktur, Hooks, Call-to-Action und passenden Emojis. 
      Fokussiere dich auf hohe Engagement-Raten und klaren Mehrwert.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt
      });

      setResult(response.text || '');
      addLog("Skript erfolgreich erstellt.", "success");
    } catch (err: any) {
      addLog("Fehler: " + err.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveToLibrary = () => {
    onSave({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      mode: AppMode.TEMPLATES,
      transcription: `Template für ${type}: ${topic}`,
      correctedText: result,
      title: `${type} Skript: ${topic.substring(0, 15)}...`
    });
    setResult('');
    setTopic('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">Content Vorlagen</h2>
          {isAutoSaving && (
            <span className="text-[9px] text-emerald-500 font-bold tracking-widest flex items-center gap-1 normal-case font-mono animate-pulse">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
              gespeichert
            </span>
          )}
        </div>
        
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          {['YouTube', 'TikTok', 'Instagram', 'Facebook'].map(t => (
            <button 
              key={t}
              onClick={() => setType(t as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${type === t ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={`Worum geht es in deinem ${type} Video?`}
          className="w-full h-24 bg-gray-50 border border-transparent rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-100 focus:bg-white outline-none transition-all resize-none mb-4"
        />

        <button
          onClick={generateTemplate}
          disabled={isGenerating || !topic}
          className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${isGenerating ? 'bg-gray-400' : 'bg-blue-600'}`}
        >
          {isGenerating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
          Skript generieren
        </button>
      </div>

      {result && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-800 text-sm">Vorschau: {type}-Post</h3>
            <button onClick={saveToLibrary} className="text-blue-600 text-xs font-bold">SPEICHERN</button>
          </div>
          <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap bg-gray-50 p-4 rounded-2xl max-h-96 overflow-y-auto font-serif">
            {result}
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesView;
