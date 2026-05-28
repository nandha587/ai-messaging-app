package expo.modules.smsinbox

import android.app.Service
import android.content.Intent
import android.os.IBinder

/**
 * Required stub service for Android Default SMS App eligibility.
 *
 * Android mandates that any app that wants to be the Default SMS App must
 * declare a Service that responds to android.intent.action.RESPOND_VIA_MESSAGE.
 * This stub satisfies that requirement.
 */
class HeadlessSmsSendService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        stopSelf()
        return START_NOT_STICKY
    }
}
