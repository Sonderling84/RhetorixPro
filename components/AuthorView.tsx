
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { speakElevenLabs } from '../utils/elevenLabsTTS';
import { LogEntry } from '../types';

interface AuthorViewProps {
  onSave: (session: any) => void;
  addLog: (message: string, level: LogEntry['level']) => void;
}

interface DriveFolder {
  id: string;
  name: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

const AuthorView: React.FC<AuthorViewProps> = ({ onSave, addLog }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<DriveFolder | null>(null);
  const [view, setView] = useState<'start' | 'select_project' | 'editor' | 'compilation'>('start');
  const [inputText, setInputText] = useState('');
  const [optimizedText, setOptimizedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [authorStyle, setAuthorStyle] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compiledBook, setCompiledBook] = useState<string>('');
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({
    clientId: localStorage.getItem('google_client_id') || '',
    clientSecret: localStorage.getItem('google_client_secret') || '',
    appUrl: localStorage.getItem('google_app_url') || window.location.origin,
  });

  const getHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'x-google-config': JSON.stringify(config),
    };
  };

  useEffect(() => {
    checkAuthStatus();
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        setIsAuthenticated(true);
        addLog('Google Drive erfolgreich verbunden!', 'success');
        fetchFolders();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/google/status', { headers: getHeaders() });
      const data = await res.json();
      setIsAuthenticated(data.isAuthenticated);
      if (data.isAuthenticated) fetchFolders();
    } catch (e) {
      console.error('Auth check failed', e);
    }
  };

  const fetchFolders = async () => {
    try {
      const res = await fetch('/api/drive/folders', { method: 'POST', headers: getHeaders() });
      const data = await res.json();
      if (Array.isArray(data)) {
        setFolders(data);
      } else {
        addLog('Fehler beim Laden der Ordner. Prüfe deine Konfiguration.', 'error');
      }
    } catch (e) {
      addLog('Fehler beim Laden der Ordner.', 'error');
    }
  };

  const handleConnect = async () => {
    if (!config.clientId || !config.clientSecret) {
      addLog('Bitte zuerst Client-ID und Secret in den Einstellungen (Zahnrad) eingeben.', 'error');
      setShowConfig(true);
      return;
    }
    try {
      const res = await fetch('/api/auth/google/url', { headers: getHeaders() });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, 'google_auth', 'width=600,height=700');
      } else {
        addLog('Fehler beim Abrufen der Auth-URL. Prüfe deine Konfiguration.', 'error');
      }
    } catch (e) {
      addLog('Fehler beim Starten der Authentifizierung.', 'error');
    }
  };

  const handleSaveConfig = () => {
    localStorage.setItem('google_client_id', config.clientId);
    localStorage.setItem('google_client_secret', config.clientSecret);
    localStorage.setItem('google_app_url', config.appUrl);
    setShowConfig(false);
    addLog('Konfiguration lokal gespeichert.', 'success');
    checkAuthStatus();
  };

  const handleCreateProject = async () => {
    const name = prompt('Name des neuen Buchprojekts:');
    if (!name) return;
    try {
      const res = await fetch('/api/drive/create-folder', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name }),
      });
      const newFolder = await res.json();
      setFolders([newFolder, ...folders]);
      setSelectedFolder(newFolder);
      setView('editor');
      addLog(`Projekt "${name}" erstellt.`, 'success');
    } catch (e) {
      addLog('Fehler beim Erstellen des Projekts.', 'error');
    }
  };

  const handleOptimize = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    addLog('Text wird im Autorenstil optimiert...', 'info');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      let stylePrompt = authorStyle;
      if (!stylePrompt) {
        const styleRes = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: `Analysiere diesen Rohtext und entwickle daraus einen konsistenten, professionellen literarischen Schreibstil für diesen Autor. Beschreibe den Stil kurz und prägnant.\n\nText: ${inputText}`,
        });
        stylePrompt = styleRes.text || 'Professioneller literarischer Stil';
        setAuthorStyle(stylePrompt);
      }

      const model = ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Du bist ein erfahrener Buchautor. Optimiere den folgenden Rohtext (Skizzen/Gedanken) in den festgelegten Autorenstil. Behalte die Kernbotschaft bei, aber mache daraus eine flüssige, erzählerische Prosa.
        
        Autorenstil: ${stylePrompt}
        
        Rohtext: ${inputText}
        
        Gib nur den optimierten Text zurück.`,
      });

      const response = await model;
      setOptimizedText(response.text || '');
      addLog('Text erfolgreich optimiert!', 'success');
    } catch (error) {
      addLog('Fehler bei der Textoptimierung.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateSpeech = async (text: string, isOriginal: boolean) => {
    addLog(`Sprachausgabe wird generiert (${isOriginal ? 'Original' : 'Optimiert'})...`, 'info');
    try {
      await speakElevenLabs(text);
      addLog('Sprachausgabe abgespielt!', 'success');
    } catch (e) {
      addLog('Fehler bei der Sprachgenerierung.', 'error');
    }
  };

  const handleSaveToDrive = async () => {
    if (!optimizedText || !selectedFolder) return;
    setIsProcessing(true);
    const fileName = `Kapitel_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    try {
      await fetch('/api/drive/upload', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: fileName,
          content: optimizedText,
          folderId: selectedFolder.id,
        }),
      });
      addLog(`Text als "${fileName}" in Google Drive gespeichert.`, 'success');
      setInputText('');
      setOptimizedText('');
    } catch (e) {
      addLog('Fehler beim Speichern in Drive.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompileBook = async () => {
    if (!selectedFolder) return;
    setIsCompiling(true);
    addLog('Alle Skripte werden analysiert und zu einem Buch zusammengefügt...', 'info');

    try {
      const listRes = await fetch('/api/drive/list-files', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ folderId: selectedFolder.id }),
      });
      const files: DriveFile[] = await listRes.json();
      const textFiles = files.filter(f => f.mimeType === 'text/plain');

      const contents = await Promise.all(textFiles.map(async (file) => {
        const contentRes = await fetch('/api/drive/get-file-content', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ fileId: file.id }),
        });
        return await contentRes.text();
      }));

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const compilationRes = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Du hast hier eine Sammlung von Textfragmenten, Skizzen und Kapiteln eines Autors. Deine Aufgabe ist es, diese Fragmente zu analysieren, chronologisch oder logisch sinnvoll zu ordnen und daraus eine zusammenhängende, flüssige Erzählung (ein Buch) zu erstellen.
        Füge Kapitelmarkierungen ein, glätte Übergänge und achte auf einen konsistenten Erzählfluss.
        
        Fragmente:
        ${contents.join('\n\n--- NÄCHSTES FRAGMENT ---\n\n')}
        
        Erstelle das fertige Buch-Manuskript.`,
      });

      setCompiledBook(compilationRes.text || '');
      setView('compilation');
      addLog('Buch erfolgreich zusammengestellt!', 'success');
    } catch (e) {
      addLog('Fehler beim Zusammenstellen des Buches.', 'error');
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      {/* Config Button */}
      <button 
        onClick={() => setShowConfig(!showConfig)}
        className="absolute top-0 right-0 w-10 h-10 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm flex items-center justify-center text-gray-400 hover:text-purple-600 transition-colors z-10"
      >
        <i className="fas fa-cog"></i>
      </button>

      {showConfig && (
        <div className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-purple-100 dark:border-purple-900/30 shadow-xl space-y-4 animate-in slide-in-from-top-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">Google Cloud Konfiguration</h3>
          <div className="space-y-3">
            <input 
              type="text" 
              placeholder="Google Client ID" 
              value={config.clientId}
              onChange={(e) => setConfig({...config, clientId: e.target.value})}
              className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-950 border-none text-xs text-gray-900 dark:text-white"
            />
            <input 
              type="password" 
              placeholder="Google Client Secret" 
              value={config.clientSecret}
              onChange={(e) => setConfig({...config, clientSecret: e.target.value})}
              className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-950 border-none text-xs text-gray-900 dark:text-white"
            />
            <input 
              type="text" 
              placeholder="App URL (z.B. https://...)" 
              value={config.appUrl}
              onChange={(e) => setConfig({...config, appUrl: e.target.value})}
              className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-950 border-none text-xs text-gray-900 dark:text-white"
            />
            <button 
              onClick={handleSaveConfig}
              className="w-full py-3 bg-purple-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest"
            >
              Speichern
            </button>
          </div>
        </div>
      )}

      {!isAuthenticated ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
            <i className="fab fa-google-drive text-4xl"></i>
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Google Drive Verbindung</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Verbinde dein Google Drive, um deine Buchprojekte sicher zu speichern.</p>
          </div>
          <button 
            onClick={handleConnect}
            className="bg-blue-600 text-white font-black py-4 px-8 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center gap-3 text-sm uppercase tracking-widest"
          >
            <i className="fas fa-link"></i> Jetzt Verbinden
          </button>
        </div>
      ) : (
        <>
          {view === 'start' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-4">
                <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-inner mx-auto">
                  <i className="fas fa-pen-nib text-2xl"></i>
                </div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight italic">KI Autor Studio</h2>
                <p className="text-gray-500 dark:text-gray-400 text-xs">Was möchtest du heute tun?</p>
                <div className="grid grid-cols-1 gap-3 pt-4">
                  <button 
                    onClick={handleCreateProject}
                    className="bg-purple-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest"
                  >
                    <i className="fas fa-plus"></i> Neues Werk beginnen
                  </button>
                  <button 
                    onClick={() => setView('select_project')}
                    className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 font-black py-4 rounded-2xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest"
                  >
                    <i className="fas fa-folder-open"></i> Werk weiter bearbeiten
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === 'select_project' && (
            <div className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Projekt wählen</h3>
                <button onClick={() => setView('start')} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times"></i></button>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                {folders.map(f => (
                  <button 
                    key={f.id}
                    onClick={() => { setSelectedFolder(f); setView('editor'); }}
                    className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-950 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-left flex items-center gap-4 transition-colors group"
                  >
                    <i className="fas fa-folder text-purple-400 group-hover:text-purple-600"></i>
                    <span className="font-bold text-gray-700 dark:text-gray-300">{f.name}</span>
                  </button>
                ))}
                {folders.length === 0 && <p className="text-center text-gray-400 py-8 text-xs">Keine Projekte gefunden.</p>}
              </div>
            </div>
          )}

          {view === 'editor' && selectedFolder && (
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <i className="fas fa-book"></i>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white leading-none">{selectedFolder.name}</h2>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">Aktives Projekt</p>
                  </div>
                </div>
                <button onClick={() => setView('start')} className="text-gray-400 hover:text-gray-600"><i className="fas fa-chevron-left"></i></button>
              </div>

              <div className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Sprich oder schreibe deine Ideen, Skizzen oder Kapitel-Entwürfe hier hinein..."
                  className="w-full h-48 p-5 rounded-3xl bg-gray-50 dark:bg-gray-950 border-none focus:ring-2 focus:ring-purple-500/20 transition-all resize-none text-sm font-medium text-gray-700 dark:text-gray-300 placeholder:text-gray-300 dark:placeholder:text-gray-700"
                />
                <div className="flex gap-2">
                  <button 
                    onClick={handleOptimize}
                    disabled={isProcessing || !inputText.trim()}
                    className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                      isProcessing ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600' : 'bg-purple-600 text-white shadow-lg shadow-purple-200 dark:shadow-purple-900/20 active:scale-95'
                    }`}
                  >
                    <i className="fas fa-wand-magic-sparkles"></i> {isProcessing ? 'Veredelung...' : 'Stil-Optimierung'}
                  </button>
                  <button 
                    onClick={handleCompileBook}
                    disabled={isCompiling}
                    className="bg-black dark:bg-gray-800 text-white px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2"
                  >
                    <i className="fas fa-layer-group"></i> Buch erstellen
                  </button>
                </div>
              </div>

              {optimizedText && (
                <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-purple-600 dark:text-purple-400">Optimiertes Manuskript</h3>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => generateSpeech(inputText, true)}
                        className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
                        title="Original hören"
                      >
                        <i className="fas fa-ear-listen"></i>
                      </button>
                      <button 
                        onClick={() => generateSpeech(optimizedText, false)}
                        className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 flex items-center justify-center transition-colors"
                        title="Optimiert hören"
                      >
                        <i className="fas fa-volume-high"></i>
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <p className="text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-300 italic border-l-4 border-purple-200 dark:border-purple-900/50 pl-4 py-2">
                      {optimizedText}
                    </p>
                    
                    <div className="flex gap-4 items-center">
                      {originalAudioUrl && (
                        <div className="flex-1 bg-gray-50 dark:bg-gray-950 p-3 rounded-2xl flex items-center gap-3">
                          <span className="text-[9px] font-black text-gray-400 dark:text-gray-600 uppercase">Original</span>
                          <audio src={originalAudioUrl} controls className="h-8 w-full" />
                        </div>
                      )}
                      {audioUrl && (
                        <div className="flex-1 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-2xl flex items-center gap-3">
                          <span className="text-[9px] font-black text-purple-400 dark:text-purple-600 uppercase">Optimiert</span>
                          <audio src={audioUrl} controls className="h-8 w-full" />
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={handleSaveToDrive}
                        disabled={isProcessing}
                        className="flex-1 py-5 rounded-3xl bg-emerald-600 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 dark:shadow-emerald-900/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        <i className="fab fa-google-drive"></i> In Drive speichern
                      </button>
                      <button 
                        onClick={() => {
                          onSave({
                            id: Date.now().toString(),
                            timestamp: Date.now(),
                            mode: 'AUTHOR',
                            correctedText: optimizedText,
                            title: `Kapitel: ${optimizedText.slice(0, 30)}...`
                          });
                        }}
                        className="w-16 h-16 rounded-3xl bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-xl active:scale-95 transition-all"
                        title="In Rhetorix Archiv speichern"
                      >
                        <i className="fas fa-archive text-xl"></i>
                      </button>
                      <button 
                        onClick={async () => {
                          if (navigator.share) {
                            try {
                              await navigator.share({
                                title: 'Mein Buch-Manuskript',
                                text: optimizedText,
                              });
                              addLog('Erfolgreich geteilt!', 'success');
                            } catch (e) {
                              console.error('Share failed', e);
                            }
                          } else {
                            navigator.clipboard.writeText(optimizedText);
                            addLog('In Zwischenablage kopiert!', 'success');
                          }
                        }}
                        className="w-16 h-16 rounded-3xl bg-gray-900 dark:bg-black text-white flex items-center justify-center shadow-xl active:scale-95 transition-all"
                        title="Teilen / In Notizen speichern"
                      >
                        <i className="fas fa-share-nodes text-xl"></i>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'compilation' && (
            <div className="space-y-6 animate-in zoom-in-95 duration-500 pb-10">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black text-gray-900 dark:text-white italic uppercase">Dein Manuskript</h2>
                <button onClick={() => setView('editor')} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times"></i></button>
              </div>
              
              <div className="bg-white dark:bg-gray-900 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-2xl space-y-8">
                <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 leading-relaxed font-serif whitespace-pre-wrap">
                  {compiledBook}
                </div>
                
                <div className="pt-8 border-t border-gray-100 dark:border-gray-800 flex justify-center gap-4">
                  <button 
                    onClick={() => {
                      onSave({
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        mode: 'AUTHOR',
                        correctedText: compiledBook,
                        title: `Buch: ${selectedFolder?.name || 'Unbenannt'}`
                      });
                    }}
                    className="bg-purple-600 text-white font-black py-4 px-10 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center gap-3 text-xs uppercase tracking-widest"
                  >
                    <i className="fas fa-archive"></i> Archivieren
                  </button>
                  <button 
                    onClick={() => {
                      const blob = new Blob([compiledBook], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${selectedFolder?.name || 'Buch'}_Manuskript.txt`;
                      a.click();
                    }}
                    className="bg-black dark:bg-gray-800 text-white font-black py-4 px-10 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center gap-3 text-xs uppercase tracking-widest"
                  >
                    <i className="fas fa-download"></i> Manuskript Exportieren
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AuthorView;
