/* ===================== KONFIGURATION (eine Datei für alle Seiten) =====================
   Hier echte Werte eintragen. Alles andere bleibt unverändert.                          */
window.MA_CONFIG = {
  // Kontakt (erscheint auf der Seite und im Impressum-Link)
  KONTAKT_EMAIL: 'kontakt@ganster.tech',          // <<< echte Adresse eintragen

  // Beta-Plätze: ehrlich pflegen. FREI runterzählen, wenn ein Platz vergeben ist.
  PLAETZE_GESAMT: 10,
  PLAETZE_FREI: 10,

  // Nachweis-Zahlen für den Hero. BUILDS = wirklich nachgebaute Gebäude.
  BUILDS_GESAMT: 11,                               // <<< echte Zahl eintragen

  // Preisvergleich (Blatt "Preis"). Marktpreis = beobachteter Preis für EINE Visualisierung
  // bei Agenturen/Freelancern (Stand Okt. 2026, ohne Anbieternamen). Beides frei änderbar.
  PREIS_MONAT: 300,                                // Matrix Architekt, pro Monat, unbegrenzt
  MARKT_EINZELBILD: 500,                           // Agentur, eine Ansicht, ca.

  // Supabase (Kundenbereich: Login per E-Mail-Code + Upload). Leer = Demo-Modus.
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  BUCKET: 'bauplaene',
  TABLE: 'einreichungen',
  MAX_MB: 25,

  // First-Party-Tracking: n8n-Webhook, der Events als JSON annimmt. Leer = nur Konsole.
  TRACK_WEBHOOK_URL: '',

  // Artefakt-Adressen (nur für die Vorschau auf claude.ai; auf ganster.tech ohne Wirkung)
  ARTIFACTS: {
    'index.html': 'https://claude.ai/artifact/LVCWGc9mY9brYvZSy7B3HA',
    './': 'https://claude.ai/artifact/LVCWGc9mY9brYvZSy7B3HA',
    'portal.html': 'https://claude.ai/artifact/BrJppUtniDW22VFJwMaNcL',
    'erkenntnisse.html': 'https://claude.ai/artifact/1xVB4BokjNsDgTG6TKWQX5',
    'impressum.html': 'https://claude.ai/artifact/GMq21t2SajrJP2dqkYSxtA',
    'datenschutz.html': 'https://claude.ai/artifact/3eV5PsGXMmDtQF7BeKeND8'
  }
};
