## 1. Analisi Funzionale

L'obiettivo è replicare l'esperienza di Splitwise eliminando la dipendenza dal cloud, garantendo privacy totale e funzionamento offline.

### Moduli Principali

- **Gestione Anagrafica:** Creazione di "Contatti" (nome, avatar, email/tel opzionali).
- **Gestione Gruppi:** Aggregazione di contatti per contesti specifici (es. "Casa", "Viaggio Londra").
- **Motore delle Spese:**
  - Inserimento dettagliato (Titolo, Importo, Data, Categoria).
  - Allegati: Gestione di immagini/PDF (scontrini) salvati come `Blob` in IndexedDB.
- **Logica di Ripartizione:**
  - _Equa:_ Divisione automatica $Importo / n$.
  - _Disuguale:_ Valori assoluti per ogni partecipante.
  - _Percentuale:_ Suddivisione basata su quote.
- Possibilità di inserire una spesa 1-1 (es. "Ho pagato il caffè a Mario") senza dover creare un gruppo.
- **Sistema di Saldo (Settling Up):** Registrazione di pagamenti per azzerare i debiti.
- **Data Portability:** Backup completo del database in un singolo file JSON scaricabile.
- **OCR:** Estrazione del testo dagli scontrini caricati con Tesseract.js.
- Semplificazione del debito
- Design responsive che garantisca facilità d'uso su dispositivi mobili e desktop.

Gruppi, spese, contatti, categorie devono poter essere sempre modificabili e cancellabili.
Per gli id usa UUIDv7 per garantire unicità e ordinamento temporale.

---

## 2. Analisi Tecnica & Architettura

### Stack Tecnologico

- **Framework:** SvelteKit 5 (utilizzando `$state` e `$derived` per la reattività dei saldi).
- **UI/UX:** Shadcn-Svelte + Tailwind CSS 4 (sfruttando le nuove variabili CSS-centriche).
- **Database:** **Dexie.js** (wrapper per IndexedDB). È fondamentale per gestire le relazioni tra tabelle e le query asincrone in modo semplice.
- **PWA:** https://svelte.dev/docs/kit/service-workers per il service worker e il caching degli asset.

Le librerie esterne sono già state installate, così come la configurazione di Tailwind CSS 4 e Shadcn-Svelte.

Icone: lucide-svelte da importare come @lucide/svelte.
Form: formsnap e Zod4 (importato come zod4 e usato come zod4()) - https://www.shadcn-svelte.com/docs/components/form
Design: pulito e minimale, uso della sidebar di Shadcn-Svelte per la navigazione, tasto "Nuova Spesa" sempre visibile come FAB centrale, datatable per contatti, gruppi, spese. Ogni azione (modifica gruppo, creazione gruppo, creazione contatto, modifica contatto, creazione spesa, modifica spesa) avrà una pagina dedicata.
Typescript: VIETATO usare `any` o `unknown`. Tutti i tipi devono essere definiti esplicitamente per garantire la sicurezza del tipo e la manutenibilità del codice.
Eseguire sempre il linting e il formatting del codice con Prettier e ESLint per verificare la presenza di errori e mantenere uno stile di codice coerente.
Consulta la documentazione ufficiale di SvelteKit, Dexie.js e Shadcn-Svelte per best practices e pattern consigliati.
Usa i Sonner per notifiche utente (successo, errore, info) in modo coerente in tutta l'applicazione.
