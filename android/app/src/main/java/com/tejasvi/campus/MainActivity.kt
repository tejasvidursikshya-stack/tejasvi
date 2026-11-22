package com.tejasvi.campus

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.automirrored.outlined.Assignment
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.core.net.toUri
import androidx.lifecycle.viewmodel.compose.viewModel
import org.json.JSONObject
import java.io.File

private val Navy=Color(0xFF112C4B)
private val Blue=Color(0xFF2459E8)
private val Ink=Color(0xFF172F4A)
private val Muted=Color(0xFF596A7E)
private val Canvas=Color(0xFFF4F7FC)
private val Line=Color(0xFFD7DFEA)

class MainActivity: ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle=SystemBarStyle.light(android.graphics.Color.TRANSPARENT,android.graphics.Color.TRANSPARENT),
            navigationBarStyle=SystemBarStyle.light(android.graphics.Color.WHITE,android.graphics.Color.BLACK)
        )
        setContent { TejasviTheme { CampusApp() } }
    }
}

@Composable fun TejasviTheme(content:@Composable ()->Unit) {
    MaterialTheme(colorScheme=lightColorScheme(primary=Blue,onPrimary=Color.White,primaryContainer=Color(0xFFE8EEFF),onPrimaryContainer=Navy,
        secondary=Navy,background=Canvas,surface=Color.White,onSurface=Ink,onSurfaceVariant=Muted,outline=Line,error=Color(0xFFAC302B)),
        typography=Typography(bodyLarge=androidx.compose.ui.text.TextStyle(fontSize=17.sp,lineHeight=27.sp),bodyMedium=androidx.compose.ui.text.TextStyle(fontSize=15.sp,lineHeight=23.sp),
            titleLarge=androidx.compose.ui.text.TextStyle(fontSize=24.sp,lineHeight=31.sp,fontWeight=FontWeight.Bold),titleMedium=androidx.compose.ui.text.TextStyle(fontSize=18.sp,lineHeight=25.sp,fontWeight=FontWeight.SemiBold)),content=content)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun CampusApp(vm:CampusViewModel=viewModel()) {
    BackHandler(enabled=vm.route!="main") { vm.back() }
    val context=LocalContext.current
    val openFile:(File)->Unit={ file ->
        val uri=FileProvider.getUriForFile(context,context.packageName+".files",file)
        val mime=when(file.extension.lowercase()) { "pdf"->"application/pdf"; "docx"->"application/vnd.openxmlformats-officedocument.wordprocessingml.document"; else->"application/vnd.openxmlformats-officedocument.presentationml.presentation" }
        try { context.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri,mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)) }
        catch(_:ActivityNotFoundException) { vm.message("Install a PDF or Office document viewer to open this file.") }
    }
    Scaffold(containerColor=Canvas,topBar={
        if(vm.signedIn&&vm.loaded&&!vm.user.optBoolean("mustChangePassword"))TopAppBar(title={ Column {
            Text(if(vm.route=="main")"Tejasvi" else when(vm.route){"course"->"Course";"lesson"->"Lesson";"quiz"->"Practice quiz";else->"Assignment"},style=MaterialTheme.typography.titleMedium)
            Text(vm.organization.s("name"),style=MaterialTheme.typography.labelMedium,color=Muted,maxLines=1)
        } },navigationIcon={ if(vm.route!="main")IconButton(onClick={vm.back()},enabled=!vm.busy){Icon(Icons.AutoMirrored.Outlined.ArrowBack,"Back")} },
            actions={IconButton(onClick={vm.refresh()},enabled=!vm.busy){Icon(Icons.Outlined.Refresh,"Refresh from institution")}},colors=TopAppBarDefaults.topAppBarColors(containerColor=Canvas))
    },bottomBar={
        if(vm.signedIn&&vm.loaded&&!vm.user.optBoolean("mustChangePassword")&&vm.route=="main"&&vm.organizations.isNotEmpty())NavigationBar(containerColor=Color.White) {
            listOf("Home" to Icons.Outlined.Home,"Learning" to Icons.AutoMirrored.Outlined.MenuBook,"Tasks" to Icons.AutoMirrored.Outlined.Assignment,"Progress" to Icons.Outlined.BarChart,"Account" to Icons.Outlined.PersonOutline).forEach { (title,icon)->
                NavigationBarItem(selected=vm.tab==title,onClick={if(!vm.busy){vm.tab=title;vm.dismiss()}},icon={Icon(icon,null)},label={Text(title,fontSize=11.sp)},alwaysShowLabel=true)
            }
        }
    }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).imePadding()) {
            if(vm.busy)LinearProgressIndicator(Modifier.fillMaxWidth())
            if(vm.error.isNotBlank()||vm.notice.isNotBlank())Surface(color=if(vm.error.isNotBlank())Color(0xFFFFEDEA) else Color(0xFFE8EEFF)) {
                Row(Modifier.fillMaxWidth().padding(start=20.dp,top=12.dp,bottom=12.dp,end=4.dp),verticalAlignment=Alignment.CenterVertically) {
                    Text(vm.error.ifBlank{vm.notice},Modifier.weight(1f),style=MaterialTheme.typography.bodyMedium,color=Ink)
                    IconButton(onClick={vm.dismiss()}) { Icon(Icons.Outlined.Close,"Dismiss message") }
                }
            }
            Box(Modifier.weight(1f).fillMaxWidth(),contentAlignment=Alignment.TopCenter) {
                if(!vm.signedIn)SignIn(vm)
                else if(!vm.loaded)Page { Heading("Connecting your campus","Loading your account and assigned learning."); Primary("Retry",vm.busy){vm.refresh()}; TextButton(onClick={vm.signOut()},enabled=!vm.busy){Text("Sign out")} }
                else if(vm.user.optBoolean("mustChangePassword"))PasswordPage(vm)
                else if(vm.organizations.isEmpty())Page { Heading("Your account is ready","No learning institution is assigned yet. Create or assign your institution on the website, then refresh here.");Primary("Refresh access",vm.busy){vm.refresh()};TextButton(onClick={vm.signOut()}){Text("Sign out")} }
                else when(vm.route) {
                    "course"->CoursePage(vm,openFile)
                    "lesson"->LessonPage(vm)
                    "quiz"->QuizPage(vm)
                    "task"->TaskPage(vm,openFile)
                    else->when(vm.tab) { "Learning"->LearningPage(vm);"Tasks"->TasksPage(vm);"Progress"->ProgressPage(vm);"Account"->AccountPage(vm);else->HomePage(vm) }
                }
            }
        }
    }
}

