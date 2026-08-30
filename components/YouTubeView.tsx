import React, { useState, useEffect } from 'react';
import { getGeminiAI } from '../utils/gemini-client';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { AppMode, SessionResult } from '../types';

interface YouTubeViewProps {
  onSave: (session: SessionResult) => void;
  addLog: (m: string, l?: any) => void;
}

type ScriptFormat = 'FULL_SCRIPT' | 'SHORT' | 'SEO_METADATA';

const YouTubeView: React.FC<YouTubeViewProps> = ({ onSave, addLog }) => {
  const [topic, setTopic] = useState('');
  const [format, setFormat] = useState<ScriptFormat>('FULL_SCRIPT');
  const [tone, setTone] = useState('Professionell & Informativ');
  const [length, setLength] = useState('5–10 Minuten');
  const [keywords, setKeywords] = useState('');
  const [customRequest, setCustomRequest] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [scriptText, setScriptText] = useState<string | null>(null);
  
  // Script adjustment/rewrite states
  const [adjustmentPrompt, setAdjustmentPrompt] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Restore draft on mount
  useEffect(() => {
    const savedTopic = localStorage.getItem('rhetorix_autosave_youtube_topic');
    if (savedTopic) setTopic(savedTopic);

    const savedFormat = localStorage.getItem('rhetorix_autosave_youtube_format');
    if (savedFormat) setFormat(savedFormat as ScriptFormat);

    const savedTone = localStorage.getItem('rhetorix_autosave_youtube_tone');
    if (savedTone) setTone(savedTone);

    const savedLength = localStorage.getItem('rhetorix_autosave_youtube_length');
    if (savedLength) setLength(savedLength);

    const savedKeywords = localStorage.getItem('rhetorix_autosave_youtube_keywords');
    if (savedKeywords) setKeywords(savedKeywords);

    const savedReq = localStorage.getItem('rhetorix_autosave_youtube_req');
    if (savedReq) setCustomRequest(savedReq);

    const savedScript = localStorage.getItem('rhetorix_autosave_youtube_script');
    if (savedScript) setScriptText(savedScript);
  }, []);

  // Save changes automatically
  useEffect(() => {
    if (topic) {
      localStorage.setItem('rhetorix_autosave_youtube_topic', topic);
      setIsAutoSaving(true);
      const timer = setTimeout(() => setIsAutoSaving(false), 800);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('rhetorix_autosave_youtube_topic');
    }
  }, [topic]);

  useEffect(() => {
    localStorage.setItem('rhetorix_autosave_youtube_format', format);
  }, [format]);

  useEffect(() => {
    localStorage.setItem('rhetorix_autosave_youtube_tone', tone);
  }, [tone]);

  useEffect(() => {
    localStorage.setItem('rhetorix_autosave_youtube_length', length);
  }, [length]);

  useEffect(() => {
    if (keywords) {
      localStorage.setItem('rhetorix_autosave_youtube_keywords', keywords);
      setIsAutoSaving(true);
      const timer = setTimeout(() => setIsAutoSaving(false), 800);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('rhetorix_autosave_youtube_keywords');
    }
  }, [keywords]);

  useEffect(() => {
    if (customRequest) {
      localStorage.setItem('rhetorix_autosave_youtube_req', customRequest);
      setIsAutoSaving(true);
      const timer = setTimeout(() => setIsAutoSaving(false), 800);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('rhetorix_autosave_youtube_req');
    }
  }, [customRequest]);

  useEffect(() => {
    if (scriptText) {
      localStorage.setItem('rhetorix_autosave_youtube_script', scriptText);
    } else {
      localStorage.removeItem('rhetorix_autosave_youtube_script');
    }
  }, [scriptText]);

  const generateScript = async () => {
    if (!topic.trim() || isGenerating) return;
    setIsGenerating(true);
    setScriptText(null);
    addLog(`Generiere YouTube-Inhalt (${format}) für das Thema "${topic}"...`, "info");

    try {
      const ai = await getGeminiAI();

      let formatInst = '';
      if (format === 'FULL_SCRIPT') {
        formatInst = `Erstelle ein KOMPLETTES, detailliertes Videoskript. Strukturiere es in diese distinkten Bereiche:
        1. **HOOK & INTRO (Erste 15-30 Sekunden)**: Extrem fesselnd, weckt sofort Neugier und formuliert das zentrale Versprechen des Videos.
        2. **HAUPTTEIL (Länge: ca. ${length})**: Strukturiert in 3-4 logische Abschnitte/Kapitel. Füge Regie-Anweisungen (Visuals, Soundeffekte, B-Roll-Ideen) in Klammern [wie hier] ein.
        3. **OUTRO & CALL TO ACTION (CTA)**: Starker Abschluss, animiert zum Abonnieren, Liken, Kommentieren und schlägt vor, welches Video als nächstes geschaut werden soll (YouTube Loop).`;
      } else if (format === 'SHORT') {
        formatInst = `Erstelle ein hochoptimiertes Kurzvideo-Skript (Shorts / Reels / TikTok) unter 60 Sekunden.
        * Das Skript muss in unter 50 Sekunden geredet werden können.
        * Starte mit einem sofortigen 'Scroll-Stopper' Hook.
        * Vermittle den Kerninhalt extrem schnell und auf den Punkt.
        * Beende mit einer schnellen, klaren CTA.
        * Füge visuelle Anweisungen und Sound-Hinweise in eckigen Klammern [z.B. Text blendet ein] hinzu.`;
      } else {
        formatInst = `Erstelle eine umfassende SEO- & Medien-Optimierung für das Video. Stelle folgende Elemente bereit:
        1. **3 Video-Titel-Varianten**: Einmal klickstark (Neugier-Hook), einmal Suchmaschinen-optimiert (SEO), einmal extrem polarisierend.
        2. **Video-Beschreibung (Description)**: Inklusive eines Hooks in den ersten beiden Zeilen, einer strukturierten Zusammenfassung und Platzhaltern für Social-Links.
        3. **SEO Tag-Liste & Suchbegriffe**: Mindestens 15 relevante Keywords, kommagetrennt.
        4. **AI-Thumbnail Prompt**: Ein extrem detaillierter Prompt für einen Bildgenerator (z.B. Imagen 3) zur Erstellung des perfekten, klickstarken Thumbnails.`;
      }

      const prompt = `Du bist ein erfahrener YouTube-Producer, Scriptwriter und SEO-Experte mit Millionen von Abonnenten. 
      Deine Aufgabe ist es, einen überzeugenden Inhalt zum Thema "${topic}" zu verfassen.

      Hier sind die Spezifikationen:
      * **Format**: ${formatInst}
      * **Tonfall**: ${tone}
      * **Zielgruppe**: Enthusiasten, die Mehrwert, Unterhaltung und präzise Informationen suchen.
      ${keywords.trim() ? `* **Einzubindende Suchbegriffe/Keywords**: ${keywords}` : ''}
      ${customRequest.trim() ? `* **Zusatzwünsche des Creators**: ${customRequest}` : ''}

      Schreibe das Skript auf DEUTSCH, formatiert in ansprechendem, klarem Markdown mit Überschriften, Aufzählungspunkten und fetten Texten zur besseren Lesbarkeit.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt
      });

      if (response.text) {
        setScriptText(response.text);
        addLog("YouTube Skript erfolgreich generiert!", "success");
      } else {
        throw new Error("Keine Antwort von der KI erhalten.");
      }
    } catch (err: any) {
      addLog("Generierungsfehler: " + err.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const adjustScript = async () => {
    if (!scriptText || !adjustmentPrompt.trim() || isAdjusting) return;
    setIsAdjusting(true);
    addLog("Passe Skript basierend auf deinem Feedback an...", "info");

    try {
      const ai = await getGeminiAI();
      const prompt = `Du bist ein professioneller YouTube Script-Doktor. Hier ist das aktuelle Skript für ein Video:

      ---
      ${scriptText}
      ---

      Der Creator wünscht folgende Überarbeitung/Verfeinerung:
      "${adjustmentPrompt}"

      Bitte passe das Skript entsprechend an. Behalte die hohe Qualität, Formatierung (Markdown) und Struktur bei. Gib das vollständig angepasste neue Skript zurück.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt
      });

      if (response.text) {
        setScriptText(response.text);
        setAdjustmentPrompt('');
        addLog("Skript erfolgreich angepasst!", "success");
      } else {
        throw new Error("Keine Antwort von der KI erhalten.");
      }
    } catch (err: any) {
      addLog("Fehler beim Anpassen: " + err.message, "error");
    } finally {
      setIsAdjusting(false);
    }
  };

  const saveToLibrary = () => {
    if (!scriptText) return;
    
    const formattedMeta = `Thema: ${topic}\nFormat: ${format === 'FULL_SCRIPT' ? 'Komplettes Skript' : format === 'SHORT' ? 'Short/Reel' : 'SEO & Thumbnail'}\nLänge: ${length}\nTon: ${tone}`;
    
    onSave({
      id: Math.random().toString(36).substring(2, 11),
      timestamp: Date.now(),
      mode: AppMode.YOUTUBE,
      title: `YouTube: ${topic.length > 25 ? topic.substring(0, 25) + '...' : topic}`,
      transcription: formattedMeta,
      correctedText: scriptText
    });
  };

  const copyToClipboard = () => {
    if (!scriptText) return;
    navigator.clipboard.writeText(scriptText);
    addLog("In Zwischenablage kopiert!", "success");
  };

  const shareContent = () => {
    if (!scriptText) return;
    if (navigator.share) {
      navigator.share({
        title: `YouTube Skript: ${topic}`,
        text: scriptText
      }).catch(() => {});
    } else {
      copyToClipboard();
      addLog("Teilen nicht unterstützt. In Zwischenablage kopiert!", "info");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Title block */}
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tighter italic flex items-center gap-3">
                <i className="fab fa-youtube text-red-600 text-3xl"></i>
                YouTube Studio
              </h2>
              {isAutoSaving && (
                <span className="text-[9px] text-emerald-500 font-bold tracking-widest flex items-center gap-1 normal-case font-mono animate-pulse mt-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
                  gespeichert
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest mt-1">Strukturierte Video-Skripte & SEO Optimierungen</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 flex items-center justify-center shadow-inner">
            <i className="fas fa-video text-xl"></i>
          </div>
        </div>
      </div>

      {/* Editor & Parameters panel */}
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl space-y-6">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">1. Video Thema oder Idee *</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Worum soll es im Video gehen? z.B. 'Sixt Autovermietung Verhandlungstipps', 'Die Kunst der Schlagfertigkeit' oder 'SEO Grundlagen einfach erklärt'..."
            className="w-full h-32 bg-gray-50 dark:bg-gray-950 border border-transparent rounded-2xl p-5 text-sm font-medium focus:bg-white dark:focus:bg-gray-900 focus:ring-4 focus:ring-red-100 dark:focus:ring-red-900/25 outline-none transition-all resize-none shadow-inner text-gray-800 dark:text-red-400 placeholder:text-gray-400"
          />
        </div>

        {/* Format Selector */}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">2. Inhaltsformat</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(['FULL_SCRIPT', 'SHORT', 'SEO_METADATA'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`py-3 px-4 rounded-xl text-[10px] font-bold uppercase transition-all tracking-wider border ${
                  format === f
                    ? 'bg-red-600 border-red-600 text-white shadow-md shadow-red-500/20'
                    : 'bg-gray-50 dark:bg-gray-800/80 border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100'
                }`}
              >
                {f === 'FULL_SCRIPT' && 'Volles Skript'}
                {f === 'SHORT' && 'Short / TikTok'}
                {f === 'SEO_METADATA' && 'SEO & Thumbnail'}
              </button>
            ))}
          </div>
        </div>

        {/* Detailed Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Tonfall / Stimmung</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-950 border border-transparent rounded-xl p-3.5 text-xs font-bold text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-red-500 outline-none cursor-pointer"
            >
              <option>Professionell & Informativ</option>
              <option>Schlagfertig & Selbstbewusst</option>
              <option>Unterhaltsam, Locker & Humorvoll</option>
              <option>Energisch, Begeisternd & Hyped</option>
              <option>Spannend, Detailreich & Mysteriös</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Geplante Video-Zieldauer</label>
            <select
              value={length}
              onChange={(e) => setLength(e.target.value)}
              disabled={format === 'SHORT'}
              className="w-full bg-gray-50 dark:bg-gray-950 border border-transparent rounded-xl p-3.5 text-xs font-bold text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-red-500 outline-none cursor-pointer disabled:opacity-50"
            >
              <option>1–3 Minuten (Kompakt)</option>
              <option>5–10 Minuten (Standard)</option>
              <option>10–20 Minuten (Ausführlich)</option>
              <option>Über 20 Minuten (Premium-Guide)</option>
            </select>
          </div>
        </div>

        {/* SEO Keywords Input */}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Keywords / SEO Schlüsselwörter (optional)</label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="z.B. sixt verhandlung, rhetorik tricks, schlagfertigkeit, tobias ganster"
            className="w-full bg-gray-50 dark:bg-gray-950 border border-transparent rounded-xl p-3.5 text-xs font-bold text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>

        {/* Specific creative requests */}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Persönliche Wünsche / Notizen (optional)</label>
          <input
            type="text"
            value={customRequest}
            onChange={(e) => setCustomRequest(e.target.value)}
            placeholder="z.B. 'Betone Humor im Intro', 'Verwende Metaphern aus dem Kampfsport'..."
            className="w-full bg-gray-50 dark:bg-gray-950 border border-transparent rounded-xl p-3.5 text-xs font-medium text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>

        {/* Submit action */}
        <button
          onClick={generateScript}
          disabled={isGenerating || !topic.trim()}
          className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
            isGenerating || !topic.trim() ? 'bg-gray-300 dark:bg-gray-800 text-gray-500 dark:text-gray-600 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700 shadow-red-500/10'
          }`}
        >
          {isGenerating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
          {isGenerating ? 'SKRIPT WIRD GENERIERT...' : 'VIDEO SKRIPT ERSTELLEN'}
        </button>
      </div>

      {/* Output Presentation and Adjusting Panel */}
      <AnimatePresence>
        {scriptText && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="space-y-6"
          >
            {/* Main result block */}
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-2xl">
              <div className="flex justify-between items-center pb-4 border-b border-gray-50 dark:border-gray-800 mb-6">
                <div>
                  <h3 className="font-black text-gray-900 dark:text-white uppercase italic text-sm flex items-center gap-2">
                    <i className="fas fa-scroll text-red-600"></i>
                    Vorschau: Dein Skript
                  </h3>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Generiert mit Rhetorix-AI</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] bg-red-50 dark:bg-red-950/20 text-red-600 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                    {format === 'FULL_SCRIPT' ? 'YouTube Skript' : format === 'SHORT' ? 'YouTube Short' : 'SEO Edition'}
                  </span>
                </div>
              </div>

              {/* Rendered script body */}
              <div className="prose prose-sm dark:prose-invert max-w-none mb-8 font-sans max-h-[500px] overflow-y-auto px-1 py-1 text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-line border-l-2 border-red-500/20 pl-4">
                <ReactMarkdown>{scriptText}</ReactMarkdown>
              </div>

              {/* Shared utility footer */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="bg-gray-950 dark:bg-black hover:bg-black text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <i className="fas fa-copy text-xs"></i> Kopieren
                </button>
                <button
                  type="button"
                  onClick={saveToLibrary}
                  className="bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <i className="fas fa-box-archive text-xs"></i> Archivieren
                </button>
                <button
                  type="button"
                  onClick={shareContent}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <i className="fas fa-share-nodes text-xs"></i> Teilen
                </button>
              </div>
            </div>

            {/* Smart adjustment & fine-tuning module */}
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-2xl space-y-4">
              <div>
                <h3 className="font-black text-gray-900 dark:text-white uppercase italic text-xs mb-1 flex items-center gap-2">
                  <i className="fas fa-wand-magic-sparkles text-red-600"></i>
                  Skript anpassen & verfeinern
                </h3>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-4">Verändere oder verfeinere einzelne Abschnitte nach deinen Wünschen</p>
                <textarea
                  value={adjustmentPrompt}
                  onChange={(e) => setAdjustmentPrompt(e.target.value)}
                  placeholder="z.B. 'Schreib das Intro um, sodass es noch klickstärker wirkt', 'Erweitere den Hauptteil um eine kurze Metapher', 'Mach das Outro lustiger'..."
                  className="w-full h-20 bg-gray-50 dark:bg-gray-950 border border-transparent rounded-xl p-4 text-xs font-semibold focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-red-500 outline-none transition-all resize-none text-gray-800 dark:text-gray-200"
                />
              </div>
              <button
                onClick={adjustScript}
                disabled={isAdjusting || !adjustmentPrompt.trim()}
                className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  isAdjusting || !adjustmentPrompt.trim()
                    ? 'bg-gray-150 dark:bg-gray-800/50 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-transparent'
                    : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black shadow-lg shadow-gray-200 dark:shadow-none'
                }`}
              >
                {isAdjusting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sparkles"></i>}
                {isAdjusting ? 'SKRIPT WIRD ANGEPASST...' : 'KORREKTUREN EINPFLEGEN'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default YouTubeView;
