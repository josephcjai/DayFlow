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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dayflow.app.data.local.TodoEntity
import com.dayflow.app.domain.model.CategoryItem
import com.dayflow.app.domain.model.TodoFilter
import com.dayflow.app.domain.model.TodoPriority
import com.dayflow.app.presentation.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodosScreen(
    viewModel: TodosViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit = {}
) {
    val todos by viewModel.todos.collectAsState()
    val allTodos by viewModel.allTodos.collectAsState()
    val notes by viewModel.notes.collectAsState()
    val categories by viewModel.categories.collectAsState()
    val activeFilter by viewModel.activeFilter.collectAsState()

    var selectedTab by remember { mutableIntStateOf(0) } // 0: Todos, 1: Strategy Notes
    var newTodoTitle by remember { mutableStateOf("") }
    var selectedPriority by remember { mutableStateOf(TodoPriority.MEDIUM) }
    var selectedCategory by remember { mutableStateOf("Work") }
    var showCategoryMenu by remember { mutableStateOf(false) }

    var notesText by remember(notes) { mutableStateOf(notes ?: "") }
    var isNotesSaved by remember { mutableStateOf(false) }

    // Dialog state for scheduling & deletion
    var schedulingTodo by remember { mutableStateOf<TodoEntity?>(null) }
    var deletingTodo by remember { mutableStateOf<TodoEntity?>(null) }

    // Feedback snackbar
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
                        text = "Weekly Todos & Strategy",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = "${allTodos.count { it.isCompleted }}/${allTodos.size} goals completed",
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
                // TAB 1: WEEKLY TODOS & TIMEBLOCKING
                // ==========================================

                // 1. Dynamic Filter Pills
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    TodoFilter.entries.forEach { filter ->
                        val isSelected = activeFilter == filter
                        val count = when (filter) {
                            TodoFilter.ALL -> allTodos.size
                            TodoFilter.HIGH -> allTodos.count { it.priority.equals("High", ignoreCase = true) }
                            TodoFilter.MEDIUM -> allTodos.count { it.priority.equals("Medium", ignoreCase = true) }
                            TodoFilter.LOW -> allTodos.count { it.priority.equals("Low", ignoreCase = true) }
                            TodoFilter.PENDING -> allTodos.count { !it.isCompleted }
                            TodoFilter.DONE -> allTodos.count { it.isCompleted }
                        }

                        Surface(
                            modifier = Modifier
                                .clickable { viewModel.setFilter(filter) }
                                .padding(vertical = 2.dp),
                            color = if (isSelected) DayFlowPrimary else SurfaceDark,
                            shape = RoundedCornerShape(16.dp),
                            border = if (!isSelected) BorderStroke(1.dp, SurfaceElevated) else null
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                val dotColor = when (filter) {
                                    TodoFilter.HIGH -> Color(0xFFEF4444)
                                    TodoFilter.MEDIUM -> Color(0xFFF59E0B)
                                    TodoFilter.LOW -> Color(0xFF10B981)
                                    else -> null
                                }
                                if (dotColor != null) {
                                    Box(
                                        modifier = Modifier
                                            .size(7.dp)
                                            .background(dotColor, CircleShape)
                                    )
                                    Spacer(modifier = Modifier.width(5.dp))
                                }
                                Text(
                                    text = "${filter.label} ($count)",
                                    fontSize = 12.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    color = if (isSelected) Color.White else TextPrimary
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // 2. Enhanced Add Todo Card
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            OutlinedTextField(
                                value = newTodoTitle,
                                onValueChange = { newTodoTitle = it },
                                placeholder = { Text("Add new weekly goal...", color = TextMuted, fontSize = 13.sp) },
                                singleLine = true,
                                modifier = Modifier.weight(1f),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = DayFlowPrimary,
                                    unfocusedBorderColor = SurfaceElevated,
                                    focusedTextColor = TextPrimary,
                                    unfocusedTextColor = TextPrimary
                                ),
                                shape = RoundedCornerShape(10.dp)
                            )

                            Spacer(modifier = Modifier.width(8.dp))

                            IconButton(
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
                                modifier = Modifier
                                    .size(48.dp)
                                    .background(DayFlowPrimary, RoundedCornerShape(10.dp))
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Add,
                                    contentDescription = "Add Todo",
                                    tint = Color.White
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // Priority & Category Selectors Row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            // Priority Selector Chips
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Priority:",
                                    fontSize = 11.sp,
                                    color = TextMuted,
                                    fontWeight = FontWeight.Medium
                                )
                                TodoPriority.entries.forEach { prio ->
                                    val isSelected = selectedPriority == prio
                                    val prioColor = Color(android.graphics.Color.parseColor(prio.hexColor))
                                    Surface(
                                        modifier = Modifier.clickable { selectedPriority = prio },
                                        color = if (isSelected) prioColor.copy(alpha = 0.25f) else SurfaceElevated,
                                        shape = RoundedCornerShape(6.dp),
                                        border = if (isSelected) BorderStroke(1.dp, prioColor) else null
                                    ) {
                                        Text(
                                            text = prio.badgeLabel,
                                            fontSize = 11.sp,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                            color = if (isSelected) prioColor else TextMuted,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                        )
                                    }
                                }
                            }

                            // Category Dropdown
                            Box {
                                Surface(
                                    modifier = Modifier.clickable { showCategoryMenu = true },
                                    color = SurfaceElevated,
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        val activeCat = categories.find { it.name.equals(selectedCategory, ignoreCase = true) }
                                        Text(
                                            text = "${activeCat?.icon ?: "📌"} $selectedCategory",
                                            fontSize = 11.sp,
                                            color = TextPrimary
                                        )
                                        Icon(Icons.Default.ArrowDropDown, contentDescription = null, modifier = Modifier.size(16.dp), tint = TextMuted)
                                    }
                                }

                                DropdownMenu(
                                    expanded = showCategoryMenu,
                                    onDismissRequest = { showCategoryMenu = false },
                                    modifier = Modifier.background(SurfaceDark)
                                ) {
                                    val availableCategories = if (categories.isNotEmpty()) categories else CategoryItem.DEFAULTS
                                    availableCategories.forEach { cat ->
                                        DropdownMenuItem(
                                            text = { Text("${cat.icon} ${cat.name}", fontSize = 12.sp, color = TextPrimary) },
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

                Spacer(modifier = Modifier.height(14.dp))

                // 3. Todo Items List
                if (todos.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = TextMuted, modifier = Modifier.size(40.dp))
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "No todos found for '${activeFilter.label}'.\nAdd high-priority tasks above to stay accountable.",
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
                // TAB 2: WEEKLY STRATEGY NOTES
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
                            .padding(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Weekly Focus Strategy",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )

                            Button(
                                onClick = {
                                    viewModel.saveNotes(notesText)
                                    isNotesSaved = true
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Icon(Icons.Default.Save, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(if (isNotesSaved) "Saved" else "Save", fontSize = 12.sp)
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = notesText,
                            onValueChange = {
                                notesText = it
                                isNotesSaved = false
                            },
                            placeholder = {
                                Text(
                                    "Outline your major priorities, time-blocking strategy, or review notes for this week...",
                                    color = TextMuted,
                                    fontSize = 13.sp
                                )
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = DayFlowPrimary,
                                unfocusedBorderColor = Color.Transparent,
                                focusedTextColor = TextPrimary,
                                unfocusedTextColor = TextPrimary
                            )
                        )
                    }
                }
            }
        }
    }

    // 1-Click Schedule Bottom Sheet
    if (schedulingTodo != null) {
        ScheduleTodoBottomSheet(
            todo = schedulingTodo!!,
            onDismiss = { schedulingTodo = null },
            viewModel = viewModel,
            onScheduled = { slotKey ->
                // Refresh or feedback
            }
        )
    }

    // Delete confirmation dialog when scheduled slot exists
    if (deletingTodo != null) {
        AlertDialog(
            onDismissRequest = { deletingTodo = null },
            containerColor = SurfaceDark,
            title = {
                Text("Delete Scheduled Todo", color = TextPrimary, fontWeight = FontWeight.Bold)
            },
            text = {
                Text(
                    "'" + deletingTodo!!.title + "' is currently scheduled on the timeline (" + deletingTodo!!.scheduledSlotKey + ").\n\nDo you want to also clear the scheduled time slot from the schedule grid?",
                    color = TextMuted,
                    fontSize = 13.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteTodo(deletingTodo!!, clearScheduledSlot = true)
                        deletingTodo = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                ) {
                    Text("Clear Both", color = Color.White)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteTodo(deletingTodo!!, clearScheduledSlot = false)
                        deletingTodo = null
                    }
                ) {
                    Text("Keep Slot Only", color = TextPrimary)
                }
            }
        )
    }
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
        colors = CardDefaults.cardColors(
            containerColor = if (todo.isCompleted) SurfaceDark.copy(alpha = 0.5f) else SurfaceDark
        ),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, SurfaceElevated)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Checkbox & Title
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = todo.isCompleted,
                        onCheckedChange = { onToggle(it) },
                        colors = CheckboxDefaults.colors(
                            checkedColor = StatusDone,
                            uncheckedColor = TextMuted,
                            checkmarkColor = Color.White
                        )
                    )

                    Spacer(modifier = Modifier.width(6.dp))

                    Text(
                        text = todo.title,
                        fontSize = 14.sp,
                        fontWeight = if (todo.isCompleted) FontWeight.Normal else FontWeight.Medium,
                        color = if (todo.isCompleted) TextMuted else TextPrimary,
                        textDecoration = if (todo.isCompleted) TextDecoration.LineThrough else TextDecoration.None,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Actions: Schedule button & Delete button
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