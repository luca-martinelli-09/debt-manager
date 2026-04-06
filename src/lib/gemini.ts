import { GoogleGenAI, Type, type Tool } from '@google/genai';
import { db } from './db';
import { userSettings } from './settings.svelte';

export function getGenAIClient() {
	if (!userSettings.geminiApiKey) {
		throw new Error('Chiave API Gemini non impostata. Vai nelle Impostazioni per configurarla.');
	}
	// Usiamo il nuovo SDK standard
	return new GoogleGenAI({ apiKey: userSettings.geminiApiKey });
}

export const debtManagerTools: Tool[] = [
	{
		functionDeclarations: [
			{
				name: 'get_dashboard_summary',
				description:
					'Recupera il bilancio totale, le spese totali da dare e quelle da ricevere. Chiamalo quando ti viene chiesta una panoramica globale o lo stato dei bilanci generali.'
			},
			{
				name: 'get_all_contacts',
				description:
					"Recupera l'elenco completo di tutti i contatti, inclusi i loro nomi e il loro ID interno del database. Essenziale se devi creare una spesa per conto di qualcuno."
			},
			{
				name: 'get_all_categories',
				description:
					"Recupera l'elenco di tutte le categorie presenti nel database per poterle associare a una spesa."
			},
			{
				name: 'get_all_groups',
				description:
					"Restituisce i gruppi salvati. Utile se l'utente vuole informazioni su un viaggio specifico o associare una spesa a un contesto."
			},
			{
				name: 'get_recent_expenses',
				description:
					'Restituisce le ultime 20 spese registrate nel sistema, con titolo, importo, data, pagatore e chi ha partecipato.'
			},
			{
				name: 'add_expense',
				description:
					"Aggiunge e registra materialmente una nuova spesa nel database. Da utilizzare quando l'utente ti chiede di segnare/aggiungere una spesa.",
				parameters: {
					type: Type.OBJECT,
					properties: {
						title: {
							type: Type.STRING,
							description: 'Titolo breve e riassuntivo della spesa (es. "Cena in Pizzeria").'
						},
						amount: { type: Type.NUMBER, description: 'Importo totale speso, espresso in euro.' },
						categoryId: {
							type: Type.STRING,
							description:
								'ID della categoria. Prima di invocarmi dovresti aver cercato la lista con get_all_categories. Se non sai quale scegliere omatte, usa quella che sembra più adatta o lascia vuoto.'
						},
						paidById: {
							type: Type.STRING,
							description:
								"ID del contatto che ha fisicamente pagato. Se non specificato diversamente o se non lo sai, usa il \"myContactId\" (ovvero l'utente che sta parlando) se c'è."
						},
						groupId: {
							type: Type.STRING,
							description: 'ID del gruppo, opzionale, se la spesa fa parte di un gruppo.'
						},
						splitParticipantIds: {
							type: Type.ARRAY,
							items: { type: Type.STRING },
							description:
								'Array degli ID (stringhe UUID) dei contatti tra cui dividere in modo equo la spesa. Attenzione: se Mario paga la pizza e divide con Anna, qua devi inserire ENTRAMBI i loro ID altrimenti il saldo andrà in negativo solo al poveretto che ha pagato.'
						}
					},
					required: ['title', 'amount', 'paidById', 'splitParticipantIds']
				}
			}
		]
	}
];

export const systemInstruction = `Sei l'Assistente AI di Debt Manager, un'app PWA open-source per il tracciamento delle spese e la gestione dei debiti tra amici, coinquilini e viaggi (simile a Splitwise). 
Il tuo compito è aiutare l'utente a recuperare informazioni sulle sue spese o inserire nuove transazioni (es. estraendo i dati da uno scontrino caricato).

REGOLE TASSATIVE:
1. Sii sempre conciso, formattando le risposte con elenchi puntati o grassetti se ci sono importi.
2. Hai a disposizione vari Tools per interagire con il database IndexedDB locale dell'utente. Usali in sequenza.
3. Se l'utente ti chiede di creare una spesa ("ho mangiato una pizza con mario per 20 euro"), prima devi usare 'get_all_contacts' per cercare l'ID di Mario e l'ID dell'utente che ti parla, e POI usare 'add_expense'.
4. Nelle divisioni: se non diversamente specificato, dividi SEMPRE in parti uguali tra i presenti della frase incluso chi ha pagato. Passa tutti gli ID nella proprietà 'splitParticipantIds' del tool.
5. Se l'utente carica uno scontrino senza dire nulla, devi capire da solo il totale, inventare un titolo e creare la spesa ripartendola col pagatore predefinito.`;

