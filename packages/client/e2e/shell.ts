// The real AppShell and KeyRow around a stand-in terminal, for checking layout under a (faked) soft keyboard.
import { mount } from 'svelte';
import '../src/app.css';
import ShellProbe from './ShellProbe.svelte';

mount(ShellProbe, { target: document.body });
