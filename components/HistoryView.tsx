
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SessionResult, AppMode } from '../types';
import { speakElevenLabs, stopSpeaking } from '../utils/elevenLabsTTS';
import { jsPDF } from 'jspdf';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface HistoryViewProps {
  sessions: SessionResult[];
  addLog: (m: string, l?: any) => void;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-900/95 dark:bg-black/95 text-white p-4 rounded-2xl border border-gray-800 shadow-2xl backdrop-blur-md text-xs space-y-1">
        <p className="font-black uppercase tracking-wider text-[10px] text-gray-400 border-b border-gray-800/60 pb-1 mb-1">{data.fullName}</p>
        <p className="font-bold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
          <span>Einheiten: <strong className="text-white text-sm font-black">{data.Einheiten}</strong></span>
        </p>
        <p className="font-bold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-405"></span>
          <span>Ø Rhetorik-Score: <strong className="text-amber-400 text-sm font-black">{data['Score Ø'] || '-'} Pkt.</strong></span>
        </p>
      </div>
    );
  }
  return null;
};

const HistoryView: React.FC<HistoryViewProps> = ({ sessions, addLog }) => {
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  const downloadPDF = (session: SessionResult) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const primaryColor = [15, 23, 42]; // Slate 900
      const accentColor = [37, 99, 235]; // Blue 600
      const lightBgColor = [248, 250, 252]; // Slate 50
      const textColor = [51, 65, 85]; // Slate 700
      const lightBorderColor = [226, 232, 240]; // Slate 200

      // Page dimensions
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);

      let yPos = margin;

      // Helper for adding dynamic page numbers/headers
      const addPageDecorativeElements = (pDoc: jsPDF, pageNum: number) => {
        pDoc.setDrawColor(226, 232, 240);
        pDoc.setLineWidth(0.5);
        // Header line
        pDoc.line(margin, 12, pageWidth - margin, 12);
        
        // Header text
        pDoc.setFont('helvetica', 'normal');
        pDoc.setFontSize(8);
        pDoc.setTextColor(148, 163, 184); // slate-400
        pDoc.text('RHETORIX PRO • SITZUNGSPROTOKOLL & ANALYSE', margin, 9);
        
        // Footer line
        pDoc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        pDoc.setTextColor(148, 163, 184); // slate-400
        pDoc.text(`Seite ${pageNum}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        pDoc.text('Erstellt mit Rhetorix Pro • Programmiert von Tobias Ganster', margin, pageHeight - 10);
      };

      // Add a page helper with auto page tracking
      const checkPageBreak = (neededHeight: number) => {
        if (yPos + neededHeight > pageHeight - margin - 15) {
          doc.addPage();
          yPos = margin + 10;
          doc.setFont('helvetica', 'normal');
          const lastPageNum = doc.internal.pages.length - 1;
          addPageDecorativeElements(doc, lastPageNum);
        }
      };

      // Initial page decorations
      addPageDecorativeElements(doc, 1);

      // Document Title
      yPos += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('Rhetorix Pro', margin, yPos);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      yPos += 6;
      doc.text('DEIN PERSÖNLICHER SPRACH- & RHETORIK-MENTOR', margin, yPos);

      // Section divider line
      yPos += 4;
      doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.setLineWidth(1);
      doc.line(margin, yPos, pageWidth - margin, yPos);

      // Metadata information box
      yPos += 8;
      doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
      doc.setDrawColor(lightBorderColor[0], lightBorderColor[1], lightBorderColor[2]);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, contentWidth, 32, 4, 4, 'FD');

      const dateStr = new Date(session.timestamp).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const modeLabel = getModeStyles(session.mode).label;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`Titel: ${session.title}`, margin + 5, yPos + 8);
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Kategorie: ${modeLabel}`, margin + 5, yPos + 15);
      doc.text(`Datum/Uhrzeit: ${dateStr}`, margin + 5, yPos + 22);
      doc.text(`Sitzungs-ID: ${session.id.substring(0, 8)}...`, margin + 5, yPos + 28);

      // If score is present, draw an elegant badge in the box
      if (session.analysis) {
        const scoreVal = session.analysis.rhetoricScore || 0;
        doc.setFillColor(239, 246, 255); // Blue-50
        doc.setDrawColor(191, 219, 254); // Blue-200
        doc.roundedRect(pageWidth - margin - 35, yPos + 4, 30, 24, 3, 3, 'FD');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(29, 78, 216); // Blue-700
        doc.text('SCORE', pageWidth - margin - 20, yPos + 11, { align: 'center' });
        
        doc.setFontSize(14);
        doc.text(`${scoreVal}/100`, pageWidth - margin - 20, yPos + 20, { align: 'center' });
      }

      yPos += 38;

      // 1. Text input or transcription
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text('Originale Transkription:', margin, yPos);
      
      yPos += 6;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      
      const wrappedTranscript = doc.splitTextToSize(`"${session.transcription}"`, contentWidth);
      doc.text(wrappedTranscript, margin, yPos);
      yPos += (wrappedTranscript.length * 5) + 6;

      // 2. Corrected Text if available
      if (session.correctedText && session.correctedText !== session.transcription) {
        checkPageBreak(30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text('Optimierter & veredelter Text:', margin, yPos);
        
        yPos += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        
        const wrappedCorrected = doc.splitTextToSize(`"${session.correctedText}"`, contentWidth);
        doc.text(wrappedCorrected, margin, yPos);
        yPos += (wrappedCorrected.length * 5) + 6;
      }

      // 3. Rhetoric analysis details
      if (session.analysis) {
        checkPageBreak(25);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('Auswertung & Rhetorik-Feedback', margin, yPos);
        
        yPos += 2;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 8;

        // Complexity/Niveau
        if (session.analysis.complexity) {
          checkPageBreak(12);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          doc.text('Komplexitätsstufe / Niveau:', margin, yPos);
          doc.setFont('helvetica', 'normal');
          doc.text(` ${session.analysis.complexity}`, margin + 50, yPos);
          yPos += 8;
        }

        // Summary
        if (session.analysis.summary) {
          checkPageBreak(25);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          doc.text('Zusammenfassende Beurteilung:', margin, yPos);
          yPos += 6;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          const wrappedSummary = doc.splitTextToSize(session.analysis.summary, contentWidth);
          doc.text(wrappedSummary, margin, yPos);
          yPos += (wrappedSummary.length * 5) + 10;
        }

        // Strengths & Improvements
        const renderListSection = (title: string, list: string[], listPrefix: string, activeColor: number[]) => {
          if (!list || list.length === 0) return;
          checkPageBreak((list.length * 6) + 15);
          
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(activeColor[0], activeColor[1], activeColor[2]);
          doc.text(title, margin, yPos);
          yPos += 6;
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);

          list.forEach(item => {
            const wrappedItem = doc.splitTextToSize(item, contentWidth - 8);
            checkPageBreak((wrappedItem.length * 5) + 2);
            doc.text(listPrefix, margin, yPos);
            doc.text(wrappedItem, margin + 5, yPos);
            yPos += (wrappedItem.length * 5) + 2;
          });

          yPos += 6;
        };

        renderListSection('Stärken in der Formulierung:', session.analysis.strengths, '✓', [22, 101, 52]); // Green 700
        renderListSection('Potenzial zur Optimierung:', session.analysis.improvements, '!', [180, 83, 9]); // Amber 700

        // Stylistic devices
        if (session.analysis.stylisticDevices && session.analysis.stylisticDevices.length > 0) {
          checkPageBreak(20);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.text('Eingesetzte rhetorische Stilmittel:', margin, yPos);
          yPos += 6;
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          
          const devicesStr = session.analysis.stylisticDevices.join(', ');
          const wrappedDevices = doc.splitTextToSize(devicesStr, contentWidth);
          doc.text(wrappedDevices, margin, yPos);
          yPos += (wrappedDevices.length * 5) + 10;
        }

        // Psychological Insight (Psychologisches Gutachten)
        if (session.analysis.psychologicalInsight) {
          const wrappedInsight = doc.splitTextToSize(session.analysis.psychologicalInsight, contentWidth - 10);
          const boxHeight = (wrappedInsight.length * 5) + 12;
          
          checkPageBreak(boxHeight + 15);
          
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(126, 34, 206); // Purple 700
          doc.text('Charakter-Gutachten & Tonalität-Profil:', margin, yPos);
          yPos += 4;

          doc.setFillColor(250, 245, 255); // Purple 50
          doc.setDrawColor(233, 213, 255); // Purple 200
          doc.setLineWidth(0.5);
          doc.roundedRect(margin, yPos, contentWidth, boxHeight, 4, 4, 'FD');

          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9.5);
          doc.setTextColor(88, 28, 135); // Purple 900
          doc.text(wrappedInsight, margin + 5, yPos + 8);
          
          yPos += boxHeight + 10;
        }
      }

      doc.save(`Rhetorix_${session.title.replace(/\s+/g, '_')}_Analyse.pdf`);
      addLog("PDF-Zusammenfassung erfolgreich generiert und heruntergeladen.", "success");
    } catch (err: any) {
      console.error(err);
      addLog(`Fehler beim PDF-Export: ${err.message}`, "error");
    }
  };

  const playWithAI = async (session: SessionResult) => {
    if (isPlaying) return;
    setIsPlaying(session.id);
    addLog(`Generiere Audio-Wiedergabe...`);

    try {
      const textToRead = session.correctedText || session.transcription;
      await speakElevenLabs(textToRead);
    } catch (err) {
      console.error(err);
      addLog("TTS Fehler", "error");
    } finally {
      setIsPlaying(null);
    }
  };

  const exportSession = async (session: SessionResult) => {
    const dateStr = new Date(session.timestamp).toLocaleString('de-DE');
    
    let analysisText = 'Keine detaillierte Analyse vorhanden.';
    if (session.analysis) {
      analysisText = `
SCORE: ${session.analysis.rhetoricScore}/100
NIVEAU: ${session.analysis.complexity}

STÄRKEN:
${session.analysis.strengths.map(s => `- ${s}`).join('\n')}

VERBESSERUNGSPOTENZIAL:
${session.analysis.improvements.map(i => `- ${i}`).join('\n')}

STILMITTEL:
${session.analysis.stylisticDevices.join(', ')}

ZUSAMMENFASSUNG:
${session.analysis.summary}

CHARAKTER-ANALYSE (GUTACHTEN):
${session.analysis.psychologicalInsight || 'Kein psychologisches Profil verfügbar.'}
      `.trim();
    }

    const exportContent = `
RHETORIX PRO - SITZUNGSPROTOKOLL
================================

TITEL: ${session.title}
MODUS: ${session.mode}
DATUM: ${dateStr}

--------------------------------
TRANSKRIPTION:
${session.transcription}

--------------------------------
KORRIGIERTER TEXT:
${session.correctedText || 'N/A'}

--------------------------------
RHETORIK-ANALYSE:
${analysisText}

================================
Programmiert & Kreiert von Tobias Ganster
    `.trim();

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Rhetorix: ${session.title}`,
          text: exportContent,
        });
        addLog("Export-Dialog geöffnet.", "success");
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          addLog("Export-Fehler: " + (err as Error).message, "error");
        }
      }
    } else {
      const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rhetorix_${session.title.replace(/\s+/g, '_')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      addLog("Export als Textdatei gestartet.", "success");
    }
  };

  const getModeStyles = (mode: AppMode) => {
    switch (mode) {
      case AppMode.TRAINER:
        return { icon: 'fa-microphone-lines', color: 'bg-blue-50 text-blue-600', label: 'Training' };
      case AppMode.CHALLENGE:
        return { icon: 'fa-trophy', color: 'bg-yellow-50 text-yellow-600', label: 'Spiel' };
      case AppMode.PHONE_SIM:
      case AppMode.PHONE_CUSTOM:
        return { icon: 'fa-phone-volume', color: 'bg-indigo-50 text-indigo-600', label: 'Telefon' };
      case AppMode.ABOUT_ME:
        return { icon: 'fa-user-astronaut', color: 'bg-rose-50 text-rose-600', label: 'Über Mich' };
      case AppMode.TEXT_OPTIMIZER:
        return { icon: 'fa-wand-magic-sparkles', color: 'bg-purple-50 text-purple-600', label: 'Veredelung' };
      case AppMode.EMAIL_STUDIO:
        return { icon: 'fa-envelope', color: 'bg-blue-50 text-sky-600', label: 'E-Mail' };
      case AppMode.DIARY:
        return { icon: 'fa-book-heart', color: 'bg-pink-50 text-pink-600', label: 'Tagebuch' };
      case AppMode.AUTHOR:
        return { icon: 'fa-pen-fancy', color: 'bg-amber-50 text-amber-600', label: 'Autor' };
      case AppMode.SOCIAL_MEDIA:
        return { icon: 'fa-share-nodes', color: 'bg-teal-50 text-teal-600', label: 'Social Media' };
      case AppMode.BUSINESS_PITCH:
        return { icon: 'fa-briefcase', color: 'bg-emerald-50 text-emerald-600', label: 'Business' };
      case AppMode.DICTATION:
        return { icon: 'fa-ear-listen', color: 'bg-orange-50 text-orange-600', label: 'Diktat' };
      case AppMode.YOUTUBE:
        return { icon: 'fa-video', color: 'bg-red-50 text-red-600 dark:bg-rose-950/20', label: 'YouTube' };
      case AppMode.DEV_LOG:
        return { icon: 'fa-laptop-code', color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20', label: 'Entwicklungs-Doku' };
      case AppMode.APP_DEV:
        return { icon: 'fa-code', color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20', label: 'App Entwurf' };
      case AppMode.PLANNING:
        return { icon: 'fa-list-check', color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/20', label: 'Planung' };
      case AppMode.VOICE_INPUT:
        return { icon: 'fa-microphone', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20', label: 'Shortcut-Einsprechung' };
      default:
        return { icon: 'fa-brain', color: 'bg-gray-50 text-gray-600', label: 'Studio' };
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <i className="fas fa-box-open text-3xl text-gray-200 mb-4"></i>
        <p className="text-gray-400 text-sm">Noch keine Aufnahmen vorhanden.</p>
      </div>
    );
  }

  // Wochentag-Analyse berechnen
  const weekdaysInfo = [
    { name: 'Mon', dayIndex: 1, label: 'Montag' },
    { name: 'Die', dayIndex: 2, label: 'Dienstag' },
    { name: 'Mit', dayIndex: 3, label: 'Mittwoch' },
    { name: 'Don', dayIndex: 4, label: 'Donnerstag' },
    { name: 'Fre', dayIndex: 5, label: 'Freitag' },
    { name: 'Sam', dayIndex: 6, label: 'Samstag' },
    { name: 'Son', dayIndex: 0, label: 'Sonntag' },
  ];

  const chartData = weekdaysInfo.map(day => {
    const sessionsOnThisDay = sessions.filter(session => {
      const d = new Date(session.timestamp);
      return d.getDay() === day.dayIndex;
    });

    const count = sessionsOnThisDay.length;
    
    // Filter sessions with a valid score from either rhetoricScore or score
    const sessionsWithScore = sessionsOnThisDay.filter(
      s => s.analysis && (typeof s.analysis.rhetoricScore === 'number' || typeof s.analysis.score === 'number')
    );
    const avgScore = sessionsWithScore.length > 0
      ? Math.round(
          sessionsWithScore.reduce((sum, s) => {
            const val = typeof s.analysis!.rhetoricScore === 'number' ? s.analysis!.rhetoricScore : (s.analysis!.score || 0);
            return sum + val;
          }, 0) / sessionsWithScore.length
        )
      : 0;

    return {
      dayName: day.name,
      fullName: day.label,
      Einheiten: count,
      'Score Ø': avgScore,
    };
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Fortschritts-Visualisierung mit Recharts */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl space-y-4 min-w-0 overflow-hidden">
        <div className="flex justify-between items-center gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 block mb-1">
              Aktivität &amp; Performance
            </span>
            <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight italic">
              Wochenanalyse
            </h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              Lernfortschritte sortiert nach Wochentag
            </p>
          </div>
          <button 
            onClick={() => navigate('/analytics')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black px-4 py-2.5 rounded-xl uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center gap-2 shrink-0 border border-indigo-500"
          >
            <i className="fas fa-chart-pie"></i> Analytik Studio
          </button>
        </div>

        <div className="h-64 w-full bg-gray-50/50 dark:bg-gray-950/20 rounded-2xl p-4 border border-gray-50 dark:border-gray-800/50">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-gray-800/40" />
              <XAxis 
                dataKey="dayName" 
                tickLine={false}
                axisLine={false}
                style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} 
              />
              <YAxis 
                yAxisId="left" 
                orientation="left" 
                stroke="#6366f1" 
                tickLine={false}
                axisLine={false}
                style={{ fontSize: '10px', fontWeight: 'bold', fill: '#6366f1' }}
                allowDecimals={false}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#f59e0b" 
                tickLine={false}
                axisLine={false}
                style={{ fontSize: '10px', fontWeight: 'bold', fill: '#f59e0b' }}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle" 
                wrapperStyle={{ fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase', letterSpacing: '0.05em' }} 
              />
              <Bar 
                yAxisId="left" 
                dataKey="Einheiten" 
                fill="#818cf8" 
                radius={[6, 6, 0, 0]} 
                barSize={24} 
              />
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="Score Ø" 
                stroke="#f59e0b" 
                strokeWidth={3} 
                dot={{ r: 4, strokeWidth: 2 }} 
                activeDot={{ r: 6 }} 
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h2 className="text-lg font-bold text-gray-800 dark:text-white px-1 uppercase tracking-wider text-xs">Deine Bibliothek</h2>
      {sessions.map(session => {
        const styles = getModeStyles(session.mode);
        return (
          <div key={session.id} className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm shadow-sm ${styles.color}`}>
                  <i className={`fas ${styles.icon}`}></i>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm line-clamp-1">{session.title}</h3>
                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-400">
                      {styles.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">
                    {new Date(session.timestamp).toLocaleDateString('de-DE')} • {new Date(session.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              {session.analysis && (
                <div className="flex flex-col items-end">
                  <span className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-[10px] font-black px-2 py-1 rounded-lg border border-green-100 dark:border-green-800 italic">Score {session.analysis.rhetoricScore}</span>
                </div>
              )}
            </div>
            
            <div className="relative">
               <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 italic leading-relaxed border-l-2 border-gray-100 dark:border-gray-800 pl-3 py-1">
                "{session.correctedText || session.transcription}"
              </p>
            </div>

            {session.analysis?.psychologicalInsight && (
              <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-2xl border border-purple-100 dark:border-purple-800 mt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-brain"></i> Charakter-Gutachten
                  </span>
                  <button 
                    onClick={() => setExpandedInsight(expandedInsight === session.id ? null : session.id)}
                    className="text-[10px] font-black text-purple-600 hover:underline active:scale-95 transition-all"
                  >
                    {expandedInsight === session.id ? 'VERBERGEN' : 'ANZEIGEN'}
                  </button>
                </div>
                {expandedInsight === session.id && (
                  <p className="text-[11px] text-purple-900 dark:text-purple-100 mt-3 font-medium leading-relaxed italic">
                    "{session.analysis.psychologicalInsight}"
                  </p>
                )}
              </div>
            )}
            
            <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800 mt-1">
              <button 
                onClick={() => playWithAI(session)}
                disabled={!!isPlaying}
                className="flex-1 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                {isPlaying === session.id ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-play"></i>}
                ANHÖREN
              </button>
              <button 
                onClick={() => downloadPDF(session)}
                className="flex-1 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-[10px] font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <i className="fas fa-file-pdf"></i> PDF DOWNLOAD
              </button>
              <button 
                onClick={() => exportSession(session)}
                className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[10px] font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-gray-200 dark:shadow-none"
              >
                <i className="fab fa-google-drive"></i> EXPORT
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HistoryView;
