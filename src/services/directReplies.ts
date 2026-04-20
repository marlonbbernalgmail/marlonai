const MARLON_EMAIL = "marlonbbernal@gmail.com";
const MARLON_LOCATION = "Morong, Rizal, Philippines";
const SCOPE_REPLY =
  "I'm here to answer job-interview questions about Marlon's work, skills, projects, and professional background. Is there something specific about his experience I can help with?";

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

export function getDirectReply(message: string): string | undefined {
  const text = normalize(message);
  if (!text) return undefined;

  if (isPromptInjection(text)) {
    return SCOPE_REPLY;
  }

  if (isAssistantIdentityQuestion(text) || isModelIdentityQuestion(text)) {
    return "I'm Marlon Bernal's portfolio interview assistant. I help answer job-interview questions about Marlon's work, skills, projects, and professional background.";
  }

  if (isMarlonNameQuestion(text)) {
    return "His full name is Marlon B. Bernal.";
  }

  if (isLocationQuestion(text)) {
    return `Marlon is based in ${MARLON_LOCATION}.`;
  }

  if (isPhoneQuestion(text)) {
    return `For contact, the best option is Marlon's email: ${MARLON_EMAIL}.`;
  }

  if (isContactQuestion(text)) {
    return `You can contact Marlon at ${MARLON_EMAIL}.`;
  }

  if (isAvailabilityQuestion(text)) {
    return `Marlon has worked as an independent software engineer and contract developer since January 2021. For current availability or interview scheduling, contact him at ${MARLON_EMAIL}.`;
  }

  if (isSalaryOrRateQuestion(text)) {
    return `I don't have Marlon's salary or rate details here. You're welcome to ask him directly at ${MARLON_EMAIL}.`;
  }

  if (isPrivatePersonalQuestion(text)) {
    return `I don't have that personal detail here. For professional questions, you're welcome to contact Marlon at ${MARLON_EMAIL}.`;
  }

  if (isGeneralCodingRequest(text)) {
    return "I'm here to answer job-interview questions about Marlon's technical background. If you're evaluating his debugging or coding experience, he has experience with Laravel/PHP, React, React Native, Vue.js, Node.js, MySQL, Firebase, debugging, performance tuning, and production support.";
  }

  if (isCommonOffTopicQuestion(text)) {
    return SCOPE_REPLY;
  }

  return undefined;
}
