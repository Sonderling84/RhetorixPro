import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getUserMicrophoneStream } from '../utils/speechHelper';
import { TRANSLATOR_ACTIVE_KEY, isTranslatorActive } from './TranslatorToggle';

type DictationPhase = 'idle' | 'recording' | 'processing' | 'result' | 'test';

const LANGUAGES = [
  { code: 'none', label: 'Keine Übersetzung' },
  { code: 'Englische', label: 'Englisch' },
  { code: 'Französische', label: 'Französisch' },
  { code: 'Spanische', label: 'Spanisch' },
  { code: 'Italienische', label: 'Italienisch' },
  { code: 'Portugiesische', label: 'Portugiesisch' },
  { code: 'Türkische', label: 'Türkisch' },
  { code: 'Japanische', label: 'Japanisch' },
  { code: 'Chinesische', label: 'Chinesisch' },
  { code: 'Russische', label: 'Russisch' },
  { code: 'Arabische', label: 'Arabisch' },
  { code: 'Koreanische', label: 'Koreanisch' },
  { code: 'Niederländische', label: 'Niederländisch' },
  { code: 'Polnische', label: 'Polnisch' },
  { code: 'Schwedische', label: 'Schwedisch' },
];

// Quick-Links für schnelles Einfügen (aus localStorage konfigurierbar)
interface QuickLink {
  label: string;
  url: string;
  icon: string;
}

// Standard-Quick-Links sind bewusst leer/generisch (kein persönlicher Inhalt im Repo).
// Nutzer konfigurieren ihre eigenen Links in der App (gespeichert in localStorage).
const DEFAULT_QUICK_LINKS: QuickLink[] = [
  { label: 'Homepage', url: '', icon: 'fa-globe' },
  { label: 'Landing', url: '', icon: 'fa-rocket' },
  { label: 'E-Mail', url: '', icon: 'fa-envelope' },
  { label: 'Twitch', url: '', icon: 'fa-twitch' },
  { label: 'Kick', url: '', icon: 'fa-k' },
  { label: 'TikTok', url: '', icon: 'fa-tiktok' },
  { label: 'Facebook', url: '', icon: 'fa-facebook' },
  { label: 'Link 1', url: '', icon: 'fa-link' },
  { label: 'Link 2', url: '', icon: 'fa-link' },
  { label: 'Link 3', url: '', icon: 'fa-link' },
];

