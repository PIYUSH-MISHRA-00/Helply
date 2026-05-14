const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Load provider configurations
let providersConfig;
try {
  providersConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'providers.json'), 'utf8'));
} catch (error) {
  console.error('Error loading providers.json:', error);
  providersConfig = { providers: {} };
}

const providerMap = providersConfig.providers || {};
const providerNames = Object.keys(providerMap);

const legacyApiKeyEnvByProvider = {
  groq: 'GROQ_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  custom: 'CUSTOM_API_KEY'
};

const legacyBaseUrlEnvByProvider = {
  custom: 'CUSTOM_BASE_URL',
  ollama: 'OLLAMA_BASE_URL',
  lmstudio: 'LMSTUDIO_BASE_URL'
};

function getProviderEnvName(providerName, suffix) {
  return `${String(providerName || '').toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${suffix}`;
}

function getEnvValue(...keys) {
  for (const key of keys) {
    if (!key) continue;
    const value = process.env[key];
    if (value !== undefined && value !== null && String(value).length > 0) {
      return value;
    }
  }
  return '';
}

function buildDefaultProviderSettings(providerName, providerConfig = {}) {
  const defaultChatModel = providerConfig.chat?.defaultModel || '';
  const defaultTranscriptionModel = providerConfig.transcription?.defaultModel || '';
  const defaultBaseUrl = providerConfig.baseUrl || '';

  const apiKey = getEnvValue(
    getProviderEnvName(providerName, 'API_KEY'),
    legacyApiKeyEnvByProvider[providerName]
  );

  const baseUrl = getEnvValue(
    getProviderEnvName(providerName, 'BASE_URL'),
    legacyBaseUrlEnvByProvider[providerName]
  ) || defaultBaseUrl;

  const chatModel = getEnvValue(
    getProviderEnvName(providerName, 'CHAT_MODEL')
  ) || defaultChatModel;

  const transcriptionModel = getEnvValue(
    getProviderEnvName(providerName, 'TRANSCRIPTION_MODEL')
  ) || defaultTranscriptionModel;

  return {
    apiKey,
    baseUrl,
    chatModel,
    transcriptionModel
  };
}

function buildProviderSettings() {
  const settings = {};

  for (const providerName of providerNames) {
    settings[providerName] = buildDefaultProviderSettings(providerName, providerMap[providerName]);
  }

  return settings;
}

// User configuration
const config = {
  transcriptionProvider: process.env.TRANSCRIPTION_PROVIDER || 'groq',
  chatProvider: process.env.CHAT_PROVIDER || 'groq',
  providerSettings: buildProviderSettings()
};

function ensureProviderSettings(providerName) {
  if (!providerMap[providerName]) return null;

  if (!config.providerSettings[providerName]) {
    config.providerSettings[providerName] = buildDefaultProviderSettings(providerName, providerMap[providerName]);
  }

  return config.providerSettings[providerName];
}

// Validate configuration
function validateConfig() {
  const transcriptionProviderConfig = providerMap[config.transcriptionProvider];
  const chatProviderConfig = providerMap[config.chatProvider];

  if (!transcriptionProviderConfig) {
    console.error(`Invalid transcription provider: ${config.transcriptionProvider}`);
    return false;
  }

  if (!chatProviderConfig) {
    console.error(`Invalid chat provider: ${config.chatProvider}`);
    return false;
  }

  if (!transcriptionProviderConfig.transcription?.enabled) {
    console.warn(`Warning: ${config.transcriptionProvider} does not support transcription.`);
  }

  if (!chatProviderConfig.chat?.enabled) {
    console.warn(`Warning: ${config.chatProvider} does not support chat.`);
  }

  const transcriptionSettings = ensureProviderSettings(config.transcriptionProvider) || {};
  const chatSettings = ensureProviderSettings(config.chatProvider) || {};

  if (transcriptionProviderConfig.apiKeyRequired && !transcriptionSettings.apiKey) {
    console.warn(`Warning: ${config.transcriptionProvider} API key not found. Transcription may not work.`);
  }

  if (chatProviderConfig.apiKeyRequired && !chatSettings.apiKey) {
    console.warn(`Warning: ${config.chatProvider} API key not found. Chat may not work.`);
  }

  return true;
}

// Get provider configuration
function getProviderConfig(providerName) {
  return providerMap[providerName];
}

function getProviderRuntime(providerName) {
  const providerConfig = getProviderConfig(providerName);
  if (!providerConfig) {
    throw new Error(`Unknown provider: ${providerName}`);
  }

  const settings = ensureProviderSettings(providerName) || {};

  return {
    name: providerName,
    type: providerConfig.type || 'openai_compatible',
    apiKeyRequired: Boolean(providerConfig.apiKeyRequired),
    supportsTranscription: Boolean(providerConfig.transcription?.enabled),
    supportsChat: Boolean(providerConfig.chat?.enabled),
    baseUrl: (settings.baseUrl || providerConfig.baseUrl || '').trim(),
    apiKey: (settings.apiKey || '').trim(),
    chatModel: (settings.chatModel || providerConfig.chat?.defaultModel || '').trim(),
    transcriptionModel: (settings.transcriptionModel || providerConfig.transcription?.defaultModel || '').trim(),
    config: providerConfig
  };
}

// Get API key for provider
function getApiKey(providerName) {
  return (ensureProviderSettings(providerName)?.apiKey || '').trim();
}

function getConfig() {
  return {
    ...config,
    providers: providerMap
  };
}

