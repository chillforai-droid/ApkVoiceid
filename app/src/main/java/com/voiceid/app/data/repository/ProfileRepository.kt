package com.voiceid.app.data.repository

import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.voiceid.app.BuildConfig
import com.voiceid.app.data.model.Profile
import com.voiceid.app.data.remote.SupabaseModule
import io.github.jan.supabase.postgrest.from
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

private data class CloudinarySignResponse(
    @SerializedName("signature") val signature: String,
    @SerializedName("apiKey") val apiKey: String
)

private data class CloudinaryUploadResponse(
    @SerializedName("secure_url") val secureUrl: String
)

/**
 * Implements API_REFERENCE.md §1.6 + BACKEND_README.md §7.5: avatar upload is a SEPARATE
 * system from B2 media (Cloudinary), signed server-side, uploaded directly from the client.
 */
class ProfileRepository {

    private val client = SupabaseModule.client()
    private val http = OkHttpClient()
    private val gson = Gson()

    suspend fun updateProfile(displayName: String?, bio: String?, avatarUrl: String?) {
        val userId = SupabaseModule.currentUserId() ?: throw AuthException("Not authenticated")
        client.from("profiles").update({
            displayName?.let { set("display_name", it) }
            bio?.let { set("bio", it) }
            avatarUrl?.let { set("avatar_url", it) }
        }) {
            filter { eq("id", userId) }
        }
    }

    fun uploadAvatar(file: File, cloudName: String): String {
        val userId = SupabaseModule.currentUserId() ?: throw AuthException("Not authenticated")
        val timestamp = System.currentTimeMillis() / 1000
        val folder = "voiceid/avatars"

        val signJson = gson.toJson(
            mapOf("timestamp" to timestamp, "folder" to folder, "public_id" to userId)
        )
        val signRequest = Request.Builder()
            .url("${BuildConfig.API_BASE_URL}/api/cloudinary-sign")
            .header("Content-Type", "application/json")
            .post(signJson.toRequestBody("application/json".toMediaTypeOrNull()))
            .build()

        val signResponse: CloudinarySignResponse = http.newCall(signRequest).execute().use { resp ->
            if (!resp.isSuccessful) throw AuthException("Failed to sign avatar upload")
            gson.fromJson(resp.body?.string(), CloudinarySignResponse::class.java)
        }

        val multipart = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("file", file.name, file.asRequestBody("image/*".toMediaTypeOrNull()))
            .addFormDataPart("signature", signResponse.signature)
            .addFormDataPart("api_key", signResponse.apiKey)
            .addFormDataPart("timestamp", timestamp.toString())
            .addFormDataPart("folder", folder)
            .addFormDataPart("public_id", userId)
            .build()

        val uploadRequest = Request.Builder()
            .url("https://api.cloudinary.com/v1_1/$cloudName/image/upload")
            .post(multipart)
            .build()

        val uploadResponse: CloudinaryUploadResponse = http.newCall(uploadRequest).execute().use { resp ->
            if (!resp.isSuccessful) throw AuthException("Avatar upload failed")
            gson.fromJson(resp.body?.string(), CloudinaryUploadResponse::class.java)
        }

        return uploadResponse.secureUrl
    }
}
