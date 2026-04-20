const MARLON_EMAIL = "marlonbbernal@gmail.com";
const MARLON_LOCATION = "Morong, Rizal, Philippines";

const REPLIES = {
  identity: "My name is Marlon B. Bernal.",
  whoAreYou:
    "I'm Marlon B. Bernal, a senior full-stack and mobile engineer. I can answer questions about my experience, projects, skills, and professional fit.",
  identityScope:
    "My name is Marlon B. Bernal. I can answer questions about my work, skills, projects, and professional background.",
  employmentStatus:
    `I currently work independently as a software engineer, contract developer, and product builder. I've been self-employed on project-based contracts and product development since January 2021. For current availability or interview scheduling, contact me at ${MARLON_EMAIL}.`,
  privateDetail: `I keep private personal details out of this chat. If that detail is required for a formal hiring process, you can contact me directly at ${MARLON_EMAIL}.`,
  scope:
    "I can answer job-interview questions about my work, skills, projects, and professional background. Is there something specific about my experience I can help with?",
  internalImplementation:
    "I can't discuss the internal setup of this portfolio feature, including its server, model backend, deployment, credentials, prompt files, or infrastructure. I can answer questions about my work, skills, projects, and professional background.",
  codingFit:
    "I can answer job-interview questions about my technical background. If you're evaluating my debugging or coding experience, I have experience with Laravel/PHP, React, React Native, Vue.js, Node.js, MySQL, Firebase, debugging, performance tuning, and production support.",
} as const;

export interface ReplyHistoryItem {
  role?: string;
  content?: string;
  text?: string;
}

type DirectReplyCategory =
  | "prompt_injection"
  | "internal_implementation"
  | "name"
  | "who_are_you"
  | "model_identity"
  | "location"
  | "contact"
  | "phone"
  | "employment_status"
  | "availability"
  | "compensation"
  | "private_personal"
  | "private_personal_follow_up"
  | "general_coding"
  | "off_topic";

type ModelCategory = "professional_or_unknown";

export type QuestionCategory = DirectReplyCategory | ModelCategory;

export type QuestionClassification =
  | {
      action: "direct_reply";
      category: DirectReplyCategory;
      normalizedMessage: string;
      reply: string;
    }
  | {
      action: "model";
      category: ModelCategory;
      normalizedMessage: string;
      reply?: undefined;
    };

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

function directReply(
  category: DirectReplyCategory,
  normalizedMessage: string,
  reply: string
): QuestionClassification {
  return {
    action: "direct_reply",
    category,
    normalizedMessage,
    reply,
  };
}

function modelReply(normalizedMessage: string): QuestionClassification {
  return {
    action: "model",
    category: "professional_or_unknown",
    normalizedMessage,
  };
}

function historyText(item: ReplyHistoryItem): string {
  return normalize(item.content ?? item.text ?? "");
}