@Composable private fun Page(content:@Composable ColumnScope.()->Unit) {
    Column(Modifier.widthIn(max=820.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal=20.dp,vertical=24.dp),verticalArrangement=Arrangement.spacedBy(20.dp),content=content)
}
@Composable private fun Heading(title:String,subtitle:String="") { Column(verticalArrangement=Arrangement.spacedBy(8.dp)){Text(title,style=MaterialTheme.typography.headlineMedium,fontWeight=FontWeight.Bold,color=Navy);if(subtitle.isNotBlank())Text(subtitle,color=Muted,style=MaterialTheme.typography.bodyLarge)} }
@Composable private fun Panel(content:@Composable ColumnScope.()->Unit) { Surface(shape=RoundedCornerShape(20.dp),color=Color.White,border=androidx.compose.foundation.BorderStroke(1.dp,Line)){Column(Modifier.fillMaxWidth().padding(20.dp),verticalArrangement=Arrangement.spacedBy(14.dp),content=content)} }
@Composable private fun Primary(text:String,busy:Boolean=false,enabled:Boolean=true,onClick:()->Unit) { Button(onClick=onClick,enabled=enabled&&!busy,shape=RoundedCornerShape(14.dp),contentPadding=PaddingValues(18.dp),modifier=Modifier.fillMaxWidth().heightIn(min=54.dp)){Text(text,fontSize=16.sp,fontWeight=FontWeight.SemiBold)} }
@Composable private fun Eyebrow(text:String) { Text(text.uppercase(),fontSize=11.sp,letterSpacing=1.4.sp,fontWeight=FontWeight.Bold,color=Blue) }
@Composable private fun Empty(title:String,text:String) { Panel { Icon(Icons.AutoMirrored.Outlined.MenuBook,null,tint=Blue,modifier=Modifier.size(32.dp));Text(title,style=MaterialTheme.typography.titleMedium);Text(text,color=Muted) } }
@Composable private fun Field(value:String,onChange:(String)->Unit,label:String,enabled:Boolean=true,lines:Int=1,type:KeyboardType=KeyboardType.Text) {
    OutlinedTextField(value=value,onValueChange=onChange,label={Text(label)},enabled=enabled,modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(13.dp),singleLine=lines==1,minLines=lines,keyboardOptions=KeyboardOptions(keyboardType=type),textStyle=MaterialTheme.typography.bodyLarge)
}
@Composable private fun Password(value:String,onChange:(String)->Unit,label:String="Password",enabled:Boolean=true) {
    var visible by remember { mutableStateOf(false) }
    OutlinedTextField(value=value,onValueChange=onChange,label={Text(label)},enabled=enabled,modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(13.dp),singleLine=true,visualTransformation=if(visible)VisualTransformation.None else PasswordVisualTransformation(),keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Password),trailingIcon={IconButton(onClick={visible=!visible}){Icon(if(visible)Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,if(visible)"Hide password" else "Show password")}})
}

