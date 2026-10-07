const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Packaged builds are read-only, so main.js points this at the user data folder.
const envPath = process.env.HELPLY_ENV_PATH || path.join(__dirname, '.env');
dotenv.config({ path: envPath });

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

  saveSettings();
  validateConfig();
}

// ---------- persistent settings ----------
// Settings live in the user data folder, which survives restarts, updates, and reinstalls.
// API keys are encrypted with the OS keychain (DPAPI on Windows) when it is available.

let settingsPath = process.env.HELPLY_SETTINGS_PATH || '';
let safeStorage = null;

function encryptKey(value) {
  if (!value) return { apiKey: '' };
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    return { apiKeyEnc: safeStorage.encryptString(value).toString('base64') };
  }
  return { apiKey: value };
}

function decryptKey(entry) {
  if (entry.apiKeyEnc) {
    try {
      return safeStorage.decryptString(Buffer.from(entry.apiKeyEnc, 'base64'));
    } catch (error) {
      console.error('Could not decrypt a saved API key; enter it again in Settings.');
      return '';
    }
  }
  return String(entry.apiKey || '');
}

function saveSettings() {
  if (!settingsPath) return;
  const providers = {};
  for (const providerName of providerNames) {
    const settings = ensureProviderSettings(providerName) || {};
    providers[providerName] = {
      baseUrl: settings.baseUrl || '',
      chatModel: settings.chatModel || '',
      transcriptionModel: settings.transcriptionModel || '',
      ...encryptKey(settings.apiKey || '')
    };
  }
  const data = JSON.stringify({
    version: 1,
    transcriptionProvider: config.transcriptionProvider,
    chatProvider: config.chatProvider,
    providers
  }, null, 2);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  const temp = `${settingsPath}.tmp`;
  fs.writeFileSync(temp, data, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, settingsPath);
}

function applySaved(saved) {
  if (providerMap[saved.transcriptionProvider]) config.transcriptionProvider = saved.transcriptionProvider;
  if (providerMap[saved.chatProvider]) config.chatProvider = saved.chatProvider;
  for (const [providerName, entry] of Object.entries(saved.providers || {})) {
    if (!providerMap[providerName] || !entry) continue;
    const settings = ensureProviderSettings(providerName);
    settings.apiKey = decryptKey(entry).trim();
    for (const key of ['baseUrl', 'chatModel', 'transcriptionModel']) {
      if (entry[key]) settings[key] = String(entry[key]).trim();
    }
  }
}

// Call once Electron is ready. Without a saved file, the .env values become the first saved settings.
function loadSettings(options = {}) {
  if (options.path) settingsPath = options.path;
  if (options.safeStorage) safeStorage = options.safeStorage;
  if (!settingsPath) return;
  if (fs.existsSync(settingsPath)) {
    try {
      applySaved(JSON.parse(fs.readFileSync(settingsPath, 'utf8')));
    } catch (error) {
      console.error('Saved settings are unreadable, keeping defaults:', error.message);
    }
  } else {
    saveSettings();
    // The keys are now in the encrypted file; drop the plain-text copy the old version wrote.
    if (options.migratedEnvPath && fs.existsSync(options.migratedEnvPath)) {
      try { fs.unlinkSync(options.migratedEnvPath); } catch (error) { /* keep going */ }
    }
  }
  validateConfig();
}

validateConfig();

module.exports = {
  config,
  providersConfig,
  getProviderConfig,
  getProviderRuntime,
  getApiKey,
  getConfig,
  updateConfig,
  validateConfig,
  loadSettings
};
