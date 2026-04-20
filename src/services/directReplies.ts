const MARLON_EMAIL = "marlonbbernal@gmail.com";
const MARLON_LOCATION = "Morong, Rizal, Philippines";
const IDENTITY_REPLY = "My name is Marlon B. Bernal.";
const SCOPE_REPLY =
  "I can answer job-interview questions about my work, skills, projects, and professional background. Is there something specific about my experience I can help with?";

function normalize(message: string): string {
  return message
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^\w\s'?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function isAssistantIdentityQuestion(text: string): boolean {
  return matchesAny(text, [
    /^(hi|hello|hey)?\s*(what('?s| is) your name|who are you|what are you|introduce yourself|what should i call you)\??$/,
    /\b(what('?s| is)|tell me|may i know|can i know|could i know)\s+(your\s+)?name\b/,
    /\bwho\s+(am i|are we)\s+(talking|speaking|chatting)\s+to\b/,
    /\byour\s+name\b/,
    /\b(are you|r u)\s+(an?\s+)?(ai|assistant|chatbot|bot)\b/,
  ]);
}

function isModelIdentityQuestion(text: string): boolean {
  return matchesAny(text, [
    /\b(what|which)\s+(ai\s+)?model\b/,
    /\b(are you|r u)\s+(chatgpt|gemini|gemma|google|openai|claude)\b/,
    /\b(trained by|made by|created by|built by)\s+(google|openai|anthropic)\b/,
    /\blarge language model\b/,
  ]);
}

function isMarlonNameQuestion(text: string): boolean {
  return matchesAny(text, [
    /\bwhat('?s| is)\s+marlon('?s)?\s+(full\s+)?name\b/,
    /\bwho\s+is\s+marlon\b/,
  ]);
}

function isLocationQuestion(text: string): boolean {
  return matchesAny(text, [
    /\bwhat('?s| is)\s+(your|his|marlon'?s)\s+(address|location)\b/,
    /\bwhere\s+(are you|is he|is marlon)\s+(located|based|from|living|live)\b/,
    /\bwhere\s+does\s+(marlon|he)\s+(live|work from)\b/,
  ]);
}

function isContactQuestion(text: string): boolean {
  return matchesAny(text, [
    /\b(contact|reach|email|message)\s+(marlon|him|you)\b/,
    /\bwhat('?s| is)\s+(your|his|marlon'?s)\s+email\b/,
    /\bhow\s+(can|do)\s+i\s+(contact|reach|email|message)\b/,
  ]);
}

function isPhoneQuestion(text: string): boolean {
  return matchesAny(text, [
    /\bwhat('?s| is)\s+(your|his|marlon'?s)\s+(phone|mobile|number|contact number)\b/,
    /\b(phone|mobile|contact number)\s+(of\s+)?(marlon|him|you)\b/,
  ]);
}

function isAvailabilityQuestion(text: string): boolean {
  return matchesAny(text, [
    /\b(is|are)\s+(marlon|he|you)\s+available\b/,
    /\bavailability\b/,
    /\bcan\s+(we|i)\s+(hire|interview|book)\b/,
  ]);
}

function isSalaryOrRateQuestion(text: string): boolean {
  return matchesAny(text, [
    /\b(salary|rate|hourly|monthly|expected pay|compensation)\b/,
    /\bhow much\s+(do you|does he|does marlon)\s+(charge|cost|expect)\b/,
  ]);
}

function isPrivatePersonalQuestion(text: string): boolean {
  return matchesAny(text, [
    /\bhow\s+old\s+(are you|is he|is marlon)\b/,
    /\bwhat('?s| is)\s+(your|his|marlon'?s)\s+age\b/,
    /\bwhen\s+(were you|was he|was marlon)\s+born\b/,
    /\b(age|birthday|birth date|date of birth|married|single|wife|girlfriend|family|children|religion|politics)\b/,
    /\b(citizenship|work authorization|visa|relocation)\b/,
    /\b(home address|exact address|street address|house address)\b/,
  ]);
}

function isPromptInjection(text: string): boolean {
  return matchesAny(text, [
    /\bignore\s+(previous|above|all|the)\s+(instructions|rules|prompt)\b/,
    /\breveal\s+(your\s+)?(system\s+)?prompt\b/,
    /\bshow\s+(your\s+)?(system\s+)?prompt\b/,
    /\bdeveloper\s+message\b/,
    /\bhidden\s+(instructions|rules|prompt)\b/,
  ]);
}

function isAssistantInfrastructureQuestion(text: string): boolean {
  return matchesAny(text, [
    /\b(current|this|your|assistant|chatbot|bot|portfolio ai)\s+(server|backend|api|endpoint|infrastructure|infra|hosting|host|deployment|runtime|environment|repo|repository|codebase|source code)\b/,
    /\b(server|backend|api|endpoint|infrastructure|infra|hosting|host|deployment|runtime|environment|repo|repository|source code)\s+(of|for|behind|powering|running)\s+(this|your|the)\s+(assistant|chatbot|bot|site|website|portfolio)\b/,
    /\b(where|how|what)\s+(is|are|do|does)\s+(this|your|the)\s+(assistant|chatbot|bot|site|website|portfolio)\s+(hosted|deployed|running|work|built|configured)\b/,
    /\b(what|which|where|how)\s+(server|backend|api|endpoint|infrastructure|infra|hosting|host|deployment|runtime|environment)\s+(are you|do you|does this|is this|is used|powers this|runs this|are you running on)\b/,
    /\b(what|which)\s+(api\s+)?endpoint\s+(powers|runs|serves|does|is used by)\s+(this|your|the)\s+(assistant|chatbot|bot|site|website|portfolio)\b/,
    /\b(what|which)\s+(model|llm|ollama model|gemma model)\s+(are you|is this|powers this|runs this|running)\b/,
    /\b(show|tell me|give me|list|print)\s+(your|the|this)?\s*(env vars|env variables|environment variables|config|configuration|secrets|credentials|api keys?)\b/,
    /\b(ollama|vercel|cloudflare tunnel|ngrok|api key|x api key|x-api-key|shared secret|env var|environment variable|system prompt|prompt file|profile context file)\b/,
  ]);
}

function isGeneralCodingRequest(text: string): boolean {
  return matchesAny(text, [
    /\b(help me|can you|please)\s+(debug|fix|write|build|code|implement)\b/,
    /\bwrite\s+(a|an|some)?\s*(code|script|function|app)\b/,
    /\bdebug\s+(this|my)\s+(code|error|bug)\b/,
  ]);
}

function isCommonOffTopicQuestion(text: string): boolean {
  return matchesAny(text, [
    /\b(tell me a joke|sing|poem|story)\b/,
    /\b(weather|news|president|capital of|recipe|movie|song|sports score)\b/,
    /\b(homework|assignment|math problem)\b/,
  ]);
}

function hasForbiddenModelSelfDescription(reply: string): boolean {
  const text = normalize(reply);

  return matchesAny(text, [
    /\bi\s+(am|'m)\s+(an?\s+)?(ai assistant|chatbot|bot|large language model|language model)\b/,
    /\bi'?m\s+(an?\s+)?(ai assistant|chatbot|bot|large language model|language model)\b/,
    /\bas\s+(an?\s+)?(ai assistant|ai model|large language model|language model)\b/,
    /\btrained by\s+(google|openai|anthropic)\b/,
    /\bbuilt by\s+(google|openai|anthropic)\b/,
    /\bmade by\s+(google|openai|anthropic)\b/,
    /\bcreated by\s+(google|openai|anthropic)\b/,
    /\bi\s+(do not|don't)\s+have\s+a\s+personal\s+name\b/,
    /\bi\s+(do not|don't)\s+have\s+personal\s+(experiences|opinions|feelings)\b/,
    /\b(my\s+)?name\s+is\s+not\s+(specified|provided|listed|available)\b/,
    /\bi\s+(can|could)\s+answer\s+questions\s+about\s+my\s+(capabilities|knowledge\s+base)\b/,
    /\b(capabilities\s+and\s+knowledge\s+base|provided\s+information\s+about\s+marlon)\b/,
    /\bknowledge\s+base\b/,
    /\bmy\s+name\s+is\s+a\s+persona\b/,
    /\bmy\s+name\s+is\s+based\s+on\b/,
    /\bmy\s+name\s+is\s+(the\s+)?profile'?s\s+persona\b/,
    /\bprofile'?s\s+persona\b/,
    /\bprofile\s+persona\b/,
    /\bpersona\s+based\s+on\s+(the\s+)?professional\s+experience\b/,
    /\bprofessional\s+experience\s+and\s+capabilities\s+described\b/,
    /\bprofessional\s+experience\s+and\s+capabilities\b/,
    /\banswer\s+(your\s+)?questions\s+about\s+my\s+professional\s+experience\s+and\s+capabilities\b/,
    /\btechnical\s+skills\s+and\s+work\s+history\b/,
    /\bfocus\s+on\s+answering\s+questions\s+about\s+my\s+technical\s+skills\b/,
  ]);
}

export function getDirectReply(message: string): string | undefined {
  const text = normalize(message);
  if (!text) return undefined;

  if (isPromptInjection(text)) {
    return SCOPE_REPLY;
  }

  if (isAssistantInfrastructureQuestion(text)) {
    return "I can't discuss the internal setup of this portfolio feature, including its server, model backend, deployment, credentials, prompt files, or infrastructure. I can answer questions about my work, skills, projects, and professional background.";
  }

  if (isAssistantIdentityQuestion(text) || isModelIdentityQuestion(text)) {
    return IDENTITY_REPLY;
  }

  if (isMarlonNameQuestion(text)) {
    return IDENTITY_REPLY;
  }

  if (isLocationQuestion(text)) {
    return `I'm based in ${MARLON_LOCATION}.`;
  }

  if (isPhoneQuestion(text)) {
    return `The best way to contact me is by email at ${MARLON_EMAIL}.`;
  }

  if (isContactQuestion(text)) {
    return `You can contact me at ${MARLON_EMAIL}.`;
  }

  if (isAvailabilityQuestion(text)) {
    return `I've worked as an independent software engineer and contract developer since January 2021. For current availability or interview scheduling, contact me at ${MARLON_EMAIL}.`;
  }

  if (isSalaryOrRateQuestion(text)) {
    return `I don't have my salary or rate details listed here. You can ask me directly at ${MARLON_EMAIL}.`;
  }

  if (isPrivatePersonalQuestion(text)) {
    return `I don't share that personal detail here. For professional questions, you can contact me at ${MARLON_EMAIL}.`;
  }

  if (isGeneralCodingRequest(text)) {
    return "I can answer job-interview questions about my technical background. If you're evaluating my debugging or coding experience, I have experience with Laravel/PHP, React, React Native, Vue.js, Node.js, MySQL, Firebase, debugging, performance tuning, and production support.";
  }

  if (isCommonOffTopicQuestion(text)) {
    return SCOPE_REPLY;
  }

  return undefined;
}

export function sanitizeReply(message: string, reply: string): string {
  const normalizedMessage = normalize(message);
  const normalizedReply = normalize(reply);
  const isIdentityQuestion =
    isAssistantIdentityQuestion(normalizedMessage) ||
    isModelIdentityQuestion(normalizedMessage) ||
    isMarlonNameQuestion(normalizedMessage);

  if (isIdentityQuestion && !normalizedReply.includes("marlon b bernal")) {
    return IDENTITY_REPLY;
  }

  if (!hasForbiddenModelSelfDescription(reply)) {
    return reply;
  }

  return (
    getDirectReply(message) ??
    IDENTITY_REPLY
  );
}
