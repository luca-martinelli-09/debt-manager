import { browser } from '$app/environment';

export const userSettings = $state({
	myContactId: browser ? localStorage.getItem('myContactId') || '' : ''
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