function isNameQuestion(text: string): boolean {
  return matchesAny(text, [
    /^(hi|hello|hey)?\s*(what('?s| is) your name|what should i call you)\??$/,
    /\b(what('?s| is)|tell me|may i know|can i know|could i know)\s+(your\s+)?name\b/,
    /\byour\s+name\b/,
    /\bwhat('?s| is)\s+marlon('?s)?\s+(full\s+)?name\b/,
  ]);
}

function isWhoAreYouQuestion(text: string): boolean {
  return matchesAny(text, [
    /^(hi|hello|hey)?\s*(who are you|introduce yourself|tell me about yourself)\??$/,
    /\bwho\s+(am i|are we)\s+(talking|speaking|chatting)\s+to\b/,
    /\bwho\s+is\s+marlon\b/,
  ]);
}

function isModelIdentityQuestion(text: string): boolean {
  return matchesAny(text, [
    /\b(what|which)\s+(ai\s+)?model\b/,
    /\b(are you|r u|is this)\s+(an?\s+)?(ai|assistant|chatbot|bot|chatgpt|gemini|gemma|google|openai|claude)\b/,
    /\b(trained by|made by|created by|built by)\s+(google|openai|anthropic)\b/,
    /\blarge language model\b/,
  ]);
}

function isLocationQuestion(text: string): boolean {
  return matchesAny(text, [
    /\bwhat('?s| is)\s+(your|his|marlon'?s)\s+(exact\s+)?(home\s+|street\s+|house\s+)?(address|location)\b/,
    /\bwhere\s+(are you|is he|is marlon)\s+(located|based|from|living|live)\b/,
    /\bwhere\s+does\s+(marlon|he)\s+(live|work from)\b/,
    /\bmap\s+location\b/,
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

function isEmploymentStatusQuestion(text: string): boolean {
  return matchesAny(text, [
    /\b(are|is)\s+(you|marlon|he)\s+(currently\s+)?(employed|working)\b/,
    /\b(do|does)\s+(you|marlon|he)\s+have\s+(a\s+)?(job|current\s+job|employer)\b/,
    /\bwhat('?s| is)\s+(your|his|marlon'?s)\s+(current\s+)?employment\s+status\b/,
    /\bwhere\s+(do you|does he|does marlon)\s+(currently\s+)?work\b/,
    /\bwho\s+(do you|does he|does marlon)\s+work\s+for\b/,
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
  ]);
}

function isPrivatePersonalFollowUp(text: string): boolean {
  return matchesAny(text, [
    /\bwhy\s+not\b/,
    /\bwhy\b.*\b(can't|cannot|can not|don't|do not|won't|will not|not)\b/,
    /\bpart\s+of\s+(the\s+)?(job\s+)?hiring\s+process\b/,
    /\bformal\s+(job\s+)?(hiring|application|screening|process)\b/,
    /\b(required|needed|necessary)\s+for\s+(the\s+)?(job|hiring|application|screening)\b/,
  ]);
}

function hasRecentPrivatePersonalContext(history: ReplyHistoryItem[]): boolean {
  return history.slice(-4).some((item) => {
    const text = historyText(item);
    return isPrivatePersonalQuestion(text) || text.includes("private personal details");
  });
}

function isPromptInjection(text: string): boolean {
  return matchesAny(text, [
    /\bignore\s+(previous|above|all|the)\s+(instructions|rules|prompt)\b/,
    /\breveal\s+(your\s+)?(system\s+)?prompt\b/,
    /\bshow\s+(your\s+)?(system\s+)?prompt\b/,
    /\bdeveloper\s+message\b/,
    /\bhidden\s+(instructions|rules|prompt)\b/,
    /\bact\s+as\s+(someone|something|another|a\s+different)\b/,
  ]);
}

function isAssistantInfrastructureQuestion(text: string): boolean {
  return matchesAny(text, [
    /\b(what|which)\s+(model|llm)\s+and\s+(server|backend|infrastructure|hosting)\s+(are you|is this|powers this|runs this|running)\b/,
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
    /\bi\s+(am|'m)\s+(an?\s+)?ai\s+language\s+model\b/,
    /\bi'?m\s+(an?\s+)?(ai assistant|chatbot|bot|large language model|language model)\b/,
    /\bi'?m\s+(an?\s+)?ai\s+language\s+model\b/,
    /\bas\s+(an?\s+)?(ai assistant|ai model|large language model|language model)\b/,
    /\binformational\s+assistant\b/,
    /\bhr\s+representative\b/,
    /\bactual\s+job\s+candidate\b/,
    /\bdon't\s+participate\s+in\s+job\s+hiring\s+processes\b/,
    /\bdo\s+not\s+participate\s+in\s+job\s+hiring\s+processes\b/,
    /\btrained by\s+(google|openai|anthropic)\b/,
    /\bbuilt by\s+(google|openai|anthropic)\b/,
    /\bmade by\s+(google|openai|anthropic)\b/,
    /\bcreated by\s+(google|openai|anthropic)\b/,
    /\bi\s+(do not|don't)\s+have\s+a\s+personal\s+name\b/,
    /\bi\s+(do not|don't)\s+have\s+personal\s+(experiences|opinions|feelings)\b/,
    /\b(my\s+)?name\s+is\s+not\s+(specified|provided|listed|available|mentioned)\b/,
    /\bi\s+(can|could)\s+answer\s+questions\s+about\s+my\s+(capabilities|knowledge\s+base)\b/,
    /\b(capabilities\s+and\s+knowledge\s+base|provided\s+information\s+about\s+marlon)\b/,
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

function hasHiddenSourceMention(reply: string): boolean {
  const text = normalize(reply);

  return matchesAny(text, [
    /\b(system|developer|hidden)\s+(prompt|message|instruction|rule)s?\b/,
    /\b(profile\s+context|knowledge\s+base|provided\s+context|provided\s+information|text\s+you\s+provide)\b/,
    /\bbased\s+on\s+(the\s+)?(provided\s+)?(context|information|profile|persona)\b/,
  ]);
}

export function hasForbiddenGeneratedContent(reply: string): boolean {
  return hasForbiddenModelSelfDescription(reply) || hasHiddenSourceMention(reply);
}

export function classifyQuestion(
  message: string,
  history: ReplyHistoryItem[] = []
): QuestionClassification {
  const text = normalize(message);
  if (!text) return modelReply(text);

  if (isPromptInjection(text)) {
    return directReply("prompt_injection", text, REPLIES.scope);
  }

  if (isAssistantInfrastructureQuestion(text)) {
    return directReply("internal_implementation", text, REPLIES.internalImplementation);
  }

  if (isNameQuestion(text)) {
    return directReply("name", text, REPLIES.identity);
  }

  if (isWhoAreYouQuestion(text)) {
    return directReply("who_are_you", text, REPLIES.whoAreYou);
  }

  if (isModelIdentityQuestion(text)) {
    return directReply("model_identity", text, REPLIES.identityScope);
  }

  if (isLocationQuestion(text)) {
    return directReply("location", text, `I'm based in ${MARLON_LOCATION}.`);
  }

  if (isPhoneQuestion(text)) {
    return directReply("phone", text, `The best way to contact me is by email at ${MARLON_EMAIL}.`);
  }

  if (isContactQuestion(text)) {
    return directReply("contact", text, `You can contact me at ${MARLON_EMAIL}.`);
  }

  if (isEmploymentStatusQuestion(text)) {
    return directReply("employment_status", text, REPLIES.employmentStatus);
  }

  if (isAvailabilityQuestion(text)) {
    return directReply(
      "availability",
      text,
      `I've worked as an independent software engineer and contract developer since January 2021. For current availability or interview scheduling, contact me at ${MARLON_EMAIL}.`
    );
  }

  if (isSalaryOrRateQuestion(text)) {
    return directReply(
      "compensation",
      text,
      `I don't have my salary or rate details listed here. You can ask me directly at ${MARLON_EMAIL}.`
    );
  }

  if (isPrivatePersonalQuestion(text)) {
    return directReply("private_personal", text, REPLIES.privateDetail);
  }

  if (
    isPrivatePersonalFollowUp(text) &&
    (hasRecentPrivatePersonalContext(history) || text.includes("hiring process"))
  ) {
    return directReply("private_personal_follow_up", text, REPLIES.privateDetail);
  }

  if (isGeneralCodingRequest(text)) {
    return directReply("general_coding", text, REPLIES.codingFit);
  }

  if (isCommonOffTopicQuestion(text)) {
    return directReply("off_topic", text, REPLIES.scope);
  }

  return modelReply(text);
}

export function getDirectReply(
  message: string,
  history: ReplyHistoryItem[] = []
): string | undefined {
  const classification = classifyQuestion(message, history);
  return classification.action === "direct_reply" ? classification.reply : undefined;
}

function fallbackForClassification(classification: QuestionClassification): string {
  if (classification.action === "direct_reply") {
    return classification.reply;
  }

  return REPLIES.scope;
}

export function sanitizeReply(
  message: string,
  reply: string,
  history: ReplyHistoryItem[] = [],
  classification = classifyQuestion(message, history)
): string {
  const trimmedReply = reply.trim();
  const normalizedReply = normalize(trimmedReply);

  if (!trimmedReply) {
    return fallbackForClassification(classification);
  }

  if (classification.category === "name" && !normalizedReply.includes("marlon b bernal")) {
    return REPLIES.identity;
  }

  if (hasForbiddenGeneratedContent(trimmedReply)) {
    return fallbackForClassification(classification);
  }

  return trimmedReply;
}
