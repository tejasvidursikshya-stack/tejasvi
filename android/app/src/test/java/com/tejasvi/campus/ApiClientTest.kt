package com.tejasvi.campus

import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.nio.file.Files
import java.util.concurrent.atomic.AtomicInteger

private class MemoryStore:DeviceStore {
    private val data=mutableMapOf<String,String>()
    @Synchronized override fun read(name:String)=data[name]?.let{JSONObject(it)}
    @Synchronized override fun write(name:String,value:JSONObject){data[name]=value.toString()}
    @Synchronized override fun remove(name:String){data.remove(name)}
    @Synchronized override fun clear(){data.clear()}
}
class ApiClientTest {
    @Test fun concurrentExpiredRequestsRotateOnlyOnce()=runBlocking {
        val server=MockWebServer(); val rotations=AtomicInteger(0)
        server.dispatcher=object:Dispatcher(){override fun dispatch(request:RecordedRequest):MockResponse {
            if(request.path=="/api/mobile/v1/auth/refresh") {
                rotations.incrementAndGet(); assertTrue(request.body.readUtf8().contains("refresh-old"))
                return MockResponse().setBody("{\"accessToken\":\"access-new\",\"refreshToken\":\"refresh-new\"}")
            }
            return if(request.getHeader("Authorization")=="Bearer access-new")MockResponse().setBody("{\"ok\":true}")else MockResponse().setResponseCode(401).setBody("{\"error\":\"Expired\"}")
        }};server.start()
        val folder=Files.createTempDirectory("tejasvi-native-test").toFile()
        try {
            val store=MemoryStore();store.write("session",obj("server" to server.url("/").toString().trimEnd('/'),"accessToken" to "access-old","refreshToken" to "refresh-old"))
            val api=ApiClient(folder,store)
            val results=listOf(async{api.get("bootstrap")},async{api.get("workspace?org=one")}).awaitAll()
            assertTrue(results.all{it.optBoolean("ok")});assertEquals(1,rotations.get());assertEquals("refresh-new",store.read("session")!!.s("refreshToken"))
        }finally{server.shutdown();folder.deleteRecursively()}
    }
    @Test fun refusedMutationDoesNotSilentlyRetryOrEraseDraft()=runBlocking {
        val server=MockWebServer();server.enqueue(MockResponse().setResponseCode(409).setBody("{\"error\":\"Submission changed\"}"));server.start()
        val folder=Files.createTempDirectory("tejasvi-native-test").toFile()
        try{
            val store=MemoryStore();store.write("session",obj("server" to server.url("/").toString().trimEnd('/'),"accessToken" to "valid","refreshToken" to "refresh"));store.write("draft",obj("body" to "My work"))
            val api=ApiClient(folder,store)
            try{api.post("assessments",obj("version" to 2));fail("Expected version conflict")}catch(e:ApiError){assertEquals(409,e.status)}
            assertEquals(1,server.requestCount);assertEquals("My work",store.read("draft")!!.s("body"))
        }finally{server.shutdown();folder.deleteRecursively()}
    }
    @Test fun redirectIsNotFollowedAndRevokedRefreshClearsCredentials()=runBlocking {
        val server=MockWebServer();server.start();val folder=Files.createTempDirectory("tejasvi-native-test").toFile()
        try{
            val store=MemoryStore();store.write("session",obj("server" to server.url("/").toString().trimEnd('/'),"accessToken" to "valid","refreshToken" to "revoked"));val api=ApiClient(folder,store)
            server.enqueue(MockResponse().setResponseCode(302).setHeader("Location","https://other.example/collect"))
            try{api.get("bootstrap");fail("Expected redirect rejection")}catch(e:ApiError){assertEquals(302,e.status)};assertEquals(1,server.requestCount)
            server.enqueue(MockResponse().setResponseCode(401).setBody("{\"error\":\"Expired\"}"));server.enqueue(MockResponse().setResponseCode(401).setBody("{\"error\":\"Revoked\"}"))
            try{api.get("bootstrap");fail("Expected revoked session")}catch(e:ApiError){assertEquals(401,e.status)};assertNull(store.read("session"))
        }finally{server.shutdown();folder.deleteRecursively()}
    }
}
