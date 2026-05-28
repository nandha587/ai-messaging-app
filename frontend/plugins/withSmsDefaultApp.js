/**
 * withSmsDefaultApp.js
 *
 * Expo config plugin that modifies AndroidManifest.xml to make the app
 * eligible to appear in the "Default SMS App" selector on Android.
 *
 * Android requires four things for Default SMS App eligibility:
 *  1. A BroadcastReceiver declared with android.provider.Telephony.SMS_RECEIVED
 *  2. A Service declared with android.intent.action.RESPOND_VIA_MESSAGE
 *  3. An Activity that handles sms:/smsto: URI schemes (SENDTO action)
 *  4. The android.permission.WRITE_SMS permission
 */

const { withAndroidManifest } = require('@expo/config-plugins');

function addSmsReceiverToManifest(androidManifest) {
  const app = androidManifest.manifest.application[0];

  // ── 1. SmsManifestReceiver ──────────────────────────────────────────────────
  if (!app.receiver) app.receiver = [];

  const receiverName = 'expo.modules.smsinbox.SmsManifestReceiver';
  const hasReceiver = app.receiver.some(
    (r) => r.$?.['android:name'] === receiverName
  );

  if (!hasReceiver) {
    app.receiver.push({
      $: {
        'android:name': receiverName,
        'android:exported': 'true',
        'android:permission': 'android.permission.BROADCAST_SMS',
      },
      'intent-filter': [
        {
          $: { 'android:priority': '999' },
          action: [
            { $: { 'android:name': 'android.provider.Telephony.SMS_RECEIVED' } },
          ],
        },
      ],
    });
  }

  // ── 2. HeadlessSmsSendService ───────────────────────────────────────────────
  if (!app.service) app.service = [];

  const serviceName = 'expo.modules.smsinbox.HeadlessSmsSendService';
  const hasService = app.service.some(
    (s) => s.$?.['android:name'] === serviceName
  );

  if (!hasService) {
    app.service.push({
      $: {
        'android:name': serviceName,
        'android:exported': 'true',
        'android:permission': 'android.permission.SEND_RESPOND_VIA_MESSAGE',
      },
      'intent-filter': [
        {
          action: [
            {
              $: { 'android:name': 'android.intent.action.RESPOND_VIA_MESSAGE' },
            },
          ],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
          ],
          data: [
            { $: { 'android:scheme': 'sms' } },
            { $: { 'android:scheme': 'smsto' } },
            { $: { 'android:scheme': 'mms' } },
            { $: { 'android:scheme': 'mmsto' } },
          ],
        },
      ],
    });
  }

  // ── 3. Add sms:/smsto: intent-filter to MainActivity ─────────────────────
  const activities = app.activity || [];
  const mainActivity = activities.find(
    (a) =>
      a.$?.['android:name'] === '.MainActivity' ||
      a.$?.['android:name']?.endsWith('.MainActivity')
  );

  if (mainActivity) {
    if (!mainActivity['intent-filter']) mainActivity['intent-filter'] = [];

    const hasSmsFilter = mainActivity['intent-filter'].some((f) =>
      (f.action || []).some(
        (a) => a.$?.['android:name'] === 'android.intent.action.SENDTO'
      )
    );

    if (!hasSmsFilter) {
      mainActivity['intent-filter'].push({
        action: [
          { $: { 'android:name': 'android.intent.action.SENDTO' } },
          { $: { 'android:name': 'android.intent.action.VIEW' } },
        ],
        category: [
          { $: { 'android:name': 'android.intent.category.DEFAULT' } },
          { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
        ],
        data: [
          { $: { 'android:scheme': 'sms' } },
          { $: { 'android:scheme': 'smsto' } },
        ],
      });
    }
  }

  return androidManifest;
}

module.exports = function withSmsDefaultApp(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = addSmsReceiverToManifest(config.modResults);
    return config;
  });
};
