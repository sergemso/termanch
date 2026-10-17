// The real KeyRow and its Settings editor around a log of what the keys send, for the key row e2e (keyrow.mjs).
import { mount } from 'svelte';
import '../src/app.css';
import KeyRowProbe from './KeyRowProbe.svelte';

mount(KeyRowProbe, { target: document.body });
