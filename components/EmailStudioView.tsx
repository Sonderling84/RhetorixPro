
import React, { useState, useRef, useEffect } from 'react';
import { getGeminiAI } from '../utils/gemini-client';
import { Modality, LiveServerMessage } from '@google/genai';
import { AppMode, SessionResult } from '../types';
import { createBlob } from '../utils/audio-helpers';
import { motion, AnimatePresence } from 'motion/react';
import { dispatchDictation } from '../utils/dictation-events';

interface EmailStudioProps {
  onSave: (s: SessionResult) => void;
  addLog: (m: string, l?: any) => void;
}

type Step = 'CONFIG' | 'DICTATE' | 'REVIEW';

const EmailStudioView: React.FC<EmailStudioProps> = ({ onSave, addLog }) => {
  const [step, setStep] = useState<Step>('CONFIG');
  const [recipient, setRecipient] = useState('');
  const [politeness, setPoliteness] = useState<'formal' | 'informal'>('formal');
  const [subject, setSubject] = useState('');
  
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [improvedEmail, setImprovedEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);

  // Restore draft on mount
  useEffect(() => {
    const savedRecipient = localStorage.getItem('rhetorix_autosave_email_recipient');
    if (savedRecipient) setRecipient(savedRecipient);

    const savedPoliteness = localStorage.getItem('rhetorix_autosave_email_politeness');
    if (savedPoliteness) setPoliteness(savedPoliteness as 'formal' | 'informal');

    const savedSubject = localStorage.getItem('rhetorix_autosave_email_subject');
    if (savedSubject) setSubject(savedSubject);

    const savedTranscription = localStorage.getItem('rhetorix_autosave_email_transcription');
    if (savedTranscription) setTranscription(savedTranscription);

    const savedImproved = localStorage.getItem('rhetorix_autosave_email_improved');
    if (savedImproved) setImprovedEmail(savedImproved);
  }, []);

  // Save changes automatically
  useEffect(() => {
    if (recipient) {
      localStorage.setItem('rhetorix_autosave_email_recipient', recipient);
      setIsAutoSaving(true);
      const timer = setTimeout(() => setIsAutoSaving(false), 800);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('rhetorix_autosave_email_recipient');
    }
  }, [recipient]);

  useEffect(() => {
    localStorage.setItem('rhetorix_autosave_email_politeness', politeness);
  }, [politeness]);

  useEffect(() => {
    if (subject) {
      localStorage.setItem('rhetorix_autosave_email_subject', subject);
      setIsAutoSaving(true);
      const timer = setTimeout(() => setIsAutoSaving(false), 800);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('rhetorix_autosave_email_subject');
    }
  }, [subject]);

  useEffect(() => {
    if (transcription) {
      localStorage.setItem('rhetorix_autosave_email_transcription', transcription);
      setIsAutoSaving(true);
      const timer = setTimeout(() => setIsAutoSaving(false), 800);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('rhetorix_autosave_email_transcription');
    }
  }, [transcription]);

  useEffect(() => {
    if (improvedEmail) {
      localStorage.setItem('rhetorix_autosave_email_improved', improvedEmail);
      setIsAutoSaving(true);
      const timer = setTimeout(() => setIsAutoSaving(false), 800);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('rhetorix_autosave_email_improved');
    }
  }, [improvedEmail]);

  useEffect(() => {
    checkGoogleStatus();
  }, []);

  const checkGoogleStatus = async () => {
    try {
      const res = await fetch('/api/auth/google/status');
      const data = await res.json();
      setIsGoogleConnected(data.isAuthenticated);
    } catch (e) {
      console.error('Failed to check Google status');
    }
  };

  const connectGoogle = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      const { url } = await res.json();
      const authWindow = window.open(url, 'google_auth', 'width=600,height=700');
      
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
          setIsGoogleConnected(true);
          addLog("Google Konto erfolgreich verknüpft!", "success");
          window.removeEventListener('message', handleMessage);
        }
      };
      window.addEventListener('message', handleMessage);
    } catch (e) {
      addLog("Verbindung zu Google fehlgeschlagen", "error");
    }
  };

  const startDictation = async () => {
    if (!recipient || !subject) {
      addLog("Bitte Empfänger und Betreff angeben", "error");
      return;
    }
    setStep('DICTATE');
    setTranscription('');
    setIsRecording(true);
    dispatchDictation('', true);
    addLog("Diktat gestartet...");

    try {
      const ai = await getGeminiAI();
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.0-flash',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "Du bist ein präziser Transkribierer. Schreibe jedes Wort auf Deutsch mit, das du hörst. Achte auf Satzzeichen.",
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            const source = audioContextRef.current!.createMediaStreamSource(streamRef.current!);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(s => {
                sessionRef.current = s;
                s.sendRealtimeInput({ audio: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: (msg: LiveServerMessage) => {
            if (msg.serverContent?.inputTranscription) {
              const newText = msg.serverContent!.inputTranscription!.text;
              setTranscription(prev => {
                const updated = prev + (prev ? " " : "") + newText;
                dispatchDictation(updated, true);
                return updated;
              });
            }
          },
          onerror: (e) => {
            console.error('Live error:', e);
            stopDictation();
          },
          onclose: () => setIsRecording(false)
        }
      });
    } catch (err) {
      addLog("Mikrofon-Zugriff verweigert oder Fehler", "error");
      setIsRecording(false);
      setStep('CONFIG');
    }
  };

  const stopDictation = () => {
    setIsRecording(false);
    dispatchDictation('', false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    improveEmail();
  };

  const improveEmail = async () => {
    setIsProcessing(true);
    setStep('REVIEW');
    addLog("KI optimiert deine E-Mail...");

    try {
      const ai = await getGeminiAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Optimiere diese diktierte E-Mail. 
        Empfänger: ${recipient}
        Betreff: ${subject}
        Höflichkeitsform: ${politeness === 'formal' ? 'Formell (Sie)' : 'Informell (Du)'}
        Diktat: "${transcription}"
        
        Erstelle eine professionelle E-Mail daraus. Korrigiere Fehler und verbessere den Stil.
        Antworte nur mit dem fertigen E-Mail-Text (inklusive Anrede und Grußformel).`
      });

      setImprovedEmail(response.text);
      addLog("E-Mail optimiert!", "success");
    } catch (e) {
      addLog("Fehler bei der Optimierung", "error");
      setImprovedEmail(transcription);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendEmail = async () => {
    if (!isGoogleConnected) {
      connectGoogle();
      return;
    }

    setIsSending(true);
    addLog("Sende E-Mail via Gmail...");

    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient,
          subject: subject,
          body: improvedEmail
        })
      });

      if (res.ok) {
        addLog("E-Mail erfolgreich gesendet!", "success");
        handleSave();
      } else {
        throw new Error("Senden fehlgeschlagen");
      }
    } catch (e) {
      addLog("Fehler beim Senden der E-Mail", "error");
    } finally {
      setIsSending(false);
    }
  };

  const handleSave = () => {
    onSave({
      id: Date.now().toString(),
      timestamp: Date.now(),
      mode: AppMode.EMAIL_STUDIO,
      title: `E-Mail an ${recipient}`,
      transcription,
      correctedText: improvedEmail
    });
    setStep('CONFIG');
    setRecipient('');
    setSubject('');
    setTranscription('');
    setImprovedEmail('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      <AnimatePresence mode="wait">
        {step === 'CONFIG' && (
          <motion.div 
            key="config"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl space-y-6"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tighter italic">E-Mail Studio</h2>
                  {isAutoSaving && (
                    <span className="text-[9px] text-emerald-500 font-bold tracking-widest flex items-center gap-1 normal-case font-mono animate-pulse">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
                      gespeichert
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">Diktieren & Versenden</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
                <i className="fas fa-envelope text-xl"></i>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">Empfänger (E-Mail)</label>
                <input 
                  type="email"
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  placeholder="beispiel@mail.de"
                  className="w-full bg-gray-50 dark:bg-gray-950 border-none rounded-2xl p-4 text-sm font-medium focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">Betreff</label>
                <input 
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Worum geht es?"
                  className="w-full bg-gray-50 dark:bg-gray-950 border-none rounded-2xl p-4 text-sm font-medium focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">Höflichkeitsform</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setPoliteness('formal')}
                    className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${politeness === 'formal' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}
                  >
                    Formell (Sie)
                  </button>
                  <button 
                    onClick={() => setPoliteness('informal')}
                    className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${politeness === 'informal' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}
                  >
                    Informell (Du)
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={startDictation}
              disabled={!recipient || !subject}
              className="w-full bg-blue-600 text-white font-black py-5 rounded-[2rem] shadow-xl active:scale-95 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
            >
              DIKTAT STARTEN
            </button>
          </motion.div>
        )}

        {step === 'DICTATE' && (
          <motion.div 
            key="dictate"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center space-y-8"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-20"></div>
              <button 
                onClick={stopDictation}
                className="w-32 h-32 rounded-full bg-red-500 text-white text-3xl shadow-2xl relative z-10 border-4 border-red-100 active:scale-90 transition-all"
              >
                <i className="fas fa-stop"></i>
              </button>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">Diktat läuft...</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2">Spreche jetzt deine E-Mail</p>
            </div>
            <div className="w-full bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl min-h-[200px]">
              <p className="text-gray-800 dark:text-gray-200 font-medium italic leading-relaxed">
                {transcription || 'Höre zu...'}
              </p>
            </div>
          </motion.div>
        )}

        {step === 'REVIEW' && (
          <motion.div 
            key="review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Optimierte E-Mail</h3>
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <i className="fas fa-spinner fa-spin text-3xl text-blue-600"></i>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">KI veredelt deinen Text...</p>
                </div>
              ) : (
                <textarea 
                  value={improvedEmail}
                  onChange={e => setImprovedEmail(e.target.value)}
                  className="w-full h-64 bg-gray-50 dark:bg-gray-950 border-none rounded-2xl p-6 text-sm font-medium focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 outline-none transition-all resize-none shadow-inner text-gray-800 dark:text-gray-200"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setStep('CONFIG')}
                className="bg-white dark:bg-gray-900 text-gray-400 font-black py-5 rounded-[2rem] text-[10px] uppercase tracking-widest active:scale-95 transition-all border border-gray-100 dark:border-gray-800"
              >
                VERWERFEN
              </button>
              <button 
                onClick={sendEmail}
                disabled={isSending || isProcessing}
                className="bg-blue-600 text-white font-black py-5 rounded-[2rem] text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
              >
                {isSending ? <i className="fas fa-spinner fa-spin"></i> : <i className="fab fa-google"></i>}
                {isSending ? 'SENDE...' : isGoogleConnected ? 'VIA GMAIL SENDEN' : 'GOOGLE VERKNÜPFEN'}
              </button>
            </div>
            
            {!isGoogleConnected && (
              <p className="text-[9px] text-center text-gray-400 font-bold uppercase tracking-widest">
                Verknüpfe dein Google Konto, um direkt aus Rhetorix zu senden.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmailStudioView;
