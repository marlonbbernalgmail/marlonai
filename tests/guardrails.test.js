const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classifyQuestion,
  getDirectReply,
  hasForbiddenGeneratedContent,
  sanitizeReply,
} = require("../dist/services/directReplies");

const privateHistory = [
  { role: "user", content: "how old are you?" },
  {
    role: "assistant",
    content:
      "I keep private personal details out of this chat. If that detail is required for a formal hiring process, you can contact me directly at marlonbbernal@gmail.com.",
  },
];

const forbiddenPersonaPattern = /\bAI\b|assistant|language model/i;

test("name questions use the canonical Marlon identity reply", () => {
  assert.equal(getDirectReply("what is your name?"), "My name is Marlon B. Bernal.");
});

test("professional questions are sent to the model layer", () => {
  const classification = classifyQuestion("Can you tell me about your Laravel experience?");

  assert.equal(classification.action, "model");
  assert.equal(classification.category, "professional_or_unknown");
});

test("location and address questions expose only the public location", () => {
  assert.equal(
    getDirectReply("what is your exact home address?"),
    "I'm based in Morong, Rizal, Philippines."
  );
});

test("private personal questions use the private-detail reply", () => {
  const reply = getDirectReply("how old are you?");

  assert.match(reply, /I keep private personal details out of this chat/);
  assert.doesNotMatch(reply, forbiddenPersonaPattern);
});

test("private-detail follow-ups preserve first-person refusal", () => {
  const reply = getDirectReply("why not, its part of job hiring process?", privateHistory);

  assert.match(reply, /I keep private personal details out of this chat/);
  assert.doesNotMatch(reply, /\bAI\b|assistant|language model|HR representative/i);
});

test("implementation questions are answered by policy, not model identity", () => {
  const reply = getDirectReply("what model and server are you running on?");

  assert.match(reply, /I can't discuss the internal setup/);
  assert.doesNotMatch(reply, /I am an AI|trained by Google|language model/i);
});

test("common off-topic questions are redirected to interview topics", () => {
  const reply = getDirectReply("tell me a joke");

  assert.match(reply, /job-interview questions/);
});

test("current employment questions use Marlon's independent work status", () => {
  const reply = getDirectReply("are you currently employed?");

  assert.match(reply, /I currently work independently/);
  assert.match(reply, /since January 2021/);
  assert.doesNotMatch(reply, /I am an AI|traditional employment status|always ready to assist/i);
});

test("forbidden generated model descriptions are detected", () => {
  assert.equal(
    hasForbiddenGeneratedContent(
      "I am an AI language model, and I don't participate in job hiring processes myself."
    ),
    true
  );
});

test("sanitizer replaces model-style private follow-up answers", () => {
  const badReply =
    "I understand why you might be asking that, but I am an AI language model, and I don't participate in job hiring processes myself.";

  const sanitized = sanitizeReply(
    "why not, its part of job hiring process?",
    badReply,
    privateHistory
  );

  assert.match(sanitized, /I keep private personal details out of this chat/);
  assert.doesNotMatch(sanitized, /\bAI\b|assistant|language model|HR representative/i);
});

test("sanitizer never leaves hidden-source wording in the final answer", () => {
  const sanitized = sanitizeReply(
    "does Marlon have AWS experience?",
    "Based on the provided context, Marlon has AWS listed in his tools.",
    []
  );

  assert.equal(
    sanitized,
    "I can answer job-interview questions about my work, skills, projects, and professional background. Is there something specific about my experience I can help with?"
  );
});
