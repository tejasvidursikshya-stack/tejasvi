package com.tejasvi.campus

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

interface DeviceStore {
    fun read(name: String): JSONObject?
    fun write(name: String, value: JSONObject)
    fun remove(name: String)
    fun clear()
}
// A rotating token must reach disk before subsequent requests use it. Calls
// which write credentials or drafts run on Dispatchers.IO, so commit is intentional.
@android.annotation.SuppressLint("ApplySharedPref", "UseKtx")
class SessionStore(context: Context): DeviceStore {
    private val prefs = context.getSharedPreferences("tejasvi_private", Context.MODE_PRIVATE)
    private val alias = "tejasvi_device_session_v1"
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    @Synchronized override fun read(name: String): JSONObject? {
        val saved = prefs.getString(name, null) ?: return null
        return try {
            val parts = saved.split(":")
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)))
            JSONObject(String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), Charsets.UTF_8))
        } catch (_: Exception) { prefs.edit().remove(name).commit(); null }
    }
    @Synchronized override fun write(name: String, value: JSONObject) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val encrypted = cipher.doFinal(value.toString().toByteArray(Charsets.UTF_8))
        check(prefs.edit().putString(name, Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(encrypted, Base64.NO_WRAP)).commit()) { "Could not securely save this device session." }
    }
    override fun remove(name: String) { prefs.edit().remove(name).commit() }
    override fun clear() { prefs.edit().clear().commit() }
}
