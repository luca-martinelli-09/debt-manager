export default [
	...require('@eslint/js').configs.recommended,
	...require('eslint-plugin-svelte').configs.recommended,
	{
		rules: {
			'svelte/no-navigation-without-resolve': 'off',
			'svelte/require-each-key': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'svelte/prefer-svelte-reactivity': 'off',
			'@typescript-eslint/no-explicit-any': 'off'
		}
	}
];
