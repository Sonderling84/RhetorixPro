import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

interface UserStats {
  xp: number;
  level: number;
}

const SkillTrainingView: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats>({ xp: 0, level: 1 });

  useEffect(() => {
    const saved = localStorage.getItem('rhetorix_stats');
    if (saved) {
      try {
        setStats(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in-50 slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <button 
          onClick={() => navigate('/')} 
          className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-400 hover:text-blue-600 shadow-sm transition-all"
        >
          <i className="fas fa-chevron-left"></i>
        </button>
        <h2 className="text-xl font-black text-gray-900 dark:text-white italic uppercase tracking-tighter">Skill Training</h2>
        <div className="w-12 h-12"></div>
      </div>

      {/* Dynamic Consolidated XP Display */}
      <div className="w-full bg-gradient-to-r from-emerald-500 via-teal-600 to-indigo-600 p-6 rounded-[2.5rem] text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl font-black italic shadow-inner">
            L{stats.level}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none mb-1">Rhetorisches Level</p>
            <h3 className="text-xl font-black italic uppercase tracking-tighter">{stats.xp} XP gesammelt</h3>
            <p className="text-[11px] text-emerald-100 font-semibold mt-1">Meistere Übungen, um XP zu erhalten!</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 w-full md:w-auto">
          <div className="h-3 w-full md:w-44 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full" style={{ width: `${(stats.xp % 1000) / 10}%` }}></div>
          </div>
          <span className="text-[9px] font-black uppercase tracking-tighter opacity-80 text-right w-full">
            Nächstes Level bei {(Math.floor(stats.xp / 1000) + 1) * 1000} XP
          </span>
        </div>
      </div>

      {/* Category Card Grid */}
      <div className="space-y-4">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">
          Verfügbare Trainingsmodule
        </span>

        {/* 1. Rhetorik Verhör */}
        <button 
          onClick={() => navigate('/challenge')}
          className="w-full group relative overflow-hidden bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-lg hover:shadow-xl hover:border-blue-200 dark:hover:border-blue-900 transition-all active:scale-[99%] text-left flex items-center gap-6"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-950/20 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-40"></div>
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center text-blue-600 shadow-inner relative z-10 shrink-0">
            <i className="fas fa-gamepad text-2xl"></i>
          </div>
          <div className="relative z-10 flex-1">
            <span className="bg-blue-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest">
              Spiel-Modus
            </span>
            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight italic mt-1.5">
              Rhetorik Verhör
            </h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs font-semibold mt-1">
              Schlagfertigkeits-Training unter drückendem Zeitmangel. Antworte blitzschnell auf provokante KI-Fragen!
            </p>
          </div>
          <i className="fas fa-arrow-right text-gray-300 dark:text-gray-700 group-hover:text-blue-500 transition-colors ml-2 shrink-0"></i>
        </button>

        {/* 2. Politische Training */}
        <button 
          onClick={() => navigate('/political-speech')}
          className="w-full group relative overflow-hidden bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-lg hover:shadow-xl hover:border-emerald-250 dark:hover:border-emerald-900/40 transition-all active:scale-[99%] text-left flex items-center gap-6"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 dark:bg-emerald-950/20 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-40"></div>
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl flex items-center justify-center text-emerald-600 shadow-inner relative z-10 shrink-0">
            <i className="fas fa-microphone-lines text-2xl"></i>
          </div>
          <div className="relative z-10 flex-1">
            <span className="bg-emerald-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest">
              Redekunst
            </span>
            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight italic mt-1.5">
              Politische Training
            </h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs font-semibold mt-1">
              Frei sprechen, strukturieren und überzeugende Reden komponieren wie ein Staatsmann.
            </p>
          </div>
          <i className="fas fa-arrow-right text-gray-300 dark:text-gray-700 group-hover:text-emerald-500 transition-colors ml-2 shrink-0"></i>
        </button>

        {/* 3. Telefon Training */}
        <button 
          onClick={() => navigate('/phone-simulation')}
          className="w-full group relative overflow-hidden bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-lg hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-900 transition-all active:scale-[99%] text-left flex items-center gap-6"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-950/20 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-40"></div>
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl flex items-center justify-center text-indigo-600 shadow-inner relative z-10 shrink-0">
            <i className="fas fa-phone-volume text-2xl"></i>
          </div>
          <div className="relative z-10 flex-1">
            <span className="bg-indigo-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest">
              Telefonate
            </span>
            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight italic mt-1.5">
              Telefon Training
            </h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs font-semibold mt-1">
              Simuliere wichtige Telefonate (Arztbesuche, Bewerbungen, Behördenverkehre) mit realistischen KI-Stimmen.
            </p>
          </div>
          <i className="fas fa-arrow-right text-gray-300 dark:text-gray-700 group-hover:text-indigo-500 transition-colors ml-2 shrink-0"></i>
        </button>
      </div>

      <div className="pt-6 text-center opacity-60">
        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-relaxed">
          Verbessere systematisch deine Stimme &amp; Schlagfertigkeit täglich!
        </p>
      </div>
    </div>
  );
};

export default SkillTrainingView;
