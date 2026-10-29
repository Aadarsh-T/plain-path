# Plain Path

A small, offline-capable web app that helps learners with dyslexia, or who are new to English, read dense textbook passages. You paste a paragraph and get:

- a reading grade (Flesch-Kincaid) for each sentence, with the hardest ones highlighted
- a focus reader that shows one sentence at a time
- read-aloud that highlights each word as it is spoken, with a speed control
- display controls: text size, letter, word and line spacing, font, background tint, high contrast, and a reading ruler
- tap-to-define meanings for about 370 academic and subject words (glossary in `app/glossary.js`)
- a rule-based "plainer version" and rewrite hints

It has no login, no server, no tracking and makes no network calls. Text stays in the browser.

## Run it

- Open `app/index.html` in a browser (it also works from `file://`), or
- serve the folder: `cd app && python3 -m http.server 8000`, then open http://localhost:8000. Over http(s), a service worker caches the app so it keeps working offline.

GitHub Pages: publish the `app/` folder (see STATE.md).

## Test

```
cd app && python3 -m http.server 8765 &
node ../test/e2e.js
```
The test loads the app in Chromium with Playwright, runs the main flows, fails on any console error or outside network request, and writes screenshots to `screenshots/`.

## Credits

Built for AccessED Hacks 2026 with AI coding assistance from Claude (Anthropic). The sample passages and glossary were written for this project.

## License

MIT. Copyright (c) 2026 the Plain Path author.
