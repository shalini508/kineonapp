const WebDriver = require('webdriver');
const { wdOpts } = require('../config/capabilities');

async function startSession(overrides = {}) {
  const opts = { ...wdOpts, capabilities: { ...wdOpts.capabilities, ...overrides } };
  const client = await WebDriver.newSession(opts);
  return client;
}

async function endSession(client) {
  if (!client) return;
  try {
    await client.deleteSession();
  } catch (err) {
    console.warn('Warning: error closing session:', err.message);
  }
}

module.exports = { startSession, endSession };
