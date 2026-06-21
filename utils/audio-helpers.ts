
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Dekodiert PCM-Daten in einen AudioBuffer.
 * @param data Die Rohdaten (PCM Int16)
 * @param ctx Der AudioContext (sollte 48000Hz oder 44100Hz haben)
 * @param sourceSampleRate Die Rate der Quelle (meist 24000Hz für Gemini TTS)
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sourceSampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  
  // Wir erstellen den Buffer mit der Quell-Sample-Rate. 
  // Der AudioContext sorgt beim Abspielen automatisch für das Resampling auf seine eigene Rate (z.B. 48kHz).
  const buffer = ctx.createBuffer(numChannels, frameCount, sourceSampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Normalisierung von Int16 auf Float32 (-1.0 bis 1.0)
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Erstellt eine professionelle Audio-Kette für die Sprachausgabe.
 * Beinhaltet einen DynamicsCompressor für eine gleichmäßigere Lautstärke.
 */
export function createAudioChain(ctx: AudioContext) {
  const gainNode = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  
  // Sanfte Kompression für klarere Stimme
  compressor.threshold.setValueAtTime(-24, ctx.currentTime);
  compressor.knee.setValueAtTime(30, ctx.currentTime);
  compressor.ratio.setValueAtTime(12, ctx.currentTime);
  compressor.attack.setValueAtTime(0.003, ctx.currentTime);
  compressor.release.setValueAtTime(0.25, ctx.currentTime);

  gainNode.gain.setValueAtTime(1.2, ctx.currentTime); // Leichte Anhebung der Gesamtlautstärke

  compressor.connect(gainNode);
  gainNode.connect(ctx.destination);

  return { input: compressor, gain: gainNode };
}

export function createBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}
