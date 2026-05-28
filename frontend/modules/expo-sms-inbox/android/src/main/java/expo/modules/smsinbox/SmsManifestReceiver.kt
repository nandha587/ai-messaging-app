package expo.modules.smsinbox

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.telephony.SmsMessage

/**
 * Manifest-declared BroadcastReceiver for SMS_RECEIVED.
 *
 * Android requires an app to declare this receiver in AndroidManifest.xml
 * (not just programmatically) to be eligible for the Default SMS App list.
 *
 * When a new SMS arrives this receiver:
 *  1. Parses the PDUs into readable messages
 *  2. Invokes the callback set by ExpoSmsInboxModule (when the app is active)
 *  3. Stores the SMS in a static queue so the module can drain it when it starts
 */
class SmsManifestReceiver : BroadcastReceiver() {

    companion object {
        private const val SMS_RECEIVED = "android.provider.Telephony.SMS_RECEIVED"

        /**
         * Set by ExpoSmsInboxModule.startSmsListener().
         * Called on the main thread whenever a new SMS is received.
         */
        var onSmsReceived: ((address: String, body: String, timestamp: Long) -> Unit)? = null

        /**
         * Pending SMS events queued while no listener is attached (app in background).
         * Drained by ExpoSmsInboxModule when startSmsListener() is called.
         */
        val pendingQueue: ArrayDeque<Triple<String, String, Long>> = ArrayDeque()
        private const val MAX_QUEUE = 50
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != SMS_RECEIVED) return

        val bundle = intent.extras ?: return
        val pdus = bundle.get("pdus") as? Array<*> ?: return
        val format = bundle.getString("format")

        val bodyMap = mutableMapOf<String, StringBuilder>()
        val dateMap = mutableMapOf<String, Long>()

        for (pdu in pdus) {
            val sms: SmsMessage = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                SmsMessage.createFromPdu(pdu as ByteArray, format)
            } else {
                @Suppress("DEPRECATION")
                SmsMessage.createFromPdu(pdu as ByteArray)
            }

            val addr = sms.displayOriginatingAddress ?: "Unknown"
            val body = sms.displayMessageBody ?: ""
            val ts   = sms.timestampMillis

            bodyMap.getOrPut(addr) { StringBuilder() }.append(body)
            dateMap[addr] = ts
        }

        bodyMap.forEach { (addr, sb) ->
            val body = sb.toString()
            val ts   = dateMap[addr] ?: System.currentTimeMillis()

            val callback = onSmsReceived
            if (callback != null) {
                // App is active — deliver immediately
                callback(addr, body, ts)
            } else {
                // App is in background — queue for later delivery
                if (pendingQueue.size < MAX_QUEUE) {
                    pendingQueue.addLast(Triple(addr, body, ts))
                }
            }
        }
    }
}
