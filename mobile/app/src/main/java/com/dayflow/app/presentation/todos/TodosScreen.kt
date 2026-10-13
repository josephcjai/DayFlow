package com.dayflow.app.presentation.todos

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dayflow.app.data.local.TodoEntity
import com.dayflow.app.domain.model.CategoryItem
import com.dayflow.app.domain.model.NoteSheet
import com.dayflow.app.domain.model.NotesSaveStatus
import com.dayflow.app.domain.model.TodoFilter
import com.dayflow.app.domain.model.TodoPriority
import com.dayflow.app.presentation.theme.*
import kotlinx.coroutines.launch
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodosScreen(
    viewModel: TodosViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit = {}
) {
    val todos by viewModel.todos.collectAsState()
    val allTodos by viewModel.allTodos.collectAsState()
    val categories by viewModel.categories.collectAsState()
    val activeFilter by viewModel.activeFilter.collectAsState()

    // Note Sheets & Markdown State
    val noteSheets by viewModel.noteSheets.collectAsState()
    val activeSheetId by viewModel.activeSheetId.collectAsState()
    val activeContent by viewModel.activeContent.collectAsState()
    val notesSaveStatus by viewModel.notesSaveStatus.collectAsState()

    var selectedTab by remember { mutableIntStateOf(0) } // 0: Todos, 1: Strategy Notes
    var newTodoTitle by remember { mutableStateOf("") }
    var selectedPriority by remember { mutableStateOf(TodoPriority.MEDIUM) }
    var selectedCategory by remember { mutableStateOf("Work") }
    var showCategoryMenu by remember { mutableStateOf(false) }

    // Editor View Mode (0: Edit, 1: Preview)
    var editorMode by remember { mutableIntStateOf(0) }

    // Dialog state for scheduling & deletion
    var schedulingTodo by remember { mutableStateOf<TodoEntity?>(null) }
    var deletingTodo by remember { mutableStateOf<TodoEntity?>(null) }

    // Dialog state for custom note sheet
    var showAddSheetDialog by remember { mutableStateOf(false) }
    var pendingDeleteSheet by remember { mutableStateOf<NoteSheet?>(null) }

    val clipboardManager = LocalClipboardManager.current
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = BackgroundDark
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            // Header Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = if (selectedTab == 0) "Weekly Todos & Strategy" else "Notes & Scratchpad",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = if (selectedTab == 0) {
                            "${allTodos.count { it.isCompleted }}/${allTodos.size} goals completed"
                        } else {
                            "Multi-sheet Markdown journal & code blocks"
                        },
                        fontSize = 12.sp,
                        color = TextMuted
                    )
                }

                // Sub-tabs (Todos / Notes)
                Surface(
                    color = SurfaceDark,
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Row(modifier = Modifier.padding(3.dp)) {
                        TabPill(
                            title = "Todos",
                            selected = selectedTab == 0,
                            onClick = { selectedTab = 0 }
                        )
                        TabPill(
                            title = "Notes",
                            selected = selectedTab == 1,
                            onClick = { selectedTab = 1 }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            if (selectedTab == 0) {
                // ==========================================
                // TAB 1: TODOS CHECKLIST (Web Parity Area 2)
                // ==========================================
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            OutlinedTextField(
                                value = newTodoTitle,
                                onValueChange = { newTodoTitle = it },
                                placeholder = { Text("What needs to get done this week?", color = TextMuted, fontSize = 13.sp) },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                                shape = RoundedCornerShape(10.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = DayFlowPrimary,
                                    unfocusedBorderColor = SurfaceElevated,
                                    focusedTextColor = TextPrimary,
                                    unfocusedTextColor = TextPrimary
                                )
                            )

                            Spacer(modifier = Modifier.width(8.dp))

                            Button(
                                onClick = {
                                    if (newTodoTitle.isNotBlank()) {
                                        viewModel.createTodo(
                                            title = newTodoTitle,
                                            priority = selectedPriority.displayName,
                                            category = selectedCategory
                                        )
                                        newTodoTitle = ""
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary),
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp)
                            ) {
                                Icon(Icons.Default.Add, contentDescription = "Add", tint = BackgroundDark, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Add", color = BackgroundDark, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // Priority & Category selectors row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            // Priority Selector Pills
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                TodoPriority.entries.forEach { prio ->
                                    val isPrioSelected = selectedPriority == prio
                                    Surface(
                                        modifier = Modifier.clickable { selectedPriority = prio },
                                        color = if (isPrioSelected) Color(android.graphics.Color.parseColor(prio.hexColor)).copy(alpha = 0.25f) else SurfaceElevated,
                                        shape = RoundedCornerShape(8.dp),
                                        border = if (isPrioSelected) BorderStroke(1.dp, Color(android.graphics.Color.parseColor(prio.hexColor))) else null
                                    ) {
                                        Text(
                                            text = prio.badgeLabel,
                                            color = if (isPrioSelected) Color(android.graphics.Color.parseColor(prio.hexColor)) else TextMuted,
                                            fontSize = 11.sp,
                                            fontWeight = if (isPrioSelected) FontWeight.Bold else FontWeight.Normal,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                        )
                                    }
                                }
                            }

                            // Category Selector Chip
                            Box {
                                Surface(
                                    modifier = Modifier.clickable { showCategoryMenu = true },
                                    color = SurfaceElevated,
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        val activeCatItem = categories.find { it.name.equals(selectedCategory, ignoreCase = true) }
                                        Text(
                                            text = "${activeCatItem?.icon ?: "📌"} $selectedCategory",
                                            color = TextPrimary,
                                            fontSize = 11.sp
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Icon(Icons.Default.ArrowDropDown, contentDescription = null, tint = TextMuted, modifier = Modifier.size(16.dp))
                                    }
                                }

                                DropdownMenu(
                                    expanded = showCategoryMenu,
                                    onDismissRequest = { showCategoryMenu = false },
                                    modifier = Modifier.background(SurfaceElevated)
                                ) {
                                    categories.forEach { cat ->
                                        DropdownMenuItem(
                                            text = {
                                                Text("${cat.icon} ${cat.name}", color = TextPrimary, fontSize = 13.sp)
                                            },
                                            onClick = {
                                                selectedCategory = cat.name
                                                showCategoryMenu = false
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Dynamic Filter Pills Row
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    TodoFilter.entries.forEach { filter ->
                        val isFilterActive = activeFilter == filter
                        val count = when (filter) {
                            TodoFilter.ALL -> allTodos.size
                            TodoFilter.HIGH -> allTodos.count { it.priority.equals("High", ignoreCase = true) }
                            TodoFilter.MEDIUM -> allTodos.count { it.priority.equals("Medium", ignoreCase = true) }
                            TodoFilter.LOW -> allTodos.count { it.priority.equals("Low", ignoreCase = true) }
                            TodoFilter.PENDING -> allTodos.count { !it.isCompleted }
                            TodoFilter.DONE -> allTodos.count { it.isCompleted }
                        }

                        Surface(
                            modifier = Modifier.clickable { viewModel.setFilter(filter) },
                            color = if (isFilterActive) DayFlowPrimary else SurfaceDark,
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = filter.label,
                                    color = if (isFilterActive) BackgroundDark else TextMuted,
                                    fontSize = 11.sp,
                                    fontWeight = if (isFilterActive) FontWeight.Bold else FontWeight.Medium
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Surface(
                                    color = if (isFilterActive) BackgroundDark.copy(alpha = 0.2f) else SurfaceElevated,
                                    shape = CircleShape
                                ) {
                                    Text(
                                        text = count.toString(),
                                        color = if (isFilterActive) BackgroundDark else TextSecondary,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                                    )
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Todos List
                if (todos.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Checklist,
                                contentDescription = null,
                                tint = TextMuted.copy(alpha = 0.5f),
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "No todos found for '${activeFilter.label}'.\\nAdd high-priority tasks above to stay accountable.",
                                fontSize = 13.sp,
                                color = TextMuted,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(todos, key = { it.id }) { todo ->
                            EnhancedTodoItemRow(
                                todo = todo,
                                categories = categories,
                                onToggle = { isChecked -> viewModel.toggleTodo(todo.id, isChecked) },
                                onSchedule = { schedulingTodo = todo },
                                onDelete = {
                                    if (!todo.scheduledSlotKey.isNullOrBlank()) {
                                        deletingTodo = todo
                                    } else {
                                        viewModel.deleteTodo(todo, clearScheduledSlot = false)
                                    }
                                }
                            )
                        }
                    }
                }
            } else {
                // ==========================================
                // TAB 2: MULTI-SHEET NOTES & MARKDOWN SCRATCHPAD (Web Parity Area 3)
                // ==========================================
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(14.dp)
                    ) {
                        // Card Top Action Bar: View Switcher (Edit/Preview) + Status Pill + Actions
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // View Switcher: [ ✏️ Edit | 👁️ Preview ]
                            Surface(
                                color = SurfaceElevated,
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Row(modifier = Modifier.padding(2.dp)) {
                                    Surface(
                                        modifier = Modifier.clickable { editorMode = 0 },
                                        color = if (editorMode == 0) DayFlowPrimary else Color.Transparent,
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = "✏️ Edit",
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = if (editorMode == 0) BackgroundDark else TextMuted
                                            )
                                        }
                                    }

                                    Surface(
                                        modifier = Modifier.clickable { editorMode = 1 },
                                        color = if (editorMode == 1) DayFlowPrimary else Color.Transparent,
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = "👁️ Preview",
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = if (editorMode == 1) BackgroundDark else TextMuted
                                            )
                                        }
                                    }
                                }
                            }

                            // Right side: Save Status Pill & Copy Button
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                // Status Pill
                                val statusColor = Color(android.graphics.Color.parseColor(notesSaveStatus.hexColor))
                                Surface(
                                    color = statusColor.copy(alpha = 0.15f),
                                    shape = RoundedCornerShape(8.dp),
                                    border = BorderStroke(1.dp, statusColor.copy(alpha = 0.4f))
                                ) {
                                    Text(
                                        text = notesSaveStatus.label,
                                        color = statusColor,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)
                                    )
                                }

                                // Copy Markdown to Clipboard
                                Surface(
                                    modifier = Modifier.clickable {
                                        clipboardManager.setText(AnnotatedString(activeContent))
                                        coroutineScope.launch {
                                            snackbarHostState.showSnackbar("✓ Copied markdown to clipboard")
                                        }
                                    },
                                    color = SurfaceElevated,
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 4.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Icon(Icons.Default.ContentCopy, contentDescription = "Copy", tint = DayFlowPrimary, modifier = Modifier.size(13.dp))
                                        Spacer(modifier = Modifier.width(3.dp))
                                        Text("Copy", color = DayFlowPrimary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                    }
                                }

                                // Immediate Save Button
                                Surface(
                                    modifier = Modifier.clickable { viewModel.saveNotesImmediately() },
                                    color = DayFlowPrimary,
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Icon(Icons.Default.Save, contentDescription = "Save", tint = BackgroundDark, modifier = Modifier.size(13.dp))
                                        Spacer(modifier = Modifier.width(3.dp))
                                        Text("Save", color = BackgroundDark, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // Note Sheets Sub-Navigation Tab Bar
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            noteSheets.forEach { sheet ->
                                val isSheetActive = sheet.id == activeSheetId
                                Surface(
                                    color = if (isSheetActive) DayFlowPrimary.copy(alpha = 0.2f) else SurfaceElevated,
                                    shape = RoundedCornerShape(10.dp),
                                    border = if (isSheetActive) BorderStroke(1.5.dp, DayFlowPrimary) else BorderStroke(1.dp, SurfaceElevated)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            modifier = Modifier.clickable { viewModel.selectSheet(sheet.id) },
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(sheet.icon, fontSize = 12.sp)
                                            Spacer(modifier = Modifier.width(5.dp))
                                            Text(
                                                text = sheet.title,
                                                fontSize = 11.sp,
                                                fontWeight = if (isSheetActive) FontWeight.Bold else FontWeight.Medium,
                                                color = if (isSheetActive) DayFlowPrimary else TextPrimary
                                            )
                                        }

                                        // Delete icon for non-default sheets
                                        if (!sheet.isDefault) {
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Box(
                                                modifier = Modifier
                                                    .size(24.dp)
                                                    .clickable { pendingDeleteSheet = sheet },
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.Close,
                                                    contentDescription = "Delete Sheet",
                                                    tint = TextMuted,
                                                    modifier = Modifier.size(14.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            // "+ Add Sheet" Action Pill
                            Surface(
                                modifier = Modifier.clickable { showAddSheetDialog = true },
                                color = SurfaceElevated.copy(alpha = 0.6f),
                                shape = RoundedCornerShape(10.dp),
                                border = BorderStroke(1.dp, DayFlowPrimary.copy(alpha = 0.5f))
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.Add, contentDescription = "Add Sheet", tint = DayFlowPrimary, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Add Sheet", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = DayFlowPrimary)
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // Markdown Formatting Toolbar (Only visible in Edit Mode)
                        if (editorMode == 0) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(5.dp)
                            ) {
                                FormattingToolPill(label = "B", title = "Bold") {
                                    viewModel.updateSheetContent("$activeContent **bold**")
                                }
                                FormattingToolPill(label = "I", title = "Italic") {
                                    viewModel.updateSheetContent("$activeContent *italic*")
                                }
                                FormattingToolPill(label = "H1", title = "Heading 1") {
                                    viewModel.updateSheetContent("$activeContent\n# Heading 1\n")
                                }
                                FormattingToolPill(label = "H2", title = "Heading 2") {
                                    viewModel.updateSheetContent("$activeContent\n## Heading 2\n")
                                }
                                FormattingToolPill(label = "☑ Task", title = "Todo Item") {
                                    viewModel.updateSheetContent("$activeContent\n- [ ] ")
                                }
                                FormattingToolPill(label = "`Code`", title = "Inline Code") {
                                    viewModel.updateSheetContent("$activeContent `code` ")
                                }
                                FormattingToolPill(label = "💻 Block", title = "Code Block") {
                                    viewModel.updateSheetContent("$activeContent\n```kotlin\n// code here\n```\n")
                                }
                                FormattingToolPill(label = "• List", title = "Bullet Point") {
                                    viewModel.updateSheetContent("$activeContent\n- ")
                                }
                                FormattingToolPill(label = "> Quote", title = "Quote") {
                                    viewModel.updateSheetContent("$activeContent\n> ")
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))
                        }

                        // Main Content Area: Editor vs Preview
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f)
                        ) {
                            if (editorMode == 0) {
                                OutlinedTextField(
                                    value = activeContent,
                                    onValueChange = { viewModel.updateSheetContent(it) },
                                    placeholder = {
                                        Text(
                                            "Record weekly reflections, tech notes, reminders, or code snippets... Use Markdown syntax or the formatting toolbar above.",
                                            color = TextMuted,
                                            fontSize = 13.sp,
                                            lineHeight = 18.sp
                                        )
                                    },
                                    modifier = Modifier.fillMaxSize(),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = DayFlowPrimary.copy(alpha = 0.6f),
                                        unfocusedBorderColor = SurfaceElevated,
                                        focusedTextColor = TextPrimary,
                                        unfocusedTextColor = TextPrimary,
                                        focusedContainerColor = SurfaceElevated.copy(alpha = 0.3f),
                                        unfocusedContainerColor = SurfaceElevated.copy(alpha = 0.3f)
                                    ),
                                    shape = RoundedCornerShape(10.dp)
                                )
                            } else {
                                Column(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(SurfaceElevated.copy(alpha = 0.25f), RoundedCornerShape(10.dp))
                                        .padding(12.dp)
                                        .verticalScroll(rememberScrollState())
                                ) {
                                    MarkdownRenderer(markdown = activeContent)
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        // Footer: Live Metrics & Hint
                        val words = activeContent.trim().split(Regex("\\s+")).count { it.isNotBlank() }
                        val chars = activeContent.length
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "💡 Tip: Switch to Preview to view rendered checklist & code",
                                fontSize = 10.sp,
                                color = TextMuted
                            )
                            Text(
                                text = "$words words • $chars chars",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = DayFlowPrimary
                            )
                        }
                    }
                }
            }
        }
    }

    // Bottom Sheet: Schedule Todo to Grid
    if (schedulingTodo != null) {
        ScheduleTodoBottomSheet(
            todo = schedulingTodo!!,
            onDismiss = { schedulingTodo = null },
            viewModel = viewModel,
            onScheduled = { msg ->
                schedulingTodo = null
                coroutineScope.launch {
                    snackbarHostState.showSnackbar(msg)
                }
            }
        )
    }

    // Dialog: Cascade Delete Confirmation
    if (deletingTodo != null) {
        AlertDialog(
            onDismissRequest = { deletingTodo = null },
            containerColor = SurfaceDark,
            title = {
                Text("Delete Scheduled Todo?", color = TextPrimary, fontWeight = FontWeight.Bold)
            },
            text = {
                Column {
                    Text(
                        text = "This todo is currently scheduled on the timetable at '${deletingTodo!!.scheduledSlotKey}'.",
                        color = TextSecondary,
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "Would you like to clear the scheduled slot as well?",
                        color = TextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteTodo(deletingTodo!!, clearScheduledSlot = true)
                        deletingTodo = null
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("✓ Todo & scheduled slot removed")
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = DayFlowSecondary)
                ) {
                    Text("Delete & Clear Slot", fontSize = 12.sp)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteTodo(deletingTodo!!, clearScheduledSlot = false)
                        deletingTodo = null
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("✓ Todo deleted (slot kept on grid)")
                        }
                    }
                ) {
                    Text("Keep Slot on Grid", color = TextMuted, fontSize = 12.sp)
                }
            }
        )
    }

    // Dialog: Add Custom Note Sheet
    if (showAddSheetDialog) {
        AddNoteSheetDialog(
            onDismiss = { showAddSheetDialog = false },
            onConfirm = { title, icon ->
                viewModel.addCustomSheet(title, icon)
                showAddSheetDialog = false
                coroutineScope.launch {
                    snackbarHostState.showSnackbar("✓ Created note sheet '$title'")
                }
            }
        )
    }

    // Dialog: Delete Custom Note Sheet Confirmation
    if (pendingDeleteSheet != null) {
        AlertDialog(
            onDismissRequest = { pendingDeleteSheet = null },
            containerColor = SurfaceDark,
            title = {
                Text("Delete Note Sheet?", color = TextPrimary, fontWeight = FontWeight.Bold)
            },
            text = {
                Column {
                    Text(
                        text = "Are you sure you want to remove '${pendingDeleteSheet!!.title}'?",
                        color = TextSecondary,
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "All markdown notes and code snippets in this sheet will be permanently deleted.",
                        color = TextMuted,
                        fontSize = 12.sp
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val deletedTitle = pendingDeleteSheet!!.title
                        viewModel.deleteSheet(pendingDeleteSheet!!.id)
                        pendingDeleteSheet = null
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("✓ Removed sheet '$deletedTitle'")
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                ) {
                    Text("Delete Sheet", fontSize = 12.sp)
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDeleteSheet = null }) {
                    Text("Keep Sheet", color = TextMuted, fontSize = 12.sp)
                }
            }
        )
    }
}

@Composable
fun FormattingToolPill(
    label: String,
    title: String,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier.clickable { onClick() },
        color = SurfaceElevated,
        shape = RoundedCornerShape(6.dp),
        border = BorderStroke(1.dp, SurfaceElevated)
    ) {
        Text(
            text = label,
            color = DayFlowPrimary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
        )
    }
}

@Composable
fun AddNoteSheetDialog(
    onDismiss: () -> Unit,
    onConfirm: (title: String, icon: String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var selectedIcon by remember { mutableStateOf("📝") }
    val icons = listOf("📝", "📓", "📅", "💻", "💼", "⚡", "🎯", "💡", "🔬", "📊", "🚀")

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceDark,
        title = {
            Text("Add Note Sheet", color = TextPrimary, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "Create a new categorized markdown sheet for this week.",
                    fontSize = 12.sp,
                    color = TextSecondary
                )

                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Sheet Title", color = TextMuted) },
                    placeholder = { Text("e.g. Design Specs, 1-on-1 Notes", color = TextMuted) },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = DayFlowPrimary,
                        unfocusedBorderColor = SurfaceElevated,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                Text(
                    text = "Select Icon",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextPrimary
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    icons.forEach { ic ->
                        val isSelected = selectedIcon == ic
                        Surface(
                            modifier = Modifier.clickable { selectedIcon = ic },
                            color = if (isSelected) DayFlowPrimary.copy(alpha = 0.25f) else SurfaceElevated,
                            shape = RoundedCornerShape(8.dp),
                            border = if (isSelected) BorderStroke(1.5.dp, DayFlowPrimary) else null
                        ) {
                            Text(
                                text = ic,
                                fontSize = 18.sp,
                                modifier = Modifier.padding(8.dp)
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { if (title.isNotBlank()) onConfirm(title.trim(), selectedIcon) },
                enabled = title.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary)
            ) {
                Text("Create Sheet", color = BackgroundDark, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = TextMuted)
            }
        }
    )
}

@Composable
fun EnhancedTodoItemRow(
    todo: TodoEntity,
    categories: List<CategoryItem>,
    onToggle: (Boolean) -> Unit,
    onSchedule: () -> Unit,
    onDelete: () -> Unit
) {
    val prio = TodoPriority.fromString(todo.priority)
    val prioColor = Color(android.graphics.Color.parseColor(prio.hexColor))
    val categoryItem = categories.find { it.name.equals(todo.category, ignoreCase = true) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
        shape = RoundedCornerShape(12.dp),
        border = if (todo.isCompleted) null else BorderStroke(1.dp, SurfaceElevated)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = todo.isCompleted,
                        onCheckedChange = onToggle,
                        colors = CheckboxDefaults.colors(
                            checkedColor = DayFlowPrimary,
                            uncheckedColor = TextMuted,
                            checkmarkColor = BackgroundDark
                        )
                    )

                    Spacer(modifier = Modifier.width(6.dp))

                    Text(
                        text = todo.title,
                        color = if (todo.isCompleted) TextMuted else TextPrimary,
                        fontSize = 14.sp,
                        fontWeight = if (todo.isCompleted) FontWeight.Normal else FontWeight.Medium,
                        textDecoration = if (todo.isCompleted) TextDecoration.LineThrough else null,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Action buttons: Schedule to Grid & Delete
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = onSchedule,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.CalendarMonth,
                            contentDescription = "Schedule to Grid",
                            tint = if (!todo.scheduledSlotKey.isNullOrBlank()) DayFlowPrimary else TextMuted,
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    IconButton(
                        onClick = onDelete,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Delete",
                            tint = TextMuted,
                            modifier = Modifier.size(17.dp)
                        )
                    }
                }
            }

            // Badges row: Priority, Category, and Scheduled Slot indicator
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 38.dp, top = 2.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Priority Badge
                Surface(
                    color = prioColor.copy(alpha = 0.18f),
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        text = prio.displayName,
                        color = prioColor,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }

                // Category Badge
                Surface(
                    color = SurfaceElevated,
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        text = "${categoryItem?.icon ?: "📌"} ${todo.category}",
                        color = TextPrimary,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }

                // Scheduled Pill
                if (!todo.scheduledSlotKey.isNullOrBlank()) {
                    val parts = todo.scheduledSlotKey!!.split("_")
                    val timePart = if (parts.size == 2) parts[1] else todo.scheduledSlotKey!!
                    Surface(
                        modifier = Modifier.clickable { onSchedule() },
                        color = DayFlowPrimary.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(4.dp),
                        border = BorderStroke(1.dp, DayFlowPrimary.copy(alpha = 0.5f))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Schedule, contentDescription = null, tint = DayFlowPrimary, modifier = Modifier.size(11.dp))
                            Spacer(modifier = Modifier.width(3.dp))
                            Text(
                                text = "Grid: $timePart",
                                color = DayFlowPrimary,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun TabPill(
    title: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier.clickable { onClick() },
        color = if (selected) DayFlowPrimary else Color.Transparent,
        shape = RoundedCornerShape(16.dp)
    ) {
        Text(
            text = title,
            color = if (selected) Color.White else TextMuted,
            fontSize = 12.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
        )
    }
}
