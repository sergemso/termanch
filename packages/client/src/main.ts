import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { setupPwa } from './lib/pwa';

setupPwa();

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;