@Composable private fun SignIn(vm:CampusViewModel) {
    var server by rememberSaveable { mutableStateOf(if(BuildConfig.DEBUG)"http://localhost:3000" else "") }
    var email by rememberSaveable { mutableStateOf("") }; var password by remember { mutableStateOf("") }
    Page {
        Spacer(Modifier.height(12.dp))
        Surface(color=Navy,shape=RoundedCornerShape(18.dp)){Text("T",Modifier.padding(horizontal=23.dp,vertical=12.dp),fontSize=32.sp,color=Color.White,fontWeight=FontWeight.Bold)}
        Eyebrow("Tejasvi · Android pilot")
        Heading("Your campus.\nIn your pocket.","Sign in with your existing Tejasvi account to continue learning.")
        Panel {
            Field(server,{server=it},"Campus server address",!vm.busy,type=KeyboardType.Uri)
            Text(if(BuildConfig.DEBUG)"Testing on your Mac? Connect by USB and run Test-Android-USB.command first." else "Use the HTTPS address provided by your institution.",style=MaterialTheme.typography.bodyMedium,color=Muted)
            Field(email,{email=it},"Email address",!vm.busy,type=KeyboardType.Email)
            Password(password,{password=it},enabled=!vm.busy)
            Primary(if(vm.busy)"Connecting…" else "Sign in",vm.busy,email.isNotBlank()&&password.isNotBlank()&&server.isNotBlank()){vm.signIn(server,email,password)}
        }
        Text("Need access or a password reset? Contact your institution administrator.",color=Muted,style=MaterialTheme.typography.bodyMedium)
    }
}
@Composable private fun PasswordPage(vm:CampusViewModel) {
    var old by remember { mutableStateOf("") };var next by remember { mutableStateOf("") };var confirm by remember { mutableStateOf("") }
    Page { Heading("Make this account yours","Change your temporary password before opening your learning workspace.");Panel {
        Password(old,{old=it},"Current password",!vm.busy);Password(next,{next=it},"New password",!vm.busy);Password(confirm,{confirm=it},"Confirm new password",!vm.busy)
        Text("Use 12–128 characters. Your other signed-in sessions will end.",color=Muted)
        Primary("Save password",vm.busy,old.isNotEmpty()&&next.length in 12..128&&next==confirm){vm.changePassword(old,next)}
    };TextButton(onClick={vm.signOut()},enabled=!vm.busy){Text("Sign out")} }
}

