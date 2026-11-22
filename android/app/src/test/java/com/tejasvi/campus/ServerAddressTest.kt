package com.tejasvi.campus
import org.junit.Assert.*
import org.junit.Test

class ServerAddressTest {
    @Test fun publicServersRequireHttps() {
        assertEquals("https://campus.example.com",ServerAddress.normalize(" https://campus.example.com/ ",false))
        assertEquals("https://campus.example.com:8443",ServerAddress.normalize("https://campus.example.com:8443",false))
        listOf("http://campus.example.com","https://user:secret@campus.example.com","https://campus.example.com/login","https://campus.example.com?key=secret","file:///etc/passwd","https://campus.example.com#part","https://campus.example.com:99999").forEach { value->assertThrows(IllegalArgumentException::class.java){ServerAddress.normalize(value,false)} }
    }
    @Test fun debugAllowsOnlyLoopbackHttp() {
        assertEquals("http://localhost:3000",ServerAddress.normalize("http://localhost:3000",true))
        assertEquals("http://127.0.0.1:3000",ServerAddress.normalize("http://127.0.0.1:3000",true))
        listOf("http://localhost.evil.example","http://192.168.1.4:3000","http://localhost:3000@evil.example","http://localhost:3000").forEachIndexed { i,value->assertThrows(IllegalArgumentException::class.java){ServerAddress.normalize(value,i!=3)} }
    }
}
