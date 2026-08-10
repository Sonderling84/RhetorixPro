
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { speakElevenLabs, stopSpeaking } from '../utils/elevenLabsTTS';

const HelpView: React.FC = () => {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState<number | null>(null); // -1: Intro, 0..8: sections, 9: gamification
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    return () => { stopSpeaking(); };
  }, []);

  const stopSpeech = () => {
    stopSpeaking();
    setActiveIndex(null);
    setIsPlayingAll(false);
  };

  const sections = [
    {
      title: "Text Studio & Optimierer",
      icon: "fa-pen-nib",
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      content: "Dein Werkzeug für professionelles Schreiben. Nutze den 'Text Optimierer' für geschäftliche Verhandlungen (z.B. Sixt), Briefe oder E-Mails. Das 'KI Autor Studio' hilft dir, ganze Buchkapitel zu strukturieren und direkt in Google Drive zu speichern."
    },
    {
      title: "Politische Rede & Rhetorik",
      icon: "fa-microphone-lines",
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-900/20",
      content: "Verbessere deine Auftritte. Diktiere einen Rede-Entwurf, lass das Skript rhetorisch veredeln und nutze den Teleprompter für die Performance. Die KI gibt dir akribisches Feedback zu Ausdruck und Wirkung."
    },
    {
      title: "Business, Pitch & Check",
      icon: "fa-briefcase",
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      content: "Analysiere Geschäftsideen mit dem 'Business Check'. Erhalte fundierte Kalkulationen (Marktgröße, Break-Even) und erstelle Pitch-Decks oder SWOT-Analysen für Investoren."
    },
    {
      title: "E-Mail Studio (Gmail Live)",
      icon: "fa-envelope",
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      content: "Diktieren statt Tippen. Deine gesprochenen E-Mails werden perfekt formatiert und können direkt über dein Google-Konto sicher versendet werden."
    },
    {
      title: "Selbstreflexion & Über Mich",
      icon: "fa-user-astronaut",
      color: "text-rose-600",
      bg: "bg-rose-50 dark:bg-rose-900/20",
      content: "Nimm Audios für dein persönliches Charakter-Profil auf. Die KI analysiert deine psychologischen Muster über die Zeit und hilft dir bei der Persönlichkeitsentwicklung."
    },
    {
      title: "Telefon Training (SIM)",
      icon: "fa-phone-volume",
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-900/20",
      content: "Trainiere schwierige Telefonate in Echtzeit. Wähle ein Szenario (z. B. Arzttermin, Vorstellungsgespräch) und sprich direkt mit der KI. Inklusive realistischem Freizeichenton und akribischer Analyse nach dem Telefonat."
    },
    {
      title: "Gamification & Fortschritt",
      icon: "fa-trophy",
      color: "text-yellow-600",
      bg: "bg-yellow-50 dark:bg-yellow-900/20",
      content: "Sammle XP für jede Aktivität und steige im Level auf. Deine 'Aufgaben' motivieren dich, alle Studio-Funktionen zu meistern."
    },
    {
      title: "Personalisierung",
      icon: "fa-image",
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-900/20",
      content: "Gestalte Rhetorix Pro zu deiner App. Lade oben rechts in der Ecke eigene Bilder oder Videos (z.B. Handball-Profile) als Hintergrund hoch, um in deiner Wohlfühl-Umgebung zu arbeiten."
    },
    {
      title: "Aufgaben & Spiel",
      icon: "fa-list-check",
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      content: "Finde neue Herausforderungen im Aufgaben-Tab oder trainiere deine Spontanität im Spiel-Modus."
    }
  ];

  const speakIndex = async (index: number, playAll = false) => {
    if (activeIndex === index && !playAll) {
      stopSpeech();
      return;
    }

    stopSpeaking();

    let titleText = "";
    let contentText = "";

    if (index === -1) {
      titleText = "Willkommen bei Rhetorix Pro";
      contentText = "Deine kreative Schaltzentrale. Rhetorix Pro hilft dir, deine rhetorischen Fähigkeiten zu verbessern, Texte zu optimieren, E-Mails zu diktieren und Telefonate realitätsnah mit künstlicher Intelligenz zu simulieren.";
    } else if (index === 9) {
      titleText = "Gamification und Fortschritt";
      contentText = "Für jede Session sammelst du XP! Steige im Level auf und werde vom Anfänger zum Master-Creator. Dein Fortschritt wird automatisch gespeichert.";
    } else {
      const section = sections[index];
      if (section) {
        titleText = section.title;
        contentText = section.content;
      }
    }

    const fullText = `${titleText}. ${contentText}`;
    setActiveIndex(index);
    setIsPlayingAll(playAll);

    try {
      await speakElevenLabs(fullText);
      if (playAll) {
        const next = index + 1;
        if (next <= 9) {
          speakIndex(next, true);
        } else {
          stopSpeech();
        }
      } else {
        stopSpeech();
      }
    } catch {
      stopSpeech();
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700 pb-20">
      <div className="flex items-center justify-between px-2">
        <button onClick={() => navigate('/')} className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-400 hover:text-blue-600 shadow-sm transition-all">
          <i className="fas fa-chevron-left"></i>
        </button>
        <h2 className="text-xl font-black text-gray-900 dark:text-white italic uppercase tracking-tighter">Anleitung &amp; Hilfe</h2>
        <div className="w-12 h-12"></div>
      </div>

      {/* Vorlese-Steuerung / Audio Player Panel */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 p-6 rounded-[2.5rem] text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl shadow-inner relative overflow-hidden shrink-0">
            <AnimatePresence mode="wait">
              {activeIndex !== null ? (
                <motion.div
                  key="wave"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="flex items-center justify-center gap-0.5"
                >
                  <span className="w-1 h-6 bg-white rounded-full animate-pulse"></span>
                  <span className="w-1 h-9 bg-white rounded-full animate-pulse [animation-delay:0.15s]"></span>
                  <span className="w-1 h-4 bg-white rounded-full animate-pulse [animation-delay:0.3s]"></span>
                  <span className="w-1 h-8 bg-white rounded-full animate-pulse [animation-delay:0.1s]"></span>
                </motion.div>
              ) : (
                <motion.i
                  key="headphones"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="fas fa-headphones text-xl"
                ></motion.i>
              )}
            </AnimatePresence>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none mb-1">
              Rhetorix Sprach-Assistent
            </p>
            <h3 className="text-xl font-black italic uppercase tracking-tighter">
              {activeIndex !== null ? "Anleitung wird vorgelesen..." : "Anleitung vorlesen lassen"}
            </h3>
            <p className="text-[11px] text-indigo-100 font-semibold mt-1">
              {activeIndex === -1 && "Kapitel: Willkommen bei Rhetorix Pro"}
              {activeIndex !== null && activeIndex >= 0 && activeIndex <= 8 && `Kapitel: ${sections[activeIndex]?.title}`}
              {activeIndex === 9 && "Kapitel: Gamification & Fortschritt"}
              {activeIndex === null && "Lasse dir die komplette Dokumentation entspannt vorlesen."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-end">
          {activeIndex !== null ? (
            <button
              onClick={stopSpeech}
              className="w-full md:w-auto bg-red-500 hover:bg-red-600 active:scale-95 text-white font-black uppercase text-xs tracking-wider px-6 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <i className="fas fa-stop"></i> Stoppen
            </button>
          ) : (
            <button
              onClick={() => speakIndex(-1, true)}
              className="w-full md:w-auto bg-white hover:bg-gray-100 active:scale-95 text-blue-600 font-black uppercase text-xs tracking-wider px-6 py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <i className="fas fa-circle-play text-base"></i> Komplett Abspielen
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center text-blue-600 shadow-inner">
              <i className="fas fa-book text-3xl"></i>
            </div>
            <div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight italic">Willkommen bei Rhetorix Pro</h3>
              <p className="text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Deine kreative Schaltzentrale</p>
            </div>
          </div>
          <button
            onClick={() => speakIndex(-1)}
            className={`w-10 h-10 rounded-full border flex items-center justify-center text-xs shrink-0 transition-all ${
              activeIndex === -1 
                ? 'bg-blue-600 border-blue-600 text-white animate-pulse shadow-md' 
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-500 hover:border-blue-500'
            }`}
            title="Einführung vorlesen"
          >
            <i className={`fas ${activeIndex === -1 ? 'fa-stop' : 'fa-volume-high'}`}></i>
          </button>
        </div>

        <div className="space-y-6">
          {sections.map((s, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex flex-col sm:flex-row gap-4 sm:gap-6 p-6 rounded-[2rem] border transition-all duration-300 ${
                activeIndex === i 
                  ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800 ring-2 ring-blue-500/20 shadow-md scale-[1.01]' 
                  : 'bg-gray-50 dark:bg-gray-950 border-gray-100 dark:border-gray-800'
              }`}
            >
              <div className="flex justify-between items-start gap-3 w-full sm:w-auto">
                <div className={`w-12 h-12 shrink-0 rounded-2xl ${s.bg} ${s.color} flex items-center justify-center shadow-inner`}>
                  <i className={`fas ${s.icon} text-xl`}></i>
                </div>
                {/* Mobile speak button */}
                <button
                  onClick={() => speakIndex(i)}
                  className={`sm:hidden w-10 h-10 rounded-full border flex items-center justify-center text-xs shrink-0 transition-all ${
                    activeIndex === i 
                      ? 'bg-blue-600 border-blue-600 text-white' 
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-450 hover:text-blue-500 hover:border-blue-500'
                  }`}
                >
                  <i className={`fas ${activeIndex === i ? 'fa-stop' : 'fa-volume-high'}`}></i>
                </button>
              </div>
              
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <h4 className={`font-black uppercase tracking-widest text-xs mb-2 ${s.color}`}>{s.title}</h4>
                  {/* Desktop speak button */}
                  <button
                    onClick={() => speakIndex(i)}
                    className={`hidden sm:flex w-8 h-8 rounded-full border items-center justify-center text-xs shrink-0 transition-all ${
                      activeIndex === i 
                        ? 'bg-blue-600 border-blue-600 text-white animate-pulse shadow-sm' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:text-blue-500 hover:border-blue-500'
                    }`}
                    title="Diesen Abschnitt vorlesen"
                  >
                    <i className={`fas ${activeIndex === i ? 'fa-stop' : 'fa-volume-high'}`}></i>
                  </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">{s.content}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Gamification footer */}
        <div className={`mt-12 bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden transition-all duration-300 ${
          activeIndex === 9 ? 'ring-4 ring-yellow-400 scale-[1.01]' : ''
        }`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          
          <div className="flex justify-between items-start gap-4 relative z-10">
            <div>
              <h4 className="text-lg font-black uppercase tracking-tight italic mb-2">Gamification &amp; Fortschritt</h4>
              <p className="text-indigo-100 text-sm font-medium leading-relaxed">
                Für jede Session sammelst du XP! Steige im Level auf und werde vom Anfänger zum Master-Creator. Dein Fortschritt wird automatisch gespeichert.
              </p>
            </div>
            
            <button
              onClick={() => speakIndex(9)}
              className={`w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-xs shrink-0 transition-all ${
                activeIndex === 9
                  ? 'bg-white text-indigo-600 animate-pulse shadow-lg font-bold'
                  : 'bg-white/10 text-white hover:bg-white/25'
              }`}
              title="Gamification vorlesen"
            >
              <i className={`fas ${activeIndex === 9 ? 'fa-stop' : 'fa-volume-high'}`}></i>
            </button>
          </div>

          <div className="mt-6 flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><i className="fas fa-trophy"></i></div>
            <span className="text-[10px] font-black uppercase tracking-widest">Level-System aktiv</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpView;
