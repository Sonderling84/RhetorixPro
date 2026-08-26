import{j as e,b as _,m as F,s as H,A as K}from"./index-aJSZaKvY.js";import{b as a}from"./react-vendor-BI4_FKNt.js";import{G as T,M as G}from"./index-BtSbKYF2.js";import{c as U}from"./audio-helpers-DXdKczVn.js";import{d as w}from"./dictation-events-BFL13jYg.js";import{M as Z}from"./index-B4lmC-pN.js";const X=({onSave:z,addLog:s})=>{const[i,h]=a.useState(""),[c,v]=a.useState(null),[p,f]=a.useState(!1),[x,j]=a.useState(!1),[m,N]=a.useState(!1),[C,S]=a.useState(!1),[o,E]=a.useState("Meine App"),d=a.useRef(null),b=a.useRef(null),I=a.useRef(null),A=a.useRef(null);a.useEffect(()=>{const r=localStorage.getItem("rhetorix_devlog_draft");r&&h(r);const t=localStorage.getItem("rhetorix_devlog_app");t&&E(t)},[]),a.useEffect(()=>{if(i){localStorage.setItem("rhetorix_devlog_draft",i),S(!0);const r=setTimeout(()=>S(!1),800);return()=>clearTimeout(r)}else localStorage.removeItem("rhetorix_devlog_draft")},[i]);const R=async()=>{try{f(!0),s("Transkription für Entwicklungs-Logbücher aktiv. Sprich frei...","info"),w("",!0);const r=new T({apiKey:""});d.current=new(window.AudioContext||window.webkitAudioContext)({sampleRate:16e3}),b.current=await navigator.mediaDevices.getUserMedia({audio:!0});const t=r.live.connect({model:"gemini-2.0-flash-exp",config:{responseModalities:[G.AUDIO],systemInstruction:"Du bist ein technischer Assistent. Transkribiere die gesprochenen Notizen des Nutzers, der gerade ein Softwareprogramm entwickelt, präzise und exakt auf DEUTSCH. Korrigiere keine Struktur, schreibe einfach genau das auf, was gesagt wird.",inputAudioTranscription:{}},callbacks:{onopen:()=>{const n=d.current.createMediaStreamSource(b.current),g=d.current.createScriptProcessor(4096,1,1);g.onaudioprocess=u=>{const l=u.inputBuffer.getChannelData(0),y=U(l);t.then(V=>V.sendRealtimeInput({media:y}))},n.connect(g),g.connect(d.current.destination)},onmessage:n=>{var g;if((g=n.serverContent)!=null&&g.inputTranscription){const u=n.serverContent.inputTranscription.text;h(l=>{const y=l+(l?" ":"")+u;return w(y,!0),y})}},onerror:()=>D(),onclose:()=>{f(!1),w("",!1)}}});I.current=await t}catch{s("Mikrofon-Zugriff verweigert","error"),f(!1)}},D=()=>{f(!1),w("",!1),b.current&&b.current.getTracks().forEach(r=>r.stop()),d.current&&d.current.state!=="closed"&&d.current.close(),s("Spracheingabe beendet.")},k=r=>{let t="";const n=new Date().toLocaleDateString("de-DE");switch(r){case"daily":t=`## Tagesbericht - ${n}
Arbeite an der App: ${o}

1. Was ich heute geschafft habe:
- 
- 

2. Aktueller Stand:
-

3. Technische Details / Frameworks:
-

4. Hindernisse & Probleme:
-
`;break;case"feature":t=`## Feature-Dokumentation: [Name des Features]
App: ${o}

Motivation & Ziel:
-
- 

Umgesetzte Schritte:
- [x] UI Entwurf erstellt
- [ ] Logik implementiert
- [ ] Datenbank-Anbindung fertig

Herausforderungen:
-
`;break;case"bug":t=`## Bugfix-Eintrag
App: ${o}
Beteiligte Komponenten:
-

Fehlerbeschreibung:
-

Root Cause (Ursache):
-

Lösung & Behebung:
- `;break;case"idea":t=`## Neue Konzept-Idee / Architektur-Entwurf
App: ${o}

Kurz-Konzept:
-

Gewünschter Tech-Stack:
-

Mögliche Bibliotheken:
- `;break}h(t),s(`Vorlage "${r}" geladen.`,"success")},B=async()=>{if(!(!i||x)){j(!0),s("Veredele und strukturiere den Entwicklungsbericht...","info");try{const t=await new T({apiKey:""}).models.generateContent({model:"gemini-2.0-flash",contents:`Du bist ein erstklassiger technischer Dokumentar und erfahrener Software-Architekt. Deine Aufgabe ist es, die unstrukturierten Notizen, Gedanken, die Diktier-Rohdaten oder den Tagesbericht des Nutzers über seine Entwicklungsfortschritte zu korrigieren, sauber und professionell zu formulieren und logisch zu strukturieren.

Projekt-Kontext:
- App-Name: ${o}
- Datum: ${new Date().toLocaleDateString("de-DE")}

Hier sind die Notizen / das Transkript des Nutzers:
"${i}"

Bitte erstelle ein wunderschönes, übersichtliches und verständliches Entwickler-Logbuch (Changelog/Dev-Daily) in Markdown auf DEUTSCH. Verwende exzellenten professionellen Entwickler-Fachjargon, aber bleibe präzise.

Halte Dich an diese Struktur (passe sie dynamisch an, falls bestimmte Abschnitte leer sind):
1. 📌 **Zusammenfassung (Executive Summary)**: Ein bis zwei Sätze, was heute gearbeitet wurde.
2. ✅ **Erreichte Milestones & Features**: Strukturierte, klare Aufzählung der geschafften Arbeiten.
3. 🛠️ **Technische Implementierung & Code-Details**: Erwähne vorgenommene Code-Strukturen, Komponenten, Hooks, APIs oder Datenbank-Tabellen.
4. 🔍 **Behobene Bugs & Herausforderungen**: Welche Hürden wurden gemeistert, welche Probleme identifiziert und gelöst?
5. 📋 **Nächste konkrete Entwicklungsschritte**: Fokus für die nächste Arbeits-Session oder To-Dos.

Antworte ausschließlich mit dem fertig formulierten Markdown-Dokument. Schreibe keine einleitenden Höflichkeitsflrasen vorweg ("Hier ist dein Bericht") oder abschließende Kommentare.`});t.text&&(v(t.text),s("Entwicklungsbericht erfolgreich veredelt!","success"),setTimeout(()=>{var n;(n=A.current)==null||n.scrollIntoView({behavior:"smooth"})},100))}catch(r){s("Fehler bei der Veredelung: "+r.message,"error")}finally{j(!1)}}},$=async()=>{if(!(!c||m)){N(!0),s("Generiere professionelles Voice-Over...","info");try{const r=c.replace(/[*#`_\-]/g," ").replace(/\n+/g,` 
 `).substring(0,5e3);await H(r)}catch(r){s("Audio-Generierung fehlgeschlagen: "+r.message,"error")}finally{N(!1)}}},M=()=>{if(!i)return;const r=c||`### Rohentwurf - ${o}

${i}`;let t=`Entwicklung: ${o}`;if(c){const u=c.split(`
`).find(l=>l.includes("###")||l.includes("##")||l.includes("#"));u&&(t=u.replace(/[#*]/g,"").trim())}const n={id:Date.now().toString(),timestamp:Date.now(),mode:K.DEV_LOG,transcription:i,correctedText:r,title:t};z(n),h(""),v(null),localStorage.removeItem("rhetorix_devlog_draft"),s(`Bericht im Archiv unter "${t}" abgespeichert.`,"success")},P=async()=>{const r=c||i;if(r)if(navigator.share)try{await navigator.share({title:`Entwicklungs-Bericht: ${o}`,text:r})}catch{}else navigator.clipboard.writeText(r),s("Bericht in die Zwischenablage kopiert!","success")};return e.jsxs("div",{className:"space-y-6 animate-in fade-in duration-500 pb-20",children:[e.jsxs("div",{className:"bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl",children:[e.jsxs("div",{className:"flex justify-between items-center mb-6",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("h2",{className:"text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tighter italic",children:"Entwicklungs-Doku"}),C&&e.jsxs("span",{className:"text-[9px] text-indigo-500 font-bold tracking-widest flex items-center gap-1 normal-case font-mono animate-pulse",children:[e.jsx("span",{className:"w-1.5 h-1.5 bg-indigo-500 rounded-full inline-block"}),"Entwurf gesichert"]})]}),e.jsx("p",{className:"text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest mt-1",children:"Tagesablauf & Fortschritts-Archiv"})]}),e.jsx("div",{className:"w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner",children:e.jsx("i",{className:"fas fa-laptop-code text-xl"})})]}),e.jsxs("div",{className:"space-y-2 mb-6",children:[e.jsx("label",{className:"text-[10px] font-black uppercase text-gray-400 tracking-widest block",children:"Aktuelles Projekt / App"}),e.jsx("div",{className:"flex gap-2",children:e.jsx("input",{type:"text",value:o,onChange:r=>{E(r.target.value),localStorage.setItem("rhetorix_devlog_app",r.target.value)},placeholder:"z.B. Rhetorix Pro, Sixt Verhandlung, MyApp...",className:"flex-1 bg-gray-50 dark:bg-gray-950 border border-transparent rounded-2xl px-6 py-4 text-sm font-medium focus:bg-white dark:focus:bg-gray-900 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/20 outline-none text-gray-800 dark:text-white"})})]}),e.jsxs("div",{className:"mb-6",children:[e.jsx("p",{className:"text-[9px] font-black uppercase text-gray-400 tracking-widest mb-2 block",children:"Vorlagen-Schnellauswahl"}),e.jsxs("div",{className:"grid grid-cols-2 sm:grid-cols-4 gap-2",children:[e.jsxs("button",{onClick:()=>k("daily"),className:"py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-[10px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/40 flex items-center justify-center gap-1.5",children:[e.jsx("i",{className:"fas fa-calendar-day"})," Tagesbericht"]}),e.jsxs("button",{onClick:()=>k("feature"),className:"py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-[10px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all border border-transparent hover:border-emerald-100 dark:hover:border-emerald-900/40 flex items-center justify-center gap-1.5",children:[e.jsx("i",{className:"fas fa-puzzle-piece"})," Feature"]}),e.jsxs("button",{onClick:()=>k("bug"),className:"py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-[10px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 transition-all border border-transparent hover:border-rose-100 dark:hover:border-rose-900/40 flex items-center justify-center gap-1.5",children:[e.jsx("i",{className:"fas fa-bug"})," Bugfix"]}),e.jsxs("button",{onClick:()=>k("idea"),className:"py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-[10px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 dark:hover:text-orange-400 transition-all border border-transparent hover:border-orange-100 dark:hover:border-orange-900/40 flex items-center justify-center gap-1.5",children:[e.jsx("i",{className:"fas fa-lightbulb"})," Idee"]})]})]}),e.jsxs("div",{className:"relative mb-6",children:[e.jsx("textarea",{value:i,onChange:r=>h(r.target.value),placeholder:"Beschreibe, was du getan hast, an welchem Bug du dran warst oder welche Features du implementiert hast. Nutze Tastatur oder Diktier-Mikrofon...",className:"w-full h-56 bg-gray-50 dark:bg-gray-950 border border-transparent rounded-[2rem] p-6 text-sm font-medium focus:bg-white dark:focus:bg-gray-900 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/20 outline-none transition-all resize-none shadow-inner text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-700"}),e.jsx("button",{onClick:p?D:R,className:`absolute bottom-4 right-4 w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-lg active:scale-90 ${p?"bg-red-500 text-white animate-pulse":"bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-gray-700"}`,title:p?"Sprachaufnahme stoppen":"Entwicklungs-Notizen diktieren",children:e.jsx("i",{className:`fas ${p?"fa-stop":"fa-microphone"}`})})]}),e.jsxs("button",{onClick:B,disabled:x||!i,className:`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${x?"bg-gray-400 text-white cursor-not-allowed":"bg-indigo-600 text-white hover:bg-indigo-700"}`,children:[x?e.jsx("i",{className:"fas fa-spinner fa-spin"}):e.jsx("i",{className:"fas fa-wand-magic-sparkles"}),x?"VEREDELE PROZESS...":"BERICHT VEREDELN & STRUKTURIEREN"]})]}),e.jsx(_,{children:c&&e.jsxs(F.div,{ref:A,initial:{opacity:0,y:30},animate:{opacity:1,y:0},exit:{opacity:0,y:30},className:"bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-2xl space-y-6",children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center",children:e.jsx("i",{className:"fas fa-align-left"})}),e.jsxs("div",{children:[e.jsx("h3",{className:"text-sm font-black uppercase tracking-widest text-gray-800 dark:text-gray-100",children:"Archiv-Fassung"}),e.jsx("p",{className:"text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase mt-0.5",children:"Sauber & professionell formatiert"})]})]}),e.jsx("button",{onClick:$,disabled:m,className:`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${m?"bg-indigo-50 text-indigo-300":"bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 active:scale-90 border border-indigo-100 dark:border-indigo-800"}`,title:"Bericht professionell vorlesen lassen",children:e.jsx("i",{className:`fas ${m?"fa-spinner fa-spin":"fa-volume-high"}`})})]}),e.jsx("div",{className:"bg-gray-50 dark:bg-gray-950 p-6 sm:p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-inner max-h-[500px] overflow-y-auto scrollbar-thin dark:text-gray-100",children:e.jsx("div",{className:"prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 leading-relaxed font-medium",children:e.jsx(Z,{children:c})})}),e.jsxs("div",{className:"grid grid-cols-2 gap-4 pt-6 border-t border-gray-100 dark:border-gray-800",children:[e.jsxs("button",{onClick:M,className:"bg-gray-900 dark:bg-black text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2",children:[e.jsx("i",{className:"fas fa-circle-check"})," Im Archiv speichern"]}),e.jsxs("button",{onClick:P,className:"bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-center gap-2",children:[e.jsx("i",{className:"fas fa-share-nodes"})," Teilen / Kopieren"]})]})]})})]})};export{X as default};