@Composable private fun HomePage(vm:CampusViewModel) {
    val waiting=if(vm.staff)vm.tasks.sumOf{t->t.submissions.count{submissionLabel(it)=="Awaiting feedback"}} else vm.tasks.count{t->submissionLabel(t.submissions.firstOrNull()) in listOf("To do","Revise & resubmit")}
    Page {
        Eyebrow(if(vm.staff)"Teaching workspace" else "Your learning workspace")
        Heading("Hello, ${vm.user.s("displayName").substringBefore(' ')}.",if(vm.staff)"Keep your learners moving forward." else "A little progress, every day.")
        Surface(color=Navy,shape=RoundedCornerShape(24.dp)) { Column(Modifier.fillMaxWidth().padding(24.dp),verticalArrangement=Arrangement.spacedBy(16.dp)) {
            Text(if(vm.staff)"Teaching, with a\nclearer view." else "Pick up where\nyou left off.",fontSize=28.sp,lineHeight=34.sp,fontWeight=FontWeight.Bold,color=Color.White)
            Row(horizontalArrangement=Arrangement.spacedBy(30.dp)){Column{Text("${vm.courses.size}",color=Color.White,fontSize=30.sp,fontWeight=FontWeight.Bold);Text("Assigned courses",color=Color(0xFFBACDE8))};Column{Text("$waiting",color=Color.White,fontSize=30.sp,fontWeight=FontWeight.Bold);Text(if(vm.staff)"To review" else "Tasks to do",color=Color(0xFFBACDE8))}}
            FilledTonalButton(onClick={vm.tab=if(vm.staff)"Tasks" else "Learning"},shape=RoundedCornerShape(12.dp)){Text(if(vm.staff)"Review submissions" else "Open my learning");Spacer(Modifier.width(10.dp));Icon(Icons.AutoMirrored.Outlined.ArrowForward,null)}
        } }
        Text(if(vm.staff)"Your courses" else "Continue learning",style=MaterialTheme.typography.titleLarge)
        if(vm.courses.isEmpty())Empty("No courses assigned yet","Your institution will appear here as soon as courses are published and assigned to your account.")
        vm.courses.take(2).forEach { c->CourseCard(vm,c) }
        val feedback=vm.reports.flatMap{r->r.objects("items").filter{it.s("feedback").isNotBlank()}.map{r to it}}.sortedByDescending{it.second.s("gradedAt").ifBlank{it.second.s("submittedAt")}}.take(2)
        if(!vm.staff&&feedback.isNotEmpty()) {
            Text("Latest feedback",style=MaterialTheme.typography.titleLarge)
            feedback.forEach { (r,item) ->
                Panel {
                    Eyebrow(r.s("courseTitle")); Text(item.s("title"),style=MaterialTheme.typography.titleMedium); Text(item.s("feedback"))
                    TextButton(onClick={vm.tab="Progress"}) { Text("View progress") }
                }
            }
        }
    }
}
@Composable private fun CourseCard(vm:CampusViewModel,c:JSONObject) {
    val report=vm.reports.firstOrNull{it.s("courseId")==c.s("id")}
    Panel { Row(verticalAlignment=Alignment.CenterVertically){Icon(Icons.AutoMirrored.Outlined.MenuBook,null,tint=Blue);Spacer(Modifier.width(10.dp));Eyebrow(c.s("audience").ifBlank{"Course"});Spacer(Modifier.weight(1f));if(c.s("status")!="published")Text("Draft",color=Muted,fontSize=12.sp)}
        Text(c.s("title"),style=MaterialTheme.typography.titleLarge);if(c.s("description").isNotBlank())Text(c.s("description"),color=Muted,maxLines=3)
        if(!vm.staff&&report!=null){LinearProgressIndicator(progress={report.optInt("percent")/100f},modifier=Modifier.fillMaxWidth(),color=Blue);Text("${report.optInt("read")} of ${report.optInt("readTotal")} readings completed",color=Muted,fontSize=13.sp)}
        OutlinedButton(onClick={vm.openCourse(c.s("id"))},enabled=!vm.busy,modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(12.dp)){Text("Open course");Spacer(Modifier.width(8.dp));Icon(Icons.AutoMirrored.Outlined.ArrowForward,null,Modifier.size(18.dp))}
    }
}
@Composable private fun LearningPage(vm:CampusViewModel) {
    var query by rememberSaveable{mutableStateOf("")}
    Page {Heading("My learning","Courses assigned by your institution.");Field(query,{query=it},"Find a course")
        val found=vm.courses.filter{it.s("title").contains(query,true)}
        if(found.isEmpty())Empty("No courses to show",if(query.isBlank())"Ask your teacher to publish and assign your courses. Enrolment and access are managed on the website." else "Try another course name.")
        found.forEach{CourseCard(vm,it)}
    }
}
@Composable private fun CoursePage(vm:CampusViewModel,openFile:(File)->Unit) {
    val done=vm.workspace.objects("progress").firstOrNull{it.s("courseId")==vm.course.s("id")&&it.s("email")==vm.user.s("email")}?.strings("lessons").orEmpty()
    Page { Eyebrow(vm.course.s("audience"));Heading(vm.course.s("title"),vm.course.s("description"))
        Text("Lessons & units",style=MaterialTheme.typography.titleLarge)
        vm.course.objects("lessons").forEachIndexed { index,item->ActionRow("${index+1}. ${item.s("title")}",if(item.s("id") in done)"Completed" else if(item.optInt("duration")>0)"${item.optInt("duration")} min" else "Open lesson",Icons.AutoMirrored.Outlined.MenuBook,!vm.busy){vm.openLesson(item,false)} }
        vm.units.forEach { u->ActionRow(u.s("title"),if(u.optBoolean("completed"))"Completed" else if(u.s("status")=="draft")"Draft unit" else "Open unit",Icons.Outlined.Layers,!vm.busy){vm.openLesson(u,true)} }
        if(!vm.staff&&vm.course.s("quizId").isNotBlank())Primary("Take course quiz",vm.busy){vm.courseQuiz()}
        val tasks=vm.tasks.filter{it.course.s("id")==vm.course.s("id")}
        if(tasks.isNotEmpty()){Text("Assignments",style=MaterialTheme.typography.titleLarge);tasks.forEach{TaskCard(vm,it)}}
        if(vm.resources.isNotEmpty()){Text("Course resources",style=MaterialTheme.typography.titleLarge);vm.resources.forEach{r->ActionRow(r.s("name"),r.s("kind").uppercase(),Icons.Outlined.FileDownload,!vm.busy){vm.openFile(r.s("id"),r.s("name"),false,openFile)}}}
    }
}
@Composable private fun ActionRow(title:String,detail:String,icon:ImageVector,enabled:Boolean=true,onClick:()->Unit) {
    Surface(shape=RoundedCornerShape(16.dp),color=Color.White,border=androidx.compose.foundation.BorderStroke(1.dp,Line),modifier=Modifier.fillMaxWidth().clickable(enabled=enabled,onClick=onClick)) {
        Row(Modifier.padding(18.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(14.dp)) { Icon(icon,null,tint=Blue);Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)){Text(title,style=MaterialTheme.typography.titleMedium);if(detail.isNotBlank())Text(detail,color=Muted,style=MaterialTheme.typography.bodyMedium)};Icon(Icons.AutoMirrored.Outlined.ArrowForward,null,tint=Muted,modifier=Modifier.size(18.dp)) }
    }
}
@Composable private fun LessonPage(vm:CampusViewModel) {
    val context=LocalContext.current
    Page { Eyebrow(vm.course.s("title"));Heading(vm.lesson.s("title"))
        if(vm.lesson.s("objectives").isNotBlank())Panel{Eyebrow("Learning objectives");Text(vm.lesson.s("objectives"))}
        if(vm.lesson.s("content").isNotBlank())Panel{ReadingText(vm.lesson.s("content"))}
        if(vm.lesson.s("videoUrl").isNotBlank())OutlinedButton(onClick={openExternal(context,vm.lesson.s("videoUrl"),vm)},modifier=Modifier.fillMaxWidth()){Icon(Icons.Outlined.PlayCircleOutline,null);Spacer(Modifier.width(8.dp));Text("Open lesson video")}
        if(!vm.staff) {
            Primary("Mark as read",vm.busy) { vm.markRead() }
            vm.unit?.let { u ->
                if(u.objects("quiz").isNotEmpty())OutlinedButton(onClick={vm.unitQuiz(u)},enabled=!vm.busy,modifier=Modifier.fillMaxWidth()) { Text("Practice this unit") }
            }
        } else Text("Teacher preview · learner completion is recorded from a learner account.",color=Muted)
    }
}
@Composable private fun ReadingText(text:String) {
    // Native text, never remote HTML or script. Preserve paragraphs and simple headings.
    text.split(Regex("\n\\s*\n")).forEach { paragraph->
        val heading=paragraph.startsWith("#")
        Text(paragraph.trimStart('#',' ').replace("**",""),style=if(heading)MaterialTheme.typography.titleLarge else MaterialTheme.typography.bodyLarge)
    }
}
@Composable private fun QuizPage(vm:CampusViewModel) {
    val quiz=vm.quiz?:return
    var answers by remember(quiz.revision,quiz.unitId){mutableStateOf(List(quiz.questions.size){-1})}
    Page {Heading(quiz.title,"Choose one answer for each question. A score of 70% passes the quiz.")
        quiz.questions.forEachIndexed { index,q->Panel { Eyebrow("Question ${index+1} of ${quiz.questions.size}");Text(q.s("prompt"),style=MaterialTheme.typography.titleMedium)
            q.strings("options").forEachIndexed{i,text->Row(Modifier.fillMaxWidth().clickable(enabled=!vm.busy){answers=answers.toMutableList().also{it[index]=i}}.padding(vertical=4.dp),verticalAlignment=Alignment.CenterVertically){RadioButton(selected=answers[index]==i,onClick={answers=answers.toMutableList().also{it[index]=i}},enabled=!vm.busy);Text(text,Modifier.weight(1f),style=MaterialTheme.typography.bodyLarge)}} }
        }
        Primary("Submit answers",vm.busy,answers.isNotEmpty()&&answers.none{it<0}){vm.submitQuiz(answers)}
        Text("Your latest attempt updates your course progress.",color=Muted)
    }
}