function mergeProviderSettings(providerName, nextValues) {
  const settings = ensureProviderSettings(providerName);
  if (!settings || !nextValues || typeof nextValues !== 'object') return;

  const allowedKeys = ['apiKey', 'baseUrl', 'chatModel', 'transcriptionModel'];
  for (const key of allowedKeys) {
    if (nextValues[key] !== undefined) {
      settings[key] = String(nextValues[key] ?? '').trim();
    }
  }
}

// Update configuration
function updateConfig(newConfig) {
  if (!newConfig || typeof newConfig !== 'object') return;

  if (newConfig.transcriptionProvider !== undefined && providerMap[newConfig.transcriptionProvider]) {
    config.transcriptionProvider = newConfig.transcriptionProvider;
    process.env.TRANSCRIPTION_PROVIDER = newConfig.transcriptionProvider;
  }

  if (newConfig.chatProvider !== undefined && providerMap[newConfig.chatProvider]) {
    config.chatProvider = newConfig.chatProvider;
    process.env.CHAT_PROVIDER = newConfig.chatProvider;
  }

  if (newConfig.providerSettings && typeof newConfig.providerSettings === 'object') {
    for (const [providerName, providerSettings] of Object.entries(newConfig.providerSettings)) {
      if (!providerMap[providerName]) continue;
      mergeProviderSettings(providerName, providerSettings);
    }
  }

  // Backward compatibility for older settings payloads
  if (newConfig.apiKeys && typeof newConfig.apiKeys === 'object') {
    for (const [providerName, key] of Object.entries(newConfig.apiKeys)) {
      if (!providerMap[providerName]) continue;
      mergeProviderSettings(providerName, { apiKey: key });
    }
  }

  if (newConfig.ollamaBaseUrl !== undefined) {
    mergeProviderSettings('ollama', { baseUrl: newConfig.ollamaBaseUrl });
  }

  if (newConfig.lmstudioBaseUrl !== undefined) {
    mergeProviderSettings('lmstudio', { baseUrl: newConfig.lmstudioBaseUrl });
  }

  if (newConfig.customBaseUrl !== undefined) {
    mergeProviderSettings('custom', { baseUrl: newConfig.customBaseUrl });
  }

  if (newConfig.customApiKey !== undefined) {
    mergeProviderSettings('custom', { apiKey: newConfig.customApiKey });
  }

  saveConfigToEnv();
  validateConfig();
}

function upsertEnvVar(envContent, key, value) {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const newLine = `${key}=${serializeEnvValue(value ?? '')}`;

  if (regex.test(envContent)) {
    return envContent.replace(regex, newLine);
  }

  return `${envContent.trimEnd()}\n${newLine}\n`;
}

function serializeEnvValue(value) {
  const stringValue = String(value ?? '');
  if (!stringValue) return '';

  // Quote values with spaces, hash comments, quotes, equals, or line breaks.
  if (/[#\s"=\r\n]/.test(stringValue)) {
    return JSON.stringify(stringValue);
  }

  return stringValue;
}

function ensureEnvFileExists(envPath) {
  const envDir = path.dirname(envPath);
  if (!fs.existsSync(envDir)) {
    fs.mkdirSync(envDir, { recursive: true });
  }

  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, '', { encoding: 'utf8', mode: 0o600 });
  }
}

// Save current config to .env file
function saveConfigToEnv() {
  const envPath = path.join(__dirname, '.env');
  let envContent = '';

  ensureEnvFileExists(envPath);

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  const baseUpdates = {
    TRANSCRIPTION_PROVIDER: config.transcriptionProvider,
    CHAT_PROVIDER: config.chatProvider
  };

  for (const [key, value] of Object.entries(baseUpdates)) {
    envContent = upsertEnvVar(envContent, key, value);
  }

  for (const providerName of providerNames) {
    const settings = ensureProviderSettings(providerName) || {};

    const updates = {
      [getProviderEnvName(providerName, 'API_KEY')]: settings.apiKey || '',
      [getProviderEnvName(providerName, 'BASE_URL')]: settings.baseUrl || '',
      [getProviderEnvName(providerName, 'CHAT_MODEL')]: settings.chatModel || '',
      [getProviderEnvName(providerName, 'TRANSCRIPTION_MODEL')]: settings.transcriptionModel || ''
    };

    for (const [key, value] of Object.entries(updates)) {
      envContent = upsertEnvVar(envContent, key, value);
    }
  }

  // Keep legacy keys in sync for backward compatibility
  const legacyUpdates = {
    GROQ_API_KEY: getApiKey('groq'),
    OPENAI_API_KEY: getApiKey('openai'),
    ANTHROPIC_API_KEY: getApiKey('anthropic'),
    CUSTOM_API_KEY: getApiKey('custom'),
    CUSTOM_BASE_URL: ensureProviderSettings('custom')?.baseUrl || '',
    OLLAMA_BASE_URL: ensureProviderSettings('ollama')?.baseUrl || '',
    LMSTUDIO_BASE_URL: ensureProviderSettings('lmstudio')?.baseUrl || ''
  };

  for (const [key, value] of Object.entries(legacyUpdates)) {
    envContent = upsertEnvVar(envContent, key, value);
  }

  fs.writeFileSync(envPath, envContent.trimEnd() + '\n', { encoding: 'utf8', mode: 0o600 });

  // Best-effort: keep env file private on Unix-like systems.
  try {
    if (process.platform !== 'win32') {
      fs.chmodSync(envPath, 0o600);
    }
  } catch (error) {
    // Ignore permission hardening errors; file contents are still saved.
  }
}

// Initialize validation
validateConfig();

module.exports = {
  config,
  providersConfig,
  getProviderConfig,
  getProviderRuntime,
  getApiKey,
  getConfig,
  updateConfig,
  validateConfig
};
