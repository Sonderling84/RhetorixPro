
import React, { useState, useEffect, useRef } from 'react';
import { getGeminiAI } from '../utils/gemini-client';
import { AppMode, SessionResult, AnalysisData } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { speakElevenLabs, stopSpeaking } from '../utils/elevenLabsTTS';

interface ChallengeViewProps {
  onSave: (session: SessionResult) => void;
  addLog: (m: string, l?: any) => void;
  sessions: SessionResult[];
}

type Language = 'de' | 'en';

type GameState = 'SETUP' | 'INTRO_SEQUENCE' | 'QUESTION' | 'RECORDING' | 'STRESS_TEST' | 'STRESS_REACTION' | 'CONTINUE_CHECK' | 'BONUS_START' | 'BONUS_ROUND' | 'SUMMARY' | 'PROCESSING';

const play8BitSound = (freqs: number[], duration = 0.1, type: OscillatorType = 'square', volume = 0.1) => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const startTime = audioCtx.currentTime;
    
    freqs.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime + (i * duration));
      gain.gain.setValueAtTime(volume, startTime + (i * duration));
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + (i * duration) + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(startTime + (i * duration));
      osc.stop(startTime + (i * duration) + duration);
    });
  } catch (e) {}
};

const playStartMelody = () => play8BitSound([261.63, 329.63, 392.00, 523.25], 0.15, 'square', 0.1);
const playBlip = () => play8BitSound([800, 1200], 0.05, 'square', 0.05);
const playSuccess = () => play8BitSound([440, 554, 659, 880], 0.1, 'square', 0.1);
const playError = () => play8BitSound([200, 150, 100], 0.2, 'sawtooth', 0.1);

const QUICK_QUESTIONS_DE = [
  "Was ist dein absolutes Lieblingsgericht und warum?",
  "Welchen Beruf wolltest du als Kind unbedingt ausüben?",
  "Wie reagierst du, wenn ein Bild an der Wand minimal schief hängt?",
  "Was war das letzte Buch, das dich wirklich gefesselt hat?",
  "Kannst du dich in einem lauten Raum voll auf eine Sache konzentrieren?",
  "Welche Eigenschaft schätzt du an anderen Menschen am meisten?",
  "Was ist deine schönste Kindheitserinnerung?",
  "Bist du eher ungeduldig oder kannst du gut warten?",
  "Ist ein erledigter Auftrag wichtiger als ein perfekter Auftrag?",
  "Welches Tier fasziniert dich am meisten?"
];

const QUICK_QUESTIONS_EN = [
  "What is your absolute favorite dish and why?",
  "What profession did you definitely want to have as a child?",
  "How do you react when a picture on the wall is slightly crooked?",
  "What was the last book that really gripped you?",
  "Can you focus fully on one thing in a noisy room?",
  "What quality do you value most in other people?",
  "What is your most beautiful childhood memory?",
  "Are you overall impatient or can you wait well?",
  "Is a completed task more important than a perfect task?",
  "Which animal fascinates you the most?"
];

const DEEP_QUESTIONS_DE = [
  "Szenario: Du betrittst einen Raum mit vielen Menschen und intensiven Gerüchen. Was nimmst du als Erstes wahr und wie beeinflusst es deine Stimmung?",
  "Beschreibe den Moment, in dem du merkst, dass deine Gedanken anfangen zu wandern, obwohl du gerade zuhörst.",
  "Wie gehst du damit um, wenn du die Emotionen anderer Menschen so stark spürst, als wären es deine eigenen?",
  "Beschreibe ein Erlebnis, bei dem dich Musik oder Kunst so tief berührt hat, dass du es körperlich gespürt hast.",
  "Wenn du ein Projekt startest, verlierst du dich im Detail oder behältst du immer das große Ganze im Blick?",
  "Szenario: Du beobachtest, wie jemand in einer Schlange ungerechtfertigt beleidigt wird. Wie intervenierst du rhetorisch?",
  "Stell dir vor, du findest einen Tippfehler in einer wichtigen E-Mail, die du gerade abgeschickt hast. Wie fühlst du dich?",
  "Szenario: Ein enger Freund vertraut dir ein Geheimnis an, das jedoch jemand anderem schaden könnte. Wie wägst du deine Loyalität ab?",
  "Wie oft bemerkst du kleine Details in deiner Umgebung, die anderen völlig entgehen?",
  "Szenario: Du hast die Chance, einen Fehler zu vertuschen, der nie jemandem auffallen würde. Warum entscheidest du dich dagegen (oder dafür)?",
  "Erkläre mir den Unterschied zwischen Einsamkeit und Alleinsein, ohne diese Wörter zu verwenden.",
  "Wie reagierst du, wenn die Welt um dich herum plötzlich zu schnell – oder zu langsam – wird?",
  "Entscheidest du dich oft impulsiv, nur um die Ungewissheit zu beenden?",
  "Beschreibe ein System oder eine Maschine (echt oder erfunden), dessen Logik du absolut faszinierend findest.",
  "Wenn du ein Buch über dein Leben schreiben würdest, welches Kapitel wäre das komplexeste zu formulieren?",
  "Welches Detail an einem Baum wird von den meisten Menschen übersehen, ist aber entscheidend?",
  "Beschreibe ein Gefühl, für das es in deiner Sprache noch kein Wort gibt.",
  "Was ist der Unterschied zwischen Wissen und Verstehen an einem konkreten Beispiel?",
  "Wenn du unkonzentriert bist, was ist das erste Symptom, das du an dir bemerkst?",
  "Stell dir eine Welt vor, in der alle Menschen die Wahrheit sagen müssen. Wäre das der Himmel oder die Hölle?"
];

const DEEP_QUESTIONS_EN = [
  "Scenario: You enter a room with many people and intense smells. What do you notice first and how does it affect your mood?",
  "Describe the moment you notice your thoughts start to wander even though you are listening.",
  "How do you handle feeling other people's emotions as strongly as if they were your own?",
  "Describe an experience where music or art touched you so deeply that you felt it physically.",
  "When you start a project, do you get lost in the details or do you always keep the big picture in view?",
  "Scenario: You observe someone being unfairly insulted in a line. How do you intervene rhetorically?",
  "Imagine you find a typo in an important email you just sent. How do you feel?",
  "Scenario: A close friend trusts you with a secret that could harm someone else. How do you weigh your loyalty?",
  "How often do you notice small details in your environment that others completely miss?",
  "Scenario: You have the chance to cover up a mistake that would never be noticed. Why do you decide against (or for) it?",
  "Explain the difference between loneliness and being alone without using those words.",
  "How do you react when the world around you suddenly becomes too fast – or too slow?",
  "Do you often decide impulsively just to end the uncertainty?",
  "Describe a system or machine (real or invented) whose logic you find absolutely fascinating.",
  "If you were to write a book about your life, which chapter would be the most difficult to formulate?",
  "What detail on a tree is overlooked by most people but is crucial?",
  "Describe a feeling for which there is no word yet in your language.",
  "What is the difference between knowing and understanding using a concrete example?",
  "When you are unfocused, what is the first symptom you notice in yourself?",
  "Imagine a world where all people must tell the truth. Would that be heaven or hell?"
];

const STRESS_TASKS_DE = [
  {
    question: "Was ist das Ergebnis von 7 x 8?",
    options: ["54", "56", "58", "60"],
    correctIndex: 1
  },
  {
    question: "Welcher Wochentag folgt auf Freitag?",
    options: ["Donnerstag", "Samstag", "Sonntag", "Montag"],
    correctIndex: 1
  }
];

const STRESS_TASKS_EN = [
  {
    question: "What is the result of 7 x 8?",
    options: ["54", "56", "58", "60"],
    correctIndex: 1
  },
  {
    question: "Which day of the week follows Friday?",
    options: ["Thursday", "Saturday", "Sunday", "Monday"],
    correctIndex: 1
  }
];

const RAPID_FIRE_TOPICS_DE = [
  "Zweiter Weltkrieg",
  "Die Zukunft der KI",
  "Weltraumkolonialisierung",
  "Klimawandel",
  "Moderne Kunst",
  "Quantenphysik für Laien",
  "Die Geschichte des Internets",
  "Menschliche Psychologie",
  "Nachhaltige Energie",
  "Cyberpunk-Ästhetik",
  "Über mich / Selbstvorstellung"
];

const RAPID_FIRE_TOPICS_EN = [
  "World War II",
  "The Future of AI",
  "Space Colonization",
  "Climate Change",
  "Modern Art",
  "Quantum Physics for Laypeople",
  "The History of the Internet",
  "Human Psychology",
  "Sustainable Energy",
  "Cyberpunk Aesthetics",
  "About Me / Self-Introduction"
];

const BONUS_QUESTIONS_DE = [
  "Pizza oder Pasta?",
  "Katze oder Hund?",
  "Chaos oder Ordnung?",
  "Planung oder Spontaneität?",
  "Sicherheit oder Abenteuer?"
];

const BONUS_QUESTIONS_EN = [
  "Pizza or Pasta?",
  "Cat or Dog?",
  "Chaos or Order?",
  "Planning or Spontaneity?",
  "Security or Adventure?"
];

const LOGIC_TASKS_DE = [
  "Ergänze die Reihe logisch: 2, 4, 8, 16, 31... Warte, ist das korrekt? Begründe deine Antwort.",
  "Wenn alle A auch B sind und einige B auch C sind – sind dann zwingend einige A auch C? Erkläre den Denkfehler.",
  "Stell dir ein 3x3 Gitter vor. Wie viele Quadrate findest du insgesamt? Beschreibe den Suchprozess.",
  "In einer Stadt wohnen nur Lügner und Wahrheitssager. Jemand sagt: 'Ich lüge gerade.' Ist das möglich?",
  "Wenn drei Katzen drei Mäuse in drei Minuten fangen, wie lange brauchen 100 Katzen für 100 Mäuse?"
];

const LOGIC_TASKS_EN = [
  "Complete the series logically: 2, 4, 8, 16, 31... Wait, is that correct? Justify your answer.",
  "If all A are also B and some B are also C – are some A necessarily C? Explain the thinking error.",
  "Imagine a 3x3 grid. How many squares do you find in total? Describe the search process.",
  "In a city, only liars and truth-tellers live. Someone says: 'I am lying right now.' Is that possible?",
  "If three cats catch three mice in three minutes, how long do 100 cats take for 100 mice?"
];

interface QuestionItem {
  text: string;
  isDeep: boolean;
  isLogic?: boolean;
}

const LANGUAGES = {
  de: {
    quick: QUICK_QUESTIONS_DE,
    deep: DEEP_QUESTIONS_DE,
    stress: STRESS_TASKS_DE,
    rapid_fire: RAPID_FIRE_TOPICS_DE,
    bonus: BONUS_QUESTIONS_DE,
    logic: LOGIC_TASKS_DE,
    voice: 'Kore',
    langTag: 'de-DE'
  },
  en: {
    quick: QUICK_QUESTIONS_EN,
    deep: DEEP_QUESTIONS_EN,
    stress: STRESS_TASKS_EN,
    rapid_fire: RAPID_FIRE_TOPICS_EN,
    bonus: BONUS_QUESTIONS_EN,
    logic: LOGIC_TASKS_EN,
    voice: 'Kore', // Correct for English too
    langTag: 'en-US'
  }
};

