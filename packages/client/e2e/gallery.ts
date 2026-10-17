// Every design-system component on one page, for the browser e2e (gallery.mjs).
import { mount } from 'svelte';
import '../src/app.css';
import Gallery from './Gallery.svelte';

mount(Gallery, { target: document.body });
