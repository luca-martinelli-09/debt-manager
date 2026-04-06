import { browser } from '$app/environment';

export const userSettings = $state({
	myContactId: browser ? localStorage.getItem('myContactId') || '' : '',
	geminiApiKey: browser ? localStorage.getItem('geminiApiKey') || '' : '',
	geminiModel: browser
		? localStorage.getItem('geminiModel') || 'gemini-2.5-flash'
		: 'gemini-2.5-flash'
});

export function setMyContactId(id: string) {
	userSettings.myContactId = id;
	if (browser) {
		if (id) {
			localStorage.setItem('myContactId', id);
		} else {
			localStorage.removeItem('myContactId');
		}
	}
}

export function setGeminiSettings(apiKey: string, model: string) {
	userSettings.geminiApiKey = apiKey;
	userSettings.geminiModel = model;
	if (browser) {
		if (apiKey) {
			localStorage.setItem('geminiApiKey', apiKey);
		} else {
			localStorage.removeItem('geminiApiKey');
		}
		if (model) {
			localStorage.setItem('geminiModel', model);
		} else {
			localStorage.removeItem('geminiModel');
		}
	}
}