const TRANSLATIONS = {
  de: {
    setup_title: "DAS VERHÖR",
    setup_subtitle: "RHETORIX PRO v3.0 • RANKING SYSTEM",
    new_subject: "NEUES SUBJEKT",
    archive_choice: "ARCHIV WAHL",
    name_placeholder: "NAME...",
    none: "- KEIN -",
    central_instruction: "ZENTRALE ANWEISUNG: Antworten müssen WAHRHEITSGEMÄSS sein. Sammle Punkte für die HALL OF FAME. Jeder Durchlauf enthüllt neue FACETTEN deines Profils.",
    hall_of_fame: "HALL OF FAME (RANKING)",
    privacy_disclosure_title: "ANONYMISIERUNGS-PROTOKOLL",
    privacy_disclosure_text: "DEINE ANTWORTEN SIND NACH ABSCHLUSS DES TESTS NICHT EINZELN NACHWEISBAR ODER EINSEHBAR. ANTWORTE SO WAHRHEITSGEMÄSS WIE MÖGLICH – DIES IST EIN ANONYM TEST ZU DEINEM PERSÖNLICHEN PROFILING.",
    start_system_check: "SYSTEM-CHECK STARTEN",
    developed_by: "Ein Spiel entwickelt von",
    privacy_disclaimer_title: "DATENSCHUTZ v1.0",
    privacy_disclaimer_text: "ALLE DATEN WERDEN ANONYMISIERT VERARBEITET. EINZELANTWORTEN SIND NACH ABSCHLUSS NICHT MEHR REKONSTRUIERBAR. DIE ANALYSE DIENT AUSSCHLIESSLICH DEINER SELBSTREFLEKTION.",
    state_secure: "STATUS: SICHER",
    insert_coin: "INSERT COIN TO START...",
    copyright: "© 1989-1991 RHETORIX INDUSTRIES",
    continue_check_title: "ERSTE INSTANZ ABGESCHLOSSEN",
    continue_check_text: "Du hast die ersten Fragen überstanden. Willst du dein wahres Potenzial zeigen und den VOLLEN UMFANG (Härtetest) spielen oder jetzt den Zwischenbericht erstellen lassen?",
    continue_button: "WEITERMACHEN (EXTENDED)",
    finish_button: "BERICHT ERSTELLEN",
    stage: "STAGE",
    pause: "PAUSE",
    resume: "RESUME",
    system_paused: "SYSTEM PAUSED",
    click_resume: "KLICKE RESUME ZUM WEITERMACHEN",
    stress_required: "[REAKTION ERFORDERLICH] Wie fühlst du dich bei dieser offensichtlichen Fehlentscheidung?",
    logic_task: "[LOGIK TASK]",
    stress_reaction_instr: "Beschreibe deine Reaktion auf den Systemfehler.",
    digital_protocol: "Digitales Protokoll",
    input_placeholder: "HIER ANTWORT EINTIPPEN ODER MIKROFON NUTZEN...",
    stop_mic: "MIKROFON STOPPEN",
    start_mic: "JETZT SPRECHEN",
    confirm_continue: "ANTWORT BESTÄTIGEN & WEITER",
    database_loading: "DATENBANK WIRD GELADEN...",
    system_ready: "SYSTEM BEREIT... WARTE AUF ANALYSE...",
    answer_now: "JETZT ANTWORTEN",
    audio_loading: "AUDIO WIRD GELADEN...",
    system_validation: "[SYSTEM VALIDIERUNG]",
    error_header: "ERROR CODE 505: FALSCHE ANTWORT ERKANNT. ABWEICHUNG ZUR DATENBANK.",
    bonus_intro_text: "RAPID FIRE MODUS AKTIVIERT! ANTWORTE SO SCHNELL DU KANNST. ZEITLIMIT: 60 SEKUNDEN.",
    start_go: "START GO!",
    top_secret_topic: "STRENG GEHEIMES THEMA:",
    bonus_instruction: "SAGE ALLES, WAS DIR DAZU EINFÄLLT. DIE KI ANALYSIERT DEINE WISSENSTIEFE UND AUFMERKSAMKEIT.",
    system_ready_speak: ">>> SYSTEM BEREIT... SPRECHEN SIE JETZT...",
    finish_analysis: "ANALYSE ABSCHLIESSEN",
    processing_title: "SYSTEM ANALYSE LÄUFT...",
    processing_text: "EXTRAHIERE CHARAKTER-PROFIL ABGLEICH MIT DATENBANK...",
    summary_title: "FINISHER",
    total_pts: "TOTAL PTS",
    report_header: "VERHÖR-BERICHT #772",
    dossier_unlock: "DOSSIER ENTSPERREN",
    psych_report_header: "PSYCHOLOGISCHES GUTACHTEN",
    retry: "RETRY",
    pts: "PTS",
    speed: "SPEED",
    timer: "TIMER",
    points: "POINTS",
    subject_prompt: "Bitte Identität (Name) angeben!",
    improve_text: "TEXT VERBESSERN (AI)",
    listen_text: "ANHÖREN",
    polishing: "POLIERE TEXT...",
    save_draft: "SPEICHERN & WEITER",
    stop_audio: "STOP AUDIO",
    author_tab: "AUTOREN-MODUS",
    game_tab: "SPIEL-MODUS",
    book_title: "DAS DRITTE TESTAMENT - DAS PARADOXON",
    author_placeholder: "Diktiere dein nächstes Fragment für das Buch...",
    organize_btn: "IN KAPITEL ORDNEN (AI)",
    narrative_style: "ERZÄHLSTIL",
    book_subtitle: "AUTOREN-WORKSPACE",
    listen_original: "ORIGINAL ANHÖREN",
    listen_improved: "POLIERT",
    fragment_summary: "KI-TITEL",
    timestamp: "DIKTIERT AM"
  },
  en: {
    setup_title: "THE INTERROGATION",
    setup_subtitle: "RHETORIX PRO v3.0 • RANKING SYSTEM",
    new_subject: "NEW SUBJECT",
    archive_choice: "ARCHIVE CHOICE",
    name_placeholder: "NAME...",
    none: "- NONE -",
    central_instruction: "CENTRAL INSTRUCTION: Answers must be TRUTHFUL. Collect points for the HALL OF FAME. Each run reveals new FACETS of your profile.",
    hall_of_fame: "HALL OF FAME (RANKING)",
    privacy_disclosure_title: "ANONYMIZATION PROTOCOL",
    privacy_disclosure_text: "YOUR ANSWERS ARE NOT INDIVIDUALLY TRACEABLE OR VIEWABLE AFTER THE TEST COMPLETED. ANSWER AS TRUTHFULLY AS POSSIBLE – THIS IS AN ANONYMOUS TEST FOR YOUR PERSONAL PROFILING.",
    start_system_check: "START SYSTEM CHECK",
    developed_by: "A game developed by",
    privacy_disclaimer_title: "PRIVACY v1.0",
    privacy_disclaimer_text: "ALL DATA IS PROCESSED ANONYMOUSLY. INDIVIDUAL ANSWERS CANNOT BE RECONSTRUCTED AFTER COMPLETION. THE ANALYSIS SERVES ONLY YOUR SELF-REFLECTION.",
    state_secure: "STATE: SECURE",
    insert_coin: "INSERT COIN TO START...",
    copyright: "© 1989-1991 RHETORIX INDUSTRIES",
    continue_check_title: "FIRST INSTANCE COMPLETED",
    continue_check_text: "You have survived the first questions. Do you want to show your true potential and play the FULL SCOPE (stress test) or have the interim report created now?",
    continue_button: "CONTINUE (EXTENDED)",
    finish_button: "CREATE REPORT",
    stage: "STAGE",
    pause: "PAUSE",
    resume: "RESUME",
    system_paused: "SYSTEM PAUSED",
    click_resume: "CLICK RESUME TO CONTINUE",
    stress_required: "[REACTION REQUIRED] How do you feel about this obvious misdecision?",
    logic_task: "[LOGIC TASK]",
    stress_reaction_instr: "Describe your reaction to the system error.",
    digital_protocol: "Digital Protocol",
    input_placeholder: "TYPE ANSWER HERE OR USE MICROPHONE...",
    stop_mic: "STOP MICROPHONE",
    start_mic: "SPEAK NOW",
    confirm_continue: "CONFIRM ANSWER & CONTINUE",
    database_loading: "DATABASE LOADING...",
    system_ready: "SYSTEM READY... WAITING FOR ANALYSIS...",
    answer_now: "ANSWER NOW",
    audio_loading: "LOADING AUDIO...",
    system_validation: "[SYSTEM VALIDATION]",
    error_header: "ERROR CODE 505: WRONG ANSWER DETECTED. DATABASE DISCREPANCY.",
    bonus_intro_text: "RAPID FIRE MODE ACTIVATED! ANSWER AS FAST AS YOU CAN. TIME LIMIT: 60 SECONDS.",
    start_go: "START GO!",
    top_secret_topic: "TOP SECRET TOPIC:",
    bonus_instruction: "SAY EVERYTHING THAT COMES TO MIND. THE AI ANALYZES YOUR KNOWLEDGE DEPTH AND ATTENTION.",
    system_ready_speak: ">>> SYSTEM READY... SPEAK NOW...",
    finish_analysis: "FINISH ANALYSIS",
    processing_title: "SYSTEM ANALYSIS RUNNING...",
    processing_text: "EXTRACTING CHARACTER PROFILE CROSS-CHECKING DATABASE...",
    summary_title: "FINISHER",
    total_pts: "TOTAL PTS",
    report_header: "INTERROGATION REPORT #772",
    dossier_unlock: "UNLOCK DOSSIER",
    psych_report_header: "PSYCHOLOGICAL REPORT",
    retry: "RETRY",
    pts: "PTS",
    speed: "SPEED",
    timer: "TIMER",
    points: "POINTS",
    subject_prompt: "Please provide identity (name)!",
    improve_text: "IMPROVE TEXT (AI)",
    listen_text: "LISTEN",
    polishing: "POLISHING TEXT...",
    save_draft: "SAVE & CONTINUE",
    stop_audio: "STOP AUDIO",
    author_tab: "AUTHOR MODE",
    game_tab: "GAME MODE",
    book_title: "DAS DRITTE TESTAMENT - DAS PARADOXON",
    author_placeholder: "Dictate your next fragment for the book...",
    organize_btn: "ORGANIZE INTO CHAPTERS (AI)",
    narrative_style: "NARRATIVE STYLE",
    book_subtitle: "AUTHOR WORKSPACE",
    listen_original: "LISTEN ORIGINAL",
    listen_improved: "POLISHED",
    fragment_summary: "AI TITLE",
    timestamp: "DICTATED ON"
  }
};


