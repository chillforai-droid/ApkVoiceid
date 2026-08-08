package com.voiceid.app.media

import android.content.Context
import java.io.File

/**
 * File-based local cache for downloaded/recorded media blobs, keyed by messageId — the
 * Android equivalent of src/lib/MediaCache.ts (IndexedDB in the web client). Ensures the
 * sender always has an instant local copy of their own message (BACKEND_README.md §7.1 step 5)
 * and recipients don't re-download media they've already cached (§7.3 step 1).
 */
class MediaCache(context: Context) {
    private val dir = File(context.cacheDir, "media_cache").apply { mkdirs() }

    fun has(messageId: String): Boolean = fileFor(messageId).exists()

    fun get(messageId: String): File? = fileFor(messageId).takeIf { it.exists() }

    fun put(messageId: String, bytes: ByteArray): File {
        val file = fileFor(messageId)
        file.writeBytes(bytes)
        return file
    }

    fun putFile(messageId: String, source: File): File {
        val dest = fileFor(messageId)
        source.copyTo(dest, overwrite = true)
        return dest
    }

    fun remove(messageId: String) {
        fileFor(messageId).delete()
    }

    private fun fileFor(messageId: String) = File(dir, messageId)
}
