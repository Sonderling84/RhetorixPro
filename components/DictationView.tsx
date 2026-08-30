
import React, { useState } from 'react';
import { getGeminiAI } from '../utils/gemini-client';
import { Modality } from '@google/genai';
import { decode, decodeAudioData } from '../utils/audio-helpers';

const DictationView: React.FC<{ onSave: (session: any) => void; addLog: (m: string, l?: any) => void }> = ({ onSave, addLog }) => {
  const [level, setLevel] = useState<'A1' | 'B2' | 'C1'>('B2');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const startDictation = async () => {
    setIsGenerating(true);
    setFeedback(null);
    setUserInput('');
    addLog(`Generiere Diktat für Niveau ${level}...`);

    try {
      const ai = await getGeminiAI();

      // 1. Generate text
      const textRes = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Generiere ein kurzes deutsches Diktat (ca. 25 Wörter) für das Sprachniveau ${level}. Das Thema soll alltagsnah sein.`
      });
      const text = textRes.text?.trim() || '';
      setCurrentText(text);

      // 2. Play audio
      const audioRes = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ parts: [{ text: `Lies dieses Diktat langsam und deutlich vor, mache kurze Pausen zwischen den Sätzen: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });

      const base64Audio = audioRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => {
          if (ctx.state !== 'closed') ctx.close();
        };
        source.start();
      }
    } catch (err) {
      addLog("Diktat Fehler", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const checkResult = async () => {
    const ai = await getGeminiAI();
    ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Vergleiche das Original-Diktat: "${currentText}" mit der Eingabe des Nutzers: "${userInput}". 
      Markiere Fehler fett und gib eine Note (1-6) sowie eine kurze Korrektur.`
    }).then(res => setFeedback(res.text || ''))
    .catch(() => setFeedback("Fehler bei der Prüfung."));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-2">Diktat-Trainer</h2>
        <p className="text-xs text-gray-400 mb-4">Höre gut zu und schreibe den Text so präzise wie möglich auf.</p>

        <div className="flex gap-3 mb-6">
          {(['A1', 'B2', 'C1'] as const).map(l => (
            <button key={l} onClick={() => setLevel(l)} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${level === l ? 'bg-green-600 text-white' : 'bg-gray-50 text-gray-400'}`}>
              {l}
            </button>
          ))}
        </div>

        <button
          onClick={startDictation}
          disabled={isGenerating}
          className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${isGenerating ? 'bg-gray-400' : 'bg-green-600'}`}
        >
          <i className="fas fa-play-circle"></i> {isGenerating ? 'Wird vorgelesen...' : 'Diktat starten'}
        </button>
      </div>

      {currentText && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Schreibe hier, was du hörst..."
            className="w-full h-40 bg-white border border-gray-100 rounded-3xl p-5 text-sm focus:ring-4 focus:ring-green-50 outline-none transition-all"
          />
          <button onClick={checkResult} className="w-full py-3 bg-gray-800 text-white font-bold rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-all">
            Prüfen
          </button>
        </div>
      )}

      {feedback && (
        <div className="bg-green-50 p-6 rounded-3xl border border-green-100 text-xs leading-relaxed text-green-800 whitespace-pre-wrap">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold uppercase tracking-widest text-[10px]">Feedback & Korrektur:</h4>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  onSave({
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    mode: 'DICTATION',
                    transcription: userInput,
                    correctedText: feedback,
                    title: `Diktat: ${level}`
                  });
                }}
                className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200 transition-colors"
                title="Archivieren"
              >
                <i className="fas fa-archive text-[10px]"></i>
              </button>
              <button 
                onClick={async () => {
                  if (navigator.share) {
                    await navigator.share({ title: 'Mein Diktat Ergebnis', text: feedback });
                  } else {
                    navigator.clipboard.writeText(feedback);
                    addLog("Feedback kopiert!", "success");
                  }
                }}
                className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200 transition-colors"
                title="Teilen"
              >
                <i className="fas fa-share-alt text-[10px]"></i>
              </button>
            </div>
          </div>
          {feedback}
        </div>
      )}
    </div>
  );
};

export default DictationView;
