
import React from 'react';

export const GLOSSARY: Record<string, { title: string, simple: string }> = {
  'Alliteration': { title: 'Alliteration', simple: 'Gleicher Anfangsbuchstabe bei aufeinanderfolgenden Wörtern. Erzeugt Rhythmus und Einprägsamkeit.' },
  'Anapher': { title: 'Anapher', simple: 'Wiederholung eines Wortes am Satzanfang. Strukturiert die Rede extrem stark.' },
  'Metapher': { title: 'Metapher', simple: 'Bildhafter Vergleich ohne "wie". Macht Abstraktes sofort greifbar.' },
  'Parallelismus': { title: 'Parallelismus', simple: 'Gleiche Satzstruktur in aufeinanderfolgenden Sätzen. Wirkt harmonisch und logisch.' },
  'Klimax': { title: 'Klimax', simple: 'Steigerung der Intensität. Führt den Zuhörer zum emotionalen Höhepunkt.' },
  'Füllwort-Dichte': { title: 'Füllwort-Dichte', simple: 'Häufigkeit von "äh", "quasi", "halt". Zu viele davon schwächen deine Autorität und lassen dich unsicher wirken.' },
  'Palilogie': { title: 'Palilogie (Wiederholung)', simple: 'Das unmittelbare Wiederholen von Wörtern (z.B. "aber aber"). Oft ein Zeichen für gedankliche Suche oder Unsicherheit.' },
  'Anakoluth': { title: 'Anakoluth (Satzbruch)', simple: 'Plötzlicher Wechsel der Satzkonstruktion oder Abbruch eines Gedankens. Erschwert dem Zuhörer das Folgen deiner Logik.' },
  'Pleonasmus': { title: 'Pleonasmus', simple: 'Überflüssige Häufung sinngleicher Wörter (z.B. "weißer Schimmel"). Wirkt oft redundant.' },
  'Rhetoric Score': { title: 'Rhetorik Score', simple: 'Gesamtwert deiner Performance. Bewertet Klarheit, Stilmittel und die Reduzierung von Füllwörtern.' }
};

export const ExplanationModal: React.FC<{ term: string, onClose: () => void }> = ({ term, onClose }) => {
  const info = GLOSSARY[term] || { title: term, simple: 'Ein spezifisches Merkmal deiner Sprache, das die Wirkung deiner Aussage beeinflusst.' };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl p-8 border border-blue-100 animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-start mb-6">
          <div className="bg-blue-50 p-3 rounded-2xl">
            <i className="fas fa-book-sparkles text-blue-600 text-xl"></i>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors">
            <i className="fas fa-times-circle text-2xl"></i>
          </button>
        </div>
        <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tighter italic uppercase">{info.title}</h3>
        <div className="h-1 w-12 bg-blue-600 rounded-full mb-6"></div>
        <p className="text-gray-600 leading-relaxed font-medium text-base">{info.simple}</p>
        <button 
          onClick={onClose}
          className="mt-10 w-full bg-gray-900 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all text-xs uppercase tracking-widest"
        >
          Verstanden
        </button>
      </div>
    </div>
  );
};
