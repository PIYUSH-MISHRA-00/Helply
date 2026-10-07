// Interview memory and prompt building. Pure functions so it runs under plain node too.

const RESUME_LIMIT = 12000;
const JD_LIMIT = 8000;
const TURN_LIMIT = 400;
const RECENT_TURNS_CHARS = 3500;
const PRIOR_QA_PAIRS = 4;
const PRIOR_ANSWER_CHARS = 1200;
const QUESTION_LIST = 15;

const TYPES = [
  ['coding', /\b(write|implement|code|function|algorithm|complexity|big ?o|array|string|linked list|tree|graph|recursion|sql query|leetcode|reverse|sort|binary search)\b/i],
  ['system design', /\b(design|architecture|scale|scalab|distributed|microservice|load balanc|cach|database schema|throughput|latency|high availability)\b/i],
  ['behavioral', /\b(tell me about a time|describe a (time|situation)|conflict|challenge|mistake|failure|disagree|proud|leadership|team ?mate|handled|example of when)\b/i],
  ['hr', /\b(salary|notice period|relocat|why (do you want|this company|should we hire)|strength|weakness|where do you see yourself|expectation|joining)\b/i],
  ['introduction', /\b(tell me about yourself|introduce yourself|walk me through your (resume|background)|about you)\b/i],
  ['technical', /\b(what is|explain|difference between|how does|why (is|do|does)|when would you|react|node|java|python|javascript|typescript|aws|docker|kubernetes|api|rest|oop|thread|process)\b/i]
];

function classify(question) {
  const text = String(question || '');
  const hit = TYPES.find(([, pattern]) => pattern.test(text));
  return hit ? hit[0] : 'general';
}

function clip(text, limit) {
  const clean = String(text || '').trim();
  return clean.length > limit ? `${clean.slice(0, limit)}\n[…trimmed]` : clean;
}

function createSession() {
  return { resume: '', jobDescription: '', turns: [], qa: [] };
}

function setContext(session, context) {
  session.resume = String((context && context.resume) || '').trim();
  session.jobDescription = String((context && context.jobDescription) || '').trim();
}

function addTurn(session, who, text) {
  const clean = String(text || '').trim();
  if (!clean) return;
  session.turns.push({ who, text: clean, t: Date.now() });
  if (session.turns.length > TURN_LIMIT) session.turns.splice(0, session.turns.length - TURN_LIMIT);
}

function recentConversation(session) {
  const lines = [];
  let size = 0;
  for (let i = session.turns.length - 1; i >= 0; i--) {
    const turn = session.turns[i];
    const line = `${turn.who === 'mic' ? 'Candidate' : 'Interviewer'}: ${turn.text}`;
    if (size + line.length > RECENT_TURNS_CHARS) break;
    lines.unshift(line);
    size += line.length;
  }
  return lines.join('\n');
}

function systemPrompt(session) {
  const parts = [
    'You are Helply, a live interview copilot. The candidate reads your answer aloud while the interviewer waits, so it must sound like the candidate speaking in first person, natural and confident.',
    '',
    'Format every answer in Markdown exactly like this, and skip sections that do not fit the question:',
    '## Say this first',
    'One or two sentences that answer the question directly.',
    '## Key points',
    '- 3 to 5 short bullets, each starting with a **bold keyword**.',
    '## Code',
    'Only for coding questions: complete, runnable code in a fenced block, then one line on time and space complexity.',
    '## Example',
    'Only for behavioral or experience questions: a short STAR story (Situation, Task, Action, Result).',
    '',
    'Rules: no preamble such as "Sure" or "Great question". Keep it short enough to say in about a minute unless code is needed. Never mention that you are an AI.'
  ];

  if (session.resume || session.jobDescription) {
    parts.push('', 'Ground every answer in the material below. Use real projects, skills, numbers, and employers from the resume, and connect them to what the job description asks for. Do not invent experience the resume does not support; if it has nothing relevant, give a strong general answer and bridge to the closest real experience.');
    if (session.resume) parts.push('', '<resume>', clip(session.resume, RESUME_LIMIT), '</resume>');
    if (session.jobDescription) parts.push('', '<job_description>', clip(session.jobDescription, JD_LIMIT), '</job_description>');
  } else {
    parts.push('', 'No resume or job description was provided. Answer as a strong, well-rounded candidate for a typical role, with general but concrete examples. Do not invent specific employer names or exact figures.');
  }

  if (session.qa.length) {
    const counts = {};
    session.qa.forEach((item) => { counts[item.type] = (counts[item.type] || 0) + 1; });
    const mix = Object.entries(counts).map(([type, n]) => `${type} ×${n}`).join(', ');
    const list = session.qa.slice(-QUESTION_LIST).map((item, i) => `${i + 1}. [${item.type}] ${item.q}`).join('\n');
    parts.push('', `Interview so far (${session.qa.length} questions: ${mix}). Stay consistent with earlier answers, build on them, and do not repeat the same stories:`, list);
  }

  return parts.join('\n');
}

function buildRequest(session, question) {
  const type = classify(question);
  const messages = [];
  for (const item of session.qa.slice(-PRIOR_QA_PAIRS)) {
    if (!item.a) continue;
    messages.push({ role: 'user', content: item.q });
    messages.push({ role: 'assistant', content: clip(item.a, PRIOR_ANSWER_CHARS) });
  }
  const recent = recentConversation(session);
  const content = [
    recent ? `Recent conversation (for follow-ups such as "why?" or "give an example of that"):\n${recent}\n` : '',
    `Question type: ${type}`,
    `Current question: ${question}`
  ].filter(Boolean).join('\n');
  messages.push({ role: 'user', content });

  return {
    type,
    system: systemPrompt(session),
    messages,
    maxTokens: type === 'coding' || type === 'system design' ? 2200 : 1400
  };
}

function recordAnswer(session, question, type, answer) {
  session.qa.push({ q: String(question).trim(), type, a: String(answer || '').trim(), t: Date.now() });
}

module.exports = { classify, createSession, setContext, addTurn, buildRequest, recordAnswer, systemPrompt };

if (require.main === module) {
  const assert = require('assert');
  assert.strictEqual(classify('Tell me about a time you had a conflict'), 'behavioral');
  assert.strictEqual(classify('Write a function to reverse a linked list'), 'coding');
  assert.strictEqual(classify('How would you design a URL shortener at scale?'), 'system design');
  assert.strictEqual(classify('Tell me about yourself'), 'introduction');

  const s = createSession();
  assert.ok(systemPrompt(s).includes('No resume or job description'));
  const longResume = `Senior engineer at Acme. ${'React and Node. '.repeat(2000)}`;
  setContext(s, { resume: longResume, jobDescription: 'We need TypeScript and AWS.' });
  const sys = systemPrompt(s);
  assert.ok(sys.includes('<resume>') && sys.includes('Senior engineer at Acme') && sys.includes('TypeScript and AWS'));
  assert.ok(sys.length < RESUME_LIMIT + JD_LIMIT + 4000);

  addTurn(s, 'speaker', 'Tell me about yourself');
  addTurn(s, 'mic', 'I am a backend engineer');
  const first = buildRequest(s, 'Tell me about yourself');
  recordAnswer(s, 'Tell me about yourself', first.type, 'I build backends.');
  const second = buildRequest(s, 'Why?');
  assert.ok(second.system.includes('[introduction] Tell me about yourself'));
  assert.strictEqual(second.messages[0].content, 'Tell me about yourself');
  assert.ok(second.messages.at(-1).content.includes('Candidate: I am a backend engineer'));
  console.log('interview ok');
}
