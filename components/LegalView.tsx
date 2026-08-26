import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * LegalView — Impressum (§ 5 DDG) + Datenschutzerklärung (DSGVO).
 *
 * WICHTIG: Vorlage, kein Rechtsrat. Platzhalter in [eckigen Klammern] ausfüllen
 * und vor Veröffentlichung rechtlich prüfen (lassen). Der Datenschutz-Teil
 * beschreibt bewusst genau, was diese App tut (Tracking nur mit Einwilligung,
 * Gemini-API, Mikrofon) — bitte an deinen tatsächlichen Einsatz anpassen.
 */

const Card: React.FC<{ children: React.ReactNode; id?: string }> = ({ children, id }) => (
  <div id={id} className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-md scroll-mt-24">
    {children}
  </div>
);

const H: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-1.5 mt-5 first:mt-0">{children}</h3>
);
const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300 mb-2">{children}</p>
);
const Ph: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="font-semibold text-amber-600 dark:text-amber-400">{children}</span>
);

const LegalView: React.FC<{ focus?: 'impressum' | 'datenschutz' }> = ({ focus = 'impressum' }) => {
  const navigate = useNavigate();
  const impressumRef = useRef<HTMLDivElement | null>(null);
  const datenschutzRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = focus === 'datenschutz' ? datenschutzRef.current : impressumRef.current;
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }, [focus]);

  const scrollTo = (which: 'impressum' | 'datenschutz') => {
    const el = which === 'datenschutz' ? datenschutzRef.current : impressumRef.current;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <button
          onClick={() => navigate('/')}
          className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-400 hover:text-blue-600 shadow-sm transition-all"
          aria-label="Zurück zur Startseite"
        >
          <i className="fas fa-chevron-left"></i>
        </button>
        <h2 className="text-xl font-black text-gray-900 dark:text-white italic uppercase tracking-tighter">Rechtliches</h2>
        <div className="w-12 h-12"></div>
      </div>

      {/* Sub-Nav */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => scrollTo('impressum')} className="py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
          Impressum
        </button>
        <button onClick={() => scrollTo('datenschutz')} className="py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
          Datenschutz
        </button>
      </div>

      {/* Disclaimer */}
      <div className="p-5 rounded-[2rem] bg-amber-50 dark:bg-amber-950/20 border border-amber-300/60 dark:border-amber-500/30 flex gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg shrink-0">
          <i className="fas fa-triangle-exclamation"></i>
        </div>
        <div>
          <h3 className="font-black uppercase tracking-wider text-[11px] text-amber-700 dark:text-amber-300">Vorlage — kein Rechtsrat</h3>
          <p className="text-[12px] text-amber-800/80 dark:text-amber-200/70 leading-relaxed mt-1">
            Alle <Ph>[Platzhalter]</Ph> ausfüllen und den Text vor der Veröffentlichung
            rechtlich prüfen (lassen). Ein fehlerhaftes Impressum oder eine fehlerhafte
            Datenschutzerklärung kann abgemahnt werden.
          </p>
        </div>
      </div>

      {/* ================= IMPRESSUM ================= */}
      <Card id="impressum">
        <div ref={impressumRef} />
        <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight mb-3">Impressum</h3>

        <H>Angaben gemäß § 5 DDG</H>
        <P>
          Tobias Ganster<br />
          <Ph>[Straße&nbsp;Hausnummer]</Ph><br />
          <Ph>[PLZ&nbsp;Ort]</Ph>
        </P>

        <H>Kontakt</H>
        <P>
          E-Mail: <Ph>[deine-geschäftliche-E-Mail]</Ph><br />
          Telefon: <Ph>[optional]</Ph>
        </P>

        <H>Umsatzsteuer</H>
        <P>
          Kleinunternehmer gemäß § 19 UStG — es wird keine Umsatzsteuer ausgewiesen.
          {' '}(USt-IdNr.: <Ph>[falls vorhanden]</Ph>)
        </P>

        <H>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</H>
        <P>Tobias Ganster, Anschrift wie oben.</P>

        <H>Verbraucherstreitbeilegung</H>
        <P>
          Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren
          vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG).
        </P>
      </Card>

      {/* ================= DATENSCHUTZ ================= */}
      <Card id="datenschutz">
        <div ref={datenschutzRef} />
        <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight mb-3">Datenschutzerklärung</h3>

        <H>1. Verantwortlicher</H>
        <P>
          Verantwortlich im Sinne der DSGVO: Tobias Ganster, <Ph>[Anschrift]</Ph>,
          {' '}<Ph>[E-Mail]</Ph>.
        </P>

        <H>2. Hosting (GitHub Pages)</H>
        <P>
          Die öffentliche Web-Version wird über GitHub Pages bereitgestellt
          (GitHub Inc./Microsoft, USA). Beim Aufruf verarbeitet der Hoster technisch
          notwendige Daten wie deine IP-Adresse in Server-Logs, um die Seite sicher
          auszuliefern (Art. 6 Abs. 1 lit. f DSGVO). Dabei kann eine Übermittlung in
          die USA erfolgen.
        </P>

        <H>3. Statistik / Reichweitenmessung</H>
        <P>
          Wir nutzen eine <strong>eigene, anonyme First-Party-Analyse</strong> (kein
          Google Analytics, keine Fremd-Cookies). Erfasst werden — <strong>nur nach
          deiner Einwilligung</strong> über das Consent-Banner — anonyme Seitenaufrufe,
          Klicks und Sitzungen mit zufälligen, nicht-personenbezogenen IDs. Es werden
          <strong> keine Eingaben, Namen oder E-Mail-Adressen</strong> erfasst.
        </P>
        <P>
          Rechtsgrundlage: deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) sowie § 25
          Abs. 1 TDDDG für das Speichern im lokalen Speicher deines Geräts. Die Daten
          liegen lokal im Browser (localStorage) und werden — sofern aktiviert — an
          <Ph> [eigener Server / n8n / Google Drive]</Ph> übermittelt. Deine Einwilligung
          kannst du jederzeit unter „Einstellungen → Statistik &amp; Datenschutz"
          widerrufen.
        </P>

        <H>4. Lokale Speicherung (statt Cookies)</H>
        <P>
          Wir setzen keine Tracking-Cookies. Für die Einwilligung und
          App-Grundeinstellungen wird der lokale Speicher des Browsers verwendet
          (z. B. `rx_consent`, Design-Einstellung). Diese sind technisch notwendig bzw.
          einwilligungsbasiert.
        </P>

        <H>5. KI-Funktionen (Google Gemini)</H>
        <P>
          Für die KI-Funktionen (Analyse, Optimierung, Diktat-Auswertung) werden deine
          Eingaben an die Google-Gemini-API (Google Ireland Ltd./Google LLC) übermittelt
          und dort verarbeitet. Bitte gib dort <strong>keine sensiblen personenbezogenen
          Daten</strong> ein. Rechtsgrundlage: Vertrag/berechtigtes Interesse bzw.
          Einwilligung (Art. 6 Abs. 1 lit. b/f/a DSGVO). Es gelten zusätzlich die
          Datenschutzhinweise von Google.
        </P>

        <H>6. Mikrofon &amp; Aufnahme</H>
        <P>
          Für Diktat/Einsprechen wird — nur nach deiner Freigabe im Browser — auf das
          Mikrofon zugegriffen. Die Audiodaten werden zur Transkription verarbeitet
          (<Ph>[lokal / über Server / Google]</Ph>) und nicht ohne Grund gespeichert.
        </P>

        <H>7. Kontaktaufnahme</H>
        <P>
          Wenn du uns per E-Mail kontaktierst, verarbeiten wir deine Angaben zur
          Bearbeitung der Anfrage (Art. 6 Abs. 1 lit. b/f DSGVO).
        </P>

        <H>8. Deine Rechte</H>
        <P>
          Du hast das Recht auf Auskunft (Art. 15), Berichtigung (16), Löschung (17),
          Einschränkung (18), Datenübertragbarkeit (20), Widerspruch (21) sowie auf
          Widerruf erteilter Einwilligungen (Art. 7 Abs. 3). Außerdem steht dir ein
          Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde zu (Art. 77).
        </P>

        <H>9. Stand</H>
        <P>Stand dieser Erklärung: <Ph>[Datum eintragen]</Ph>.</P>
      </Card>

      <p className="text-[11px] text-center text-gray-400 dark:text-gray-500 px-4">
        Diese Seite ist eine anpassbare Vorlage. Für eine rechtssichere Fassung ggf.
        einen spezialisierten Generator (z. B. von einer Anwaltskanzlei) oder eine
        Rechtsberatung nutzen.
      </p>
    </div>
  );
};

export default LegalView;
