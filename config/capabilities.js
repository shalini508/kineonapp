// Known-good Appium capabilities for testing Kineon Move+ (io.kineon.move)
// on Shalini's iPhone 16 via WebDriverAgent, signed under the "XTW26G8FF2"
// Apple Development team. See README.md for how this was derived.

const DEVICE_UDID = '00008140-00142C6214EB001C';
const DEVICE_NAME = "Shalini's iPhone";
const PLATFORM_VERSION = '26.6';
const TEAM_ID = 'XTW26G8FF2';
const BUNDLE_ID = 'io.kineon.move';

const capabilities = {
  platformName: 'iOS',
  'appium:automationName': 'XCUITest',
  'appium:udid': DEVICE_UDID,
  'appium:deviceName': DEVICE_NAME,
  'appium:platformVersion': PLATFORM_VERSION,
  'appium:bundleId': BUNDLE_ID,
  'appium:xcodeOrgId': TEAM_ID,
  'appium:xcodeSigningId': 'Apple Development',
  'appium:allowProvisioningDeviceRegistration': true,
  'appium:usePrebuiltWDA': false,
  'appium:showXcodeLog': false,
  'appium:wdaLaunchTimeout': 240000,
  'appium:wdaConnectionTimeout': 240000,
  'appium:newCommandTimeout': 180,
};

const wdOpts = {
  protocol: 'http',
  hostname: '127.0.0.1',
  port: 4723,
  path: '/',
  logLevel: 'warn',
  connectionRetryTimeout: 240000,
  capabilities,
};

module.exports = { capabilities, wdOpts, DEVICE_UDID, BUNDLE_ID };
