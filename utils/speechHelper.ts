export type VoiceStyle = 'standard' | 'formal' | 'emotional' | 'enthusiastic';
export type GeminiVoice = 'Kore' | 'Aoede' | 'Charon' | 'Puck' | 'Fenrir';

export interface VoicePreference {
  style: VoiceStyle;
  geminiVoice: GeminiVoice;
  speed: number; // Multiplikator (z.B. 0.9 - 1.2)
}

export const getVoicePreference = (): VoicePreference => {
  const style = (localStorage.getItem('rhetorix_voice_style') as VoiceStyle) || 'standard';
  const geminiVoice = (localStorage.getItem('rhetorix_gemini_voice') as GeminiVoice) || 'Kore';
  const speed = parseFloat(localStorage.getItem('rhetorix_tts_speed') || '1.0');
  return { style, geminiVoice, speed };
};

export const saveVoicePreference = (pref: Partial<VoicePreference>) => {
  if (pref.style) localStorage.setItem('rhetorix_voice_style', pref.style);
  if (pref.geminiVoice) localStorage.setItem('rhetorix_gemini_voice', pref.geminiVoice);
  if (pref.speed !== undefined) localStorage.setItem('rhetorix_tts_speed', String(pref.speed));
};

export const selectGermanVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined => {
  const deVoices = voices.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith('de'));
  if (deVoices.length === 0) return undefined;

  return deVoices.sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    
    // Premium/Natürliche Online-Stimmen bevorzugen
    const naturalA = nameA.includes('natural') || nameA.includes('premium') || nameA.includes('online');
    const naturalB = nameB.includes('natural') || nameB.includes('premium') || nameB.includes('online');
    if (naturalA && !naturalB) return -1;
    if (!naturalA && naturalB) return 1;

    // Bevorzugte angenehme Sprecher wie Katja, Amelie, Marlene, Anna, Hedda, Yannick
    const preferred = ['katja', 'hedda', 'amelie', 'marlene', 'anna', 'steffi', 'lisa', 'siri', 'yannick', 'stefan'];
    const indexA = preferred.findIndex(n => nameA.includes(n));
    const indexB = preferred.findIndex(n => nameB.includes(n));
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1 && indexB === -1) return -1;
    if (indexA === -1 && indexB !== -1) return 1;

    // Google-Stimmen
    const googleA = nameA.includes('google');
    const googleB = nameB.includes('google');
    if (googleA && !googleB) return -1;
    if (!googleA && googleB) return 1;

    return 0;
  })[0];
};

export const applyVoiceStyleToUtterance = (utter: SpeechSynthesisUtterance) => {
  const pref = getVoicePreference();
  
  let baseRate = 0.92;
  let basePitch = 1.0;
  
  switch (pref.style) {
    case 'enthusiastic':
      baseRate = 1.05;
      basePitch = 1.15;
      break;
    case 'formal':
      baseRate = 0.90;
      basePitch = 0.90;
      break;
    case 'emotional':
      baseRate = 0.82;
      basePitch = 1.05;
      break;
    case 'standard':
    default:
      baseRate = 0.92;
      basePitch = 1.0;
      break;
  }
  
  utter.rate = baseRate * pref.speed;
  utter.pitch = basePitch;
  
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = selectGermanVoice(voices);
    if (selectedVoice) {
      utter.voice = selectedVoice;
    }
  }
};

export const getGeminiVoiceName = (): GeminiVoice => {
  const pref = getVoicePreference();
  return pref.geminiVoice;
};

export const getUserMicrophoneStream = async (): Promise<MediaStream> => {
  if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Medien-Eingabegeräte werden von diesem Browser nicht unterstützt.");
  }

  // Alle verfügbaren Mics loggen
  try {
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const mics = allDevices.filter(d => d.kind === 'audioinput');
    console.log('[Mic] Verfügbare Mikrofone:', mics.map(d => `${d.label} (${d.deviceId.slice(0, 8)})`).join(', '));
  } catch { /* */ }

  const selectedMicId = localStorage.getItem('rhetorix_selected_mic_id');
  if (selectedMicId && selectedMicId !== 'default') {
    try {
      // EXACT: Erzwingt das ausgewählte Mikrofon (nicht nur "ideal")
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: selectedMicId } }
      });
      const track = stream.getAudioTracks()[0];
      const trackLabel = (track?.label || '').toLowerCase();
      // Virtuelles Mic? → stoppen und Fallback nutzen
      if (trackLabel.includes('virtual') || trackLabel.includes('ndi') || trackLabel.includes('loopback') || trackLabel.includes('blackhole')) {
        console.warn('[Mic] Gespeichertes Mikrofon ist virtuell, suche echtes...');
        stream.getTracks().forEach(t => t.stop());
        localStorage.removeItem('rhetorix_selected_mic_id');
      } else {
        console.log('[Mic] Verwende ausgewähltes Mikrofon:', track?.label || selectedMicId);
        return stream;
      }
    } catch (err) {
      console.warn('[Mic] Ausgewähltes Mikrofon nicht verfügbar, versuche ohne Virtuelle...', err);
    }
  } else if (selectedMicId === 'default') {
    // "default" zeigt oft auf ein virtuelles Gerät → ignorieren, Fallback nutzen
    console.warn('[Mic] System-Default übersprungen (oft virtuell), suche echtes Mic...');
    localStorage.removeItem('rhetorix_selected_mic_id');
  }

  // Fallback: Erstes echtes (nicht-virtuelles) Mikrofon finden
  try {
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const mics = allDevices.filter(d => d.kind === 'audioinput');
    const realMic = mics.find(d => {
      const label = d.label.toLowerCase();
      return !label.includes('virtual') && !label.includes('ndi') && !label.includes('loopback') && !label.includes('blackhole');
    });
    if (realMic) {
      console.log('[Mic] Fallback: Echtes Mikrofon gefunden:', realMic.label);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: realMic.deviceId } }
      });
      // Merken für nächstes Mal
      localStorage.setItem('rhetorix_selected_mic_id', realMic.deviceId);
      return stream;
    }
  } catch { /* */ }

  // Letzter Fallback: System-Default
  console.log('[Mic] Fallback: System-Default');
  return await navigator.mediaDevices.getUserMedia({ audio: true });
};

