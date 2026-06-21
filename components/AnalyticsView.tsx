import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ComposedChart,
  Area
} from 'recharts';
import { SessionResult, AppMode } from '../types';
import { motion } from 'motion/react';

interface AnalyticsViewProps {
  sessions: SessionResult[];
}

interface CategoryScore {
  subject: string;
  score: number;
  fullMark: number;
}

const AnalyticsView: React.FC<AnalyticsViewProps> = ({ sessions }) => {
  const [timeRange, setTimeRange] = useState<'all' | '30' | '7'>('all');

  // Filter sessions by selected time range
  const filteredSessions = useMemo(() => {
    const now = Date.now();
    let sorted = [...sessions].sort((a, b) => a.timestamp - b.timestamp);
    if (timeRange === '7') {
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      return sorted.filter(s => s.timestamp >= sevenDaysAgo);
    }
    if (timeRange === '30') {
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      return sorted.filter(s => s.timestamp >= thirtyDaysAgo);
    }
    return sorted;
  }, [sessions, timeRange]);

  // Compute metric profiles for a given session dynamically
  const getSessionMetrics = (session: SessionResult) => {
    const score = session.analysis?.rhetoricScore || session.analysis?.score || 70;
    const txt = (session.transcription || '') + ' ' + (session.correctedText || '');
    const wordCount = txt.split(/\s+/).filter(Boolean).length;
    
    // Heuristic modifiers based on text/mode features
    let schlagfertigkeit = 65; 
    let empathie = 65;
    let sprachfluss = 70;
    let ueberzeugung = 65;
    let struktur = 60;

    // Adjusting based on mode
    switch (session.mode) {
      case AppMode.CHALLENGE:
        schlagfertigkeit = Math.min(100, score + 15);
        empathie = Math.max(40, score - 20);
        ueberzeugung = Math.min(100, score + 5);
        struktur = Math.max(50, score - 10);
        break;
      case AppMode.PHONE_SIM:
      case AppMode.PHONE_CUSTOM:
        schlagfertigkeit = Math.min(100, score + 10);
        empathie = Math.min(100, score + 10);
        sprachfluss = Math.min(100, score + 5);
        break;
      case AppMode.ABOUT_ME:
      case AppMode.DIARY:
        empathie = Math.min(100, score + 20);
        schlagfertigkeit = Math.max(35, score - 25);
        struktur = Math.max(50, score - 5);
        break;
      case AppMode.BUSINESS_PITCH:
        ueberzeugung = Math.min(100, score + 20);
        struktur = Math.min(100, score + 10);
        empathie = Math.max(55, score - 5);
        break;
      case AppMode.YOUTUBE:
      case AppMode.TRAINER:
        ueberzeugung = Math.min(100, score + 15);
        sprachfluss = Math.min(100, score + 10);
        struktur = Math.min(100, score + 5);
        break;
      case AppMode.TEXT_OPTIMIZER:
      case AppMode.EMAIL_STUDIO:
        struktur = Math.min(100, score + 15);
        empathie = Math.min(100, score + 5);
        schlagfertigkeit = Math.max(45, score - 15);
        break;
      case AppMode.PLANNING:
        struktur = Math.min(100, score + 25);
        sprachfluss = Math.max(50, score - 10);
        break;
    }

    // Heuristics mapping to certain keywords
    const lowerTxt = txt.toLowerCase();
    if (lowerTxt.includes('ich danke') || lowerTxt.includes('bitte') || lowerTxt.includes('verstehen') || lowerTxt.includes('gefühl') || lowerTxt.includes('empathie')) {
      empathie = Math.min(100, empathie + 8);
    }
    if (lowerTxt.includes('weil') || lowerTxt.includes('deshalb') || lowerTxt.includes('schließlich') || lowerTxt.includes('daher') || lowerTxt.includes('fakten')) {
      struktur = Math.min(100, struktur + 8);
    }
    if (lowerTxt.includes('erfolg') || lowerTxt.includes('investition') || lowerTxt.includes('gewinn') || lowerTxt.includes('überzeugen') || lowerTxt.includes('vorteil')) {
      ueberzeugung = Math.min(100, ueberzeugung + 8);
    }

    // Speech flow adjustment on word count
    if (wordCount > 100) {
      sprachfluss = Math.min(100, sprachfluss + 5);
    } else if (wordCount > 0 && wordCount < 15) {
      sprachfluss = Math.max(40, sprachfluss - 15);
    }

    return {
      schlagfertigkeit: Math.round(schlagfertigkeit),
      empathie: Math.round(empathie),
      sprachfluss: Math.round(sprachfluss),
      ueberzeugung: Math.round(ueberzeugung),
      struktur: Math.round(struktur),
    };
  };

  // 1. Compute averages for Radar Chart
  const categoryAverages = useMemo(() => {
    if (filteredSessions.length === 0) {
      return [
        { subject: 'Schlagfertigkeit', score: 0, fullMark: 100 },
        { subject: 'Empathie', score: 0, fullMark: 100 },
        { subject: 'Sprachfluss', score: 0, fullMark: 100 },
        { subject: 'Überzeugung', score: 0, fullMark: 100 },
        { subject: 'Struktur', score: 0, fullMark: 100 },
      ];
    }

    let sums = { schlagfertigkeit: 0, empathie: 0, sprachfluss: 0, ueberzeugung: 0, struktur: 0 };
    filteredSessions.forEach(s => {
      const metrics = getSessionMetrics(s);
      sums.schlagfertigkeit += metrics.schlagfertigkeit;
      sums.empathie += metrics.empathie;
      sums.sprachfluss += metrics.sprachfluss;
      sums.ueberzeugung += metrics.ueberzeugung;
      sums.struktur += metrics.struktur;
    });

    const count = filteredSessions.length;
    return [
      { subject: 'Schlagfertigkeit', score: Math.round(sums.schlagfertigkeit / count), fullMark: 100 },
      { subject: 'Empathie', score: Math.round(sums.empathie / count), fullMark: 100 },
      { subject: 'Sprachfluss', score: Math.round(sums.sprachfluss / count), fullMark: 100 },
      { subject: 'Überzeugung', score: Math.round(sums.ueberzeugung / count), fullMark: 100 },
      { subject: 'Struktur', score: Math.round(sums.struktur / count), fullMark: 100 },
    ];
  }, [filteredSessions]);

  // 2. Chronological progression data for Line Chart
  const progressionData = useMemo(() => {
    return filteredSessions.map((s, index) => {
      const metrics = getSessionMetrics(s);
      const score = s.analysis?.rhetoricScore || s.analysis?.score || 72;
      return {
        name: `Sitzung ${index + 1}`,
        dateStr: new Date(s.timestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
        title: s.title,
        Score: score,
        Schlagfertigkeit: metrics.schlagfertigkeit,
        Empathie: metrics.empathie,
        Sprachfluss: metrics.sprachfluss,
        Überzeugung: metrics.ueberzeugung,
        Struktur: metrics.struktur,
      };
    });
  }, [filteredSessions]);

  // 3. Category comparison across Sub-Studios (Bar Chart)
  const modeData = useMemo(() => {
    const modesList = [
      { key: AppMode.CHALLENGE, label: 'Spiel / Verhör' },
      { key: AppMode.YOUTUBE, label: 'YouTube Studio' },
      { key: AppMode.EMAIL_STUDIO, label: 'E-Mail Studio' },
      { key: AppMode.PHONE_SIM, label: 'Telefon Simulation' },
      { key: AppMode.TRAINER, label: 'Training / Rede' },
      { key: AppMode.TEXT_OPTIMIZER, label: 'Veredelung' },
    ];

    return modesList.map(item => {
      const matchSessions = filteredSessions.filter(s => s.mode === item.key);
      if (matchSessions.length === 0) return null;

      const sumScore = matchSessions.reduce((acc, s) => acc + (s.analysis?.rhetoricScore || s.analysis?.score || 70), 0);
      const sumFluency = matchSessions.reduce((acc, s) => acc + getSessionMetrics(s).sprachfluss, 0);
      const sumLogic = matchSessions.reduce((acc, s) => acc + getSessionMetrics(s).struktur, 0);

      return {
        Studio: item.label,
        'Durchschnitt Score': Math.round(sumScore / matchSessions.length),
        'Sprachfluss': Math.round(sumFluency / matchSessions.length),
        'Struktur & Logik': Math.round(sumLogic / matchSessions.length),
      };
    }).filter(Boolean);
  }, [filteredSessions]);

  // 4. Last 7 days statistics and trendline
  const last7DaysData = useMemo(() => {
    const data = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const startOfDay = d.getTime();
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

      const daySessions = sessions.filter(s => s.timestamp >= startOfDay && s.timestamp <= endOfDay);
      const scoreSum = daySessions.reduce((acc, s) => acc + (s.analysis?.rhetoricScore || s.analysis?.score || 70), 0);
      const avgScore = daySessions.length > 0 ? Math.round(scoreSum / daySessions.length) : null;
      
      const dayLabel = d.toLocaleDateString('de-DE', { weekday: 'short' });
      const dateStr = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

      data.push({
        dayName: `${dayLabel} (${dateStr})`,
        'Sitzungen': daySessions.length,
        'Rhetorik-Score': avgScore,
      });
    }
    return data;
  }, [sessions]);

  // Total sessions in last 7 days
  const last7DaysSessionsCount = useMemo(() => {
    return last7DaysData.reduce((acc, curr) => acc + curr['Sitzungen'], 0);
  }, [last7DaysData]);

  // Average trend score in last 7 days
  const last7DaysAverageScore = useMemo(() => {
    const daysWithData = last7DaysData.filter(d => d['Rhetorik-Score'] !== null);
    if (daysWithData.length === 0) return null;
    const sum = daysWithData.reduce((acc, curr) => acc + (curr['Rhetorik-Score'] as number), 0);
    return Math.round(sum / daysWithData.length);
  }, [last7DaysData]);

  // Additional stats KPI calculations
  const totalWordsSpoken = useMemo(() => {
    return sessions.reduce((acc, s) => {
      const text = (s.transcription || '') + ' ' + (s.correctedText || '');
      return acc + text.split(/\s+/).filter(Boolean).length;
    }, 0);
  }, [sessions]);

  const bestCategory = useMemo(() => {
    if (sessions.length === 0) return { name: '-', score: 0 };
    const maxCat = [...categoryAverages].sort((a, b) => b.score - a.score)[0];
    return { name: maxCat.subject, score: maxCat.score };
  }, [categoryAverages, sessions]);

  const worstCategory = useMemo(() => {
    if (sessions.length === 0) return { name: '-', score: 0 };
    const minCat = [...categoryAverages].sort((a, b) => a.score - b.score)[0];
    return { name: minCat.subject, score: minCat.score };
  }, [categoryAverages, sessions]);

  const averageOverallScore = useMemo(() => {
    if (filteredSessions.length === 0) return 0;
    const total = filteredSessions.reduce((sum, s) => sum + (s.analysis?.rhetoricScore || s.analysis?.score || 70), 0);
    return Math.round(total / filteredSessions.length);
  }, [filteredSessions]);

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl min-h-[450px]">
        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner animate-bounce">
          <i className="fas fa-chart-pie text-2xl"></i>
        </div>
        <h3 className="text-xl font-black text-gray-900 dark:text-gray-100 uppercase italic tracking-tight mb-2">Noch keine Daten verfügbar</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest max-w-sm text-center mb-8">
          Absolviere zuerst Trainings, Aufgaben oder Verhöre, um detaillierte rhetorische Profile und Trends zu zeichnen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-in fade-in zoom-in-95 duration-500">
      
      {/* Header section with tabs */}
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-950/20 rounded-full -mr-16 -mt-16 opacity-50"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest leading-none">Rhetorisches Cockpit</p>
            </div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic mt-1.5 flex items-center gap-3">
              <i className="fas fa-chart-pie text-blue-600"></i>
              Analytik Studio
            </h2>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-wider">
              Diagnostische Veredelung &amp; langfristige Leistungsanalysen
            </p>
          </div>
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-2xl p-1.5 gap-1 shadow-inner shrink-0 self-stretch md:self-auto justify-around">
            {(['all', '30', '7'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                  timeRange === range 
                    ? 'bg-white dark:bg-gray-900 text-blue-600 shadow-md scale-105' 
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                {range === 'all' ? 'Alle' : range === '30' ? '30 Tage' : '7 Tage'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Tiles / KPI Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-105 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Effektivität</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-600 flex items-center justify-center">
              <i className="fas fa-graduation-cap"></i>
            </div>
          </div>
          <div>
            <h4 className="text-3xl font-black text-gray-950 dark:text-white italic tracking-tighter">{averageOverallScore}<span className="text-blue-600 text-sm italic font-black">/100</span></h4>
            <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mt-1">Ø Rhetorik-Score</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-105 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Stärkste Kategorie</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 flex items-center justify-center">
              <i className="fas fa-arrow-trend-up"></i>
            </div>
          </div>
          <div>
            <h4 className="text-lg font-black text-gray-950 dark:text-white uppercase leading-tight tracking-tight mt-1 mb-0.5">{bestCategory.name}</h4>
            <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider mt-1">Ø {bestCategory.score}% Ausprägung</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-105 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Fokus-Bereich</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-600 flex items-center justify-center">
              <i className="fas fa-lightbulb"></i>
            </div>
          </div>
          <div>
            <h4 className="text-lg font-black text-gray-950 dark:text-white uppercase leading-tight tracking-tight mt-1 mb-0.5">{worstCategory.name}</h4>
            <p className="text-[9px] text-amber-500 font-bold uppercase tracking-wider mt-1">Ø {worstCategory.score}% - Ausbaufähig</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-105 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Vokabular-Volumen</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/20 text-purple-600 flex items-center justify-center">
              <i className="fas fa-file-word"></i>
            </div>
          </div>
          <div>
            <h4 className="text-3xl font-black text-gray-950 dark:text-white italic tracking-tighter">
              {totalWordsSpoken.toLocaleString('de-DE')}
            </h4>
            <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mt-1">Übertragene Wörter</p>
          </div>
        </div>

      </div>

      {/* Grid containing Radar of metrics, and progression Line chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Radar chart of the core dimensions */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl space-y-4 min-w-0 overflow-hidden">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 block mb-1">
              Rhetorisches Kompetenznetz
            </span>
            <h3 className="text-xl font-black text-gray-850 dark:text-white uppercase tracking-tight italic">
              Fünf-Dimensionen-Profil
            </h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              Analyse deines Charakters &amp; sprachlichen Talentes
            </p>
          </div>

          <div className="h-72 w-full flex items-center justify-center p-2">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={categoryAverages}>
                <PolarGrid stroke="#e2e8f0" className="dark:stroke-gray-800/60" />
                <PolarAngleAxis 
                  dataKey="subject" 
                  tick={{ fill: '#64748b', fontSize: '9px', fontWeight: 'bold' }} 
                />
                <PolarRadiusAxis 
                  angle={30} 
                  domain={[0, 100]} 
                  tick={{ fill: '#94a3b8', fontSize: '8px' }} 
                />
                <Radar 
                  name="Dein Kompetenzwert" 
                  dataKey="score" 
                  stroke="#3b82f6" 
                  fill="#3b82f6" 
                  fillOpacity={0.2} 
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Chronological progression Line chart */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl space-y-4 min-w-0 overflow-hidden">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 block mb-1">
              Zeitlicher Verlauf
            </span>
            <h3 className="text-xl font-black text-gray-850 dark:text-white uppercase tracking-tight italic">
              Performance Trend
            </h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              Entwicklung deiner rhetorischen Gesamtbewertung
            </p>
          </div>

          <div className="h-72 w-full p-2">
            {progressionData.length < 2 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <i className="fas fa-chart-line text-gray-200 dark:text-gray-800 text-3xl mb-3"></i>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Warte auf weitere Sitzungen...</p>
                <p className="text-[9px] text-gray-400 dark:text-gray-500 font-medium max-w-[250px] mt-1">
                  Mache mindestens zwei separate Studio-Sitzungen, um eine Kurve zu zeichnen.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressionData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-gray-800/40" vertical={false} />
                  <XAxis 
                    dataKey="dateStr" 
                    tickLine={false}
                    axisLine={false}
                    style={{ fontSize: '9px', fontWeight: 'bold', fill: '#94a3b8' }} 
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    tickLine={false}
                    axisLine={false}
                    style={{ fontSize: '9px', fontWeight: 'bold', fill: '#94a3b8' }} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                      borderRadius: '1rem', 
                      border: '1px solid rgba(51, 65, 85, 0.5)',
                      color: '#ffffff',
                      fontSize: '11px'
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                  <Line 
                    type="monotone" 
                    dataKey="Score" 
                    stroke="#2563eb" 
                    strokeWidth={3} 
                    dot={{ r: 4 }} 
                    activeDot={{ r: 6 }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Schlagfertigkeit" 
                    stroke="#eab308" 
                    strokeWidth={1.5} 
                    dot={false} 
                    strokeDasharray="4 4"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Empathie" 
                    stroke="#ec4899" 
                    strokeWidth={1.5} 
                    dot={false}
                    strokeDasharray="4 4"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Sprachfluss" 
                    stroke="#10b981" 
                    strokeWidth={1.5} 
                    dot={false}
                    strokeDasharray="4 4"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* 7-Tage-Trend & Aktivität Composed Chart */}
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl space-y-6 min-w-0 overflow-hidden">
        <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-500 block mb-1">
              Aktivität &amp; Rhetorik-Trend
            </span>
            <h3 className="text-xl font-black text-gray-850 dark:text-white uppercase tracking-tight italic">
              Letzte 7 Tage Analyse
            </h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              Verbindung von täglichem Fleiß (Sitzungsanzahl) und rhetorischer Qualität (Trendline)
            </p>
          </div>
          <div className="bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 w-11 h-11 rounded-2xl flex items-center justify-center">
            <i className="fas fa-calendar-week text-lg"></i>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
          {/* KPI columns */}
          <div className="space-y-4 bg-gray-50 dark:bg-gray-950 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800/60 shadow-inner">
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 block mb-0.5">Sitzungen</span>
              <span className="text-3xl font-black text-violet-600 dark:text-violet-400 italic leading-none">{last7DaysSessionsCount}</span>
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 ml-1">in 7 Tagen</span>
            </div>
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800/40">
              <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 block mb-0.5">Ø Rhetorik-Qualität</span>
              <span className="text-3xl font-black text-blue-600 dark:text-blue-400 italic leading-none font-mono">
                {last7DaysAverageScore !== null ? `${last7DaysAverageScore}` : '—'}
              </span>
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 ml-1">{last7DaysAverageScore !== null ? '/100' : 'Keine Übung'}</span>
            </div>
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800/40 text-[10px] text-gray-500 font-medium leading-relaxed">
              {last7DaysSessionsCount > 3 ? (
                <p className="text-emerald-600 dark:text-emerald-400 font-bold">
                  <i className="fas fa-circle-check mr-1 text-xs"></i> Sensationeller Elan! Deine Trendlinie zeigt eine aktive stimmliche Entwicklung.
                </p>
              ) : last7DaysSessionsCount > 0 ? (
                <p className="text-blue-600 dark:text-blue-400 font-bold">
                  <i className="fas fa-circle-info mr-1 text-xs"></i> Guter Anfang! Mache täglich mindestens eine Übung, um die Trendlinie zu festigen.
                </p>
              ) : (
                <p className="text-amber-600 dark:text-amber-400 font-bold">
                  <i className="fas fa-triangle-exclamation mr-1 text-xs"></i> Keine Aktivitäten in den letzten 7 Tagen. Starte noch heute dein nächstes Training!
                </p>
              )}
            </div>
          </div>

          {/* Chart Area */}
          <div className="md:col-span-3 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={last7DaysData} margin={{ top: 15, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-gray-800/40" vertical={false} />
                <XAxis 
                  dataKey="dayName" 
                  tickLine={false}
                  axisLine={false}
                  style={{ fontSize: '9px', fontWeight: 'bold', fill: '#94a3b8' }} 
                />
                <YAxis 
                  yAxisId="left"
                  domain={[0, 100]} 
                  tickLine={false}
                  axisLine={false}
                  style={{ fontSize: '9px', fontWeight: 'bold', fill: '#94a3b8' }} 
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 'auto']} 
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  style={{ fontSize: '9px', fontWeight: 'bold', fill: '#94a3b8' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    borderRadius: '1rem', 
                    border: '1px solid rgba(51, 65, 85, 0.5)',
                    color: '#ffffff',
                    fontSize: '11px'
                  }} 
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                
                <Bar 
                  yAxisId="right" 
                  name="Sitzungen" 
                  dataKey="Sitzungen" 
                  fill="#c084fc" 
                  radius={[4, 4, 0, 0]} 
                  barSize={24} 
                />
                
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  name="Rhetorik-Trend" 
                  dataKey="Rhetorik-Score" 
                  stroke="#2563eb" 
                  strokeWidth={3} 
                  dot={{ r: 4, strokeWidth: 1 }} 
                  activeDot={{ r: 6 }} 
                  connectNulls={true}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Studio Comparison across modes (Bar Chart) */}
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl space-y-4 min-w-0 overflow-hidden">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500 block mb-1">
              Studio-Analyse
            </span>
            <h3 className="text-xl font-black text-gray-850 dark:text-white uppercase tracking-tight italic">
              Vergleich nach Fachgebieten
            </h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              Leistungsunterschiede in deinen meistgenutzten Übungen
            </p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 w-11 h-11 rounded-2xl flex items-center justify-center">
            <i className="fas fa-layer-group text-lg"></i>
          </div>
        </div>

        <div className="h-72 w-full p-2">
          {modeData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 italic text-xs">
              Mache Übungen in unterschiedlichen Studios für eine detailliertere Aufschlüsselung.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modeData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-gray-800/40" vertical={false} />
                <XAxis 
                  dataKey="Studio" 
                  tickLine={false}
                  axisLine={false}
                  style={{ fontSize: '9px', fontWeight: 'bold', fill: '#94a3b8' }} 
                />
                <YAxis 
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  style={{ fontSize: '9px', fontWeight: 'bold', fill: '#94a3b8' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    borderRadius: '1rem', 
                    border: '1px solid rgba(51, 65, 85, 0.5)',
                    color: '#ffffff',
                    fontSize: '11px'
                  }} 
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                <Bar dataKey="Durchschnitt Score" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={25} />
                <Bar dataKey="Sprachfluss" fill="#10b981" radius={[4, 4, 0, 0]} barSize={25} />
                <Bar dataKey="Struktur & Logik" fill="#a855f7" radius={[4, 4, 0, 0]} barSize={25} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="pt-4 text-center opacity-60">
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-relaxed">
          Diese Auswertungen basieren auf Live-Feedback-Heuristiken &amp; KI Scorings <br/>
          Rhetorix Pro • Programmiert von <span className="text-blue-600">Tobias Ganster</span>
        </p>
      </div>

    </div>
  );
};

export default AnalyticsView;
