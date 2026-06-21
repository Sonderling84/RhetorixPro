import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getUserMicrophoneStream } from '../utils/speechHelper';

const GlobalDictationOverlay: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [targetName, setTargetName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [key1, setKey1] = useState('Control');
  const [key2, setKey2] = useState(' '); // space

  const activeElementRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});
  const streamRef = useRef<MediaStream | null>(null);

  // Reload keys periodically or listen to changes from the VoiceInputView
  const loadShortcutKeys = () => {
    const savedKeys = localStorage.getItem('rhetorix_voice_shortcut_keys');
    if (savedKeys) {
      try {
        const parsed = JSON.parse(savedKeys);
        if (parsed.key1 && parsed.key2) {
          setKey1(parsed.key1);
          setKey2(parsed.key2);
        }
      } catch (e) {
        // use default
      }
    }
  };

  useEffect(() => {
    loadShortcutKeys();
    
    // Add custom listener for custom UI buttons
    const triggerStart = () => {
      startDictation();
    };

    const triggerStop = () => {
      stopDictation();
    };

    window.addEventListener('rhetorix-force-start-dictation', triggerStart);
    window.addEventListener('rhetorix-force-stop-dictation', triggerStop);

    return () => {
      window.removeEventListener('rhetorix-force-start-dictation', triggerStart);
      window.removeEventListener('rhetorix-force-stop-dictation', triggerStop);
    };
  }, []);

  // Bulletproof text insertion supporting dynamic React state syncs
  const insertTextAtCursor = (el: HTMLInputElement | HTMLTextAreaElement, text: string) => {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const val = el.value;
    const before = val.substring(0, start);
    const after = val.substring(end);
    const newValue = before + text + after;

    const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(el, newValue);
    } else {
      el.value = newValue;
    }

    el.selectionStart = el.selectionEnd = start + text.length;

    // Trigger state changes up to parents
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Dispatch custom global event for playground syncing
    window.dispatchEvent(new CustomEvent('rhetorix-dictation-text', { detail: { text: newValue } }));
  };

  const startDictation = async () => {
    if (isActive) return;
    
    // Find focused element
    const active = document.activeElement;
    const isValidInput = active && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement);

    if (isValidInput) {
      activeElementRef.current = active as HTMLInputElement | HTMLTextAreaElement;
      
      const placeholder = activeElementRef.current.placeholder || activeElementRef.current.id || 'Eingabefeld';
      setTargetName(placeholder.substring(0, 30) + (placeholder.length > 30 ? '...' : ''));
    } else {
      // Find FIRST visible input or textarea on the page as automatic focal backup
      const backupInput = document.querySelector('textarea, input[type="text"]') as HTMLInputElement | HTMLTextAreaElement;
      if (backupInput) {
        backupInput.focus();
        activeElementRef.current = backupInput;
        const placeholder = backupInput.placeholder || backupInput.id || 'Eingabefeld';
        setTargetName(placeholder.substring(0, 30) + (placeholder.length > 30 ? '...' : ''));
      } else {
        setErrorMsg('Bitte klicke zuerst in ein Textfeld, um dort einzusprechen!');
        setIsActive(true);
        return;
      }
    }

    // Try starting Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg('Dein Browser unterstützt die Spracherkennung leider nicht. Bitte verwende Safari, Chrome oder lade den neuesten Edge Browser.');
      setIsActive(true);
      return;
    }

    try {
      setErrorMsg(null);
      setTranscript('');
      setIsActive(true);
      window.dispatchEvent(new CustomEvent('rhetorix-dictation-active', { detail: { isActive: true } }));

      // Secure chosen microphone device stream
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await getUserMicrophoneStream();
          streamRef.current = stream;
        } catch (streamErr) {
          console.error("Microphone stream capture failed:", streamErr);
        }
      }

      const rec = new SpeechRecognition();
      rec.lang = 'de-DE';
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (e: any) => {
        let finalSegment = '';
        let interimSegment = '';

        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) {
            finalSegment += e.results[i][0].transcript;
          } else {
            interimSegment += e.results[i][0].transcript;
          }
        }

        const captured = finalSegment || interimSegment;
        if (captured) {
          setTranscript(captured);
          
          if (activeElementRef.current) {
            // Only append/insert if final
            if (finalSegment) {
              insertTextAtCursor(activeElementRef.current, ' ' + finalSegment.trim());
            }
          }
        }
      };

      rec.onerror = (e: any) => {
        console.error('Speech recognition error:', e.error);
        if (e.error === 'not-allowed') {
          setErrorMsg('Das Mikrofon ist im Iframe blockiert! Navigiere zur Vollbild-App (Sprechblasen-Icon oben rechts in AI Studio) oder lade den Iframe neu.');
        } else if (e.error === 'no-speech' || e.error === 'aborted' || e.error === 'audio-capture') {
          // ignore silent pause or aborted/silently stopped instances
        } else {
          setErrorMsg(`Sprach-Übertragungs-Fehler: ${e.error}`);
        }
      };

      rec.onend = () => {
        // Automatically check if we should auto-restart or just close
        // In this case, we close cleanly when user hits stop
      };

      rec.start();
      recognitionRef.current = rec;
      
      // Play soft notification beep or play sound if wanted
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
      } catch (ae) {
        // audio context failed
      }
    } catch (err: any) {
      setErrorMsg(`Fehler bei Initialisierung: ${err.message}`);
      setIsActive(true);
    }
  };

  const stopDictation = () => {
    setIsActive(false);
    window.dispatchEvent(new CustomEvent('rhetorix-dictation-active', { detail: { isActive: false } }));

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => track.stop());
      } catch (trackErr) {
        console.error("Error stopping tracks:", trackErr);
      }
      streamRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // already stopped
      }
      recognitionRef.current = null;
    }
    
    // Play light low beep
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      osc.frequency.setValueAtTime(450, audioCtx.currentTime);
      osc.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch (ae) {}
  };

  // Build key combo listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return; // Prevent repetitive triggers when holding keys down
      // Refresh configurations on key down
      loadShortcutKeys();

      const k = e.key;
      keysPressedRef.current[k] = true;

      // Translate keys to match localized naming comparison
      const checkKey1 = key1 === ' ' ? ' ' : key1;
      const checkKey2 = key2 === ' ' ? ' ' : key2;

      const isModifierMatched = 
        (checkKey1 === 'Control' && e.ctrlKey) ||
        (checkKey1 === 'Alt' && e.altKey) ||
        (checkKey1 === 'Meta' && e.metaKey) ||
        (checkKey1 === 'Shift' && e.shiftKey) ||
        keysPressedRef.current[checkKey1] === true;

      const isKey2Matched = 
        keysPressedRef.current[checkKey2] === true ||
        (checkKey2.length === 1 && e.key.toLowerCase() === checkKey2.toLowerCase());

      if (isModifierMatched && isKey2Matched) {
        e.preventDefault();
        e.stopPropagation();

        if (isActive) {
          stopDictation();
        } else {
          startDictation();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [key1, key2, isActive]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-lg bg-gray-950/95 backdrop-blur-md text-white p-6 rounded-[2.5rem] border border-indigo-500/20 shadow-[0_20px_50px_rgba(99,102,241,0.25)] flex flex-col gap-4"
        >
          {/* Wave & Title Indicators */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-3.5 w-3.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
              </span>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Globales Einsprechen</p>
                <p className="text-xs font-black text-white italic mt-1 uppercase tracking-tight">
                  {errorMsg ? 'Problem aufgetreten' : `Schreibe in: "${targetName}"`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-1 rounded-md uppercase tracking-wider font-mono">
                {key1 === ' ' ? 'Leertaste' : key1} + {key2 === ' ' ? 'Leertaste' : key2}
              </span>
              <button 
                onClick={stopDictation}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors outline-none"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
          </div>

          {/* Feedback Body */}
          <div className="p-4 bg-white/5 rounded-2xl min-h-[50px] flex items-center justify-center relative overflow-hidden">
            {errorMsg ? (
              <div className="text-center text-xs text-rose-400 font-medium px-2 leading-relaxed space-y-2">
                <p className="font-bold flex items-center justify-center gap-1.5 leading-tight"><i className="fas fa-triangle-exclamation"></i> Mikrofon blockiert / Iframe-Limit</p>
                <p className="text-[10px] text-gray-400 font-bold leading-normal">
                  Öffne die App im eigenen Tab über das Tab-Icon oben rechts! Dadurch umgehst du das Iframe-Rechteproblem sofort.
                </p>
              </div>
            ) : (
              <div className="relative w-full">
                {/* Simulated Wave Visuals */}
                <div className="flex items-center justify-center gap-0.5 mb-2 h-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((val, idx) => (
                    <motion.div
                      key={idx}
                      animate={{ height: ['4px', `${val * 2.5}px`, '4px'] }}
                      transition={{ repeat: Infinity, duration: 1.2, delay: idx * 0.05 }}
                      className="w-0.5 bg-indigo-400 rounded-full"
                    />
                  ))}
                </div>
                
                <p className="text-center text-xs text-gray-300 italic font-medium">
                  {transcript ? `„${transcript}“` : 'Bereit. Fange an zu sprechen...'}
                </p>
              </div>
            )}
          </div>

          {/* Guidelines info */}
          <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider px-1">
            <span>Tippen: Drücke shortcut erneut</span>
            <button 
              onClick={stopDictation}
              className="text-indigo-400 hover:text-indigo-300 font-black"
            >
              Diktieren beenden
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalDictationOverlay;
