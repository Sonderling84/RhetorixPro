
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { speakElevenLabs, stopSpeaking } from '../utils/elevenLabsTTS';

const ChatBot: React.FC<{ addLog: (m: string, l?: any) => void }> = ({ addLog }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { role: 'bot', text: 'Hallo! Ich bin dein Rhetorik-Mentor. Frag mich alles über Sprechtechniken, Körpersprache oder Storytelling.' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speak = async (text: string) => {
    setIsPlaying(true);
    try {
      await speakElevenLabs(text);
    } catch (err) {
      // handled by elevenLabsTTS fallback
    } finally {
      setIsPlaying(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: userText,
        config: {
          systemInstruction: "Du bist ein erfahrener Rhetorik-Mentor. Gib präzise, motivierende und professionelle Antworten. Nutze Beispiele."
        }
      });
      const botText = response.text || 'Entschuldigung, ich konnte keine Antwort generieren.';
      setMessages(prev => [...prev, { role: 'bot', text: botText }]);
      speak(botText);
    } catch (err) {
      addLog("Chat-Fehler", "error");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[75vh] animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-t-[3rem] border-x border-t border-gray-100 shadow-xl flex items-center justify-between">
         <div className="flex items-center gap-3">
           <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
             <i className="fas fa-comment-dots text-xl"></i>
           </div>
           <div>
             <h2 className="text-xl font-black text-gray-800 italic uppercase tracking-tighter">KI Mentor</h2>
             <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Powered by Gemini 3 Pro</p>
           </div>
         </div>
         {isPlaying && <div className="flex gap-1 items-end h-4"><div className="w-1 bg-emerald-400 animate-pulse h-full"></div><div className="w-1 bg-emerald-400 animate-pulse h-2"></div><div className="w-1 bg-emerald-400 animate-pulse h-3"></div></div>}
      </div>

      <div className="flex-1 bg-gray-50/50 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-5 rounded-[2rem] text-sm font-medium shadow-sm ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && <div className="bg-white p-4 rounded-2xl self-start text-gray-400 animate-pulse"><i className="fas fa-ellipsis"></i></div>}
        <div ref={scrollRef} />
      </div>

      <div className="bg-white p-6 rounded-b-[3rem] border-x border-b border-gray-100 shadow-xl flex gap-3">
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
          placeholder="Frag deinen Mentor..."
          className="flex-1 bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
        />
        <button onClick={sendMessage} className="w-14 h-14 bg-emerald-600 text-white rounded-2xl shadow-lg active:scale-90 transition-all flex items-center justify-center">
          <i className="fas fa-paper-plane"></i>
        </button>
      </div>
    </div>
  );
};

export default ChatBot;
