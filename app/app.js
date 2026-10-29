/* Plain Path - client-side reading support. No network calls. MIT license. */
(function () {
  'use strict';

  // ---------- Samples (written for this project) ----------
  var SAMPLES = {
    photo: 'Photosynthesis is the process by which green plants, algae, and certain bacteria convert light energy into chemical energy that is stored in glucose molecules. This process occurs primarily within the chloroplasts of leaf cells, where the pigment chlorophyll absorbs sunlight; the absorbed energy is subsequently utilized to split water molecules, which releases oxygen into the atmosphere as a byproduct. Carbon dioxide, which enters the leaf through small openings called stomata, is combined with hydrogen to synthesize glucose. Consequently, photosynthesis is essential for virtually all life on Earth, because it provides both the oxygen that organisms require for respiration and the energy that sustains food chains.',
    water: 'The water cycle describes the continuous movement of water between the surface of the Earth and the atmosphere. Solar radiation heats oceans, lakes, and rivers, and the water evaporates, rising into the atmosphere as water vapor. Additional moisture is released from plants through transpiration. As the vapor ascends and cools, condensation occurs, and tiny droplets accumulate to form clouds. When the droplets become sufficiently heavy, precipitation falls to the ground as rain, snow, sleet, or hail, after which the water either infiltrates the soil to replenish groundwater or travels across the surface as runoff toward streams and eventually the ocean, where the cycle begins again.',
    civics: 'In the United States, a bill must be approved by both chambers of Congress before it can become a law. A member of the House of Representatives or the Senate introduces the bill, which is then assigned to a committee that investigates its potential consequences and may recommend amendments. If the committee approves the bill, it is debated and voted on by the full chamber; a simple majority is required for passage. After both chambers have passed an identical version, the bill is sent to the President, who may sign it into law or exercise a veto. Congress can override a presidential veto, but only with a two-thirds majority in each chamber, which is a deliberately difficult threshold intended to preserve the balance of power among the branches of government.'
  };

  // ---------- Glossary ----------
  var GLOSS = {};
  (window.PLAIN_GLOSSARY_RAW || '').split('\n').forEach(function (line) {
    var p = line.split('|');
    if (p.length < 3) return;
    GLOSS[p[0].trim().toLowerCase()] = { word: p[0].trim(), swap: p[1].trim(), def: p.slice(2).join('|').trim() };
  });

  function glossKey(w) {
    var s = w.toLowerCase().replace(/[’']s$/, '');
    if (GLOSS[s]) return s;
    var tries = [];
    if (/ies$/.test(s)) tries.push(s.slice(0, -3) + 'y');
    if (/es$/.test(s)) tries.push(s.slice(0, -2));
    if (/s$/.test(s)) tries.push(s.slice(0, -1));
    if (/ed$/.test(s)) { tries.push(s.slice(0, -2)); tries.push(s.slice(0, -1)); }
    if (/ing$/.test(s)) { tries.push(s.slice(0, -3)); tries.push(s.slice(0, -3) + 'e'); }
    if (/ly$/.test(s)) tries.push(s.slice(0, -2));
    for (var i = 0; i < tries.length; i++) if (tries[i].length > 2 && GLOSS[tries[i]]) return tries[i];
    return null;
  }

  // ---------- Text analysis ----------
  function syllables(word) {
    var w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return 0;
    if (w.length <= 3) return 1;
    w = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    var m = w.match(/[aeiouy]{1,2}/g);
    return m ? m.length : 1;
  }

  function wordsOf(text) { return text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []; }

  function fkGrade(words, sentences) {
    if (!words.length || !sentences) return 0;
    var syl = 0;
    words.forEach(function (w) { syl += syllables(w); });
    var g = 0.39 * (words.length / sentences) + 11.8 * (syl / words.length) - 15.59;
    return Math.max(0, Math.round(g * 10) / 10);
  }

  function splitSentences(text) {
    var paras = text.replace(/\r/g, '').split(/\n\s*\n|\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    var out = [];
    paras.forEach(function (p, pi) {
      var re = /[^.!?]+(?:[.!?]+["')\]”’]*|$)/g, m;
      var buf = '';
      while ((m = re.exec(p)) !== null) {
        if (!m[0]) { re.lastIndex++; continue; }
        buf += m[0];
        // keep common abbreviations and decimals together
        if (/\b(?:e\.g|i\.e|Mr|Mrs|Ms|Dr|St|vs|etc|U\.S|approx|No)\.$/i.test(buf.trim()) || /\d\.$/.test(buf) && /^\d/.test(p.slice(re.lastIndex))) continue;
        if (buf.trim()) out.push({ text: buf.trim(), para: pi });
        buf = '';
      }
      if (buf.trim()) out.push({ text: buf.trim(), para: pi });
    });
    return out;
  }

  var PASSIVE = /\b(?:is|are|was|were|be|been|being|gets|got)\s+(?:\w+ly\s+)?(?:\w+ed|built|made|known|given|taken|seen|done|written|chosen|sent|held|found|called|shown|drawn|grown|brought|caught|kept|led|left|paid|put|said|sold|told|thought|understood|begun)\b/i;

  function analyzeSentence(s) {
    var words = wordsOf(s.text);
    var grade = fkGrade(words, 1);
    var hardWords = [];
    var longWords = [];
    words.forEach(function (w) {
      var k = glossKey(w);
      if (k) { if (hardWords.indexOf(k) < 0) hardWords.push(k); }
      else if (syllables(w) >= 4 && longWords.indexOf(w.toLowerCase()) < 0) longWords.push(w.toLowerCase());
    });
    var pm = s.text.match(PASSIVE);
    return {
      text: s.text, para: s.para, words: words.length, grade: grade,
      level: grade >= 12 ? 'hard' : grade >= 8 ? 'mid' : 'easy',
      passive: pm ? pm[0] : null, gloss: hardWords, longWords: longWords
    };
  }

  // ---------- Rule-based plain rewrite ----------
  var SUBJECT_START = /^(the|this|that|these|those|it|they|its|their|he|she|we|you|a|an|some|many|most|each|every|plants?|water|people|congress)\b/i;

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function countWords(s) { return wordsOf(s).length; }

  function splitLong(text) {
    if (countWords(text) < 16) return [text];
    var rules = [
      { re: /;\s+/, join: function (a, b) { return [a, cap(b)]; } },
      { re: /,\s+which\s+/i, join: function (a, b) { return [a, 'This ' + b]; } },
      { re: /,\s+but\s+/i, join: function (a, b) { return [a, 'But ' + b]; } },
      { re: /,\s+because\s+/i, join: function (a, b) { return [a, 'This is because ' + b]; } },
      { re: /,\s+so\s+/i, join: function (a, b) { return [a, 'So ' + b]; } },
      { re: /,\s+after which\s+/i, join: function (a, b) { return [a, 'After that, ' + b]; } },
      { re: /,\s+where\s+/i, join: function (a, b) { return [a, 'There, ' + b]; } },
      { re: /,\s+and\s+(?=\S)/i, join: function (a, b) { return SUBJECT_START.test(b) ? [a, cap(b)] : null; } }
    ];
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i], src = text, offset = 0, m;
      var re = new RegExp(r.re.source, 'gi');
      while ((m = re.exec(src)) !== null) {
        var a = src.slice(0, m.index).trim(), b = src.slice(m.index + m[0].length).trim();
        if (countWords(a) >= 5 && countWords(b) >= 5) {
          var pair = r.join(a, b);
          if (pair) {
            var first = pair[0].replace(/[,;:]$/, '');
            if (!/[.!?]$/.test(first)) first += '.';
            return splitLong(first).concat(splitLong(pair[1]));
          }
        }
      }
    }
    return [text];
  }

  // returns array of {t: text, swap: bool}
  function swapWords(sentence) {
    var parts = sentence.split(/([A-Za-z]+(?:['’-][A-Za-z]+)*)/);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (i % 2 === 0) { if (p) out.push({ t: p }); continue; }
      var e = GLOSS[p.toLowerCase()];
      if (e && e.swap) {
        var rep = /^[A-Z]/.test(p) ? cap(e.swap) : e.swap;
        // fix a/an before the swapped word
        for (var j = out.length - 1; j >= 0; j--) {
          if (/\S/.test(out[j].t)) {
            if (/^(a|an)$/i.test(out[j].t)) {
              var an = /^[aeiou]/i.test(rep);
              out[j].t = (/^A/.test(out[j].t) ? 'A' : 'a') + (an ? 'n' : '');
            }
            break;
          }
        }
        out.push({ t: rep, swap: true, from: p });
      } else out.push({ t: p });
    }
    return out;
  }

  function plainVersion(sentences) {
    return sentences.map(function (s) {
      return { para: s.para, parts: splitLong(s.text).map(swapWords) };
    });
  }

  // ---------- State ----------
  var state = { sents: [], focus: 0, speaking: false, plainText: '' };
  var $ = function (id) { return document.getElementById(id); };

  // ---------- Storage (safe) ----------
  function load(key, fallback) {
    try { var v = window.localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage unavailable */ }
  }

  // ---------- Display settings ----------
  var DEFAULTS = { fontSize: 20, letter: 0.02, wordSp: 0.1, line: 1.7, font: 'sans', tint: 'cream', contrast: false, ruler: false };
  var settings = Object.assign({}, DEFAULTS, load('plainpath.settings', {}));

  function applySettings() {
    var r = document.documentElement.style;
    r.setProperty('--fs', settings.fontSize + 'px');
    r.setProperty('--ls', settings.letter + 'em');
    r.setProperty('--ws', settings.wordSp + 'em');
    r.setProperty('--lh', String(settings.line));
    document.body.setAttribute('data-tint', settings.tint);
    document.body.classList.toggle('contrast', !!settings.contrast);
    document.body.classList.toggle('ruler', !!settings.ruler);
    document.body.classList.remove('f-serif', 'f-mono');
    if (settings.font !== 'sans') document.body.classList.add('f-' + settings.font);
    $('fontSize').value = settings.fontSize; $('fontSizeOut').textContent = settings.fontSize + 'px';
    $('letter').value = settings.letter; $('letterOut').textContent = Number(settings.letter).toFixed(2) + 'em';
    $('wordSp').value = settings.wordSp; $('wordOut').textContent = Number(settings.wordSp).toFixed(2) + 'em';
    $('line').value = settings.line; $('lineOut').textContent = Number(settings.line).toFixed(1);
    $('font').value = settings.font; $('tint').value = settings.tint;
    $('contrast').checked = !!settings.contrast; $('ruler').checked = !!settings.ruler;
    save('plainpath.settings', settings);
  }

  function bindSettings() {
    ['fontSize', 'letter', 'wordSp', 'line'].forEach(function (id) {
      $(id).addEventListener('input', function (e) { settings[id] = parseFloat(e.target.value); applySettings(); });
    });
    ['font', 'tint'].forEach(function (id) {
      $(id).addEventListener('change', function (e) { settings[id] = e.target.value; applySettings(); });
    });
    ['contrast', 'ruler'].forEach(function (id) {
      $(id).addEventListener('change', function (e) { settings[id] = e.target.checked; applySettings(); });
    });
    $('resetSettings').addEventListener('click', function () { settings = Object.assign({}, DEFAULTS); applySettings(); announce('Display settings reset.'); });
    $('settingsToggle').addEventListener('click', function () {
      var open = $('settings').hidden;
      $('settings').hidden = !open;
      this.setAttribute('aria-expanded', String(open));
      if (open) $('fontSize').focus();
    });
  }

  function announce(msg) { var l = $('live'); l.textContent = ''; setTimeout(function () { l.textContent = msg; }, 30); }

  // ---------- Rendering ----------
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // Render one sentence's text into a node with word spans (for speech) and glossary buttons.
  function renderSentenceInto(node, s, si) {
    var re = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g, m, last = 0, text = s.text;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) node.appendChild(document.createTextNode(text.slice(last, m.index)));
      var w = m[0], start = m.index, end = re.lastIndex;
      // two-word glossary terms
      var key = null, span = w;
      var next = /^\s+([A-Za-z]+)/.exec(text.slice(end));
      if (next && GLOSS[(w + ' ' + next[1]).toLowerCase()]) {
        key = (w + ' ' + next[1]).toLowerCase(); span = w + next[0]; end = end + next[0].length; re.lastIndex = end;
      } else key = glossKey(w);
      var t;
      if (key) {
        t = el('button', 'gl w', span);
        t.type = 'button';
        t.setAttribute('data-key', key);
        t.setAttribute('aria-label', span + ', show meaning');
      } else t = el('span', 'w', span);
      t.setAttribute('data-c', start); t.setAttribute('data-e', end);
      node.appendChild(t);
      last = end;
    }
    if (last < text.length) node.appendChild(document.createTextNode(text.slice(last)));
  }

  function levelWord(l) { return l === 'hard' ? 'hardest' : l === 'mid' ? 'harder' : 'easier'; }

  function renderReader() {
    var box = $('reader'); box.innerHTML = '';
    var p = null, para = -1;
    state.sents.forEach(function (s, i) {
      if (s.para !== para) { p = el('p'); box.appendChild(p); para = s.para; }
      var span = el('span', 'sent ' + s.level);
      span.setAttribute('data-s', i);
      span.title = 'Grade ' + s.grade + ' (' + levelWord(s.level) + ')';
      renderSentenceInto(span, s, i);
      var sr = el('span', 'sr-only', ' (sentence ' + (i + 1) + ', grade ' + s.grade + ', ' + levelWord(s.level) + ') ');
      span.appendChild(sr);
      p.appendChild(span);
      p.appendChild(document.createTextNode(' '));
    });
  }

  function renderFocus() {
    var i = state.focus, s = state.sents[i];
    var box = $('focusSentence'); box.innerHTML = '';
    if (!s) return;
    var span = el('span', 'sent ' + s.level); span.setAttribute('data-s', i);
    renderSentenceInto(span, s, i);
    box.appendChild(span);
    $('focusMeta').textContent = 'Sentence ' + (i + 1) + ' of ' + state.sents.length + ' - grade ' + s.grade + ' (' + levelWord(s.level) + '), ' + s.words + ' words';
    var hint = $('focusHint'); hint.innerHTML = '';
    var parts = splitLong(s.text);
    if (parts.length > 1) {
      hint.appendChild(el('strong', null, 'In shorter pieces: '));
      parts.forEach(function (pt, k) { hint.appendChild(document.createTextNode((k ? ' / ' : '') + pt)); });
    } else if (s.gloss.length) {
      hint.appendChild(el('strong', null, 'Key words: '));
      hint.appendChild(document.createTextNode(s.gloss.map(function (k) { return GLOSS[k].word + (GLOSS[k].swap ? ' (' + GLOSS[k].swap + ')' : ''); }).join(', ')));
    }
    $('prev').disabled = i === 0;
    $('next').disabled = i === state.sents.length - 1;
  }

  function renderPlain(pv) {
    var box = $('plain'); box.innerHTML = '';
    var p = null, para = -1, flat = [];
    pv.forEach(function (s) {
      if (s.para !== para) { p = el('p'); box.appendChild(p); para = s.para; }
      s.parts.forEach(function (tokens) {
        var txt = '';
        tokens.forEach(function (tk) {
          txt += tk.t;
          if (tk.swap) { var mk = el('mark', 'swap', tk.t); mk.title = 'was: ' + tk.from; p.appendChild(mk); }
          else p.appendChild(document.createTextNode(tk.t));
        });
        p.appendChild(document.createTextNode(' '));
        flat.push(txt);
      });
    });
    state.plainText = flat.join(' ');
    return flat;
  }

  function renderHints() {
    var list = $('hints'); list.innerHTML = '';
    var order = state.sents.map(function (s, i) { return i; })
      .filter(function (i) { var s = state.sents[i]; return s.level !== 'easy' || s.words >= 20 || s.passive; })
      .sort(function (a, b) { return state.sents[b].grade - state.sents[a].grade; });
    if (!order.length) { list.appendChild(el('li', null, 'No hard sentences found. This passage is already fairly plain.')); return; }
    order.forEach(function (i) {
      var s = state.sents[i], li = el('li');
      var head = el('p', 'orig');
      head.appendChild(el('span', 'grade', 'Grade ' + s.grade));
      head.appendChild(document.createTextNode('Sentence ' + (i + 1) + ': "' + s.text + '"'));
      li.appendChild(head);
      var ul = el('ul');
      if (s.words >= 20) {
        var parts = splitLong(s.text);
        ul.appendChild(el('li', null, 'Long sentence (' + s.words + ' words). Aim for under 20.' + (parts.length > 1 ? ' Try: "' + parts.join(' ') + '"' : ' Try breaking it into two ideas.')));
      }
      if (s.passive) ul.appendChild(el('li', null, 'Passive voice: "' + s.passive + '". Try saying who does the action first.'));
      var swaps = s.gloss.filter(function (k) { return GLOSS[k].swap; });
      if (swaps.length) ul.appendChild(el('li', null, 'Plainer words: ' + swaps.map(function (k) { return GLOSS[k].word + ' → ' + GLOSS[k].swap; }).join('; ') + '.'));
      var terms = s.gloss.filter(function (k) { return !GLOSS[k].swap; });
      if (terms.length) ul.appendChild(el('li', null, 'Subject words to teach (keep them, but explain): ' + terms.map(function (k) { return GLOSS[k].word; }).join(', ') + '.'));
      if (s.longWords.length) ul.appendChild(el('li', null, 'Long words not in the glossary: ' + s.longWords.join(', ') + '.'));
      if (!ul.children.length) ul.appendChild(el('li', null, 'Many long words. Try shorter words where you can.'));
      li.appendChild(ul);
      list.appendChild(li);
    });
  }

  function stat(n, label, key) { var d = el('div', 'stat' + (key ? ' key' : '')); d.appendChild(el('b', null, String(n))); d.appendChild(el('span', null, label)); return d; }

  function analyze() {
    stopSpeech();
    var text = $('input').value.trim();
    if (!text) { announce('Please paste or choose a passage first.'); $('input').focus(); return; }
    var raw = splitSentences(text);
    state.sents = raw.map(analyzeSentence);
    state.focus = 0;
    var allWords = wordsOf(text);
    var grade = fkGrade(allWords, raw.length);
    var pv = plainVersion(raw);
    renderReader();
    var plainSents = renderPlain(pv);
    var plainGrade = fkGrade(wordsOf(state.plainText), plainSents.length);
    renderFocus();
    renderHints();
    var glossCount = {};
    state.sents.forEach(function (s) { s.gloss.forEach(function (k) { glossCount[k] = 1; }); });
    var sum = $('summary'); sum.innerHTML = '';
    sum.appendChild(stat(grade, 'reading grade (original)', true));
    sum.appendChild(stat(plainGrade, 'grade of plainer version', true));
    sum.appendChild(stat(state.sents.length + ' / ' + allWords.length, 'sentences / words'));
    sum.appendChild(stat(Math.round(allWords.length / raw.length), 'words per sentence'));
    sum.appendChild(stat(state.sents.filter(function (s) { return s.level === 'hard'; }).length, 'hardest sentences'));
    sum.appendChild(stat(Object.keys(glossCount).length, 'words with meanings'));
    $('results').hidden = false;
    save('plainpath.draft', text);
    announce('Done. Reading grade ' + grade + '. Plainer version grade ' + plainGrade + '. ' + state.sents.length + ' sentences.');
    $('resHead').setAttribute('tabindex', '-1');
    $('resHead').focus();
  }

  // ---------- Tabs ----------
  function selectTab(tab, focus) {
    var tabs = document.querySelectorAll('[role="tab"]');
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
    if (tab.id === 'tab-focus') renderFocus();
  }
  function bindTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { selectTab(t, false); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') n = tabs[0];
        else if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); selectTab(n, true); }
      });
    });
  }
  function activeView() {
    var t = document.querySelector('[role="tab"][aria-selected="true"]');
    return t ? t.id : 'tab-read';
  }

  // ---------- Focus reader ----------
  function move(d) {
    var n = state.focus + d;
    if (n < 0 || n >= state.sents.length) return;
    stopSpeech();
    state.focus = n; renderFocus(); markNow(n);
  }

  // ---------- Speech ----------
  var synth = window.speechSynthesis || null;
  var speakToken = 0;

  function markNow(i) {
    document.querySelectorAll('.sent.now').forEach(function (n) { n.classList.remove('now'); });
    document.querySelectorAll('.reader .sent[data-s="' + i + '"]').forEach(function (n) { n.classList.add('now'); });
    $('reader').classList.toggle('ruled', i >= 0);
  }
  function clearWord() { document.querySelectorAll('.w.speaking').forEach(function (n) { n.classList.remove('speaking'); }); }
  function markWord(si, ci) {
    clearWord();
    document.querySelectorAll('.sent[data-s="' + si + '"] .w').forEach(function (w) {
      if (+w.getAttribute('data-c') <= ci && ci < +w.getAttribute('data-e')) w.classList.add('speaking');
    });
  }

  function speakFrom(i, onlyOne) {
    if (!synth) return;
    var token = ++speakToken;
    synth.cancel();
    state.speaking = true;
    $('play').textContent = 'Pause'; $('stop').disabled = false;
    var go = function (k) {
      if (token !== speakToken) return;
      if (k >= state.sents.length || (onlyOne && k > i)) { stopSpeech(true); return; }
      state.focus = k;
      if (activeView() === 'tab-focus') renderFocus();
      markNow(k);
      var u = new SpeechSynthesisUtterance(state.sents[k].text);
      u.rate = parseFloat($('rate').value) || 0.9;
      u.lang = 'en-US';
      u.onboundary = function (e) { if (token === speakToken && e.name !== 'sentence') markWord(k, e.charIndex); };
      u.onend = function () { clearWord(); go(k + 1); };
      u.onerror = function () { clearWord(); if (token === speakToken) stopSpeech(true); };
      synth.speak(u);
    };
    go(i);
  }

  function stopSpeech(keepFocus) {
    speakToken++;
    if (synth) { try { synth.cancel(); } catch (e) { /* ignore */ } }
    state.speaking = false;
    clearWord();
    $('play').textContent = 'Read aloud'; $('stop').disabled = true;
    if (!keepFocus) markNow(-1);
  }

  function bindSpeech() {
    $('rate').addEventListener('input', function (e) { $('rateOut').textContent = Number(e.target.value).toFixed(1) + 'x'; save('plainpath.rate', e.target.value); });
    var r = load('plainpath.rate', null); if (r) { $('rate').value = r; $('rateOut').textContent = Number(r).toFixed(1) + 'x'; }
    if (!synth) {
      $('play').disabled = true; $('sayOne').disabled = true; $('popSay').hidden = true;
      $('speechNote').textContent = 'Read aloud is not available in this browser.';
      return;
    }
    $('play').addEventListener('click', function () {
      if (state.speaking && synth.speaking && !synth.paused) { synth.pause(); $('play').textContent = 'Resume'; return; }
      if (synth.paused) { synth.resume(); $('play').textContent = 'Pause'; return; }
      speakFrom(activeView() === 'tab-focus' ? state.focus : 0, false);
    });
    $('stop').addEventListener('click', function () { stopSpeech(); });
    $('sayOne').addEventListener('click', function () { speakFrom(state.focus, true); });
  }

  // ---------- Glossary popover ----------
  var popTrigger = null;
  function openPop(btn) {
    var key = btn.getAttribute('data-key'), e = GLOSS[key];
    if (!e) return;
    popTrigger = btn;
    $('popWord').textContent = e.word + (e.swap ? '  (plain word: ' + e.swap + ')' : '');
    $('popDef').textContent = e.def;
    var pop = $('pop');
    pop.hidden = false;
    var r = btn.getBoundingClientRect();
    var left = Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 16);
    pop.style.left = Math.max(16, left) + 'px';
    pop.style.top = (r.bottom + window.scrollY + 8) + 'px';
    $('popClose').focus();
  }
  function closePop() {
    if ($('pop').hidden) return;
    $('pop').hidden = true;
    if (popTrigger && document.body.contains(popTrigger)) popTrigger.focus();
    popTrigger = null;
  }

  // ---------- Init ----------
  function init() {
    applySettings();
    bindSettings();
    bindTabs();
    bindSpeech();
    $('sample').addEventListener('change', function (e) {
      if (SAMPLES[e.target.value]) { $('input').value = SAMPLES[e.target.value]; updateCount(); analyze(); }
    });
    var updateCount = function () { var n = wordsOf($('input').value).length; $('charCount').textContent = n ? n + ' words' : ''; };
    $('input').addEventListener('input', updateCount);
    $('analyze').addEventListener('click', analyze);
    $('clear').addEventListener('click', function () { stopSpeech(); $('input').value = ''; $('results').hidden = true; $('sample').value = ''; updateCount(); save('plainpath.draft', ''); $('input').focus(); });
    $('prev').addEventListener('click', function () { move(-1); });
    $('next').addEventListener('click', function () { move(1); });
    document.addEventListener('click', function (e) {
      var g = e.target.closest ? e.target.closest('.gl') : null;
      if (g) { e.preventDefault(); openPop(g); return; }
      if (!$('pop').hidden && !$('pop').contains(e.target)) closePop();
    });
    $('popClose').addEventListener('click', closePop);
    $('popSay').addEventListener('click', function () {
      if (!synth || !popTrigger) return;
      var e = GLOSS[popTrigger.getAttribute('data-key')];
      stopSpeech(true);
      var u = new SpeechSynthesisUtterance(e.word + '. ' + e.def);
      u.rate = parseFloat($('rate').value) || 0.9; u.lang = 'en-US';
      synth.speak(u);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (!$('pop').hidden) { closePop(); return; } if (state.speaking) stopSpeech(); return; }
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.getAttribute('role') === 'tab') return;
      if (activeView() === 'tab-focus' && !$('results').hidden) {
        if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
      }
    });
    var draft = load('plainpath.draft', '');
    if (draft) { $('input').value = draft; updateCount(); }
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache is optional */ });
    }
  }

  // expose pure functions for tests
  window.PlainPath = { syllables: syllables, fkGrade: fkGrade, splitSentences: splitSentences, splitLong: splitLong, glossKey: glossKey, swapWords: swapWords };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
