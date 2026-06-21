import React, { useState, useEffect, useRef } from 'react';

interface MicSelectorProps {
  addLog?: (msg: string, type: 'success' | 'error' | 'info' | 'warn') => void;
}

export const MicSelector: React.FC<MicSelectorProps> = ({ addLog }) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [permState, setPermState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isTestingLevel, setIsTestingLevel] = useState<boolean>(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (navigator.permissions && (navigator.permissions as any).query) {
      navigator.permissions.query({ name: 'microphone' as any }).then((state: PermissionStatus) => {
        setPermState(state.state);
        state.onchange = () => {
          setPermState(state.state);
        };
      }).catch(e => console.error(e));
    }
    
    loadDevices();
    
    return () => {
      stopTest();
    };
  }, []);

  // Automatically start monitoring whenever the selected microphone changes
  useEffect(() => {
    if (selectedId) {
      startTest(selectedId);
    } else if (devices.length > 0 && devices[0].deviceId) {
      startTest(devices[0].deviceId);
    }
  }, [selectedId, devices]);

  const loadDevices = async (requestPermission = false) => {
    try {
      if (requestPermission) {
        if (addLog) addLog("Konfiguriere Mikrofon-Zugang...", "info");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setPermState('granted');
      }
      
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter(d => d.kind === 'audioinput');
      setDevices(audioInputs);
      
      if (audioInputs.some(d => d.label)) {
        setPermState('granted');
      }
      
      const saved = localStorage.getItem('rhetorix_selected_mic_id') || '';
      if (saved && audioInputs.some(d => d.deviceId === saved)) {
        setSelectedId(saved);
      } else if (audioInputs.length > 0) {
        setSelectedId(audioInputs[0].deviceId);
        localStorage.setItem('rhetorix_selected_mic_id', audioInputs[0].deviceId);
      }
    } catch (err: any) {
      console.error("Error loading microphones:", err);
      if (addLog) addLog(`Mikrofon-Suche fehlgeschlagen: ${err.message || err}`, 'error');
    }
  };

  const handleMicChange = (id: string) => {
    setSelectedId(id);
    localStorage.setItem('rhetorix_selected_mic_id', id);
    if (addLog) {
      const dev = devices.find(d => d.deviceId === id);
      addLog(`Standard-Mikrofon gewechselt zu: ${dev ? dev.label : 'Standard'}`, 'success');
    }
  };

  const startTest = async (idToUse = selectedId) => {
    stopTest();
    if (!idToUse && devices.length > 0) {
      idToUse = devices[0].deviceId;
    }
    try {
      setIsTestingLevel(true);
      const constraints: MediaStreamConstraints = {
        audio: idToUse ? { deviceId: { ideal: idToUse } } : true
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const checkLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const percentage = Math.min(100, Math.round((average / 120) * 100));
        setAudioLevel(percentage);
        animationRef.current = requestAnimationFrame(checkLevel);
      };
      
      animationRef.current = requestAnimationFrame(checkLevel);
    } catch (err: any) {
      // Quietly fall back, might be blocked initially due to lack of permission interaction
      console.warn("Auto mic test failed (waiting for interaction):", err);
      // Try with generic audio constraints if specific device fails
      if (idToUse) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;
          const source = ctx.createMediaStreamSource(stream);
          source.connect(analyser);
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          const checkLevel = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const average = sum / bufferLength;
            const percentage = Math.min(100, Math.round((average / 120) * 100));
            setAudioLevel(percentage);
            animationRef.current = requestAnimationFrame(checkLevel);
          };
          animationRef.current = requestAnimationFrame(checkLevel);
        } catch (e2) {
          setIsTestingLevel(false);
        }
      } else {
        setIsTestingLevel(false);
      }
    }
  };

  const stopTest = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
    setIsTestingLevel(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
          Mikrofon-Auswahl (Mac OS &amp; Global)
        </span>
        {permState !== 'granted' ? (
          <button
            onClick={() => loadDevices(true)}
            className="text-[9px] bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider transition-colors shadow-sm"
          >
            Gerätenamen freischalten
          </button>
        ) : (
          <span className="text-[8px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-black uppercase px-2 py-0.5 rounded-full tracking-widest">
            Aktiviert
          </span>
        )}
      </div>
      
      <div className="relative">
        <select
          value={selectedId}
          onChange={(e) => handleMicChange(e.target.value)}
          className="w-full text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 px-4 py-3.5 rounded-2xl outline-none appearance-none"
        >
          {devices.length === 0 ? (
            <option value="">Standard-Eingabegerät (System-Default)</option>
          ) : (
            devices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `System-Mikrofon (ID: ${d.deviceId.slice(0, 5) || 'Standard'}...)`}
              </option>
            ))
          )}
        </select>
        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
          <i className="fas fa-chevron-down text-xs"></i>
        </div>
      </div>

      {/* Hinweistext zur Geräteauswahl */}
      <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 p-4 rounded-2xl text-[11px] text-gray-500 dark:text-gray-400 space-y-2">
        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-extrabold uppercase text-[9px] tracking-wider">
          <i className="fas fa-circle-info"></i>
          Keine Sorge: Dein Mikrofon funktioniert!
        </div>
        <p className="leading-relaxed text-gray-600 dark:text-gray-300">
          Das gewählte <strong>System-Mikrofon</strong> ist voll einsatzbereit! Es leitet deine Stimme automatisch an das Gerät weiter, das in deinen macOS- oder Windows-Systemeinstellungen als Standard eingestellt ist.
        </p>
        {devices.length <= 1 && (
          <div className="pt-1.5 border-t border-blue-100/50 dark:border-blue-900/40 space-y-1">
            <span className="block font-bold text-[9px] text-blue-600 dark:text-blue-400 uppercase tracking-widest">
              Warum sehe ich nur ein Gerät?
            </span>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-normal">
              Weil die App hier sicherheitshalber in einem <strong>Vorschau-Behälter (Iframe)</strong> geladen wird. Um einzelne Hardware-Namen (wie AirPods, Studio-Mic etc.) aufzulisten: 
              Klicke einfach oben rechts über dem Vorschau-Fenster auf das <strong className="text-gray-700 dark:text-gray-200">"In neuem Tab öffnen"</strong>-Symbol (Quadrat mit Pfeil). Schon siehst du alle Geräte namentlich!
            </p>
          </div>
        )}
      </div>
      
      {/* Mic Audio Tester Meter */}
      <div className="bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 p-4 rounded-[1.5rem] flex flex-col gap-3">
        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isTestingLevel ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
            Live Pegel-Monitor
          </span>
          <span className={audioLevel > 0 ? "text-emerald-600 dark:text-emerald-400 font-extrabold" : "text-gray-400"}>
            {audioLevel > 0 ? `${audioLevel}% Level` : "Stille / Kein Signal"}
          </span>
        </div>
        
        {/* Progress bar container */}
        <div className="h-2.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden flex items-center">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 via-green-400 to-teal-500 rounded-full transition-all duration-75"
            style={{ width: `${audioLevel}%` }}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => startTest()}
            className="flex-1 py-2 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
            title="Verbindung neu herstellen"
          >
            <i className="fas fa-arrows-rotate"></i>
            Kanal Neu Kalibrieren
          </button>

          <button
            onClick={isTestingLevel ? stopTest : () => startTest()}
            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              isTestingLevel 
                ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/20' 
                : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
            }`}
          >
            <i className={`fas ${isTestingLevel ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
            {isTestingLevel ? 'Pause' : 'Start'}
          </button>
        </div>
        
        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold text-center mt-1">
          Der Pegel lauscht und schlägt automatisch aus, sobald du sprichst!
        </p>
      </div>
    </div>
  );
};
