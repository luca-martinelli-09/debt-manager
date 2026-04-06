## 1. Analisi Funzionale

L'obiettivo è replicare l'esperienza di Splitwise eliminando la dipendenza dal cloud, garantendo privacy totale e funzionamento offline.

### Moduli Principali
* **Gestione Anagrafica:** Creazione di "Contatti" (nome, avatar, email/tel opzionali).
* **Gestione Gruppi:** Aggregazione di contatti per contesti specifici (es. "Casa", "Viaggio Londra").
* **Motore delle Spese:**
    * Inserimento dettagliato (Titolo, Importo, Data, Categoria).
    * Allegati: Gestione di immagini/PDF (scontrini) salvati come `Blob` in IndexedDB.
* **Logica di Ripartizione:**
    * *Equa:* Divisione automatica $Importo / n$.
    * *Disuguale:* Valori assoluti per ogni partecipante.
    * *Percentuale:* Suddivisione basata su quote.
* Possibilità di inserire una spesa 1-1 (es. "Ho pagato il caffè a Mario") senza dover creare un gruppo.
* **Sistema di Saldo (Settling Up):** Registrazione di pagamenti per azzerare i debiti.
* **Data Portability:** Backup completo del database in un singolo file JSON scaricabile.
* **OCR:** Estrazione del testo dagli scontrini caricati con Tesseract.js.
* Semplificazione del debito

---

## 2. Analisi Tecnica & Architettura

### Stack Tecnologico
* **Framework:** SvelteKit 5 (utilizzando `$state` e `$derived` per la reattività dei saldi).
* **UI/UX:** Shadcn-Svelte + Tailwind CSS 4 (sfruttando le nuove variabili CSS-centriche).
* **Database:** **Dexie.js** (wrapper per IndexedDB). È fondamentale per gestire le relazioni tra tabelle e le query asincrone in modo semplice.
* **PWA:** https://svelte.dev/docs/kit/service-workers per il service worker e il caching degli asset.

Le librerie esterne sono già state installate, così come la configurazione di Tailwind CSS 4 e Shadcn-Svelte.