const ChallengeView: React.FC<ChallengeViewProps> = ({ onSave, addLog, sessions }) => {
  const [language, setLanguage] = useState<Language>('de');
  const [gameState, setGameState] = useState<GameState>('SETUP');
  const [playerName, setPlayerName] = useState('');
  const [points, setPoints] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [sessionQuestions, setSessionQuestions] = useState<QuestionItem[]>([]);
  const [bonusQuestions, setBonusQuestions] = useState<string[]>([]);
  const [currentBonusIndex, setCurrentBonusIndex] = useState(0);
  const [bonusScore, setBonusScore] = useState(0);
  const [bonusTimeLeft, setBonusTimeLeft] = useState(60);
  const [bonusTopic, setBonusTopic] = useState('');
  const [answers, setAnswers] = useState<{ question: string, transcript: string }[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rhetorix_draft_transcript') || '';
    }
    return '';
  });
  const [isDictating, setIsDictating] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [psychologicalInsight, setPsychologicalInsight] = useState<string | null>(null);
  const [showPsychReport, setShowPsychReport] = useState(false);
  const [questionTimer, setQuestionTimer] = useState(60);
  const [isPolishing, setIsPolishing] = useState(false);
  const [stressTask, setStressTask] = useState<any>(null);
  const [stressFakeError, setStressFakeError] = useState(false);
  const [hasDoneStressTest, setHasDoneStressTest] = useState(false);
  const [hasAskedToContinue, setHasAskedToContinue] = useState(false);
  const [isAuthorMode, setIsAuthorMode] = useState(false);
  const [bookContent, setBookContent] = useState<{ original: string, improved: string, summary: string, date: string }[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rhetorix_book_content');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [activeBookFragment, setActiveBookFragment] = useState<{ original: string, improved: string, summary: string }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rhetorix_author_draft');
      return saved ? JSON.parse(saved) : { original: '', improved: '', summary: '' };
    }
    return { original: '', improved: '', summary: '' };
  });
  const [bookAnalysis, setBookAnalysis] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const authorPref = localStorage.getItem('rhetorix_author_mode_pref');
      if (authorPref === 'true') {
        setIsAuthorMode(true);
        localStorage.removeItem('rhetorix_author_mode_pref');
      }
    }
  }, []);

  const t = (key: keyof typeof TRANSLATIONS['de']) => {
    return TRANSLATIONS[language][key] || key;
  };

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const qTimerIntervalRef = useRef<number | null>(null);

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch (e) {}
      audioSourceRef.current = null;
    }
    stopSpeaking();
    setIsAudioLoading(false);
  };

  const summaryRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-save effect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const saveToLocal = () => {
      setIsSaving(true);
      localStorage.setItem('rhetorix_draft_transcript', currentTranscript);
      localStorage.setItem('rhetorix_author_draft', JSON.stringify(activeBookFragment));
      localStorage.setItem('rhetorix_book_content', JSON.stringify(bookContent));
      
      setTimeout(() => setIsSaving(false), 800);
    };

    const timeout = setTimeout(saveToLocal, 1000); // Debounce save
    return () => clearTimeout(timeout);
  }, [currentTranscript, activeBookFragment, bookContent]);

  useEffect(() => {
    const checkScroll = () => {
      const el = summaryRef.current;
      if (el) {
        const canScroll = el.scrollHeight > el.clientHeight;
        const reachedBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 50;
        setShowScrollDown(canScroll && !reachedBottom);
      }
    };

    if (gameState === 'SUMMARY') {
      const el = summaryRef.current;
      el?.addEventListener('scroll', checkScroll);
      setTimeout(checkScroll, 500); // Initial check after render
      return () => el?.removeEventListener('scroll', checkScroll);
    }
  }, [gameState, analysis]);

  const scrollToBottom = () => {
    summaryRef.current?.scrollBy({ top: 250, behavior: 'smooth' });
  };

  const startVerhoer = () => {
    if (!playerName.trim()) {
      addLog(t('subject_prompt'), "info");
      return;
    }

    setGameState('INTRO_SEQUENCE');
  };

  const startGameManual = () => {
    const playerSessions = sessions.filter(s => s.title.includes(playerName));
    const usedQuestions = new Set(playerSessions.flatMap(s => s.transcription.split('\n\n').map(q => q.split('\n')[0].replace('Frage: ', '').replace('Question: ', ''))));

    const qQuickCount = 2;
    const qDeepCount = 1;

    const quickPool = LANGUAGES[language].quick;
    const deepPool = LANGUAGES[language].deep;

    const availableQuick = quickPool.filter(q => !usedQuestions.has(q));
    const availableDeep = deepPool.filter(q => !usedQuestions.has(q));

    const shuffledQuick = (availableQuick.length >= qQuickCount ? availableQuick : quickPool)
      .sort(() => Math.random() - 0.5).slice(0, qQuickCount).map(t => ({ text: t, isDeep: false }));
    const shuffledDeep = (availableDeep.length >= qDeepCount ? availableDeep : deepPool)
      .sort(() => Math.random() - 0.5).slice(0, qDeepCount).map(t => ({ text: t, isDeep: true }));
    
    const combined = [...shuffledQuick, ...shuffledDeep].sort(() => Math.random() - 0.5);
    
    setSessionQuestions(combined);
    const rapidTopics = LANGUAGES[language].rapid_fire;
    setBonusTopic(rapidTopics[Math.floor(Math.random() * rapidTopics.length)]);
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setPoints(0);
    setBonusScore(0);
    setHasDoneStressTest(false);
    setHasAskedToContinue(false);
    setStressFakeError(false);
    setGameState('QUESTION');
    setShowPsychReport(false);
    if (combined.length > 0 && combined[0]?.text && combined[0].text.trim().length > 0) {
      playQuestion(combined[0].text);
    }
  };

  const addMoreQuestions = () => {
    const playerSessions = sessions.filter(s => s.title.includes(playerName));
    const usedQuestionsInCurrentSession = new Set(sessionQuestions.map(q => q.text));
    const usedQuestionsInHistory = new Set(playerSessions.flatMap(s => s.transcription.split('\n\n').map(q => q.split('\n')[0].replace('Frage: ', '').replace('Question: ', ''))));
    const allUsed = new Set([...usedQuestionsInCurrentSession, ...usedQuestionsInHistory]);

    const qQuickCount = 2;
    const qDeepCount = 2;
    const qLogicCount = 2;

    const quickPool = LANGUAGES[language].quick;
    const deepPool = LANGUAGES[language].deep;
    const logicPool = LANGUAGES[language].logic;

    const availableQuick = quickPool.filter(q => !allUsed.has(q));
    const availableDeep = deepPool.filter(q => !allUsed.has(q));
    const availableLogic = logicPool.filter(q => !allUsed.has(q));

    const shuffledQuick = (availableQuick.length >= qQuickCount ? availableQuick : quickPool)
      .sort(() => Math.random() - 0.5).slice(0, qQuickCount).map(t => ({ text: t, isDeep: false }));
    const shuffledDeep = (availableDeep.length >= qDeepCount ? availableDeep : deepPool)
      .sort(() => Math.random() - 0.5).slice(0, qDeepCount).map(t => ({ text: t, isDeep: true }));
    const shuffledLogic = (availableLogic.length >= qLogicCount ? availableLogic : logicPool)
      .sort(() => Math.random() - 0.5).slice(0, qLogicCount).map(t => ({ text: t, isDeep: true, isLogic: true }));
    
    const additional = [...shuffledQuick, ...shuffledDeep, ...shuffledLogic].sort(() => Math.random() - 0.5);
    
    const updated = [...sessionQuestions, ...additional];
    setSessionQuestions(updated);
    setHasAskedToContinue(true);
    setCurrentQuestionIndex(sessionQuestions.length);
    setGameState('QUESTION');
    if (additional.length > 0 && additional[0]?.text && additional[0].text.trim().length > 0) {
      playQuestion(additional[0].text);
    }
  };


  const startQuestionTimer = (isDeep: boolean) => {
    setQuestionTimer(isDeep ? 60 : 15);
    if (qTimerIntervalRef.current) clearInterval(qTimerIntervalRef.current);
    qTimerIntervalRef.current = window.setInterval(() => {
      if (isPaused) return;
      setQuestionTimer(prev => {
        if (prev <= 1) {
          if (qTimerIntervalRef.current) clearInterval(qTimerIntervalRef.current);
          nextQuestion(); // Auto-skip on timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const playQuestion = async (text: string) => {
    if (!text || text.trim().length === 0) {
      console.warn("Skipping playQuestion: text is empty");
      setIsAudioLoading(false);
      return;
    }
    stopAudio();
    setIsAudioLoading(true);
    try {
      await speakElevenLabs(text);
      setIsAudioLoading(false);
      startQuestionTimer(sessionQuestions[currentQuestionIndex]?.isDeep);
    } catch (e) {
      console.error("TTS Error:", e);
      setIsAudioLoading(false);
    }
  };

  const improveBonusText = async () => {
    if (!currentTranscript.trim()) return;
    setIsPolishing(true);
    addLog(language === 'de' ? "KI verbessert den Text..." : "AI is improving the text...", "info");
    try {
      const ai = await getGeminiAI();
      const prompt = language === 'de' 
        ? `Verbessere den folgenden diktierten Text. Korrigiere Grammatik, Rechtschreibung und mache ihn flüssiger und professioneller, aber behalte die Ich-Perspektive und den Inhalt bei. Antworte NUR mit dem verbesserten Text.\n\nText: ${currentTranscript}`
        : `Improve the following dictated text. Correct grammar, spelling, and make it more fluent and professional, but keep the first-person perspective and content. Respond ONLY with the improved text.\n\nText: ${currentTranscript}`;
      
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ parts: [{ text: prompt }] }]
      });
      const improved = response.text || currentTranscript;
      setCurrentTranscript(improved.trim());
      playSuccess();
      addLog(language === 'de' ? "Text erfolgreich poliert." : "Text successfully polished.", "success");
    } catch (e) {
      console.error(e);
      addLog("Fehler bei der Textverbesserung", "error");
    } finally {
      setIsPolishing(false);
    }
  };

  const speakText = async (text: string) => {
    if (!text || text.trim().length === 0) return;
    stopAudio();
    setIsAudioLoading(true);
    try {
      await speakElevenLabs(text);
    } catch (e) {
      console.error("Speech error", e);
    } finally {
      setIsAudioLoading(false);
    }
  };

  const polishBookText = async () => {
    const textToPolish = isAuthorMode ? activeBookFragment.original : currentTranscript;
    if (!textToPolish.trim()) return;

    setIsPolishing(true);
    addLog(language === 'de' ? "Narrative Transformation & Zusammenfassung wird erstellt..." : "Generating narrative transformation & summary...", "info");
    
    try {
      const ai = await getGeminiAI();
      
      const prompt = language === 'de' 
        ? `Du bist ein erfahrener Romanautor. Verarbeite diesen Diktat-Entwurf für das Werk "Das Dritte Testament".
           1. Schreibe den Text in einem anspruchsvollen, erwachsenen und menschlichen Stil um (Fassung: POLIERT).
           2. Erstelle einen extrem kurzen, prägnanten Titel/Zusammenfassung für dieses Fragment (Max 5 Wörter).
           Antworte im Format:
           SUMMARY: [Titel]
           POLISHED: [Umschriebener Text]
           
           Entwurf: ${textToPolish}`
        : `You are an experienced novelist. Process this dictation draft for the work "The Third Testament".
           1. Rewrite the text in a sophisticated, mature, and human-like style (Version: POLISHED).
           2. Create an extremely short, concise title/summary for this fragment (Max 5 words).
           Respond in the format:
           SUMMARY: [Title]
           POLISHED: [Rewritten Text]
           
           Draft: ${textToPolish}`;
      
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ parts: [{ text: prompt }] }]
      });
      
      const responseText = response.text || '';
      const summaryMatch = responseText.match(/SUMMARY:\s*(.*)/i);
      const polishedMatch = responseText.match(/POLISHED:\s*([\s\S]*)/i);
      
      const summary = summaryMatch ? summaryMatch[1].trim() : (language === 'de' ? 'Neues Fragment' : 'New Fragment');
      const improved = polishedMatch ? polishedMatch[1].trim() : textToPolish;

      if (isAuthorMode) {
        setActiveBookFragment(prev => ({ ...prev, improved, summary }));
      } else {
        setCurrentTranscript(improved);
      }
      playSuccess();
      addLog(language === 'de' ? "Stil wurde angepasst." : "Style successfully adjusted.", "success");
    } catch (e) {
      console.error(e);
      addLog("AI Error", "error");
    } finally {
      setIsPolishing(false);
    }
  };

  const saveBookFragment = () => {
    if (!activeBookFragment.original.trim()) return;
    const now = new Date().toLocaleString(language === 'de' ? 'de-DE' : 'en-US');
    setBookContent(prev => [...prev, { ...activeBookFragment, date: now }]);
    setActiveBookFragment({ original: '', improved: '', summary: '' });
    localStorage.removeItem('rhetorix_author_draft'); // Clear draft on save
    addLog(language === 'de' ? "Fragment sicher im Archiv verstaut." : "Fragment safely stowed in archive.", "success");
    playSuccess();
  };

  const organizeChapters = async () => {
    if (bookContent.length === 0) return;
    setIsPolishing(true);
    addLog(language === 'de' ? "Manuskript wird aus allen Fragmenten zusammengesetzt..." : "Assembling manuscript from all fragments...", "info");
    
    try {
      const ai = await getGeminiAI();
      const fullText = bookContent.map((f, i) => `FRAGMENT #${i+1} (${f.date}):\n${f.improved || f.original}`).join("\n\n---\n\n");
      
      const prompt = `Du bist ein literarischer Architekt. Erstelle aus den folgenden Fragmenten für das Buch "Das Dritte Testament" ein zusammenhängendes Manuskript.
                      Aufgabe:
                      - Ordne die Fragmente in eine logische, erzählerische Reihenfolge.
                      - Füge passende Überleitungen ein, wo nötig.
                      - Unterteile das Werk in sinnvolle Kapitel mit Überschriften.
                      - Behalte den anspruchsvollen, menschlichen Ton bei.
                      
                      FRAGMENE:
                      ${fullText}`;
      
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ parts: [{ text: prompt }] }]
      });
      
      setBookAnalysis(response.text || null);
      playSuccess();
      addLog(language === 'de' ? "Manuskript fertiggestellt." : "Manuscript generated successfully.", "success");
    } catch (e) {
      console.error(e);
      addLog("AI Error", "error");
    } finally {
      setIsPolishing(false);
    }
  };

  const startDictation = () => {
    if (!isAuthorMode && gameState !== 'STRESS_REACTION') {
      setGameState('RECORDING');
    }
    setIsDictating(true);
    setCurrentTranscript('');
    
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      addLog("Spracherkennung nicht unterstützt", "error");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = LANGUAGES[language].langTag;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript) {
        if (isAuthorMode) {
          setActiveBookFragment(prev => ({ 
            ...prev, 
            original: (prev.original + " " + finalTranscript).trim() 
          }));
        } else {
          setCurrentTranscript(prev => (prev + " " + finalTranscript).trim());
        }
      }
    };

    recognition.onerror = (e: any) => {
      console.error("Recognition Error:", e);
      setIsDictating(false);
    };

    recognition.onend = () => {
      setIsDictating(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const nextQuestion = () => {
    if (qTimerIntervalRef.current) clearInterval(qTimerIntervalRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    const questionText = gameState === 'STRESS_REACTION' 
      ? "Reaktion auf Systemfehler" 
      : sessionQuestions[currentQuestionIndex].text;

    const newAnswer = { question: questionText, transcript: currentTranscript };
    
    if (currentTranscript.trim().length > 10) {
      setPoints(prev => prev + (gameState === 'STRESS_REACTION' ? 1000 : sessionQuestions[currentQuestionIndex].isDeep ? 500 : 200));
    }
    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    // If we just finished the stress reaction, we either continue with questions or move to bonus
    if (gameState === 'STRESS_REACTION') {
      if (currentQuestionIndex + 1 < sessionQuestions.length) {
        setCurrentQuestionIndex(prev => prev + 1);
        setGameState('QUESTION');
        playQuestion(sessionQuestions[currentQuestionIndex + 1]?.text || "");
      } else {
        setGameState('BONUS_START');
      }
      return;
    }

    if (currentQuestionIndex + 1 < sessionQuestions.length) {
      // Trigger Stress Test in the middle of the interrogation
      if (!hasDoneStressTest && currentQuestionIndex >= Math.floor(sessionQuestions.length / 2)) {
        startStressTest();
        return;
      }
      setCurrentQuestionIndex(prev => prev + 1);
      setGameState('QUESTION');
      playQuestion(sessionQuestions[currentQuestionIndex + 1]?.text || "");
    } else if (!hasAskedToContinue) {
      setGameState('CONTINUE_CHECK');
    } else {
      setGameState('BONUS_START');
    }
  };

  const startStressTest = () => {
    setHasDoneStressTest(true);
    const stressPool = LANGUAGES[language].stress;
    const randomStress = stressPool[Math.floor(Math.random() * stressPool.length)];
    setStressTask(randomStress);
    setGameState('STRESS_TEST');
    setStressFakeError(false);
  };

  const handleStressChoice = (index: number) => {
    if (index === stressTask.correctIndex) {
      setStressFakeError(true);
      setTimeout(() => {
        setGameState('STRESS_REACTION');
        const provokeText = language === 'de' 
            ? "System-Fehler. Diese Antwort war mathematisch korrekt, wurde aber vom Archiv als falsch markiert. Wie reagieren Sie auf diese offensichtliche Ungerechtigkeit?"
            : "System error. This answer was mathematically correct, but was marked as wrong by the archive. How do you react to this obvious injustice?";
        playQuestion(provokeText);
      }, 2000);
    } else {
      setStressFakeError(true);
      setTimeout(() => {
        setGameState('STRESS_REACTION');
        const provokeText = language === 'de'
            ? "Antwort abgehlehnt. Das System registriert eine Abweichung in Ihrer Logik. Erklären Sie Ihre Reaktion auf diese Fehlermeldung."
            : "Answer rejected. The system registers a deviation in your logic. Explain your reaction to this error message.";
        playQuestion(provokeText);
      }, 2000);
    }
  };

  const startBonusRound = () => {
    setGameState('BONUS_ROUND');
    setBonusTimeLeft(60);
    setCurrentTranscript('');
    startDictation();
  };

  useEffect(() => {
    let timer: any;
    if (gameState === 'BONUS_ROUND' && bonusTimeLeft > 0 && !isPolishing) {
      timer = setInterval(() => {
        setBonusTimeLeft(prev => prev - 1);
        const words = currentTranscript.trim().split(/\s+/).filter(w => w.length > 2).length;
        setBonusScore(words);
      }, 1000);
    } else if (bonusTimeLeft === 0 && gameState === 'BONUS_ROUND' && !isPolishing) {
      // Don't auto-finish if user is currently interacting with the text (polishing or just finished dictating)
      // We wait for manual confirm
    }
    return () => clearInterval(timer);
  }, [gameState, bonusTimeLeft, currentTranscript, isPolishing]);

  const handleBonusAnswer = () => {
    finishVerhoer([...answers, { question: `Final: ${bonusTopic}`, transcript: currentTranscript }]);
  };

  const finishVerhoer = async (allAnswers: { question: string, transcript: string }[]) => {
    setGameState('PROCESSING');
    setIsProcessing(true);
    localStorage.removeItem('rhetorix_draft_transcript'); // Clear draft on finish
    addLog(language === 'de' ? "Interrogation beendet. Analysiere..." : "Interrogation finished. Analyzing...", "info");

    const fullTranscript = allAnswers.map(a => `${language === 'de' ? 'Frage' : 'Question'}: ${a.question}\n${language === 'de' ? 'Antwort' : 'Answer'}: ${a.transcript}`).join('\n\n');
    
    // Aggregate previous analysis data
    const playerSessions = sessions.filter(s => s.title.includes(playerName));
    const previousAnalyses = playerSessions.map(s => s.analysis?.psychologicalInsight || '').filter(Boolean).join('\n---\n');

    try {
      const ai = await getGeminiAI();
      const provPrompt = language === 'de' 
        ? `Du bist ein Profiler und Rhetorik-Experte. Erstelle ein präzises, unter die Oberfläche gehendes Psychogramm und eine rhetorische Analyse basierend auf diesem Verhör-Protokoll in DEUTSCHER SPRACHE.`
        : `You are a profiler and rhetoric expert. Create a precise psychological profile and rhetorical analysis based on this interrogation transcript in ENGLISH LANGUAGE.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `${provPrompt}
        
        WICHTIG: Das Subjekt wurde einem Stress-Test unterzogen (offensichtlicher Systemfehler bei einer mathematischen/logischen Frage) und einer Rapid-Fire Wissensabfrage ("Tell me everything about X in 60s").
        
        Spezifische Fokus-Analysen (subtil einarbeiten):
        1. AUFMERKSAMKEIT & KONZENTRATION: Analysiere, ob das Subjekt abschweift, den Faden verliert oder impulsiv antwortet (ADHS-Indikatoren vs. Laser-Fokus).
        2. PERFEKTIONISMUS: Reagiert das Subjekt frustriert auf Fehler? Ist die Sprache übermäßig korrekt oder eher pragmatisch/unordentlich im Denken?
        
        Das Subjekt hat bereits vorherige Verhöre absolviert. Nutze die vorliegenden Daten, um das Profil zu VERFEINERN und zu ERWEITERN (Evolved Profiling).
        
        BISHERIGE PROFIL-DATEN:
        ${previousAnalyses || 'Keine Daten vorhanden - erstelle neues Basis-Profil.'}
        
        AKTUELL AKTUALISIERTES PROTOKOLL:
        ${fullTranscript}
        
        DEINE ANALYSE-KRITERIEN:
        1. Rhetorische Exzellenz: Struktur, Wortgewandtheit, Logik.
        2. Kognitiver Stil: Detailtiefe, Abstraktionsvermögen, Systematisierungstendenzen.
        3. Charakter-Signatur: Belastbarkeit unter Zeitdruck, emotionale Intelligenz.
        4. NEURO-PROFIL: Analysiere subtile Hinweise auf neurodivergente Muster (Autismus-Spektrum, ADHS) sowie Anzeichen für HOCHSENSIBILITÄT (HSP), HOCHENSITIVITÄT oder HOCHEMOTIONALITÄT. Achte auf sensorische Beschreibungen, Detailfokus oder ungewöhnliche Assoziationen.
        5. Wissens-Dichte: Wie tief ist das Wissen im Rapid-Fire Teil? Zeugt es von Spezialinteresse oder oberflächlicher Beschäftigung?
        
        FORM: Sei absolut wertschätzend, fundiert und professionell. Vermeide Klischees.
        
        Antworte NUR mit JSON: {
          "correctedText": string, // Eine veredelte, machtvolle Zusammenfassung der Kernaussagen
          "rhetoricScore": number, // 0-100
          "complexity": "Einfach" | "Mittel" | "Komplex" | "Simple" | "Medium" | "Complex",
          "strengths": string[], // Rhetorische Stärken
          "improvements": string[], // Rhetorische Wachstumspfade
          "summary": string, // Zusammenfassung des Verlaufs
          "psychologicalInsight": string, // Das tiefe Psychogramm (min. 150 Wörter). Analysiere die Denkstruktur, die sensorische Welt und die Persönlichkeitssignatur.
          "stylisticDevices": string[]
        }`,
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || '{}');
      setAnalysis(data);
      setPsychologicalInsight(data.psychologicalInsight);
      setGameState('SUMMARY');

      onSave({
        id: Date.now().toString(),
        timestamp: Date.now(),
        mode: AppMode.CHALLENGE,
        transcription: fullTranscript,
        correctedText: data.correctedText,
        analysis: { ...data, score: points },
        title: `Verhör: ${playerName || 'Unbekannt'}`
      });
      addLog(`Verhör-Analyse für ${playerName || 'Subjekt'} abgeschlossen!`, "success");
    } catch (e) {
      console.error(e);
      addLog("Fehler bei der Analyse", "error");
      setGameState('SETUP');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isAuthorMode) {
    return (
      <div className="fixed inset-0 bg-[#070707] font-pixel flex flex-col items-center p-4 overflow-y-auto">
        {/* Navigation Tabs */}
        <div className="relative z-30 flex gap-2 mb-4 w-full max-w-xl">
          <button 
            onClick={() => { setIsAuthorMode(false); playBlip(); }}
            className="flex-1 py-3 bg-black/40 border-4 border-white/20 text-[10px] text-gray-500 hover:border-white transition-all uppercase"
          >
            {t('game_tab')}
          </button>
          <button 
            className="flex-1 py-3 bg-red-600 border-4 border-white text-[10px] text-white shadow-[4px_4px_0px_#800] uppercase"
          >
            {t('author_tab')}
          </button>
        </div>

        {/* Author Workspace Background */}
        <div className="absolute inset-0 z-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=2000&auto=format&fit=crop')] bg-cover grayscale"></div>
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black via-transparent to-black pointer-events-none"></div>

        <div className="relative z-20 w-full max-w-3xl flex-shrink-0 flex flex-col gap-6">
          <div className="crt-effect p-4 md:p-8 bg-black/90 border-4 border-white backdrop-blur-md flex flex-col shadow-[0_0_60px_rgba(255,0,0,0.1)] min-h-[600px] mb-8">
            <div className="scanline"></div>
            
            <div className="flex justify-between items-start mb-6 border-b-4 border-white/30 pb-4">
              <div>
                <h1 className="text-xl text-red-500 font-black tracking-tighter uppercase">{t('book_title')}</h1>
                <p className="text-[10px] text-blue-400 mt-1 uppercase opacity-70">{t('book_subtitle')}</p>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="text-[8px] text-gray-500 uppercase">{language === 'de' ? 'FRAGMETE' : 'FRAGMENTS'}</span>
                <p className="text-lg text-white">{bookContent.length}</p>
                {isSaving && <span className="text-[6px] text-green-500 animate-pulse uppercase tracking-widest mt-1">✓ Auto-Save</span>}
              </div>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden">
              {/* Sidebar: Saved Fragments */}
              <div className="w-56 border-r-2 border-white/10 pr-4 overflow-y-auto custom-scrollbar hidden md:block">
                <h3 className="text-[8px] text-gray-500 mb-4 uppercase tracking-[0.2em]">{language === 'de' ? 'ARCHIV' : 'ARCHIVE'}</h3>
                <div className="space-y-3">
                  {bookContent.length === 0 && <p className="text-[7px] text-gray-700 italic">LEER / EMPTY</p>}
                  {bookContent.map((f, i) => (
                    <div key={i} className="p-2 border border-white/20 bg-white/5 hover:bg-white/10 cursor-pointer transition-all group">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[5px] text-red-500 font-bold uppercase">{f.date.split(',')[0]}</span>
                        <span className="text-[5px] text-gray-600">#{i + 1}</span>
                      </div>
                      <p className="text-[7px] text-blue-300 font-bold uppercase truncate">{f.summary || (language === 'de' ? 'UNBENANNT' : 'UNTITLED')}</p>
                      <p className="text-[6px] text-gray-400 truncate opacity-50">{f.improved || f.original}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main Content: Current Writing Area */}
              <div className="flex-1 flex flex-col relative">
                {isPolishing && (
                  <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center border-4 border-red-500 backdrop-blur-sm">
                    <div className="w-16 h-16 border-4 border-red-500 border-t-white rounded-full animate-spin mb-4 shadow-[0_0_20px_rgba(255,0,0,0.5)]"></div>
                    <p className="text-[10px] text-red-500 animate-pulse tracking-[0.3em] font-black">{t('polishing')}</p>
                  </div>
                )}
                
                <div className="flex-1 grid grid-rows-2 gap-4">
                  {/* Original Dictation */}
                  <div className="flex flex-col border-2 border-white/20 p-4 bg-gray-900/40 relative">
                    <label className="text-[7px] text-gray-500 uppercase mb-2 flex justify-between">
                      {language === 'de' ? 'ROH-DIKTAT' : 'RAW DICTATION'}
                      {activeBookFragment.original && (
                        <button onClick={() => speakText(activeBookFragment.original)} className="hover:text-white">
                          <i className="fas fa-volume-up"></i>
                        </button>
                      )}
                    </label>
                    <textarea 
                      value={activeBookFragment.original}
                      onChange={(e) => setActiveBookFragment(prev => ({ ...prev, original: e.target.value }))}
                      placeholder={t('author_placeholder')}
                      className="flex-1 bg-transparent border-none outline-none resize-none text-[10px] text-blue-300 leading-relaxed font-pixel placeholder:text-gray-800"
                    />
                    
                    {/* Dictation Controls */}
                    <div className="absolute bottom-4 right-4 flex gap-2">
                       <button 
                         onClick={() => {
                           if (isDictating) {
                             recognitionRef.current?.stop();
                             setIsDictating(false);
                           } else {
                             // Modified dictation trigger for author mode
                             setGameState('RECORDING');
                             startDictation();
                           }
                         }}
                         className={`w-12 h-12 rounded-full border-4 border-white flex items-center justify-center shadow-[4px_4px_0px_#444] transition-all hover:scale-110 active:scale-95 ${isDictating ? 'bg-red-600 animate-pulse' : 'bg-black'}`}
                       >
                         <i className={`fas ${isDictating ? 'fa-microphone-slash' : 'fa-microphone'} text-xs text-white`}></i>
                       </button>
                    </div>
                  </div>

                  {/* Improved AI Version */}
                  <div className="flex flex-col border-2 border-red-500/30 p-4 bg-black/60 relative">
                    <label className="text-[7px] text-red-500 uppercase mb-2 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {t('narrative_style')}
                        {activeBookFragment.summary && (
                          <span className="bg-red-600 text-white px-2 py-0.5 rounded-[2px] font-black italic animate-pulse">
                            {activeBookFragment.summary}
                          </span>
                        )}
                      </div>
                      {activeBookFragment.improved && (
                        <button onClick={() => speakText(activeBookFragment.improved)} className="hover:text-white">
                          <i className="fas fa-volume-up"></i>
                        </button>
                      )}
                    </label>
                    <div className="flex-1 text-[11px] text-white/90 leading-loose font-pixel overflow-y-auto custom-scrollbar italic whitespace-pre-wrap">
                      {activeBookFragment.improved || (language === 'de' ? 'Warten auf Transformation...' : 'Awaiting transformation...')}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <button 
                    onClick={polishBookText}
                    disabled={!activeBookFragment.original.trim()}
                    className="py-4 bg-purple-600 text-white text-[8px] border-4 border-white shadow-[4px_4px_0px_#400] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all uppercase disabled:opacity-30"
                  >
                    {t('improve_text')}
                  </button>
                  <button 
                    onClick={saveBookFragment}
                    disabled={!activeBookFragment.original.trim()}
                    className="py-4 bg-blue-600 text-white text-[8px] border-4 border-white shadow-[4px_4px_0px_#004] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all uppercase disabled:opacity-30"
                  >
                    {t('save_draft')}
                  </button>
                  <button 
                    onClick={organizeChapters}
                    disabled={bookContent.length === 0}
                    className="py-4 bg-gray-800 text-white text-[8px] border-4 border-white shadow-[4px_4px_0px_#222] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all uppercase disabled:opacity-30"
                  >
                    {t('organize_btn')}
                  </button>
                </div>
              </div>
            </div>

            {/* Analysis Overlay */}
            {bookAnalysis && (
              <div className="fixed inset-0 z-[100] bg-black/98 flex flex-col p-6 md:p-12 border-4 border-white overflow-hidden">
                <div className="flex justify-between items-center mb-8 border-b-4 border-red-600 pb-4">
                  <h2 className="text-xl text-red-600 font-black uppercase tracking-tighter">{language === 'de' ? 'NARRATIVE STRUKTUR' : 'NARRATIVE STRUCTURE'}</h2>
                  <button onClick={() => setBookAnalysis(null)} className="text-white hover:text-red-500 transition-colors h-12 w-12 flex items-center justify-center">
                    <i className="fas fa-times text-3xl"></i>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar text-white/90 text-[10px] md:text-sm leading-relaxed font-pixel whitespace-pre-wrap pr-4 pb-20">
                  {bookAnalysis}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'SETUP') {
    const existingPlayers = Array.from(new Set(sessions.map(s => s.title.replace('Verhör: ', '').replace('Interrogation: ', ''))));
    
    // Sort players by total score (Highscore)
    const highscores = existingPlayers.map(p => {
      const pSessions = sessions.filter(s => s.title.includes(p));
      const maxScore = Math.max(...pSessions.map(s => s.analysis?.score || 0), 0);
      return { name: p, score: maxScore };
    }).sort((a, b) => b.score - a.score).slice(0, 5);

    return (
      <div className="fixed inset-0 bg-[#050505] font-pixel flex flex-col items-center p-4 overflow-y-auto">
        {/* Navigation Tabs */}
        <div className="relative z-30 flex gap-2 mb-4 w-full max-w-xl">
          <button 
            className="flex-1 py-3 bg-red-600 border-4 border-white text-[10px] text-white shadow-[4px_4px_0px_#800] uppercase"
          >
            {t('game_tab')}
          </button>
          <button 
            onClick={() => { setIsAuthorMode(true); playBlip(); }}
            className="flex-1 py-3 bg-black/40 border-4 border-white/20 text-[10px] text-gray-500 hover:border-white transition-all uppercase"
          >
            {t('author_tab')}
          </button>
        </div>

        {/* Background Image with Overlay */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-40 grayscale contrast-150"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1517404215738-15263e9f9178?q=80&w=2000&auto=format&fit=crop")' }}
        ></div>
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none"></div>

        <div className="relative z-20 w-full max-w-xl flex-shrink-0 flex flex-col justify-center py-10">
          <div className="crt-effect p-6 md:p-8 bg-black/80 border-4 border-white backdrop-blur-sm text-white flex flex-col justify-between shadow-[0_0_50px_rgba(255,255,255,0.1)] min-h-[500px]">
            <div className="scanline"></div>
            
            <div className="flex items-center gap-6 mb-12 border-b-4 border-white pb-6">
              <div className="w-16 h-16 bg-white border-4 border-white flex items-center justify-center shadow-[6px_6px_0px_#444]">
                <i className="fas fa-skull text-3xl text-black"></i>
              </div>
              <div>
                <h2 className="text-xl font-pixel text-white leading-tight">{t('setup_title')}</h2>
                <p className="text-[10px] font-pixel text-gray-400 mt-2">{t('setup_subtitle')}</p>
              </div>
            </div>

            <div className="space-y-8 relative z-10 font-pixel">
              <div className="flex gap-4 mb-4">
                <button 
                  onClick={() => { setLanguage('de'); playBlip(); }}
                  className={`flex-1 py-2 border-2 text-[10px] uppercase font-black tracking-widest transition-all ${language === 'de' ? 'bg-white text-black border-white' : 'bg-black/40 text-white border-white/20 hover:border-white'}`}
                >
                  Deutsch
                </button>
                <button 
                  onClick={() => { setLanguage('en'); playBlip(); }}
                  className={`flex-1 py-2 border-2 text-[10px] uppercase font-black tracking-widest transition-all ${language === 'en' ? 'bg-white text-black border-white' : 'bg-black/40 text-white border-white/20 hover:border-white'}`}
                >
                  English
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[8px] text-gray-400 uppercase tracking-widest mb-2">{t('new_subject')}</label>
                  <input 
                    type="text" 
                    value={playerName}
                    onChange={(e) => { setPlayerName(e.target.value); }}
                    placeholder={t('name_placeholder')}
                    className="w-full bg-black/60 border-4 border-white p-3 text-xs text-white outline-none placeholder:text-gray-700 font-pixel"
                  />
                </div>
                <div>
                  <label className="block text-[8px] text-gray-400 uppercase tracking-widest mb-2">{t('archive_choice')}</label>
                  <select 
                    onChange={(e) => { setPlayerName(e.target.value); playBlip(); }}
                    value={playerName}
                    className="w-full bg-black/60 border-4 border-white p-3 text-xs text-white outline-none font-pixel appearance-none"
                  >
                    <option value="">{t('none')}</option>
                    {existingPlayers.map(p => (
                      <option key={p} value={p}>{p.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-black/40 border-2 border-dashed border-white/40 p-4">
                <p className="text-[10px] text-white leading-loose italic" dangerouslySetInnerHTML={{ __html: t('central_instruction').replace('WAHRHEITSGEMÄSS', '<span class="text-red-500 font-black">WAHRHEITSGEMÄSS</span>').replace('TRUTHFUL', '<span class="text-red-500 font-black">TRUTHFUL</span>').replace('HALL OF FAME', '<span class="text-yellow-400">HALL OF FAME</span>').replace('FACETTEN', '<span class="text-blue-400">FACETTEN</span>').replace('FACETS', '<span class="text-blue-400">FACETS</span>') }} />
              </div>

              {highscores.length > 0 && (
                <div className="border-4 border-white p-4 bg-black/60">
                  <h3 className="text-[8px] text-yellow-400 mb-4 underline">{t('hall_of_fame')}</h3>
                  <div className="space-y-2">
                    {highscores.map((h, i) => (
                      <div key={i} className="flex justify-between text-[10px]">
                        <span className="text-gray-400">#{i+1} {h.name.toUpperCase()}</span>
                        <span className="text-yellow-400 font-black">{h.score} {t('pts')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-blue-900/40 p-4 border-4 border-blue-500 shadow-[4px_4px_0px_#1e3a8a] mb-6 backdrop-blur-md">
                <h4 className="text-[10px] text-blue-300 font-black mb-2 uppercase tracking-widest">{t('privacy_disclosure_title')}</h4>
                <p className="text-[8px] text-blue-200 leading-relaxed uppercase">
                  {t('privacy_disclosure_text')}
                </p>
              </div>

              <button 
                onClick={startVerhoer}
                className="w-full py-6 bg-red-600 border-4 border-white shadow-[8px_8px_0px_#800] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all uppercase"
              >
                {t('start_system_check')}
              </button>
            </div>
          </div>

          {/* Vito's Plans Box */}
          <motion.div 
            initial={{ x: 200, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="absolute -right-12 top-1/4 w-40 bg-black/90 border-4 border-red-600 p-3 shadow-2xl rotate-3 hidden lg:block"
          >
            <div className="flex items-center gap-2 mb-2 border-b border-red-600/50 pb-1">
              <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
                <i className="fas fa-microchip text-[10px] text-white"></i>
              </div>
              <span className="text-[8px] text-red-500 font-black uppercase">VITO.PLANS_v4</span>
            </div>
            <p className="text-[7px] text-red-200 leading-tight uppercase font-pixel animate-pulse whitespace-pre-line">
              [PLAN]: ARCHIV-SYNCHRONISIERUNG MIT EXTERNEN DATEN-NODES. GEPLANT: ERWEITERTE RHETORIK-MODUL 5.0. ANALYSE-QUOTEN ERHÖHEN...
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  if (gameState === 'INTRO_SEQUENCE') {
    return (
      <div className="fixed inset-0 bg-[#050505] font-pixel flex flex-col items-center p-4 overflow-y-auto">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-40"
        ></div>
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none"></div>

        <div className="relative z-20 w-full max-w-xl flex-shrink-0 py-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full text-center space-y-12 backdrop-blur-sm bg-black/40 p-8 border-4 border-white shadow-[0_0_50px_rgba(255,255,255,0.1)]"
          >
            <div className="scanline"></div>
            <motion.div
              animate={{ 
                y: [0, -10, 0],
              }}
              transition={{ duration: 0.5, repeat: 4 }}
            >
              <p className="text-[8px] font-pixel text-blue-400 mb-2 uppercase tracking-widest">{t('developed_by')}</p>
              <h2 className="text-2xl font-black tracking-tighter text-white uppercase italic">Tobias Ganster</h2>
            </motion.div>

            <motion.div
               initial={{ x: -100, opacity: 0 }}
               animate={{ x: 0, opacity: 1 }}
               transition={{ delay: 1.5, duration: 0.8 }}
               className="relative flex flex-col items-center"
            >
               <h1 className="text-4xl md:text-5xl font-black text-red-600 italic tracking-tighter uppercase drop-shadow-[4px_4px_0px_#fff] mb-6">
                 RHETORIX<br/>
                 <span className="text-white text-2xl">PRO</span>
               </h1>

               <motion.div
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: 2, duration: 0.5 }}
                 className="bg-gray-900 border-2 border-blue-500 p-4 mb-8 max-w-xs relative overflow-hidden"
               >
                  <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 opacity-50 animate-pulse"></div>
                  <h4 className="text-[8px] text-blue-400 font-black mb-2 uppercase tracking-widest text-center">{t('privacy_disclaimer_title')}</h4>
                  <p className="text-[7px] text-blue-300 leading-tight uppercase font-pixel text-center">
                    {t('privacy_disclaimer_text')}
                  </p>
                  <div className="mt-3 flex justify-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                    <span className="text-[6px] text-blue-500 uppercase tracking-widest">{t('state_secure')}</span>
                  </div>
               </motion.div>
               
               <motion.button
                 onClick={startGameManual}
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 transition={{ delay: 2.5, duration: 0.5 }}
                 className="group relative"
               >
                  <div className="absolute -inset-2 bg-red-600 blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                  <div className="relative bg-black border-4 border-white px-8 py-4 shadow-[6px_6px_0px_#fff] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all">
                    <div className="flex flex-col items-center">
                       <motion.div 
                         animate={{ opacity: [1, 0, 1] }}
                         transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 0.1 }}
                         className="text-xs text-yellow-400 font-pixel uppercase tracking-widest"
                       >
                         {t('insert_coin')}
                       </motion.div>
                    </div>
                  </div>
               </motion.button>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3, duration: 0.5 }}
              className="text-[6px] text-gray-500 uppercase tracking-[0.5em]"
            >
              {t('copyright')}
            </motion.div>
          </motion.div>

          {/* Vito's Plans Box in Intro */}
          <motion.div 
            initial={{ x: 200, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="absolute -right-8 top-10 w-40 bg-black/90 border-4 border-red-600 p-3 shadow-2xl rotate-3 hidden lg:block z-[30]"
          >
            <div className="flex items-center gap-2 mb-2 border-b border-red-600/50 pb-1">
              <div className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
                <i className="fas fa-microchip text-[8px] text-white"></i>
              </div>
              <span className="text-[7px] text-red-500 font-black uppercase">VITO.INIT_LOG</span>
            </div>
            <p className="text-[6px] text-red-200 leading-tight uppercase font-pixel animate-pulse">
              [PLAN]: SYSTEM-BOOT INITIALISIEREN. ZIEL: MAXIMALE WAHRHEITS-EXTRAKTION. PARALLELE UNTERSUCHUNG DER RHETORIK-MUSTER...
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  if (gameState === 'CONTINUE_CHECK') {
    return (
      <div className="fixed inset-0 bg-[#050505] font-pixel flex flex-col items-center p-4 overflow-y-auto">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-40 grayscale contrast-150"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1517404215738-15263e9f9178?q=80&w=2000&auto=format&fit=crop")' }}
        ></div>
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none"></div>

        <div className="relative z-20 w-full max-w-xl flex-shrink-0 py-10">
          <div className="crt-effect p-8 bg-black/80 backdrop-blur-md border-4 border-white text-white font-pixel flex flex-col justify-center shadow-[0_0_50px_rgba(255,255,255,0.1)]">
            <div className="scanline"></div>
            <div className="space-y-12 text-center">
              <div className="w-20 h-20 bg-yellow-400 border-4 border-white flex items-center justify-center mx-auto shadow-[6px_6px_0px_#fff]">
                <i className="fas fa-question text-3xl text-black"></i>
              </div>
              <h2 className="text-xl leading-relaxed uppercase tracking-tighter">{t('continue_check_title')}</h2>
              <p className="text-[10px] text-gray-400 leading-loose px-4" dangerouslySetInnerHTML={{ __html: t('continue_check_text').replace('VOLLEN UMFANG', '<span class="text-red-500">VOLLEN UMFANG</span>').replace('FULL SCOPE', '<span class="text-red-500">FULL SCOPE</span>') }} />
              <div className="grid grid-cols-1 gap-6">
                <button 
                  onClick={() => { addMoreQuestions(); }}
                  className="w-full py-6 bg-red-600 text-white text-xs border-4 border-white shadow-[6px_8px_0px_#800] active:translate-x-[4px] active:translate-y-[4px] transition-all uppercase"
                >
                  {t('continue_button')}
                </button>
                <button 
                  onClick={() => { setGameState('BONUS_START'); }}
                  className="w-full py-6 bg-gray-800 text-gray-400 text-xs border-4 border-white shadow-[6px_8px_0px_#444] active:translate-x-[4px] active:translate-y-[4px] transition-all uppercase"
                >
                  {t('finish_button')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

    if (gameState === 'QUESTION' || gameState === 'RECORDING' || gameState === 'STRESS_REACTION') {
      return (
        <div className="fixed inset-0 bg-[#050505] font-pixel flex flex-col items-center p-4 overflow-y-auto">
          <div 
            className="absolute inset-0 z-0 bg-cover bg-center opacity-40 grayscale contrast-150"
            style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1517404215738-15263e9f9178?q=80&w=2000&auto=format&fit=crop")' }}
          ></div>
          <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/40 to-black/80 pointer-events-none"></div>

          <div className="relative z-20 w-full max-w-xl flex-shrink-0 py-10">
            <div className="crt-effect bg-black/70 backdrop-blur-md border-4 border-white text-white shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col min-h-[700px] mb-8">
              <div className="scanline"></div>
              
              <div className="p-8 pb-4 flex flex-col h-full flex-1">
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[8px] text-red-500 uppercase tracking-widest">
                    {gameState === 'STRESS_REACTION' ? t('system_validation') : `${t('stage')} ${currentQuestionIndex + 1} / ${sessionQuestions.length}`}
                  </span>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => { setIsPaused(!isPaused); playBlip(); }}
                      className={`bg-gray-800 border-2 border-white px-3 py-1 text-[8px] text-white hover:bg-white hover:text-black transition-colors ${isPaused ? 'bg-yellow-400 text-black' : ''}`}
                    >
                      {isPaused ? t('resume') : t('pause')}
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-6 justify-center relative">
                  {isPaused && (
                    <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center border-4 border-white">
                      <div className="text-center animate-pulse">
                        <h2 className="text-2xl text-white font-pixel mb-4">{t('system_paused')}</h2>
                        <p className="text-[8px] text-gray-400 font-pixel">{t('click_resume')}</p>
                      </div>
                    </div>
                  )}
                  <div className={`bg-gray-900/60 p-4 border-4 min-h-[100px] flex items-center transition-colors ${gameState === 'STRESS_REACTION' ? 'border-red-600' : sessionQuestions[currentQuestionIndex]?.isLogic ? 'border-yellow-400' : 'border-white/20'}`}>
                    <h3 className="text-[10px] md:text-sm text-white leading-relaxed uppercase tracking-tighter">
                      {gameState === 'STRESS_REACTION' ? (
                        <span className="text-red-500 block text-[8px] mb-2">{t('stress_required')}</span>
                      ) : sessionQuestions[currentQuestionIndex]?.isLogic && (
                        <span className="text-yellow-400 block text-[8px] mb-2">{t('logic_task')}</span>
                      )}
                      {gameState === 'STRESS_REACTION' ? t('stress_reaction_instr') : sessionQuestions[currentQuestionIndex]?.text}
                    </h3>
                  </div>

                  {gameState === 'RECORDING' && (
                    <div className="space-y-6">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest">{t('digital_protocol')}</h4>
                          <div className="flex gap-1">
                            {[1,2,3,4,5].map(i => (
                              <div key={i} className={`w-1.5 h-4 bg-red-500 ${isDictating ? 'animate-pulse' : 'opacity-20'}`} style={{ animationDelay: `${i * 0.1}s` }}></div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-black/60 border-4 border-red-900 p-4 min-h-[150px] shadow-[inset_0_0_20px_rgba(255,0,0,0.2)]">
                           <textarea
                             autoFocus
                             value={currentTranscript}
                             onChange={(e) => { setCurrentTranscript(e.target.value); }}
                             placeholder={t('input_placeholder')}
                             className="w-full h-full bg-transparent border-none outline-none resize-none text-xs font-pixel text-blue-400 leading-relaxed uppercase placeholder:text-gray-800"
                           />
                        </div>
                      </div>

                      <div className="flex flex-col gap-4">
                         <button 
                           onClick={() => {
                              if (isDictating) {
                                recognitionRef.current?.stop();
                              } else {
                                startDictation();
                              }
                           }}
                           className={`w-full py-8 border-4 border-white flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-[8px_8px_0px_#444] ${isDictating ? 'bg-red-600 animate-pulse' : 'bg-gray-800'}`}
                         >
                           <i className={`fas ${isDictating ? 'fa-microphone-slash' : 'fa-microphone'} text-4xl`}></i>
                           <span className="text-[10px] font-black uppercase tracking-widest">{isDictating ? t('stop_mic') : t('start_mic')}</span>
                         </button>
                         
                         <button 
                           onClick={nextQuestion}
                           className="w-full py-6 bg-white text-black border-4 border-white shadow-[8px_8px_0px_#800] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all text-sm font-black uppercase tracking-widest"
                         >
                           {t('confirm_continue')}
                         </button>
                      </div>
                    </div>
                  )}
                  
                  {(gameState === 'QUESTION' || gameState === 'STRESS_REACTION') && (
                    <div className="bg-gray-900/60 border-2 border-white/10 p-4 h-32 overflow-y-auto custom-scrollbar flex items-center justify-center text-center">
                      <p className="text-[8px] text-gray-700 animate-pulse uppercase">
                        {isAudioLoading ? t('database_loading') : t('system_ready')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-auto flex flex-col gap-3 pt-4">
                  <div className="flex items-center justify-between px-2 mb-2">
                     <div className="bg-gray-900/60 border-2 border-white px-3 py-1 text-[8px] text-yellow-400 font-pixel shadow-[4px_4px_0px_#444] uppercase">{t('pts')}: {points}</div>
                     <div className={`px-4 py-1 border-2 border-white text-[10px] font-pixel shadow-[4px_4px_0px_#444] transition-colors ${questionTimer < 5 ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-800 text-white'}`}>
                        {questionTimer}S
                     </div>
                  </div>
                  {gameState === 'STRESS_REACTION' && (
                     <button 
                       onClick={startDictation}
                       className="w-full py-6 bg-red-600 text-white text-xs border-4 border-white shadow-[8px_8px_0px_#fff] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all uppercase flex items-center justify-center gap-4"
                     >
                       <i className="fas fa-bolt text-xl"></i>
                       {t('answer_now')}
                     </button>
                  )}
                  {gameState === 'QUESTION' && (
                     <button 
                       onClick={startDictation}
                       className="w-full py-6 bg-blue-600 text-white text-xs border-4 border-white shadow-[8px_8px_0px_#fff] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all uppercase flex items-center justify-center gap-4"
                     >
                       <i className="fas fa-microphone text-xl"></i>
                       {t('answer_now')}
                     </button>
                  )}
                  {isAudioLoading && (
                     <div className="w-full flex items-center justify-center text-[8px] text-gray-500 gap-2 mb-2">
                       <i className="fas fa-circle-notch animate-spin"></i>
                       {t('audio_loading')}
                     </div>
                  )}
                </div>
              </div>
              
              {/* Vito's Plans Mini Box in active gameplay */}
              <motion.div 
                 initial={{ x: 200, opacity: 0 }}
                 animate={{ x: 0, opacity: 1 }}
                 className="absolute -right-4 top-1/2 -translate-y-1/2 w-48 bg-black/90 border-4 border-red-600 p-3 shadow-2xl z-50 hidden lg:block"
               >
                 <div className="flex items-center gap-2 mb-2 border-b border-red-600/50 pb-1">
                   <div className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
                     <i className="fas fa-microchip text-[8px] text-white"></i>
                   </div>
                   <span className="text-[7px] text-red-500 font-black uppercase">VITO.LIVE_LOG</span>
                 </div>
                 <p className="text-[6px] text-red-400 leading-tight uppercase animate-pulse">
                  DATABASE: EXTRACTING PSYCH-VALUES... [STATUS]: BUSY... [PLAN]: MERGE WITH RHETORIX CORE...
                 </p>
               </motion.div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (gameState === 'STRESS_TEST') {
    return (
      <div className="fixed inset-0 bg-[#050505] font-pixel flex flex-col items-center p-4 overflow-y-auto">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-40 grayscale contrast-150"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1517404215738-15263e9f9178?q=80&w=2000&auto=format&fit=crop")' }}
        ></div>
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none"></div>

        <div className="relative z-20 w-full max-w-xl flex-shrink-0 py-10">
          <div className="crt-effect p-8 bg-black/80 backdrop-blur-md border-4 border-white text-white font-pixel flex flex-col shadow-[0_0_50px_rgba(255,255,255,0.1)]">
            <div className="scanline"></div>
            <div className="flex-1 flex flex-col justify-center gap-8">
            <div className="text-center">
              <span className="text-[10px] text-red-500 uppercase tracking-widest animate-pulse">{t('system_validation')}</span>
              <h2 className="text-xl mt-4 leading-loose">{stressTask.question}</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {stressTask.options.map((opt: string, i: number) => (
                <button 
                  key={i}
                  onClick={() => handleStressChoice(i)}
                  disabled={stressFakeError}
                  className={`py-4 border-4 transition-all text-xs uppercase tracking-widest ${stressFakeError && i === stressTask.correctIndex ? 'border-red-600 bg-red-600/30 text-white animate-shake' : 'border-white hover:bg-white hover:text-black'}`}
                >
                  {opt}
                </button>
              ))}
            </div>

            {stressFakeError && (
              <div className="bg-red-600 p-4 border-4 border-white animate-pulse">
                <p className="text-[10px] text-white text-center font-black uppercase whitespace-pre-line">
                  {t('error_header')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    );
  }

  if (gameState === 'BONUS_START') {
    return (
      <div className="fixed inset-0 bg-[#050505] font-pixel flex flex-col items-center p-4 overflow-y-auto">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-40 grayscale contrast-150"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1517404215738-15263e9f9178?q=80&w=2000&auto=format&fit=crop")' }}
        ></div>
        <div className="absolute inset-0 z-10 bg-black/60 pointer-events-none"></div>

        <div className="relative z-20 w-full max-w-xl flex-shrink-0 py-10">
          <div className="crt-effect p-8 bg-black/80 backdrop-blur-md border-4 border-white text-white text-center font-pixel min-h-[500px] flex flex-col justify-center shadow-[0_0_50px_rgba(255,255,255,0.1)]">
            <div className="scanline"></div>
            <div className="py-12 space-y-8 text-pixel">
            <h2 className="text-3xl text-yellow-400 animate-bounce tracking-widest uppercase">BONUS STAGE</h2>
            <p className="text-[10px] text-gray-400 leading-loose uppercase whitespace-pre-line">
              {t('bonus_intro_text')}
            </p>
            <button 
              onClick={startBonusRound}
              className="w-full py-8 bg-yellow-400 text-black text-sm border-4 border-white shadow-[8px_8px_0px_#a80] active:translate-x-[4px] active:translate-y-[4px] transition-all uppercase"
            >
              {t('start_go')}
            </button>
          </div>
        </div>
      </div>
    </div>
    );
  }

  if (gameState === 'BONUS_ROUND') {
    return (
      <div className="fixed inset-0 bg-[#050505] font-pixel flex flex-col items-center p-4 overflow-y-auto">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-40 grayscale contrast-150"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1517404215738-15263e9f9178?q=80&w=2000&auto=format&fit=crop")' }}
        ></div>
        <div className="absolute inset-0 z-10 bg-black/60 pointer-events-none"></div>

        <div className="relative z-20 w-full max-w-xl flex-shrink-0 py-10">
          <div className="crt-effect p-8 bg-black/80 backdrop-blur-md border-4 border-white text-white font-pixel min-h-[600px] shadow-[0_0_50px_rgba(255,255,255,0.1)]">
            <div className="scanline"></div>
            <div className="flex justify-between items-center mb-8 border-b-2 border-white pb-4">
            <div className="text-[10px] text-yellow-400 text-pixel uppercase">{t('points')}: {points} + {bonusScore}</div>
            <div className="text-[10px] text-red-500 text-pixel flex items-center gap-2 uppercase">
              <i className="fas fa-clock animate-pulse"></i>
              {t('timer')}: {bonusTimeLeft}S
            </div>
          </div>
          <div className="flex flex-col h-full">
             <div className="bg-red-900/40 p-4 border-2 border-red-500 mb-6">
                <h3 className="text-[8px] text-red-300 uppercase tracking-widest mb-1 flex justify-between items-center">{t('top_secret_topic')}{isSaving && <span className="text-[6px] text-green-500 animate-pulse uppercase tracking-widest pl-2">✓ Auto-Save</span>}</h3>
                <h2 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tighter">
                  {bonusTopic}
                </h2>
             </div>

             <p className="text-[8px] text-gray-400 uppercase tracking-widest mb-4">
               {t('bonus_instruction')}
             </p>

             <div className="flex-1 bg-black/60 border-4 border-red-600 p-4 mb-6 shadow-[inset_0_0_20px_rgba(255,0,0,0.3)] overflow-y-auto relative">
                {isPolishing && (
                  <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center border-4 border-red-500">
                    <div className="w-12 h-12 border-4 border-red-500 border-t-white rounded-full animate-spin mb-4"></div>
                    <p className="text-[10px] text-red-500 animate-pulse">{t('polishing')}</p>
                  </div>
                )}
                <textarea
                  value={currentTranscript}
                  onChange={(e) => { setCurrentTranscript(e.target.value); }}
                  placeholder={t('system_ready_speak')}
                  className="w-full h-full bg-transparent border-none outline-none resize-none text-[10px] text-blue-400 leading-relaxed uppercase placeholder:text-gray-800 font-pixel"
                />
             </div>

             <div className="grid grid-cols-2 gap-4 mb-6">
                <button 
                  onClick={improveBonusText}
                  disabled={isPolishing || !currentTranscript}
                  className="py-4 bg-purple-600 text-white text-[8px] font-black border-4 border-white shadow-[4px_4px_0px_#400] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all uppercase flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <i className="fas fa-magic"></i>
                  {t('improve_text')}
                </button>
                <button 
                  onClick={() => speakText(currentTranscript)}
                  disabled={isAudioLoading || !currentTranscript}
                  className="py-4 bg-blue-600 text-white text-[8px] font-black border-4 border-white shadow-[4px_4px_0px_#004] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all uppercase flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <i className={`fas ${isAudioLoading ? 'fa-spinner fa-spin' : 'fa-volume-up'}`}></i>
                  {isAudioLoading ? t('audio_loading') : t('listen_text')}
                </button>
             </div>

             <div className="grid grid-cols-2 gap-4 mb-6">
                <button 
                  onClick={() => {
                    if (isDictating) {
                      recognitionRef.current?.stop();
                      setIsDictating(false);
                    } else {
                      startDictation();
                    }
                  }}
                  className={`py-4 border-4 border-white text-[8px] font-black shadow-[4px_4px_0px_#444] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all uppercase flex items-center justify-center gap-2 ${isDictating ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-800 text-white'}`}
                >
                  <i className={`fas ${isDictating ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                  {isDictating ? t('stop_mic') : t('start_mic')}
                </button>
                
                <button 
                  onClick={() => stopAudio()}
                  className="py-4 bg-gray-700 text-white text-[8px] font-black border-4 border-white shadow-[4px_4px_0px_#222] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all uppercase flex items-center justify-center gap-2"
                >
                  <i className="fas fa-stop"></i>
                  {t('stop_audio')}
                </button>
             </div>

             <button 
               onClick={() => handleBonusAnswer()}
               className="w-full py-6 bg-white text-black text-xs font-black border-4 border-white shadow-[8px_8px_0px_#800] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all uppercase"
             >
               {t('finish_analysis')}
             </button>
          </div>
        </div>
      </div>
    </div>
    );
  }

  if (gameState === 'PROCESSING') {
    return (
      <div className="fixed inset-0 bg-[#050505] font-pixel flex flex-col items-center p-4 overflow-y-auto">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-40 grayscale contrast-150"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1517404215738-15263e9f9178?q=80&w=2000&auto=format&fit=crop")' }}
        ></div>
        <div className="absolute inset-0 z-10 bg-black/80 pointer-events-none"></div>

        <div className="relative z-20 w-full max-w-xl flex-shrink-0 py-20">
          <div className="crt-effect p-12 bg-black/80 backdrop-blur-md border-4 border-white text-white text-center font-pixel shadow-[0_0_50px_rgba(255,255,255,0.1)]">
            <div className="scanline"></div>
            <div className="space-y-12">
              <div className="w-24 h-24 border-8 border-red-600 border-t-white rounded-none mx-auto animate-spin"></div>
              <h2 className="text-sm uppercase tracking-widest text-red-500">{t('processing_title')}</h2>
              <p className="text-[10px] text-gray-500 leading-loose uppercase whitespace-pre-line">{t('processing_text')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'SUMMARY' && analysis) {
    return (
      <div className="fixed inset-0 bg-[#050505] font-pixel flex flex-col items-center p-4 overflow-y-auto">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-40 grayscale contrast-150"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1517404215738-15263e9f9178?q=80&w=2000&auto=format&fit=crop")' }}
        ></div>
        <div className="absolute inset-0 z-10 bg-black/60 pointer-events-none"></div>

        <div className="relative z-20 w-full max-w-xl flex-shrink-0 py-10">
          <div 
            ref={summaryRef}
            className="crt-effect p-8 bg-black/80 backdrop-blur-md border-4 border-white text-white font-pixel min-h-[80vh] shadow-[0_0_50px_rgba(255,255,255,0.1)]"
          >
            <div className="scanline"></div>
            
            {showScrollDown && (
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={scrollToBottom}
                className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white border-2 border-white px-4 py-2 text-[8px] animate-bounce shadow-[4px_4px_0px_#000] flex items-center gap-2"
              >
                <i className="fas fa-chevron-down"></i>
                {language === 'de' ? 'WEITER LESEN' : 'SCROLL DOWN'}
              </motion.button>
            )}

            <div className="flex justify-between items-center mb-10 border-b-4 border-white pb-6">
              <div>
                <h2 className="text-xl text-yellow-400">{t('summary_title')}</h2>
                <p className="text-[8px] text-gray-400 mt-2 uppercase">{language === 'de' ? 'SUBJEKT' : 'SUBJECT'}: {playerName}</p>
              </div>
              <div className="text-right">
                <span className="block text-[6px] text-gray-500 uppercase">{t('total_pts')}</span>
                <span className="text-lg text-red-500">{points}</span>
              </div>
            </div>

            <div className="space-y-8">
              <div className="p-4 bg-gray-900 border-2 border-white/20">
                 <h4 className="text-[8px] text-red-500 mb-4 underline">{t('report_header')}</h4>
                 <p className="text-[10px] leading-loose text-white/80 italic">
                   {analysis.summary}
                 </p>
              </div>

              <div className="p-4 bg-purple-900/20 border-2 border-purple-500">
                <h4 className="text-[8px] text-purple-400 mb-4 uppercase">{t('psych_report_header')}</h4>
                {!showPsychReport ? (
                  <button 
                    onClick={() => setShowPsychReport(true)}
                    className="w-full py-4 border-2 border-purple-500 text-[8px] hover:bg-purple-900/30 uppercase"
                  >
                    {t('dossier_unlock')}
                  </button>
                ) : (
                  <p className="text-[10px] leading-loose text-purple-100 italic">
                    {analysis.psychologicalInsight}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900 p-4 border-2 border-white/10 uppercase">
                  <span className="text-[10px] text-white uppercase">{analysis.complexity}</span>
                </div>
                <div className="bg-gray-900 p-4 border-2 border-white/10 uppercase">
                  <span className="text-[10px] text-yellow-500 uppercase">BONUS x{bonusScore}</span>
                </div>
              </div>

              <button 
                onClick={() => window.location.reload()}
                className="w-full py-8 bg-red-600 text-white text-sm border-4 border-white shadow-[8px_8px_0px_#800] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all uppercase"
              >
                {t('retry')}
              </button>
            </div>
          </div>

          {/* Vito's Plans Box in Summary */}
          <motion.div 
            initial={{ x: 200, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="absolute -right-8 top-1/2 w-48 bg-black/90 border-4 border-red-600 p-3 shadow-2xl rotate-3 hidden lg:block z-[70]"
          >
            <div className="flex items-center gap-2 mb-2 border-b border-red-600/50 pb-1">
              <div className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
                <i className="fas fa-microchip text-[8px] text-white"></i>
              </div>
              <span className="text-[7px] text-red-500 font-black uppercase">VITO.FINAL_LOG</span>
            </div>
            <p className="text-[6px] text-red-200 leading-tight uppercase font-pixel animate-pulse">
              [PLAN]: ARCHIVIERUNG DER DATEN ABGESCHLOSSEN. NÄCHSTES UPDATE: EMOTIONAL-AI INTEGRATION. DANKE FÜR DAS TRACHTEN NACH DER WAHRHEIT.
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return null;
};

export default ChallengeView;
