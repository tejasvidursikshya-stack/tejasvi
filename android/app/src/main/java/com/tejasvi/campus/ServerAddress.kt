package com.tejasvi.campus

import java.net.URI

object ServerAddress {
    fun normalize(raw: String, allowLocal: Boolean): String {
        val uri = try { URI(raw.trim()) } catch (_: Exception) { throw IllegalArgumentException("Enter a complete server address.") }
        require(!uri.host.isNullOrBlank() && uri.rawUserInfo == null && uri.rawQuery == null && uri.rawFragment == null && uri.path.orEmpty() in listOf("", "/")) { "Use the server address only, such as https://campus.example.com." }
        require(uri.scheme == "https" || (allowLocal && uri.scheme == "http" && uri.host in listOf("localhost", "127.0.0.1"))) { "Use HTTPS. This testing build also accepts localhost over USB." }
        require(uri.port == -1 || uri.port in 1..65535) { "Check the server port." }
        return "${uri.scheme}://${uri.host.lowercase()}${if (uri.port == -1) "" else ":${uri.port}"}"
    }
}