@Composable private fun TasksPage(vm:CampusViewModel) {
    var showAll by rememberSaveable{mutableStateOf(false)}
    val filtered=if(showAll)vm.tasks else vm.tasks.filter{if(vm.staff)it.submissions.any{s->submissionLabel(s)=="Awaiting feedback"} else submissionLabel(it.submissions.firstOrNull()) in listOf("To do","Revise & resubmit")}
    Page {Heading(if(vm.staff)"Review & feedback" else "My tasks",if(vm.staff)"Review submitted work and help learners take their next step." else "Know what to do next, and where you stand.")
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){FilterChip(selected=!showAll,onClick={showAll=false},label={Text(if(vm.staff)"Awaiting review" else "To do")});FilterChip(selected=showAll,onClick={showAll=true},label={Text("All tasks")})}
        if(filtered.isEmpty())Empty("You're up to date",if(showAll)"Assignments will appear when your teacher publishes them." else "No tasks need your attention. Choose All tasks to see submitted and graded work.")
        filtered.forEach{TaskCard(vm,it)}
    }
}
@Composable private fun TaskCard(vm:CampusViewModel,t:LearningTask) {
    val sub=t.submissions.firstOrNull()
    Panel { Eyebrow(t.course.s("title"));Text(t.data.s("title"),style=MaterialTheme.typography.titleMedium)
        Text(if(t.staff)"${t.submissions.count{submissionLabel(it)=="Awaiting feedback"}} awaiting review · ${t.submissions.size} submitted" else submissionLabel(sub),color=Blue,fontWeight=FontWeight.SemiBold)
        val due=sub?.s("returned_until").orEmpty().ifBlank{t.data.s("due_at").ifBlank{t.data.s("due_date")}}
        if(due.isNotBlank())Text("Due ${readableDate(due)}",color=Muted)
        OutlinedButton(onClick={vm.openTask(t)},enabled=!vm.busy,modifier=Modifier.fillMaxWidth()){Text(if(t.staff)"Review work" else "Open assignment")}
    }
}
@Composable private fun TaskPage(vm:CampusViewModel,openFile:(File)->Unit) {
    val task=vm.currentTask?:return; val a=task.data;val sub=task.submissions.firstOrNull()
    val draft=remember(vm.taskId){vm.draft()}
    var answer by remember(vm.taskId){mutableStateOf(draft?.s("body")?:sub?.s("body").orEmpty())}
    var link by remember(vm.taskId){mutableStateOf(draft?.s("link")?:sub?.s("link").orEmpty())}
    val picker=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()){uri->uri?.let{vm.chooseFile(it)}}
    Page {Eyebrow(task.course.s("title"));Heading(a.s("title"),"${a.s("kind").replace('_',' ')} · ${a.optInt("max_score")} marks")
        Panel {Text("Your brief",style=MaterialTheme.typography.titleMedium);ReadingText(a.s("instructions"));if(a.s("case_context").isNotBlank())ReadingText(a.s("case_context"));if(a.s("deliverables").isNotBlank()){Eyebrow("Deliverables");Text(a.s("deliverables"))};if(a.s("rubric").isNotBlank()){Eyebrow("Assessment criteria");Text(a.s("rubric"))} }
        if(a.s("question_material_id").isNotBlank())ActionRow("Assignment attachment","Open the question document",Icons.Outlined.AttachFile,!vm.busy){vm.openFile(a.s("question_material_id"),"assignment.pdf",false,openFile)}
        if(task.staff){
            if(task.submissions.isEmpty())Empty("No submissions yet","Submitted work from your assigned learners will appear here.")
            task.submissions.forEach{s->key(s.s("id"),s.optInt("version")){ReviewPanel(vm,s,a.optInt("max_score"),openFile)}}
        } else {
            if(sub!=null)SubmissionPanel(vm,sub,openFile)
            if(sub==null||sub.isNull("score"))Panel {
                Text(if(sub?.s("returned_until").orEmpty().isNotBlank())"Revise your answer" else "Your answer",style=MaterialTheme.typography.titleMedium)
                Text("Text drafts are saved on this device. Submitting requires a connection.",style=MaterialTheme.typography.bodyMedium,color=Muted)
                Field(answer,{if(it.length<=20000){answer=it;vm.saveDraft(answer,link)}},"Write your answer",!vm.busy,6)
                Field(link,{if(it.length<=2000){link=it;vm.saveDraft(answer,link)}},"HTTPS link (optional)",!vm.busy,type=KeyboardType.Uri)
                Text("${answer.length}/20,000 characters",color=Muted,fontSize=12.sp)
                OutlinedButton(onClick={picker.launch(arrayOf("application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.presentationml.presentation"))},enabled=!vm.busy,modifier=Modifier.fillMaxWidth()){Icon(Icons.Outlined.AttachFile,null);Text("Attach PDF, DOCX or PPTX")}
                Text("Up to 5 MB. Add a short description in your answer. Reselect the file if you close the app before submitting.",color=Muted,fontSize=13.sp)
                vm.picked?.let{file->Text(file.name,fontWeight=FontWeight.SemiBold);TextButton(onClick={vm.removePicked()},enabled=!vm.busy){Text("Remove selected attachment")}}
                Primary(if(sub==null)"Submit assignment" else "Resubmit assignment",vm.busy,answer.isNotBlank()){vm.submitTask(answer,link,sub?.optInt("version")?:0)}
            }
        }
    }
}
@Composable private fun SubmissionPanel(vm:CampusViewModel,s:JSONObject,openFile:(File)->Unit) {
    val context=LocalContext.current
    Panel {Eyebrow(submissionLabel(s));if(s.s("name").isNotBlank())Text(s.s("name"),style=MaterialTheme.typography.titleMedium)
        if(!s.isNull("score"))Text("${s.s("score")} marks",style=MaterialTheme.typography.titleLarge)
        if(s.s("returned_until").isNotBlank())Text("Revision due ${readableDate(s.s("returned_until"))}",color=Blue)
        if(s.s("feedback").isNotBlank()){Text("Teacher feedback",fontWeight=FontWeight.Bold);Text(s.s("feedback"))}
        Text(s.s("body"),style=MaterialTheme.typography.bodyLarge)
        if(s.s("link").isNotBlank())TextButton(onClick={openExternal(context,s.s("link"),vm)}){Text("Open submitted link")}
        if(s.s("file_id").isNotBlank())OutlinedButton(onClick={vm.openFile(s.s("file_id"),s.s("file_name"),true,openFile)},enabled=!vm.busy){Icon(Icons.Outlined.FileDownload,null);Spacer(Modifier.width(8.dp));Text(s.s("file_name"))}
        Text("Submitted ${readableDate(s.s("submitted_at"))} · revision ${s.optInt("version")}",color=Muted,fontSize=12.sp)
    }
}
@Composable private fun ReviewPanel(vm:CampusViewModel,s:JSONObject,max:Int,openFile:(File)->Unit) {
    var expanded by remember{mutableStateOf(false)};var mark by remember{mutableStateOf(if(s.isNull("score"))"" else s.optDouble("score").toInt().toString())};var feedback by remember{mutableStateOf(s.s("feedback"))};var days by remember{mutableIntStateOf(7)}
    Panel {Text(s.s("name").ifBlank{s.s("email")},style=MaterialTheme.typography.titleMedium);Text(submissionLabel(s),color=Blue);TextButton(onClick={expanded=!expanded}){Text(if(expanded)"Close review" else "Read submission")}
        if(expanded){SubmissionPanel(vm,s,openFile)
            if(s.s("returned_until").isBlank()) {
                Field(mark,{if(it.length<5)mark=it},"Mark out of $max",!vm.busy,type=KeyboardType.Number)
                Field(feedback,{if(it.length<=10000)feedback=it},"Feedback for the learner",!vm.busy,4)
                Primary("Release grade & feedback",vm.busy,mark.toIntOrNull()?.let{it in 0..max}==true){vm.review(s,feedback,mark,null)}
                Text("Or return this work for revision",style=MaterialTheme.typography.titleMedium)
                Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf(3,7,14).forEach{d->FilterChip(selected=days==d,onClick={days=d},label={Text("$d days")})}}
                OutlinedButton(onClick={vm.review(s,feedback,mark,days)},enabled=!vm.busy&&feedback.isNotBlank(),modifier=Modifier.fillMaxWidth()){Text("Return with a $days-day deadline")}
            }else Text("The learner must resubmit before this work can be graded.",color=Muted)
        }
    }
}

