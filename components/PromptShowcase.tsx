import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SHOWCASE_PROMPTS } from '../data/showcasePrompts';

/**
 * PromptShowcase — dezenter Hintergrund-Effekt für die Startseite.
 * Blendet in größeren Abständen eine kleine "Blase" mit einem Beispiel-Prompt
 * ein (fade + leichtes Aufsteigen), damit Besucher Ideen bekommen, was man die
 * KI fragen kann. Bewusst selten & unaufdringlich. pointer-events-none.
 *
 * Mobile und Desktop sind getrennt abgestimmt (Position, Größe, Häufigkeit).
 */

interface Bubble { id: number; text: string; style: React.CSSProperties; mobile: boolean; }

// Zonen so gewählt, dass die zentrale Menü-Spalte (max-w-2xl) frei bleibt.
const DESKTOP_ZONES: React.CSSProperties[] = [
  { top: '92px', left: '18px' },
  { top: '92px', right: '18px' },
  { bottom: '104px', left: '18px' },
  { bottom: '104px', right: '18px' },
  { top: '44%', left: '14px' },
  { top: '44%', right: '14px' },
];
// Auf dem Handy als schlanker Hinweis direkt unter dem Header (kein Platz an
// den Seiten wie am Desktop) — liegt sauber über dem Inhalt, statt hinter dem Logo.
const MOBILE_ZONES: React.CSSProperties[] = [
  { top: '64px', left: '12px', right: '12px' },
];

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const SHOW_MS = 6500;                 // wie lange eine Blase sichtbar ist
const FIRST_DELAY = 3200;             // erste Blase nach dem Laden
const GAP_DESKTOP: [number, number] = [15000, 24000];
const GAP_MOBILE: [number, number] = [22000, 34000]; // seltener auf dem Handy

export const PromptShowcase: React.FC<{ active?: boolean }> = ({ active = true }) => {
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const idRef = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const reduce =
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!active || reduce || SHOWCASE_PROMPTS.length === 0) return;

    const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
    let lastText = '';

    const scheduleNext = (delay: number) => {
      timers.current.push(setTimeout(showOne, delay));
    };

    const showOne = () => {
      // Pausieren, wenn Tab im Hintergrund — dann später erneut versuchen.
      if (typeof document !== 'undefined' && document.hidden) { scheduleNext(4000); return; }

      const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
      // nicht zweimal denselben Prompt hintereinander
      let text = pick(SHOWCASE_PROMPTS);
      for (let i = 0; i < 5 && text === lastText; i++) text = pick(SHOWCASE_PROMPTS);
      lastText = text;

      const zone = isMobile ? pick(MOBILE_ZONES) : pick(DESKTOP_ZONES);
      idRef.current += 1;
      setBubble({ id: idRef.current, text, style: zone, mobile: isMobile });

      // wieder ausblenden
      timers.current.push(setTimeout(() => setBubble(null), SHOW_MS));
      // nächste Blase nach einer Pause
      const gap = isMobile ? GAP_MOBILE : GAP_DESKTOP;
      scheduleNext(SHOW_MS + rand(gap[0], gap[1]));
    };

    scheduleNext(FIRST_DELAY);
    return () => { clearTimers(); setBubble(null); };
  }, [active, reduce]);

  if (!active || reduce) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden="true">
      <AnimatePresence>
        {bubble && (
          <div key={bubble.id} style={{ position: 'absolute', ...bubble.style }}>
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 0.92, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`mx-auto rounded-3xl border border-blue-300/40 dark:border-blue-400/20 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md shadow-lg shadow-blue-900/5 px-4 py-3 ${
                bubble.mobile ? 'max-w-[82vw]' : 'max-w-[260px]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="grid place-items-center w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-[9px] shrink-0">
                  <i className="fas fa-wand-magic-sparkles"></i>
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                  Prompt-Idee
                </span>
              </div>
              <p className="text-[12px] leading-snug text-gray-700 dark:text-gray-200 font-medium">
                „{bubble.text}"
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PromptShowcase;
