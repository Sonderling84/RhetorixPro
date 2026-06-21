
export enum AppMode {
  TRAINER = 'TRAINER',
  BRAINSTORM = 'BRAINSTORM',
  TEMPLATES = 'TEMPLATES',
  DICTATION = 'DICTATION',
  CHALLENGE = 'CHALLENGE',
  DIARY = 'DIARY',
  AUTHOR = 'AUTHOR',
  APP_DEV = 'APP_DEV',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
  BUSINESS_PITCH = 'BUSINESS_PITCH',
  LEARNING_QUIZ = 'LEARNING_QUIZ',
  EMAIL_STUDIO = 'EMAIL_STUDIO',
  ABOUT_ME = 'ABOUT_ME',
  MEDIA_LAB = 'MEDIA_LAB',
  PHONE_SIM = 'PHONE_SIM',
  PHONE_CUSTOM = 'PHONE_CUSTOM',
  TEXT_OPTIMIZER = 'TEXT_OPTIMIZER',
  YOUTUBE = 'YOUTUBE',
  PLANNING = 'PLANNING',
  DEV_LOG = 'DEV_LOG',
  VOICE_INPUT = 'VOICE_INPUT'
}

export interface UserStats {
  xp: number;
  level: number;
  completedSessions: number;
  streak: number;
  lastSessionDate?: number;
}

export interface SessionResult {
  id: string;
  timestamp: number;
  mode: AppMode;
  transcription: string;
  correctedText?: string;
  analysis?: AnalysisData;
  title: string;
  focusId?: string; // ID der vorherigen Session für Vergleiche
}

export interface AnalysisData {
  rhetoricScore: number;
  complexity: 'Einfach' | 'Mittel' | 'Komplex';
  strengths: string[];
  improvements: string[];
  summary: string;
  stylisticDevices: string[];
  explanationForKids?: string;
  detailedAdvice?: string;
  nextTrainingTask?: string; // Konkrete Aufgabe für das nächste Mal
  progressFeedback?: string; // Feedback im Vergleich zum vorherigen Mal
  psychologicalInsight?: string; // Detailliertes Psychogramm für den Verhör-Modus
  score?: number; // Gesamtpunktzahl für den Verhör-Modus
}

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'error' | 'success';
  message: string;
}
