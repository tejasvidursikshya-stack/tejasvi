package com.tejasvi.campus

import android.content.Context
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.io.ByteArrayOutputStream
import java.util.concurrent.TimeUnit

fun JSONObject.s(key: String): String = if (isNull(key)) "" else optString(key, "")
fun JSONObject.objects(key: String): List<JSONObject> = optJSONArray(key)?.let { a -> (0 until a.length()).mapNotNull { a.optJSONObject(it) } } ?: emptyList()
fun JSONObject.strings(key: String): List<String> = optJSONArray(key)?.let { a -> (0 until a.length()).map { a.optString(it) } } ?: emptyList()
fun obj(vararg pairs: Pair<String, Any?>): JSONObject = JSONObject().apply { pairs.forEach { (k,v) -> put(k, v ?: JSONObject.NULL) } }
class ApiError(val status: Int, message: String): IOException(message)
data class PickedFile(val name: String, val mime: String, val bytes: ByteArray)

class ApiClient(private val cacheRoot: File, val store: DeviceStore) {
    private val client = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).readTimeout(45, TimeUnit.SECONDS)
        .callTimeout(60, TimeUnit.SECONDS).followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false).build()
    private val refreshLock = Any()
    val saved: JSONObject? get() = store.read("session")
    val server: String get() = saved?.s("server").orEmpty()
    private fun request(base: String, path: String, token: String?, body: RequestBody?): Request = Request.Builder()
        .url("$base/api/mobile/v1/$path").apply { if (!token.isNullOrEmpty()) header("Authorization", "Bearer $token"); if (body != null) post(body) }
        .header("Accept", "application/json").build()
    private fun jsonBody(value: JSONObject) = value.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
    private fun execute(base: String, path: String, token: String?, body: RequestBody?): JSONObject {
        client.newCall(request(base,path,token,body)).execute().use { response ->
            val source = response.body ?: throw IOException("The server returned no response.")
            val bytes = source.byteStream().use { input ->
                val out=ByteArrayOutputStream(); val buffer=ByteArray(8192); var total=0
                while(true) { val n=input.read(buffer); if(n<0)break; total+=n; if(total>4*1024*1024)throw IOException("This response is too large. Open this workspace on the web."); out.write(buffer,0,n) }; out.toByteArray()
            }
            val data = try { JSONObject(String(bytes, Charsets.UTF_8)) } catch (_: Exception) { JSONObject() }
            if (!response.isSuccessful) throw ApiError(response.code, data.s("error").ifBlank { if (response.isRedirect) "Use the server's final HTTPS address; redirects are not followed." else "The server could not complete this request (${response.code})." })
            return data
        }
    }
    suspend fun checkServer(raw: String): String = withContext(Dispatchers.IO) {
        val base = ServerAddress.normalize(raw, BuildConfig.DEBUG)
        val info = try { execute(base,"status",null,null) } catch(e:ApiError) {
            if(e.status==404)throw IllegalArgumentException("Update your Tejasvi server to 3.10.0 before connecting this app."); throw e
        }
        require(info.optInt("mobileApi") == 1 && info.s("product") == "Tejasvi Campus") { "Update your Tejasvi server to 3.10.0 before connecting." }; base
    }
    suspend fun login(base: String, email: String, password: String) = withContext(Dispatchers.IO) {
        val result = execute(base,"auth/login",null,jsonBody(obj("email" to email.trim(), "password" to password, "deviceName" to "${Build.MANUFACTURER} ${Build.MODEL}".take(100))))
        store.clear(); store.write("session", result.put("server",base)); result
    }
    private fun authorized(path: String, body: RequestBody?): JSONObject {
        val session = saved ?: throw ApiError(401,"Please sign in again.")
        try { return execute(session.s("server"),path,session.s("accessToken"),body) }
        catch (e: ApiError) { if (e.status != 401) throw e }
        val renewed = refresh(session)
        return execute(renewed.s("server"),path,renewed.s("accessToken"),body)
    }
    private fun refresh(old: JSONObject): JSONObject = synchronized(refreshLock) {
        val now = saved ?: throw ApiError(401,"Please sign in again.")
        if (now.s("refreshToken") != old.s("refreshToken")) return@synchronized now
        try {
            val renewed = execute(now.s("server"),"auth/refresh",null,jsonBody(obj("refreshToken" to now.s("refreshToken")))).put("server",now.s("server"))
            store.write("session",renewed); renewed
        } catch (e: ApiError) { if (e.status == 401) store.clear(); throw e }
    }
    suspend fun get(path: String) = withContext(Dispatchers.IO) { authorized(path,null) }
    suspend fun post(path: String, data: JSONObject) = withContext(Dispatchers.IO) { authorized(path,jsonBody(data)) }
    suspend fun changePassword(current: String, replacement: String) = withContext(Dispatchers.IO) {
        val base = server
        val result = authorized("auth/change-password",jsonBody(obj("currentPassword" to current,"newPassword" to replacement,"deviceName" to Build.MODEL.take(100))))
        store.write("session",result.put("server",base)); result
    }
    suspend fun upload(assessment: String, file: PickedFile): JSONObject = withContext(Dispatchers.IO) {
        require(file.bytes.size in 1..5*1024*1024) { "Choose a PDF, DOCX or PPTX up to 5 MB." }
        authorized("submission-file",MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("assessmentId",assessment).addFormDataPart("file",file.name,file.bytes.toRequestBody(file.mime.toMediaType())).build())
    }
    suspend fun download(path: String, id: String, name: String): File = withContext(Dispatchers.IO) {
        fun fetch(session: JSONObject): File {
            client.newCall(request(session.s("server"),"$path?id=$id",session.s("accessToken"),null)).execute().use { response ->
                if (!response.isSuccessful) throw ApiError(response.code, "This file could not be opened (${response.code}).")
                val folder = File(cacheRoot,"learning-files").apply { mkdirs() }
                val original=Regex("filename=\"([^\"]+)\"").find(response.header("Content-Disposition").orEmpty())?.groupValues?.get(1)?:name
                val safeName = original.replace(Regex("[^a-zA-Z0-9._ -]"),"_").take(150).ifBlank { "learning-file" }
                val file = File(folder,"${id.take(36)}-$safeName")
                try { response.body!!.byteStream().use { input -> file.outputStream().use { out ->
                    var count=0; val buffer=ByteArray(8192); while(true) { val n=input.read(buffer); if(n<0)break; count+=n; if(count>30*1024*1024)throw IOException("This file exceeds the mobile download limit."); out.write(buffer,0,n) }
                } }; return file } catch(e: Exception) { file.delete(); throw e }
            }
        }
        val session=saved ?: throw ApiError(401,"Please sign in again.")
        try { fetch(session) } catch(e: ApiError) { if(e.status!=401)throw e; fetch(refresh(session)) }
    }
    fun clearFiles() { File(cacheRoot,"learning-files").deleteRecursively() }
    suspend fun logout(): Boolean = withContext(Dispatchers.IO) {
        val session=saved
        val revoked=try { if(session!=null)execute(session.s("server"),"auth/logout",null,jsonBody(obj("refreshToken" to session.s("refreshToken")))); true } catch (_: Exception) { false }
        store.clear(); clearFiles(); revoked
    }
}
