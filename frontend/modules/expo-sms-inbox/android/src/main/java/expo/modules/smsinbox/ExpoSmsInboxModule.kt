package expo.modules.smsinbox

import android.Manifest
import android.app.PendingIntent
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.ContactsContract
import android.provider.Telephony
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoSmsInboxModule : Module() {

  private val context: Context
    get() = appContext.reactContext
      ?: throw IllegalStateException("ReactApplicationContext is not available")

  // ─── Contact name cache (avoid repeated lookups) ──────────────────────────
  private val contactCache = mutableMapOf<String, String>()

  private fun resolveContactName(address: String): String? {
    if (address.isBlank()) return null
    contactCache[address]?.let { return it }

    if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS)
      != PackageManager.PERMISSION_GRANTED) return null

    return try {
      val uri = Uri.withAppendedPath(
        ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
        Uri.encode(address)
      )
      context.contentResolver.query(
        uri,
        arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
        null, null, null
      )?.use { cursor ->
        if (cursor.moveToFirst()) {
          val name = cursor.getString(0)
          if (!name.isNullOrBlank()) {
            contactCache[address] = name
            name
          } else null
        } else null
      }
    } catch (e: Exception) {
      null
    }
  }

  // ─── Read SMS from a given URI, up to maxRows rows ─────────────────────────
  private fun querySmsUri(
    uri: Uri,
    selection: String? = null,
    selectionArgs: Array<String>? = null,
    maxRows: Int = 500
  ): List<Map<String, Any>> {
    val results = mutableListOf<Map<String, Any>>()
    val cr: ContentResolver = context.contentResolver

    // Use official Telephony constants where possible
    val projection = arrayOf(
      "_id",
      "thread_id",
      "address",
      "body",
      "date",
      "type",   // 1=inbox, 2=sent
      "read",
      "subject"
    )

    // NOTE: Do NOT put LIMIT in sortOrder — breaks on many OEMs.
    // Control result count via manual loop below.
    val cursor = try {
      cr.query(uri, projection, selection, selectionArgs, "date DESC")
    } catch (e: Exception) {
      null
    } ?: return results

    cursor.use {
      val idIdx       = it.getColumnIndex("_id")
      val threadIdx   = it.getColumnIndex("thread_id")
      val addrIdx     = it.getColumnIndex("address")
      val bodyIdx     = it.getColumnIndex("body")
      val dateIdx     = it.getColumnIndex("date")
      val typeIdx     = it.getColumnIndex("type")
      val readIdx     = it.getColumnIndex("read")

      var count = 0
      while (it.moveToNext() && count < maxRows) {
        val address = if (addrIdx >= 0) it.getString(addrIdx)?.trim() ?: "" else ""
        val body    = if (bodyIdx >= 0) it.getString(bodyIdx) ?: "" else ""

        // Skip completely blank rows
        if (address.isBlank() && body.isBlank()) continue

        val contactName = resolveContactName(address)

        results.add(
          buildMap {
            put("id",          if (idIdx >= 0)     it.getString(idIdx)  ?: "" else "")
            put("threadId",    if (threadIdx >= 0) it.getString(threadIdx) ?: "" else "")
            put("address",     address)
            put("contactName", contactName ?: "")
            put("body",        body)
            put("date",        if (dateIdx >= 0) it.getLong(dateIdx) else 0L)
            put("type",        if (typeIdx >= 0) it.getInt(typeIdx)  else 1)
            put("read",        if (readIdx >= 0) it.getInt(readIdx)  else 1)
          }
        )
        count++
      }
    }

    return results
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoSmsInbox")

    Events("onNewSmsReceived")

    // ─── getSmsThreads ─────────────────────────────────────────────────────
    // Returns threaded conversations grouped by thread_id, with contact names.
    // Each thread contains its messages sorted newest-first.
    // ─────────────────────────────────────────────────────────────────────
    AsyncFunction("getSmsThreads") { promise: Promise ->
      try {
        // Check permission first — return structured error, not throw
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS)
          != PackageManager.PERMISSION_GRANTED) {
          promise.resolve(
            mapOf("threads" to emptyList<Any>(), "error" to "PERMISSION_DENIED")
          )
          return@AsyncFunction
        }

        // Try official Telephony URI first, fall back to string URI
        val messages = try {
          querySmsUri(Telephony.Sms.CONTENT_URI)
        } catch (e: Exception) {
          querySmsUri(Uri.parse("content://sms"))
        }

        // Group into threads by threadId (canonical Android grouping)
        // Fall back to grouping by address if threadId is blank
        val threadMap = LinkedHashMap<String, MutableMap<String, Any>>()

        messages.forEach { msg ->
          val threadId = (msg["threadId"] as? String)?.takeIf { it.isNotBlank() }
            ?: (msg["address"] as? String) ?: "unknown"
          val address     = msg["address"] as? String ?: ""
          val contactName = msg["contactName"] as? String ?: ""
          val body        = msg["body"] as? String ?: ""
          val date        = msg["date"] as? Long ?: 0L
          val type        = msg["type"] as? Int ?: 1
          val read        = msg["read"] as? Int ?: 1

          if (threadMap.containsKey(threadId)) {
            val thread = threadMap[threadId]!!
            @Suppress("UNCHECKED_CAST")
            val msgs = thread["messages"] as MutableList<Map<String, Any>>
            msgs.add(msg)

            // Track unread count
            if (type == 1 && read == 0) {
              thread["unreadCount"] = ((thread["unreadCount"] as? Int) ?: 0) + 1
            }
          } else {
            // First (= latest) message in thread
            threadMap[threadId] = mutableMapOf(
              "threadId"    to threadId,
              "address"     to address,
              "contactName" to contactName,
              "latestBody"  to body,
              "latestDate"  to date,
              "latestType"  to type,
              "unreadCount" to (if (type == 1 && read == 0) 1 else 0),
              "messages"    to mutableListOf(msg)
            )
          }
        }

        val threads = threadMap.values.toList()

        promise.resolve(
          mapOf("threads" to threads, "error" to null)
        )
      } catch (e: Exception) {
        promise.resolve(
          mapOf("threads" to emptyList<Any>(), "error" to (e.message ?: "Unknown error"))
        )
      }
    }

    // ─── sendSmsDirect ─────────────────────────────────────────────────────
    AsyncFunction("sendSmsDirect") { phoneNumber: String, messageContent: String, promise: Promise ->
      try {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS)
          != PackageManager.PERMISSION_GRANTED) {
          promise.reject("ERR_PERMISSION_DENIED", "SEND_SMS permission not granted", null)
          return@AsyncFunction
        }

        val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          context.getSystemService(SmsManager::class.java) ?: @Suppress("DEPRECATION") SmsManager.getDefault()
        } else {
          @Suppress("DEPRECATION")
          SmsManager.getDefault()
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
          PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        else
          PendingIntent.FLAG_UPDATE_CURRENT

        val sentPI = PendingIntent.getBroadcast(
          context, System.currentTimeMillis().toInt(),
          Intent("expo.modules.smsinbox.SMS_SENT"),
          flags
        )

        if (messageContent.length > 160) {
          val parts = smsManager.divideMessage(messageContent)
          val pis = ArrayList<PendingIntent>(parts.size).apply {
            repeat(parts.size) { add(sentPI) }
          }
          smsManager.sendMultipartTextMessage(phoneNumber, null, parts, pis, null)
        } else {
          smsManager.sendTextMessage(phoneNumber, null, messageContent, sentPI, null)
        }

        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("ERR_SEND_SMS", e.message ?: "Failed to send SMS", e)
      }
    }

    // ─── startSmsListener ──────────────────────────────────────────────────
    // Hook the companion-object callback on SmsManifestReceiver.
    // Also drains any pending SMS queued while app was in background.
    Function("startSmsListener") {
      SmsManifestReceiver.onSmsReceived = { address, body, timestamp ->
        val contactName = resolveContactName(address)
        sendEvent(
          "onNewSmsReceived", mapOf(
            "id"          to "live_${System.currentTimeMillis()}",
            "threadId"    to "",   // will be resolved on JS re-fetch
            "address"     to address,
            "contactName" to (contactName ?: ""),
            "body"        to body,
            "date"        to timestamp,
            "type"        to 1,
            "read"        to 0
          )
        )
      }

      // Drain background queue
      val pending = SmsManifestReceiver.pendingQueue.toList()
      SmsManifestReceiver.pendingQueue.clear()
      pending.forEach { (address, body, ts) ->
        val name = resolveContactName(address)
        sendEvent(
          "onNewSmsReceived", mapOf(
            "id"          to "queued_${ts}_${address.hashCode()}",
            "threadId"    to "",
            "address"     to address,
            "contactName" to (name ?: ""),
            "body"        to body,
            "date"        to ts,
            "type"        to 1,
            "read"        to 0
          )
        )
      }
    }

    // ─── stopSmsListener ───────────────────────────────────────────────────
    Function("stopSmsListener") {
      SmsManifestReceiver.onSmsReceived = null
    }

    // ─── Lifecycle ─────────────────────────────────────────────────────────
    OnDestroy {
      SmsManifestReceiver.onSmsReceived = null
      contactCache.clear()
    }
  }
}