function getQuickLinks(): QuickLink[] {
  try {
    const stored = localStorage.getItem('rhetorix_quick_links');
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_QUICK_LINKS;
}

// Sichere Base64-Konvertierung (kein Stack-Overflow bei großen Arrays)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Wort-Ähnlichkeit berechnen (für Kalibrierungs-Test)
function wordSimilarity(expected: string, actual: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[.,!?;:"""''„"()]/g, '').trim().split(/\s+/).filter(Boolean);
  const expectedWords = norm(expected);
  const actualWords = norm(actual);
  if (expectedWords.length === 0) return 0;
  let matches = 0;
  for (const word of expectedWords) {
    if (actualWords.includes(word)) matches++;
  }
  return matches / expectedWords.length;
}

// Transcribe-API aufrufen
async function transcribeAudio(audioBase64: string, translateTo: string, rawMode: boolean = false): Promise<any> {
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: audioBase64, mimeType: 'audio/webm', translateTo, rawMode }),
  });
  return res.json();
}

// Reine Übersetzung eines bereits transkribierten Textes (für Sprachwechsel im Ergebnis)
async function translateTextApi(text: string, translateTo: string): Promise<{ text?: string; original?: string; error?: string }> {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, translateTo }),
  });
  return res.json();
}

// Schnelle Live-Transkription (für Kalibrierung)
async function transcribeLive(audioBase64: string): Promise<string> {
  const res = await fetch('/api/transcribe-live', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: audioBase64, mimeType: 'audio/webm' }),
  });
  const data = await res.json();
  return data.text || '';
}

interface GlobalDictationOverlayProps {
  isStandalone?: boolean;
}

const GlobalDictationOverlay: React.FC<GlobalDictationOverlayProps> = ({ isStandalone = false }) => {
  const [phase, setPhase] = useState<DictationPhase>('idle');
  const [liveText, setLiveText] = useState('');
  const [resultText, setResultText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [quality, setQuality] = useState<'good' | 'poor'>('good');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [translateTo, setTranslateTo] = useState(() => localStorage.getItem('rhetorix_translate_to') || 'none');
  const [translatorActive, setTranslatorActive] = useState<boolean>(() => isTranslatorActive());
  const [useGemini, setUseGemini] = useState(() => localStorage.getItem('rhetorix_use_gemini') !== 'false');
  const [optimizeMode, setOptimizeMode] = useState(() => localStorage.getItem('rhetorix_optimize_mode') === 'true');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [key1, setKey1] = useState('Shift');
  const [key2, setKey2] = useState(' ');
  const [testStep, setTestStep] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(() => localStorage.getItem('rhetorix_tts_enabled') !== 'false');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [testResults, setTestResults] = useState<Array<{expected: string; got: string; passed: boolean; similarity: number}>>([]);

  const activeElementRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveTranscribingRef = useRef(false);
  const liveAbortRef = useRef<AbortController | null>(null);
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});
  const phaseRef = useRef<DictationPhase>('idle');
  const sourceTextRef = useRef(''); // deutscher Whisper-Text als Quelle für Nach-Übersetzung
  const testModeActiveRef = useRef(false);
  const testStepRef = useRef(0);
  const speechRecRef = useRef<any>(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { testStepRef.current = testStep; }, [testStep]);

  const loadShortcutKeys = () => {
    const saved = localStorage.getItem('rhetorix_voice_shortcut_keys');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.key1 && parsed.key2) { setKey1(parsed.key1); setKey2(parsed.key2); }
      } catch { /* default */ }
    }
  };

  useEffect(() => { loadShortcutKeys(); }, []);

  // Übersetzer-Master-Schalter synchron halten (anderes Fenster ändert ihn per localStorage)
  useEffect(() => {
    const sync = () => setTranslatorActive(isTranslatorActive());
    const onStorage = (e: StorageEvent) => { if (e.key === TRANSLATOR_ACTIVE_KEY) sync(); };
    const onCustom = () => sync();
    window.addEventListener('storage', onStorage);
    window.addEventListener('rhetorix-translator-active', onCustom as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('rhetorix-translator-active', onCustom as EventListener);
    };
  }, []);
  useEffect(() => { localStorage.setItem('rhetorix_translate_to', translateTo); }, [translateTo]);
  useEffect(() => { localStorage.setItem('rhetorix_use_gemini', String(useGemini)); }, [useGemini]);
  useEffect(() => { localStorage.setItem('rhetorix_optimize_mode', String(optimizeMode)); }, [optimizeMode]);

  const insertTextAtCursor = (el: HTMLInputElement | HTMLTextAreaElement, text: string) => {
    if (isStandalone && (window as any).electronAPI?.insertGlobalText) {
      // Global Paste Modus
      (window as any).electronAPI.insertGlobalText(text.trim());
      return;
    }

    // Lokaler Modus
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const newValue = el.value.substring(0, start) + text + el.value.substring(end);
    const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (nativeSetter) nativeSetter.call(el, newValue);
    else el.value = newValue;
    el.selectionStart = el.selectionEnd = start + text.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    window.dispatchEvent(new CustomEvent('rhetorix-dictation-text', { detail: { text: newValue } }));
  };

  const speakText = useCallback((text: string) => {
    if (!text.trim() || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'de-DE';
    utter.rate = 0.95;
    // Deutsche Stimme bevorzugen
    const voices = window.speechSynthesis.getVoices();
    const deVoice = voices.find(v => v.lang.startsWith('de'));
    if (deVoice) utter.voice = deVoice;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  // Zielsprache umschalten. Im Ergebnis-Zustand wird der bereits transkribierte
  // deutsche Text sofort neu übersetzt — ohne erneut aufzunehmen.
  const handleChangeTargetLang = useCallback(async (lang: string) => {
    setTranslateTo(lang);
    if (phaseRef.current !== 'result') return; // während Aufnahme greift die Wahl erst beim Stoppen
    const source = sourceTextRef.current;
    if (!source) return;
    stopSpeaking();
    if (lang === 'none') {
      setResultText(source);
      setFeedback('Original (Deutsch)');
      return;
    }
    setIsOptimizing(true);
    try {
      const data = await translateTextApi(source, lang);
      if (data.text) {
        setResultText(data.text);
        setOriginalText(source);
        const label = LANGUAGES.find(l => l.code === lang)?.label || lang;
        setFeedback('Übersetzt (' + label + ')');
        if (isStandalone && (window as any).electronAPI?.notifyDictationResult) {
          (window as any).electronAPI.notifyDictationResult(source, data.text);
        }
      } else if (data.error) {
        setFeedback('Übersetzung fehlgeschlagen');
      }
    } catch (e) {
      setFeedback('Übersetzung fehlgeschlagen');
    } finally {
      setIsOptimizing(false);
    }
  }, [isStandalone, stopSpeaking]);

  useEffect(() => {
    localStorage.setItem('rhetorix_tts_enabled', String(ttsEnabled));
  }, [ttsEnabled]);

  const playBeep = (freq: number) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
      // AudioContext nach Beep-Ende schließen
      setTimeout(() => { if (ctx.state !== 'closed') try { ctx.close(); } catch { /* */ } }, 200);
    } catch { /* */ }
  };

  // Live-Transkription: Alle 1.5s kumulative Chunks an Whisper-base senden
  const startLiveTranscription = useCallback(() => {
    // Vorherigen Timer aufräumen (verhindert Doppel-Timer bei schnellem Klick)
    if (liveTimerRef.current) { clearInterval(liveTimerRef.current); liveTimerRef.current = null; }
    liveTimerRef.current = setInterval(async () => {
      if (phaseRef.current !== 'recording' || liveTranscribingRef.current) return;
      if (chunksRef.current.length < 2) return;

      liveTranscribingRef.current = true;

      // Vorherigen Request abbrechen falls noch laufend
      if (liveAbortRef.current) liveAbortRef.current.abort();
      const controller = new AbortController();
      liveAbortRef.current = controller;

      try {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const buffer = await blob.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);

        const res = await fetch('/api/transcribe-live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio: base64, mimeType: 'audio/webm' }),
          signal: controller.signal,
        });
        const data = await res.json();

        if (data.text && phaseRef.current === 'recording') {
          setLiveText(data.text);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') console.warn('[LiveTranscribe]', err.message);
      } finally {
        // Controller freigeben wenn noch aktuell
        if (liveAbortRef.current === controller) liveAbortRef.current = null;
      }
      liveTranscribingRef.current = false;
    }, 1500);
  }, []);

  const stopLiveTranscription = useCallback(() => {
    if (liveTimerRef.current) {
      clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    if (liveAbortRef.current) {
      liveAbortRef.current.abort();
      liveAbortRef.current = null;
    }
    liveTranscribingRef.current = false;
  }, []);

  // Legacy-Stubs (Web Speech API entfernt)
  const startSpeechRecognition = useCallback(() => {}, []);
  const stopSpeechRecognition = useCallback(() => {}, []);

  const startRecording = useCallback(async () => {
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'test') return;
    const isTest = phaseRef.current === 'test';
    console.log('[Dictation] Aufnahme startet...');

    // Ziel-Element finden
    if (!isTest && !isStandalone) {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        activeElementRef.current = active;
      } else {
        const backup = document.querySelector('textarea, input[type="text"]') as HTMLInputElement | HTMLTextAreaElement;
        if (backup) { backup.focus(); activeElementRef.current = backup; }
      }
    }

    try {
      setErrorMsg(null);
      setResultText('');
      setOriginalText('');
      setFeedback('');
      setLiveText('');
      setRecordingDuration(0);
      chunksRef.current = [];

      const stream = await getUserMicrophoneStream();
      streamRef.current = stream;
      console.log('[Dictation] Mikrofon OK:', stream.getTracks().map(t => t.label).join(', '));

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(500);
      setPhase('recording');
      playBeep(600);
      // Main-Prozess informieren → Space global registrieren
      if (isStandalone && (window as any).electronAPI?.notifyRecordingStarted) {
        (window as any).electronAPI.notifyRecordingStarted();
      }

      // Timer: Aufnahmedauer (alten Timer vorher aufräumen)
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Live-Transkription: Alle 3s bisherige Aufnahme an Whisper senden
      startLiveTranscription();

    } catch (err: any) {
      console.error('[Dictation] Aufnahme-Fehler:', err);
      setErrorMsg(`Mikrofon-Fehler: ${err.message}`);
      setPhase('idle');
    }
  }, [startLiveTranscription]);

  const stopRecording = useCallback(async () => {
    if (phaseRef.current !== 'recording') return;
    console.log('[Dictation] Aufnahme stoppt...');

    // Timer & Live-Transkription stoppen
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    stopLiveTranscription();
    playBeep(450);
    // Main-Prozess informieren → Space-Shortcut freigeben
    if (isStandalone && (window as any).electronAPI?.notifyRecordingStopped) {
      (window as any).electronAPI.notifyRecordingStopped();
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder) { setPhase('idle'); return; }

    setPhase('processing');

    await new Promise<void>((resolve) => { recorder.onstop = () => resolve(); recorder.stop(); });

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    console.log('[Dictation] Finale Audio-Größe:', Math.round(blob.size / 1024), 'KB');

    if (blob.size < 1000) {
      setErrorMsg('Aufnahme zu kurz. Bitte länger sprechen.');
      setPhase('idle');
      return;
    }

    try {
      const buffer = await blob.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);

      // Test-Modus: Speech Recognition Live-Text für Vergleich nutzen
      if (testModeActiveRef.current) {
        const gotText = liveText || await transcribeLive(base64);
        const currentStep = testStepRef.current;
        const expected = TEST_SENTENCES[currentStep - 1]?.text || '';
        const sim = wordSimilarity(expected, gotText);
        const passed = sim >= 0.5;
        console.log(`[Test] Schritt ${currentStep}: erwartet="${expected}" erkannt="${gotText}" sim=${Math.round(sim*100)}%`);

        setTestResults(prev => [...prev, { expected, got: gotText, passed, similarity: Math.round(sim * 100) }]);
        setTestStep(currentStep + 1);
        setPhase('test');
        playBeep(passed ? 800 : 300);
        return;
      }

      // useGemini=false bedeutet "rawMode=true" (1:1 Diktat ohne KI Korrektur)
      // Übersetzung nur, wenn der Master-Schalter an ist — sonst hart 'none'.
      const effectiveTranslateTo = translatorActive ? translateTo : 'none';
      const data = await transcribeAudio(base64, effectiveTranslateTo, !useGemini);
      console.log('[Dictation] Gemini Ergebnis:', JSON.stringify(data).substring(0, 300));

      if (data.error) {
        setErrorMsg(data.error);
        setPhase('idle');
        return;
      }

      const rawText = data.text || '';
      // Quelle für spätere Sprachwechsel = deutscher Originaltext (bei Übersetzung data.original, sonst der Text selbst)
      sourceTextRef.current = data.original || rawText;
      setOriginalText(data.original || rawText);
      setFeedback(data.feedback || '');
      setQuality(data.quality === 'poor' ? 'poor' : 'good');

      // KI-Optimierung wenn aktiviert
      if (optimizeMode && rawText.trim().length > 0) {
        setResultText(rawText);
        setPhase('result');
        setIsOptimizing(true);
        try {
          const optRes = await fetch('/api/optimize-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: rawText }),
          });
          const optData = await optRes.json();
          if (optData.text) {
            setResultText(optData.text);
            setOriginalText(rawText);
            setFeedback('KI-optimiert');
            if (isStandalone && (window as any).electronAPI?.notifyDictationResult) {
              (window as any).electronAPI.notifyDictationResult(rawText, optData.text);
            }
          }
        } catch (e) {
          console.error('[Optimize] Fehler:', e);
        } finally {
          setIsOptimizing(false);
        }
      } else {
        setResultText(rawText);
        setPhase('result');
        if (isStandalone && (window as any).electronAPI?.notifyDictationResult) {
          (window as any).electronAPI.notifyDictationResult(rawText, rawText);
        }
      }
      // Text wird NICHT auto-eingefügt — User reviewt erst und drückt nochmal Shortcut
    } catch (err: any) {
      console.error('[Dictation] Transcribe-Fehler:', err);
      setErrorMsg(`Transkriptions-Fehler: ${err.message}`);
      if (testModeActiveRef.current) {
        const currentStep = testStepRef.current;
        setTestResults(prev => [...prev, { expected: TEST_SENTENCES[currentStep - 1]?.text || '', got: '(Fehler)', passed: false, similarity: 0 }]);
        setTestStep(currentStep + 1);
        setPhase('test');
      } else {
        setPhase('idle');
      }
    }
  }, [translateTo, translatorActive, liveText, stopLiveTranscription, useGemini, isStandalone]);

  const dismiss = useCallback(() => {
    stopSpeaking();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    stopLiveTranscription();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* */ }
    }
    testModeActiveRef.current = false;
    setPhase('idle');
    setErrorMsg(null);
    setLiveText('');
    setTestStep(0);
    setTestResults([]);

    if (isStandalone && (window as any).electronAPI?.hideDictationOverlay) {
      (window as any).electronAPI.hideDictationOverlay();
    }
  }, [stopLiveTranscription, stopSpeaking, isStandalone]);

  // Test-Modus starten
  const startTestMode = useCallback(() => {
    testModeActiveRef.current = true;
    setPhase('test');
    setTestStep(1);
    setTestResults([]);
    setLiveText('');
    setResultText('');
    setFeedback('');
    setErrorMsg(null);
  }, []);

  // 3. Schritt: Text bestätigen und in das ursprüngliche Textfeld einfügen
  const confirmAndInsert = useCallback(() => {
    if (!resultText) { dismiss(); return; }
    console.log('[Dictation] Text einfügen:', resultText.substring(0, 80));
    if (isStandalone) {
      insertTextAtCursor(null as any, ' ' + resultText.trim());
    } else if (activeElementRef.current) {
      insertTextAtCursor(activeElementRef.current, ' ' + resultText.trim());
    }
    dismiss();
  }, [resultText, isStandalone, dismiss]);

  // 3-Schritt-Toggle: idle→recording, recording→result, result→insert+close
  const toggleRecording = useCallback(() => {
    const current = phaseRef.current;
    if (current === 'idle') startRecording();
    else if (current === 'recording') stopRecording();
    else if (current === 'result') confirmAndInsert();
  }, [startRecording, stopRecording, confirmAndInsert]);

  // External events
  useEffect(() => {
    const onStart = () => startRecording();
    const onStop = () => { if (phaseRef.current === 'recording') stopRecording(); else dismiss(); };
    const onTest = () => startTestMode();
    window.addEventListener('rhetorix-force-start-dictation', onStart);
    window.addEventListener('rhetorix-force-stop-dictation', onStop);
    window.addEventListener('rhetorix-start-mic-test', onTest);

    let removeIpcListener: (() => void) | null = null;
    let removeToggleListener: (() => void) | null = null;
    if (isStandalone && (window as any).electronAPI?.onGlobalDictationStart) {
      removeIpcListener = (window as any).electronAPI.onGlobalDictationStart(() => {
        startRecording();
      });
    }
    // Neuer Toggle-Handler für den globalen Shortcut (3-Schritt-Flow)
    if (isStandalone && (window as any).electronAPI?.onGlobalDictationToggle) {
      removeToggleListener = (window as any).electronAPI.onGlobalDictationToggle(() => {
        toggleRecording();
      });
    }
    // Globale Leertaste → Aufnahme stoppen (Space wird während Aufnahme global registriert)
    let removeStopListener: (() => void) | null = null;
    if (isStandalone && (window as any).electronAPI?.onGlobalDictationStop) {
      removeStopListener = (window as any).electronAPI.onGlobalDictationStop(() => {
        if (phaseRef.current === 'recording') stopRecording();
      });
    }

    // Übersetzungs-Popup (F2): eingehenden Fremdtext übersetzt anzeigen
    let removeShowTranslation: (() => void) | null = null;
    if (isStandalone && (window as any).electronAPI?.onShowTranslation) {
      removeShowTranslation = (window as any).electronAPI.onShowTranslation((payload: { text?: string; original?: string }) => {
        const src = payload?.original || '';
        sourceTextRef.current = src;
        setOriginalText(src);
        setResultText(payload?.text || '');
        setFeedback('Übersetzt → Deutsch');
        setQuality('good');
        setErrorMsg(null);
        setPhase('result');
      });
    }

    return () => {
      window.removeEventListener('rhetorix-force-start-dictation', onStart);
      window.removeEventListener('rhetorix-force-stop-dictation', onStop);
      window.removeEventListener('rhetorix-start-mic-test', onTest);
      if (removeIpcListener) removeIpcListener();
      if (removeToggleListener) removeToggleListener();
      if (removeStopListener) removeStopListener();
      if (removeShowTranslation) removeShowTranslation();
    };
  }, [startRecording, stopRecording, dismiss, startTestMode, isStandalone, toggleRecording]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      loadShortcutKeys();
      keysPressedRef.current[e.key] = true;

      // Während Aufnahme: nur Leertaste zum Stoppen
      if (phaseRef.current === 'recording' && e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        stopRecording();
        return;
      }

      // Ergebnis: Leertaste = Einfügen, Escape = Abbrechen
      if (phaseRef.current === 'result') {
        if (e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          confirmAndInsert();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          dismiss();
          return;
        }
      }

      // Test-Modus: Leertaste/Escape
      if (phaseRef.current === 'test' && (e.key === ' ' || e.key === 'Escape')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape' || testStepRef.current > TEST_SENTENCES.length) {
          dismiss();
        } else {
          startRecording();
        }
        return;
      }

      // Start: Volle Tastenkombination
      const checkKey1 = key1 === ' ' ? ' ' : key1;
      const checkKey2 = key2 === ' ' ? ' ' : key2;
      const isModifier =
        (checkKey1 === 'Control' && e.ctrlKey) ||
        (checkKey1 === 'Alt' && e.altKey) ||
        (checkKey1 === 'Meta' && e.metaKey) ||
        (checkKey1 === 'Shift' && e.shiftKey) ||
        keysPressedRef.current[checkKey1] === true;
      const isKey2 =
        keysPressedRef.current[checkKey2] === true ||
        (checkKey2.length === 1 && e.key.toLowerCase() === checkKey2.toLowerCase());

      if (isModifier && isKey2) {
        e.preventDefault();
        e.stopPropagation();
        toggleRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => { keysPressedRef.current[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [key1, key2, toggleRecording, stopRecording, dismiss, startRecording, confirmAndInsert, isStandalone]);

  const isVisible = phase !== 'idle';
  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const shortcutLabel = `${key1 === ' ' ? '␣' : key1} + ${key2 === ' ' ? '␣' : key2}`;

  const TEST_SENTENCES = [
    { prompt: 'Sage laut:', text: 'Heute ist ein schöner Tag und ich freue mich.' },
    { prompt: 'Sage laut:', text: 'Die Katze sitzt auf dem Dach und schaut nach unten.' },
    { prompt: 'Sage laut:', text: 'Morgen gehe ich einkaufen und koche etwas Leckeres.' },
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.97 }}
          className={
            isStandalone
              ? "w-full bg-gray-950/98 backdrop-blur-md text-white p-3 rounded-xl border border-indigo-500/30 shadow-[0_8px_32px_rgba(99,102,241,0.35)] flex flex-col gap-1.5"
              : "fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-2xl bg-gray-950/95 backdrop-blur-md text-white p-5 rounded-[2rem] border border-indigo-500/20 shadow-[0_20px_50px_rgba(99,102,241,0.25)] flex flex-col gap-3"
          }
        >
          {/* TEST-MODUS / KALIBRIERUNG */}
          {phase === 'test' && (
            <>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${testStep <= TEST_SENTENCES.length ? 'bg-cyan-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Mikrofon-Kalibrierung</p>
                    <p className="text-xs font-black text-cyan-400 italic mt-1 uppercase tracking-tight">
                      {testStep <= TEST_SENTENCES.length ? `Schritt ${testStep} von ${TEST_SENTENCES.length}` : 'Ergebnis'}
                    </p>
                  </div>
                </div>
                <button onClick={dismiss} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                  <i className="fas fa-times text-xs" />
                </button>
              </div>

              {/* Bisherige Ergebnisse (während Test läuft) */}
              {testResults.length > 0 && testStep <= TEST_SENTENCES.length && (
                <div className="space-y-1">
                  {testResults.map((r, i) => (
                    <div key={i} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${r.passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      <i className={`fas ${r.passed ? 'fa-check' : 'fa-xmark'}`} />
                      <span className="truncate">Satz {i + 1}: {r.similarity}% erkannt</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Aktueller Satz zum Sprechen */}
              {testStep <= TEST_SENTENCES.length && (
                <div className="p-4 bg-cyan-500/5 rounded-xl border border-cyan-500/20">
                  <p className="text-[10px] text-cyan-400/60 font-bold uppercase tracking-widest mb-2">
                    <i className="fas fa-microphone mr-1" />{TEST_SENTENCES[testStep - 1].prompt}
                  </p>
                  <p className="text-base text-white font-bold leading-relaxed">
                    „{TEST_SENTENCES[testStep - 1].text}"
                  </p>
                  <p className="text-[10px] text-gray-500 mt-3">
                    Drücke <span className="text-white font-bold">Leertaste</span> um aufzunehmen, dann nochmal <span className="text-white font-bold">Leertaste</span> zum Stoppen.
                  </p>
                </div>
              )}

              {/* Zusammenfassung (nach allen Schritten) */}
              {testStep > TEST_SENTENCES.length && (
                <div className="space-y-3">
                  {testResults.map((r, i) => (
                    <div key={i} className={`flex items-center justify-between px-4 py-3 rounded-xl ${r.passed ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <i className={`fas ${r.passed ? 'fa-circle-check text-emerald-400' : 'fa-circle-xmark text-red-400'} text-lg flex-shrink-0`} />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-300 font-bold">Satz {i + 1}</p>
                          <p className="text-[10px] text-gray-500 truncate">„{r.got || '(nichts erkannt)'}"</p>
                        </div>
                      </div>
                      <span className={`text-sm font-black flex-shrink-0 ml-2 ${r.passed ? 'text-emerald-400' : 'text-red-400'}`}>{r.similarity}%</span>
                    </div>
                  ))}

                  {(() => {
                    const passCount = testResults.filter(r => r.passed).length;
                    const isGood = passCount >= 2;
                    return (
                      <div className={`p-4 rounded-xl border ${isGood ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                        <div className="flex items-center gap-3">
                          <i className={`fas ${isGood ? 'fa-microphone-lines text-emerald-400' : 'fa-triangle-exclamation text-amber-400'} text-xl`} />
                          <div>
                            <p className={`text-sm font-black ${isGood ? 'text-emerald-300' : 'text-amber-300'}`}>
                              {isGood ? 'Mikrofon funktioniert!' : 'Erkennung nicht optimal'}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {passCount}/{TEST_SENTENCES.length} Sätze korrekt erkannt
                              {!isGood && ' — Prüfe Mikrofon-Auswahl oder sprich lauter/deutlicher'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <p className="text-[10px] text-gray-500 font-bold text-center uppercase tracking-wider">
                    Leertaste oder Escape zum Schließen
                  </p>
                </div>
              )}
            </>
          )}

          {/* AUFNAHME */}
          {phase === 'recording' && (
            <>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="flex h-3.5 w-3.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500" />
                  </span>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Aufnahme</p>
                    <p className="text-xs font-black text-white italic mt-1 uppercase tracking-tight">{formatDuration(recordingDuration)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUseGemini(!useGemini)}
                    title="Gemini KI Korrektur an/ausschalten"
                    className={`text-[9px] font-bold px-2 py-1 rounded-md transition-colors ${useGemini ? 'bg-indigo-500/20 text-indigo-300' : 'bg-gray-500/20 text-gray-400'}`}
                  >
                    <i className={`fas fa-wand-magic-sparkles mr-1`}></i>KI {useGemini ? 'An' : 'Aus'}
                  </button>
                  <button
                    onClick={() => setOptimizeMode(!optimizeMode)}
                    title="Text nach Transkription optimieren (Grammatik, Stil, Ausdruck)"
                    className={`text-[9px] font-bold px-2 py-1 rounded-md transition-colors ${optimizeMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-400'}`}
                  >
                    <i className={`fas fa-gem mr-1`}></i>Optimieren {optimizeMode ? 'An' : 'Aus'}
                  </button>
                  <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-1 rounded-md font-mono">{shortcutLabel}</span>
                  <button onClick={dismiss} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                    <i className="fas fa-times text-xs" />
                  </button>
                </div>
              </div>

              {/* Übersetzungs-Auswahl — direkt beim Einsprechen wählbar (nur wenn Übersetzer aktiv) */}
              {translatorActive && (
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${translateTo !== 'none' ? 'bg-indigo-500/15 border border-indigo-500/30' : 'bg-white/5'}`}>
                  <i className="fas fa-language text-indigo-400 text-xs" />
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Übersetzen</span>
                  <select
                    value={translateTo}
                    onChange={(e) => handleChangeTargetLang(e.target.value)}
                    className="flex-1 text-[10px] font-bold text-gray-200 bg-transparent outline-none appearance-none cursor-pointer"
                  >
                    {LANGUAGES.map(l => (
                      <option key={l.code} value={l.code} className="bg-gray-900">{l.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Waveform */}
              <div className="flex items-center justify-center gap-0.5 h-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1].map((val, idx) => (
                  <motion.div
                    key={idx}
                    animate={{ height: ['3px', `${val * 3}px`, '3px'] }}
                    transition={{ repeat: Infinity, duration: 0.8 + idx * 0.04, delay: idx * 0.03 }}
                    className="w-0.5 bg-red-400 rounded-full"
                  />
                ))}
              </div>

              {/* Live-Text Vorschau */}
              <div className={`p-2.5 bg-white/5 rounded-xl overflow-y-auto ${isStandalone ? 'min-h-[44px] max-h-20' : 'min-h-[60px] max-h-40'}`}>
                {liveText ? (
                  <p className="text-sm text-gray-200 leading-relaxed italic">
                    <i className="fas fa-quote-left text-indigo-500/40 text-[8px] mr-1" />
                    {liveText}
                    <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ml-0.5 align-middle" />
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 italic text-center">
                    {recordingDuration < 2 ? 'Sprich jetzt...' : 'Echtzeit-Erkennung läuft...'}
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider px-1">
                <span><i className="fas fa-keyboard mr-1" />Leertaste = Stoppen</span>
                <button onClick={stopRecording} className="text-red-400 hover:text-red-300 font-black">
                  <i className="fas fa-stop-circle mr-1" />Stoppen
                </button>
              </div>
            </>
          )}

          {/* VERARBEITUNG */}
          {phase === 'processing' && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Verarbeitung</p>
                  <p className="text-xs text-gray-300">Gemini transkribiert & korrigiert...</p>
                </div>
              </div>
              {liveText && (
                <div className="p-3 bg-white/5 rounded-xl">
                  <p className="text-sm text-gray-400 italic">Vorschau: „{liveText}"</p>
                </div>
              )}
            </>
          )}

          {/* ERGEBNIS */}
          {phase === 'result' && (
            <>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${quality === 'good' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Ergebnis</p>
                    <p className="text-xs font-black text-white italic mt-1 uppercase tracking-tight">
                      {quality === 'good' ? 'Transkription erfolgreich' : 'Qualitäts-Problem'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* TTS Vorschau-Button */}
                  {resultText && (
                    <button
                      onClick={() => isSpeaking ? stopSpeaking() : speakText(resultText)}
                      title={isSpeaking ? 'Vorlesen stoppen' : 'Text vorlesen'}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${isSpeaking ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/10 hover:bg-white/20 text-gray-300'}`}
                    >
                      <i className={`fas ${isSpeaking ? 'fa-stop' : 'fa-volume-high'} text-xs`} />
                      {isSpeaking ? 'Stopp' : 'Vorlesen'}
                    </button>
                  )}
                  {/* TTS Auto-Toggle */}
                  <button
                    onClick={() => setTtsEnabled(!ttsEnabled)}
                    title="Automatisches Vorlesen an/aus"
                    className={`text-[9px] font-bold px-2 py-1 rounded-md transition-colors ${ttsEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-500'}`}
                  >
                    <i className="fas fa-ear-listen mr-1" />Auto
                  </button>
                  <button onClick={dismiss} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                    <i className="fas fa-times text-xs" />
                  </button>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-xl space-y-3">
                {quality === 'poor' && (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                    <i className="fas fa-volume-low text-amber-400" />
                    <span className="text-xs text-amber-300 font-bold">Audio zu leise/unverständlich — nicht eingefügt</span>
                  </div>
                )}

                {errorMsg ? (
                  <p className="text-sm text-rose-400">{errorMsg}</p>
                ) : (
                  <div>
                    <p className="text-base text-white leading-relaxed font-medium max-h-28 overflow-y-auto">
                      „{resultText}"
                    </p>
                    {isOptimizing && (
                      <div className="flex items-center gap-2 mt-2 text-emerald-400">
                        <i className="fas fa-spinner fa-spin text-xs" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Text wird optimiert...</span>
                      </div>
                    )}
                  </div>
                )}

                {originalText && originalText !== resultText && (
                  <p className="text-xs text-gray-400 italic border-t border-white/5 pt-2">
                    <i className="fas fa-quote-left text-gray-500 text-[8px] mr-1" />
                    Original: „{originalText}"
                  </p>
                )}

                {feedback && (
                  <div className={`flex items-center gap-1.5 ${quality === 'poor' ? 'text-amber-400' : 'text-emerald-400'}`}>
                    <i className={`fas ${quality === 'poor' ? 'fa-triangle-exclamation' : 'fa-check-circle'} text-xs`} />
                    <span className="text-[11px] font-bold">{feedback}</span>
                  </div>
                )}

                {quality === 'poor' && resultText && (
                  <button
                    onClick={() => {
                      if (isStandalone) {
                        insertTextAtCursor(null as any, ' ' + resultText.trim());
                        setQuality('good');
                      } else if (activeElementRef.current) {
                        insertTextAtCursor(activeElementRef.current, ' ' + resultText.trim());
                        setQuality('good');
                      }
                    }}
                    className="w-full py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
                  >
                    Trotzdem einfügen
                  </button>
                )}
              </div>

              {/* Übersetzungs-Dropdown — schaltet die Zielsprache sofort um (nur wenn Übersetzer aktiv) */}
              {translatorActive && (
                <div className="flex items-center gap-2 px-1">
                  <i className="fas fa-language text-indigo-400 text-xs" />
                  <select
                    value={translateTo}
                    onChange={(e) => handleChangeTargetLang(e.target.value)}
                    className="flex-1 text-[10px] font-bold text-gray-300 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 outline-none appearance-none cursor-pointer"
                  >
                    {LANGUAGES.map(l => (
                      <option key={l.code} value={l.code} className="bg-gray-900">{l.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Einfügen-Button für Standalone/Global Modus */}
              {isStandalone && resultText && quality === 'good' && (
                <button
                  onClick={confirmAndInsert}
                  className="w-full py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                >
                  <i className="fas fa-paste mr-2" />Einfügen (Shortcut)
                </button>
              )}

              {/* Quick-Links zum schnellen Einfügen — nur in eingebetteter App */}
              {!isStandalone && <div className="flex flex-wrap gap-1.5 px-1">
                {getQuickLinks().filter(l => l.url).map((link, i) => {
                  const brandIcons = ['fa-twitch', 'fa-tiktok', 'fa-facebook', 'fa-pinterest', 'fa-github', 'fa-youtube', 'fa-instagram', 'fa-twitter', 'fa-discord', 'fa-linkedin'];
                  const iconPrefix = brandIcons.includes(link.icon) ? 'fab' : 'fas';
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (isStandalone) {
                          insertTextAtCursor(null as any, ' ' + link.url);
                        } else if (activeElementRef.current) {
                          insertTextAtCursor(activeElementRef.current, ' ' + link.url);
                        }
                        dismiss();
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/30 rounded-lg text-[10px] font-bold text-gray-300 hover:text-indigo-300 transition-all"
                      title={link.url}
                    >
                      <i className={`${iconPrefix} ${link.icon} text-[9px]`} />
                      {link.label}
                    </button>
                  );
                })}
              </div>}

              <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider px-1">
                <span>{quality === 'good' ? 'Shortcut nochmal drücken = Einfügen' : 'Bitte erneut versuchen'}</span>
                <button onClick={dismiss} className="text-indigo-400 hover:text-indigo-300 font-black">
                  Abbrechen (Esc)
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalDictationOverlay;
