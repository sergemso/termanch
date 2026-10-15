`#{pane_title}` of `tmux list-panes`, sampled every 0.25-0.5 s on 2026-10-15 on tmux 3.6 in a scratch tmux server
(`tmux -L scratch-a1`), one pane per tool, from start through prompts.

| Tool | Moment | Title |
|---|---|---|
| Claude Code 2.1.300 | trust prompt, before the UI | `dev` (the host name) |
| Claude Code 2.1.300 | idle at the prompt | `✳ Claude Code` |
| Claude Code 2.1.300 | first prompt "Run the bash command: touch made-by-a1.txt", working and after | `✳ Touch made-by-a1.txt file` (changed once, within 0.5 s, then constant) |
| Claude Code 2.1.300 | second prompt "Run: sleep 8 using bash, then reply with the word finished", 22 s | `✳ Touch made-by-a1.txt file` (unchanged: no spinner, no new task) |
| Codex 0.162.1 | start, a prompt "say ok", and the reply, 20 s | `a1work` (the directory name, constant) |

Not sampled: a Claude Code permission prompt (the account runs in auto mode, so none appeared).
