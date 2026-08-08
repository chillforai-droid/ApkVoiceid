package com.voiceid.app.data.remote

import com.google.gson.annotations.SerializedName
import com.voiceid.app.BuildConfig
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.util.concurrent.TimeUnit

data class UploadResponse(@SerializedName("objectKey") val objectKey: String)
data class UploadAuthResponse(
    @SerializedName("url") val url: String,
    @SerializedName("objectKey") val objectKey: String
)
data class DownloadAuthResponse(@SerializedName("url") val url: String)
data class SimpleSuccess(@SerializedName("success") val success: Boolean)
data class ApiErrorBody(
    @SerializedName("error") val error: String?,
    @SerializedName("stage") val stage: String? = null,
    @SerializedName("message") val message: String? = null
)

class MediaApiException(val code: Int, val body: ApiErrorBody?) :
    Exception(body?.error ?: "Media API error ($code)")

/**
 * Thin client for the frozen `/api/media` endpoints contract documented in API_REFERENCE.md §1.
 * This talks to the EXISTING VoiceID backend (Express/Vercel handlers) — it does not
 * reimplement any server logic. Base URL points at the deployed backend (BuildConfig.API_BASE_URL).
 */
class MediaApi(private val baseUrl: String = BuildConfig.API_BASE_URL) {

    private val http = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private val gson = com.google.gson.Gson()

    private fun authHeader(token: String) = "Bearer $token"

    /** POST /api/media/upload — raw binary body, matches API_REFERENCE.md §1.1 exactly. */
    fun uploadRaw(token: String, file: File, mimeType: String): UploadResponse {
        val body = file.asRequestBody(mimeType.toMediaTypeOrNull())
        val request = Request.Builder()
            .url("$baseUrl/api/media/upload")
            .header("Authorization", authHeader(token))
            .header("Content-Type", mimeType)
            .post(body)
            .build()
        return execute(request, UploadResponse::class.java)
    }

    /** POST /api/media/upload-auth — presigned direct-to-B2 PUT URL, §1.2. Preferred for large files. */
    fun requestUploadAuth(token: String, mimeType: String): UploadAuthResponse {
        val json = gson.toJson(mapOf("mimeType" to mimeType))
        val request = Request.Builder()
            .url("$baseUrl/api/media/upload-auth")
            .header("Authorization", authHeader(token))
            .header("Content-Type", "application/json")
            .post(json.toRequestBody("application/json".toMediaTypeOrNull()))
            .build()
        return execute(request, UploadAuthResponse::class.java)
    }

    /** Direct PUT of raw bytes to the presigned B2 URL returned above. */
    fun putToPresignedUrl(url: String, file: File, mimeType: String) {
        val body = file.asRequestBody(mimeType.toMediaTypeOrNull())
        val request = Request.Builder()
            .url(url)
            .header("Content-Type", mimeType)
            .put(body)
            .build()
        http.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) throw MediaApiException(resp.code, null)
        }
    }

    /** POST /api/media/download-auth — presigned GET URL, §1.3. */
    fun requestDownloadAuth(token: String, messageId: String): DownloadAuthResponse {
        val json = gson.toJson(mapOf("messageId" to messageId))
        val request = Request.Builder()
            .url("$baseUrl/api/media/download-auth")
            .header("Authorization", authHeader(token))
            .header("Content-Type", "application/json")
            .post(json.toRequestBody("application/json".toMediaTypeOrNull()))
            .build()
        return execute(request, DownloadAuthResponse::class.java)
    }

    /** Fetch the actual bytes from a presigned B2 URL. */
    fun downloadBytes(url: String): ByteArray {
        val request = Request.Builder().url(url).get().build()
        http.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) throw MediaApiException(resp.code, null)
            return resp.body?.bytes() ?: ByteArray(0)
        }
    }

    /**
     * POST /api/media/ack — §1.4. Fire-and-forget per API_REFERENCE.md: a 403 here means the
     * caller is the message's own sender, which is expected/non-fatal, not a bug to retry.
     */
    fun ackDelivery(token: String, messageId: String) {
        try {
            val json = gson.toJson(mapOf("messageId" to messageId))
            val request = Request.Builder()
                .url("$baseUrl/api/media/ack")
                .header("Authorization", authHeader(token))
                .header("Content-Type", "application/json")
                .post(json.toRequestBody("application/json".toMediaTypeOrNull()))
                .build()
            http.newCall(request).execute().close()
        } catch (_: Exception) {
            // best-effort cleanup signal only, per API_REFERENCE.md §1.4 — never surfaced to the user
        }
    }

    /** DELETE /api/media/delete/:objectKey — §1.5, called after the messages row is already deleted. */
    fun deleteObject(token: String, objectKey: String) {
        val request = Request.Builder()
            .url("$baseUrl/api/media/delete/$objectKey")
            .header("Authorization", authHeader(token))
            .delete()
            .build()
        http.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) throw MediaApiException(resp.code, null)
        }
    }

    private fun <T> execute(request: Request, clazz: Class<T>): T {
        http.newCall(request).execute().use { resp ->
            val bodyStr = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                val errorBody = runCatching { gson.fromJson(bodyStr, ApiErrorBody::class.java) }.getOrNull()
                throw MediaApiException(resp.code, errorBody)
            }
            return gson.fromJson(bodyStr, clazz)
        }
    }
}