@Composable private fun ProgressPage(vm:CampusViewModel) {
    Page {Heading(if(vm.staff)"Learner progress" else "My progress",if(vm.staff)"Current readings, quizzes and released marks for your assigned learners." else "See your reading progress and the feedback behind your marks.")
        if(vm.reports.isEmpty())Empty("Progress starts here","Published courses and learner activity will appear here. Missing marks are never counted as zero.")
        vm.reports.forEach{r->Panel{
            if(vm.staff)Eyebrow(r.s("name"));Text(r.s("courseTitle"),style=MaterialTheme.typography.titleLarge)
            if(!r.isNull("percent")){LinearProgressIndicator(progress={r.optInt("percent")/100f},modifier=Modifier.fillMaxWidth());Text("${r.optInt("read")} / ${r.optInt("readTotal")} readings · ${r.optInt("quizPassed")} / ${r.optInt("quizTotal")} quizzes passed",color=Muted)}
            Text(if(r.isNull("provisional"))"No marks released yet" else "${r.s("provisional")}% across ${r.optInt("graded")} graded items",fontWeight=FontWeight.Bold)
            Text("This is a progress view. Final approved results are shown separately.",fontSize=12.sp,color=Muted)
            r.objects("items").forEach{i->HorizontalDivider(color=Line);Row{Text(i.s("title"),Modifier.weight(1f),fontWeight=FontWeight.SemiBold);Text(if(i.isNull("score"))"—" else "${i.s("score")}/${i.s("max")}",color=Blue)};Text(i.s("state").replace('_',' '),fontSize=13.sp,color=Muted);if(i.s("feedback").isNotBlank())Text(i.s("feedback"))}
            r.optJSONObject("result")?.let{result->HorizontalDivider();Eyebrow("Approved result");Text("${result.s("label")} · ${result.s("score")}/${result.s("max")}",fontWeight=FontWeight.Bold);if(result.optBoolean("changed"))Text("New marks have changed since this result was approved.",color=MaterialTheme.colorScheme.error)}
        }}
    }
}
@Composable private fun AccountPage(vm:CampusViewModel) {
    var menu by remember { mutableStateOf(false) };var confirm by remember{mutableStateOf(false)}
    Page {Heading("My account");Panel{Eyebrow(vm.organization.s("role"));Text(vm.user.s("displayName"),style=MaterialTheme.typography.titleLarge);Text(vm.user.s("email"),color=Muted)}
        Panel {Text("Institution",style=MaterialTheme.typography.titleMedium);Text(vm.organization.s("name"));if(vm.organizations.size>1)Box{OutlinedButton(onClick={menu=true},enabled=!vm.busy){Text("Switch institution");Icon(Icons.Outlined.ExpandMore,null)};DropdownMenu(expanded=menu,onDismissRequest={menu=false}){vm.organizations.forEach{o->DropdownMenuItem(text={Text(o.s("name")+" · "+o.s("role"))},onClick={menu=false;vm.switchOrganization(o.s("id"))})}}}}
        Panel {Text("Connected server",style=MaterialTheme.typography.titleMedium);Text(vm.api.server,color=Muted);Text("Tejasvi Android ${BuildConfig.VERSION_NAME}",color=Muted);Text("This pilot covers learning, assignments, reviews and progress. Institution setup and administration remain available on the website.",style=MaterialTheme.typography.bodyMedium,color=Muted)}
        OutlinedButton(onClick={confirm=true},enabled=!vm.busy,modifier=Modifier.fillMaxWidth()){Icon(Icons.AutoMirrored.Outlined.Logout,null);Spacer(Modifier.width(8.dp));Text("Sign out")}
    }
    if(confirm)AlertDialog(onDismissRequest={confirm=false},title={Text("Sign out of this device?")},text={Text("Local drafts and downloaded files will be removed. Submitted work stays in your institution's database.")},confirmButton={TextButton(onClick={confirm=false;vm.signOut()}){Text("Sign out")}},dismissButton={TextButton(onClick={confirm=false}){Text("Cancel")}})
}
private fun openExternal(context:android.content.Context,url:String,vm:CampusViewModel) {
    val uri=url.toUri()
    if(uri.scheme!="https"||uri.host.isNullOrBlank()){vm.message("This link must use HTTPS.");return}
    try{context.startActivity(Intent(Intent.ACTION_VIEW,uri))}catch(_:ActivityNotFoundException){vm.message("Install a browser or video app to open this link.")}
}
