package com.tejasvi.campus

import android.app.Application
import android.net.Uri
import android.provider.OpenableColumns
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset

data class LearningTask(val course: JSONObject, val data: JSONObject, val submissions: List<JSONObject>, val staff: Boolean)
data class QuizScreen(val title: String, val questions: List<JSONObject>, val revision: String, val unitId: String? = null)

class CampusViewModel(app: Application): AndroidViewModel(app) {
    val api = ApiClient(app.cacheDir,SessionStore(app))
    var signedIn by mutableStateOf(api.saved != null); private set
    var loaded by mutableStateOf(false); private set
    var user by mutableStateOf(JSONObject()); private set
    var organizations by mutableStateOf(emptyList<JSONObject>()); private set
    var organization by mutableStateOf(JSONObject()); private set
    var workspace by mutableStateOf(JSONObject()); private set
    var journey by mutableStateOf(JSONObject()); private set
    var tasks by mutableStateOf(emptyList<LearningTask>()); private set
    var busy by mutableStateOf(false); private set
    var error by mutableStateOf(""); private set
    var notice by mutableStateOf(""); private set
    var tab by mutableStateOf("Home")
    var route by mutableStateOf("main")
    var course by mutableStateOf(JSONObject()); private set
    var units by mutableStateOf(emptyList<JSONObject>()); private set
    var resources by mutableStateOf(emptyList<JSONObject>()); private set
    var lesson by mutableStateOf(JSONObject()); private set
    var unit by mutableStateOf<JSONObject?>(null); private set
    var taskId by mutableStateOf(""); private set
    var quiz by mutableStateOf<QuizScreen?>(null); private set
    var picked by mutableStateOf<PickedFile?>(null); private set
    private var draftJob: Job? = null
    val staff get() = organization.s("role") in listOf("admin","teacher")
    val currentTask get() = tasks.find { it.data.s("id")==taskId }
    val courses get() = workspace.objects("courses")
    val reports get() = journey.objects("rows")
    init { if(signedIn) launch { bootstrap() } }
    private fun launch(work: suspend () -> Unit) {
        if(busy)return
        busy=true; error=""; notice=""
        viewModelScope.launch { try { work() } catch(e: Exception) {
            if(e is ApiError && e.status==401 && api.saved==null) { signedIn=false; loaded=false; clearMemory() }
            error = when(e) { is ApiError,is IllegalArgumentException -> e.message.orEmpty(); else -> "Could not connect. Check the server and internet connection, then retry. Your saved work is still here." }
        } finally { busy=false } }
    }
    fun dismiss() { error=""; notice="" }
    fun message(text: String) { notice=text }
    fun signIn(server: String,email: String,password: String) = launch {
        val base=api.checkServer(server); api.login(base,email,password); signedIn=true; bootstrap()
    }
    private suspend fun bootstrap() {
        val data=api.get("bootstrap"); user=data.getJSONObject("user"); organizations=data.objects("organizations")
        if(!user.optBoolean("mustChangePassword")&&organizations.isNotEmpty()) {
            val prior=api.store.read("workspace")?.s("id"); organization=organizations.find { it.s("id")==prior }?:organizations.first(); loadWorkspace()
        }; loaded=true
    }
    private suspend fun loadWorkspace() {
        val id=organization.s("id"); api.store.write("workspace",obj("id" to id))
        workspace=api.get("workspace?org=$id"); journey=api.get("progress?org=$id")
        val next=mutableListOf<LearningTask>()
        for(c in courses) { val result=api.get("assessments?course=${c.s("id")}&all=1");
            for(a in result.objects("assessments"))next+=LearningTask(c,a,result.objects("submissions").filter { it.s("assessment_id")==a.s("id") },result.optBoolean("staff"))
        }; tasks=next
    }
    fun refresh() = launch { if(!loaded)bootstrap() else { loadWorkspace(); if(route in listOf("course","lesson"))loadCourse(course.s("id")) }; notice="Updated from your institution." }
    fun switchOrganization(id: String) = launch {
        organization=organizations.first { it.s("id")==id }; workspace=JSONObject(); journey=JSONObject(); tasks=emptyList(); api.clearFiles(); route="main"; tab="Home"; loadWorkspace()
    }
    fun changePassword(current: String,replacement: String) = launch { api.changePassword(current,replacement); bootstrap(); notice="Password updated. Other signed-in sessions have been revoked." }
    fun signOut() = launch {
        draftJob?.cancel(); val revoked=api.logout(); signedIn=false; loaded=false; clearMemory()
        if(!revoked)notice="Signed out on this device. The server could not be reached to revoke the session; change your password on the web to revoke all devices."
    }
    private fun clearMemory() { user=JSONObject(); organization=JSONObject(); organizations=emptyList(); workspace=JSONObject(); journey=JSONObject(); tasks=emptyList(); course=JSONObject(); units=emptyList(); resources=emptyList(); lesson=JSONObject(); unit=null; quiz=null; picked=null; taskId=""; tab="Home"; route="main" }
    private suspend fun loadCourse(id: String) {
        course=courses.find { it.s("id")==id }?:throw IllegalArgumentException("This course is no longer available. Refresh your learning list.")
        units=api.get("units?course=$id").objects("units"); resources=api.get("resources?course=$id").objects("materials")
    }
    fun openCourse(id: String) = launch { loadCourse(id); route="course" }
    fun openLesson(item: JSONObject,isUnit: Boolean) {
        if(busy)return
        lesson=item; unit=if(isUnit)item else null; route="lesson"
    }
    fun markRead() = launch {
        val u=unit
        if(u==null)api.post("learning",obj("action" to "complete-lesson","orgId" to organization.s("id"),"courseId" to course.s("id"),"lessonId" to lesson.s("id")))
        else api.post("units",obj("action" to "complete","unitId" to u.s("id")))
        loadWorkspace(); loadCourse(course.s("id")); notice="Reading progress saved."; route="course"
    }
    fun courseQuiz() {
        val q=workspace.objects("quizzes").find { it.s("id")==course.s("quizId") }?:return
        quiz=QuizScreen(q.s("title"),q.objects("questions"),q.s("updatedAt")); route="quiz"
    }
    fun unitQuiz(u: JSONObject) { quiz=QuizScreen(u.s("title")+" · quiz",u.objects("quiz"),u.s("quizRevision"),u.s("id")); route="quiz" }
    fun submitQuiz(answers: List<Int>) = launch {
        val q=quiz?:return@launch
        val result=if(q.unitId!=null)api.post("units",obj("action" to "quiz","unitId" to q.unitId,"quizRevision" to q.revision,"answers" to JSONArray(answers)))
        else api.post("learning",obj("action" to "submit-quiz","orgId" to organization.s("id"),"courseId" to course.s("id"),"quizRevision" to q.revision,"answers" to JSONArray(answers)))
        loadWorkspace(); loadCourse(course.s("id")); route="course"; notice="Quiz saved · ${result.optInt("score")}% · ${if(result.optBoolean("passed"))"Passed" else "Review the lesson and try again"}"
    }
    fun openTask(task: LearningTask) { if(busy)return; taskId=task.data.s("id"); picked=null; route="task" }
    private fun draftKey()="draft:${user.s("userId")}:${organization.s("id")}:$taskId"
    fun draft()=api.store.read(draftKey())
    fun saveDraft(body: String,link: String) {
        val key=draftKey(); draftJob?.cancel(); draftJob=viewModelScope.launch(Dispatchers.IO) {
            delay(350)
            try { api.store.write(key,obj("body" to body,"link" to link)) }
            catch(_:Exception) { withContext(Dispatchers.Main) { error="This draft could not be saved on the device. Copy your answer before closing the app." } }
        }
    }
    fun chooseFile(uri: Uri) = launch {
        picked=withContext(Dispatchers.IO) {
            val resolver=getApplication<Application>().contentResolver
            val name=resolver.query(uri,arrayOf(OpenableColumns.DISPLAY_NAME),null,null,null)?.use { if(it.moveToFirst())it.getString(0) else null } ?: "document"
            val mime=when(name.substringAfterLast('.').lowercase()) { "pdf"->"application/pdf"; "docx"->"application/vnd.openxmlformats-officedocument.wordprocessingml.document"; "pptx"->"application/vnd.openxmlformats-officedocument.presentationml.presentation"; else->throw IllegalArgumentException("Choose a PDF, DOCX or PPTX file.") }
            val bytes=resolver.openInputStream(uri)?.use { input -> val out=ByteArrayOutputStream(); val buffer=ByteArray(8192); var total=0; while(true) { val n=input.read(buffer); if(n<0)break; total+=n; require(total<=5*1024*1024) { "Choose a file up to 5 MB." }; out.write(buffer,0,n) }; out.toByteArray() } ?:throw IllegalArgumentException("This file could not be read.")
            require(bytes.isNotEmpty()) { "This file is empty." }; PickedFile(name,mime,bytes)
        }
    }
    fun removePicked() { picked=null }
    fun submitTask(body: String,link: String,version: Int) = launch {
        require(body.trim().isNotEmpty()) { "Write an answer or a short description of your attachment." }
        val data=obj("action" to "submit","assessmentId" to taskId,"body" to body.trim(),"link" to link.trim(),"version" to version)
        picked?.let { data.put("fileId",api.upload(taskId,it).s("id")) }
        api.post("assessments",data); draftJob?.cancel(); api.store.remove(draftKey()); picked=null; loadWorkspace(); route="main"; tab="Tasks"; notice="Submitted. Your teacher can now review your work."
    }
    fun review(submission: JSONObject,feedback: String,score: String,returnDays: Int?) = launch {
        val data=obj("action" to if(returnDays==null)"grade" else "return","assessmentId" to taskId,"submissionId" to submission.s("id"),"version" to submission.optInt("version"),"feedback" to feedback.trim())
        if(returnDays==null) { val mark=score.toIntOrNull()?:throw IllegalArgumentException("Enter a whole-number mark."); data.put("score",mark) }
        else { require(feedback.isNotBlank()) { "Explain what the learner needs to revise." }; data.put("returnedUntil",Instant.now().plusSeconds(returnDays.toLong()*86400).toString()) }
        api.post("assessments",data); loadWorkspace(); notice=if(returnDays==null)"Grade and feedback released to the learner." else "Returned for revision. The new deadline is visible to the learner."
    }
    fun openFile(id: String,name: String,submission: Boolean,onReady: (File)->Unit) = launch {
        val file=api.download(if(submission)"submission-file" else "material",id,name); onReady(file)
    }
    fun back() { if(busy)return; dismiss(); route=when(route) { "lesson","quiz"->"course"; else->"main" }; quiz=null }
}

fun submissionLabel(s: JSONObject?): String = when {
    s==null -> "To do"
    s.s("returned_until").isNotBlank() -> "Revise & resubmit"
    !s.isNull("score") -> "Graded"
    else -> "Awaiting feedback"
}
fun readableDate(value: String): String = try {
    val instant=if(value.endsWith("Z"))Instant.parse(value) else LocalDateTime.parse(value.replace(' ','T')).toInstant(ZoneOffset.UTC)
    java.time.format.DateTimeFormatter.ofPattern("d MMM, h:mm a").withZone(java.time.ZoneId.systemDefault()).format(instant)
} catch (_:Exception) { value.ifBlank { "No deadline" } }
