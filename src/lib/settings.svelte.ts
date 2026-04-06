import { browser } from '$app/environment';
import { db } from '$lib/db';

export const userSettings = $state({
	myContactId: '',
	geminiApiKey: '',
	geminiModel: 'gemini-2.5-flash',
	isLoaded: false
});

// Inizializza le impostazioni all'avvio dell'app dal DB
if (browser) {
	db.settings.toArray().then((settingsArray) => {
		const settingsMap = new Map(settingsArray.map((s) => [s.key, s.value]));
		
		userSettings.myContactId = settingsMap.get('myContactId') || '';
		userSettings.geminiApiKey = settingsMap.get('geminiApiKey') || '';
		userSettings.geminiModel = settingsMap.get('geminiModel') || 'gemini-2.5-flash';
		userSettings.isLoaded = true;
	}).catch(err => {
		console.error("Failed to load settings from DB", err);
		userSettings.isLoaded = true; // Set to true even on error so UI can render
	});
}

export async function setMyContactId(id: string) {
	userSettings.myContactId = id;
	if (browser) {
		if (id) {
			await db.settings.put({ key: 'myContactId', value: id });
		} else {
			await db.settings.delete('myContactId');
		}
	}
}

export async function setGeminiSettings(apiKey: string, model: string) {
	userSettings.geminiApiKey = apiKey;
	userSettings.geminiModel = model;
	if (browser) {
		if (apiKey) {
			await db.settings.put({ key: 'geminiApiKey', value: apiKey });
		} else {
			await db.settings.delete('geminiApiKey');
		}
		
		if (model) {
			await db.settings.put({ key: 'geminiModel', value: model });
		} else {
			await db.settings.delete('geminiModel');
		}
	}
}