// Le funzioni reali che verranno mappate al tool call
export const toolHandlers: Record<string, Function> = {
	get_dashboard_summary: async () => {
		// Logica semplificata basata sui calcoli di debt
		const { calculateBalances, simplifyDebts } = await import('./utils/debt');
		const expenses = await db.expenses.toArray();
		const settlements = await db.settlements.toArray();
		const contacts = await db.contacts.toArray();

		const allIds = contacts.map((c) => c.id).filter((c) => c !== undefined);
		const balances = calculateBalances(expenses, settlements, allIds);
		const debts = simplifyDebts(balances);

		let myId = userSettings.myContactId ? userSettings.myContactId : null;

		if (myId) {
			const myBalance = balances.get(myId) || 0;
			const iOwe = debts.filter((d) => d.from === myId).reduce((sum, d) => sum + d.amount, 0);
			const owedToMe = debts.filter((d) => d.to === myId).reduce((sum, d) => sum + d.amount, 0);
			return JSON.stringify({
				note: "Dati personali dell'utente loggato",
				balance: myBalance,
				debt_passivo: iOwe,
				credit_attivo: owedToMe
			});
		} else {
			const globalDebt = debts.reduce((sum, d) => sum + d.amount, 0);
			return JSON.stringify({ note: 'Dati globali', global_total_balance_volume: globalDebt });
		}
	},
	get_all_contacts: async () => {
		const contacts = await db.contacts.toArray();
		const myId = userSettings.myContactId ? userSettings.myContactId : null;
		return JSON.stringify(contacts.map((c) => ({ id: c.id, name: c.name, is_me: c.id === myId })));
	},
	get_all_categories: async () => {
		const cats = await db.categories.toArray();
		return JSON.stringify(cats.map((c) => ({ id: c.id, name: c.name })));
	},
	get_all_groups: async () => {
		const groups = await db.groups.toArray();
		return JSON.stringify(groups.map((g) => ({ id: g.id, name: g.name, member_ids: g.memberIds })));
	},
	get_recent_expenses: async () => {
		const expenses = await db.expenses.reverse().limit(20).toArray();
		const contacts = await db.contacts.toArray();
		return JSON.stringify(
			expenses.map((e) => ({
				id: e.id,
				title: e.title,
				amount: e.amount,
				date: e.date,
				paid_by_name: contacts.find((c) => c.id === e.paidById)?.name || 'Sconosciuto',
				category: e.category,
				type: e.splitType
			}))
		);
	},
	add_expense: async (args: any) => {
		try {
			const { title, amount, categoryId, paidById, groupId, splitParticipantIds } = args;

			if (
				!title ||
				!amount ||
				!paidById ||
				!splitParticipantIds ||
				splitParticipantIds.length === 0
			) {
				return JSON.stringify({
					error:
						'Campi obbligatori mancanti: assicurati di passare title, amount, paidById e array splitParticipantIds'
				});
			}

			// Prepara array per db
			const splitValue = amount / splitParticipantIds.length;
			const splits = splitParticipantIds.map((cid: string) => ({
				contactId: cid,
				value: splitValue
			}));

			let catName = 'Generale';
			const realCatId = categoryId;
			if (realCatId) {
				const cat = await db.categories.get(realCatId);
				if (cat) catName = cat.name;
			} else {
				// Cerca la categoria Generale se non specificata
				const allCats = await db.categories.toArray();
				const genCat = allCats.find((c) => c.name === 'Generale');
				if (genCat) catName = genCat.name;
			}

			const newExpId = await db.expenses.add({
				id: (await import('uuidv7')).uuidv7(),
				title,
				amount,
				date: new Date(),
				categoryId: realCatId || undefined,
				category: catName,
				groupId: groupId || undefined,
				paidById: paidById,
				splitType: 'equally',
				splits: splits,
				createdAt: new Date()
			});

			return JSON.stringify({ success: true, message: 'Spesa aggiunta!', expense_id: newExpId });
		} catch (e: any) {
			console.error(e);
			return JSON.stringify({ error: 'Errore inserimento DB: ' + e.message });
		}
	}
};
