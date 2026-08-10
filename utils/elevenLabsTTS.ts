/**
 * ElevenLabs TTS — Zentrale Utility für alle Vorlese-Funktionen
 * Ersetzt sowohl Gemini TTS als auch Web Speech API
 */

let currentSource: AudioBufferSourceNode | null = null;
let currentCtx: AudioContext | null = null;

/** Aktuelle Voice-ID aus localStorage oder Default */
export function getVoiceId(): string {
  return localStorage.getItem('rhetorix_elevenlabs_voice_id') || 'piTKgcLEGmPE4e6mEKli';
}

/** Voice-ID speichern (+ an Main-Prozess melden, damit F1/F2/F3 & Übersetzungs-Popup sie nutzen) */
export function setVoiceId(id: string): void {
  localStorage.setItem('rhetorix_elevenlabs_voice_id', id);
  try { (window as any).electronAPI?.setTtsVoice?.(id || null); } catch { /* kein Electron */ }
}

/** Gespeicherte Stimme beim Start an den Main-Prozess pushen (globale Shortcuts). */
export function syncVoiceToMain(): void {
  try { (window as any).electronAPI?.setTtsVoice?.(getVoiceId() || null); } catch { /* */ }
}

/** Laufende Wiedergabe stoppen */
export function stopSpeaking(): void {
  if (currentSource) {
    try { currentSource.stop(); } catch { /* already stopped */ }
    currentSource = null;
  }
  if (currentCtx && currentCtx.state !== 'closed') {
    currentCtx.close();
    currentCtx = null;
  }
}

/** Prüft ob gerade gesprochen wird */
export function isSpeaking(): boolean {
  return currentSource !== null && currentCtx !== null && currentCtx.state === 'running';
}

/**
 * Text über ElevenLabs TTS vorlesen
 * @param text Der vorzulesende Text
 * @param voiceId Optional: Voice-ID (sonst aus Settings)
 * @returns Promise die resolved wenn Audio fertig abgespielt ist
 */
export async function speakElevenLabs(text: string, voiceId?: string): Promise<void> {
  // Vorherige Wiedergabe stoppen
  stopSpeaking();

  if (!text || text.trim().length === 0) return;

  // Text auf 5000 Zeichen limitieren (ElevenLabs Limit)
  const trimmedText = text.trim().substring(0, 5000);

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: trimmedText,
        voiceId: voiceId || getVoiceId(),
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || `TTS Fehler: ${response.status}`);
    }

    const { audio } = await response.json();
    if (!audio) throw new Error('Kein Audio erhalten');

    // Base64 MP3 → ArrayBuffer
    const binaryString = atob(audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // AudioContext erstellen und MP3 dekodieren
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    currentCtx = ctx;
    const buffer = await ctx.decodeAudioData(bytes.buffer.slice(0));

    // Abspielen
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    currentSource = source;

    return new Promise<void>((resolve) => {
      source.onended = () => {
        currentSource = null;
        if (currentCtx === ctx) {
          ctx.close();
          currentCtx = null;
        }
        resolve();
      };
      source.start();
    });
  } catch (err: any) {
    console.error('[ElevenLabs TTS] Fehler:', err.message);
    throw err;
  }
}
