// Interview memory and answer formatting. Pure functions so they run in the panel and in node.
(function (root) {
  const TYPES = {
    general: 'General',
    behavioral: 'Behavioral (answer with short STAR stories)',
    technical: 'Technical and coding',
    'system-design': 'System design',
    hr: 'HR and culture fit'
  };

  const MODES = {
    shorter: 'Rewrite it much shorter: only "Say first" and three bullets. Keep the same headings.',
    detail: 'Expand it with more depth, trade-offs, and specifics. Keep the same headings.',
    example: 'Add one concrete example under "### Example". Use the resume when it has a fit, in STAR form for behavioral questions. Keep the rest brief.',
    code: 'Add complete, runnable code under "### Code" with a two-line walkthrough under it.',
    regen: 'Answer again, differently and better. Keep the same headings.'
  };

  function clip(text, max) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max)}…` : clean;
  }

  function systemPrompt(profile) {
    const p = profile || {};
    const lines = [
      'You are Helply, a real-time interview copilot. The candidate glances at your answer and says it out loud while the interviewer waits, so it must be instantly scannable.',
      '',
      'Interview:'
    ];
    if (p.role) lines.push(`- Role: ${clip(p.role, 120)}`);
    if (p.company) lines.push(`- Company: ${clip(p.company, 120)}`);
    lines.push(`- Type: ${TYPES[p.type] || TYPES.general}`);
    if (p.resume) lines.push('', `Candidate resume:\n${clip(p.resume, 3500)}`);
    if (p.jd) lines.push('', `Job description:\n${clip(p.jd, 3000)}`);
    lines.push(
      '',
      'Rules:',
      '- Speak as the candidate, first person, natural spoken English. No preamble such as "Sure" or "Great question".',
      '- Use the transcript. Resolve follow-ups like "why", "that", or "tell me more" against earlier questions and what the candidate already said. Build on it and do not repeat it.',
      '- Use real details from the resume. Never invent employers, titles, or numbers the resume does not support.',
      '',
      'Format exactly, in this order:',
      '### Say first',
      'One or two sentences the candidate can say immediately.',
      '### Key points',
      '- Three to five short bullets, each starting with a **bold keyword**.',
      'Add these only when they help:',
      '### Code — fenced code with a language tag, for coding questions.',
      '### Example — a short STAR story (Situation, Task, Action, Result) for behavioral questions.',
      '### If they ask more — one or two likely follow-ups, each with a one-line answer.',
      '',
      p.style === 'detailed'
        ? 'Length: detailed, but every bullet stays one line.'
        : 'Length: concise. The whole answer should be readable in about 20 seconds.'
    );
    return lines.join('\n');
  }

  function sayFirst(answer) {
    const match = String(answer || '').match(/###\s*Say first\s*\n([\s\S]*?)(?=\n###|$)/i);
    return (match ? match[1] : String(answer || '')).trim();
  }

  function transcriptText(turns, maxChars) {
    const limit = maxChars || 6000;
    const out = [];
    let used = 0;
    for (let i = (turns || []).length - 1; i >= 0; i--) {
      const turn = turns[i];
      const line = `${turn.who === 'you' ? 'Candidate' : 'Interviewer'}: ${clip(turn.text, 600)}`;
      if (used + line.length > limit) break;
      out.unshift(line);
      used += line.length + 1;
    }
    return out.join('\n');
  }

  function buildRequest(session, options) {
    const opts = options || {};
    const mode = opts.mode || 'answer';
    const question = String(opts.question || '').trim();
    const profile = (session && session.profile) || {};
    const covered = ((session && session.qa) || [])
      .filter((item) => item.answer && item.id !== opts.id)
      .slice(-8);

    const parts = [];
    if (covered.length) {
      parts.push(
        'Already covered in this interview (build on these, do not repeat them):\n' +
        covered.map((item, i) => `${i + 1}. Q: ${clip(item.q, 200)}\n   A: ${clip(sayFirst(item.answer), 220)}`).join('\n')
      );
    }
    const transcript = transcriptText(session && session.turns);
    if (transcript) parts.push(`Live transcript, most recent last:\n${transcript}`);

    if (mode === 'answer') {
      parts.push(`Latest from the interviewer:\n"${question}"`);
      parts.push(opts.allowSkip
        ? 'Answer it now as the candidate. If it is only small talk, logistics, or not something the candidate needs to answer, reply with exactly SKIP.'
        : 'Answer it now as the candidate.');
    } else {
      parts.push(`Question: "${question}"\n\nYour previous answer:\n${String(opts.previous || '').trim()}`);
      parts.push(MODES[mode] || MODES.regen);
    }

    return {
      system: systemPrompt(profile),
      messages: [{ role: 'user', content: parts.join('\n\n') }],
      maxTokens: profile.style === 'detailed' ? 1400 : 800
    };
  }

  function esc(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function inline(escaped) {
    return escaped
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function slug(title) {
    return title.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '') || 'section';
  }

  function codeBlock(lang, code) {
    return `<div class="code"><div class="code-head"><span>${esc(lang || 'code')}</span>` +
      `<button class="copy-code" type="button">Copy</button></div><pre><code>${esc(code)}</code></pre></div>`;
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown || '').replace(/\r/g, '').split('\n');
    let html = '';
    let inCode = false;
    let code = [];
    let lang = '';
    let list = false;
    let section = false;

    const closeList = () => {
      if (list) html += '</ul>';
      list = false;
    };
    const closeSection = () => {
      closeList();
      if (section) html += '</section>';
      section = false;
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (inCode) {
        if (trimmed.startsWith('```')) {
          html += codeBlock(lang, code.join('\n'));
          inCode = false;
          code = [];
        } else {
          code.push(line);
        }
        continue;
      }
      const fence = trimmed.match(/^```(\S*)/);
      if (fence) {
        closeList();
        inCode = true;
        lang = fence[1] || '';
        continue;
      }
      const heading = trimmed.match(/^#{1,4}\s+(.*)$/);
      if (heading) {
        closeSection();
        const title = heading[1].replace(/[—-].*$/, '').trim() || heading[1].trim();
        html += `<section class="sec sec-${slug(title)}"><h3>${inline(esc(title))}</h3>`;
        section = true;
        continue;
      }
      const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (item) {
        if (!list) html += '<ul>';
        list = true;
        html += `<li>${inline(esc(item[1]))}</li>`;
        continue;
      }
      if (!trimmed) {
        closeList();
        continue;
      }
      closeList();
      html += `<p>${inline(esc(trimmed))}</p>`;
    }
    if (inCode) html += codeBlock(lang, code.join('\n'));
    closeSection();
    return html;
  }

  const api = { TYPES, systemPrompt, sayFirst, transcriptText, buildRequest, renderMarkdown, clip };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HelplyContext = api;

  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    const assert = require('assert');
    const html = renderMarkdown('### Say first\nI use <closures>.\n### Key points\n- **Scope** keeps vars\n```js\nconst a = 1;\n```');
    assert(html.includes('sec-say-first') && html.includes('sec-key-points'), 'sections');
    assert(html.includes('&lt;closures&gt;') && !html.includes('<closures>'), 'escapes html');
    assert(html.includes('<strong>Scope</strong>') && html.includes('const a = 1;'), 'inline and code');

    const turns = Array.from({ length: 50 }, (_, i) => ({ who: i % 2 ? 'you' : 'interviewer', text: `line ${i} ${'x'.repeat(200)}` }));
    const text = transcriptText(turns, 1000);
    assert(text.length <= 1100 && text.includes('line 49') && !text.includes('line 0 '), 'keeps most recent turns');

    const session = {
      profile: { role: 'Frontend Engineer', type: 'technical', resume: 'Built React apps at Acme' },
      turns: [{ who: 'interviewer', text: 'What is a closure?' }, { who: 'you', text: 'It captures scope.' }],
      qa: [{ id: 'a', q: 'What is a closure?', answer: '### Say first\nA function that remembers its scope.' }]
    };
    const req = buildRequest(session, { question: 'Can you give an example of that?', allowSkip: true });
    const body = req.messages[0].content;
    assert(body.includes('What is a closure?') && body.includes('remembers its scope'), 'carries earlier Q&A');
    assert(body.includes('Candidate: It captures scope.') && body.includes('SKIP'), 'carries transcript and skip rule');
    assert(req.system.includes('Frontend Engineer') && req.system.includes('Acme'), 'profile in system prompt');
    console.log('context ok');
  }
})(typeof window !== 'undefined' ? window : globalThis);
