package com.dayflow.app.presentation.todos

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dayflow.app.data.local.TodoEntity
import com.dayflow.app.presentation.theme.BackgroundDark
import com.dayflow.app.presentation.theme.DayFlowPrimary
import com.dayflow.app.presentation.theme.DayFlowSecondary
import com.dayflow.app.presentation.theme.StatusDone
import com.dayflow.app.presentation.theme.SurfaceDark
import com.dayflow.app.presentation.theme.SurfaceElevated
import com.dayflow.app.presentation.theme.TextMuted
import com.dayflow.app.presentation.theme.TextPrimary
import com.dayflow.app.presentation.theme.TextSecondary

@Composable
fun TodosScreen(
    viewModel: TodosViewModel
) {
    val todos by viewModel.todos.collectAsState()
    val notes by viewModel.notes.collectAsState()

    var selectedTab by remember { mutableIntStateOf(0) } // 0 = Checklist, 1 = Strategy Notes
    var newTodoTitle by remember { mutableStateOf("") }
    var notesText by remember(notes) { mutableStateOf(notes ?: "") }
    var isNotesSaved by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(16.dp)
    ) {
        // Tab Switcher: Checklist / Strategy Notes
        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = SurfaceDark,
            contentColor = DayFlowPrimary,
            indicator = { tabPositions ->
                TabRowDefaults.SecondaryIndicator(
                    Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                    color = DayFlowPrimary
                )
            },
            modifier = Modifier.padding(bottom = 16.dp)
        ) {
            Tab(
                selected = selectedTab == 0,
                onClick = { selectedTab = 0 },
                text = {
                    Text(
                        "Weekly Todos (${todos.count { !it.isCompleted }})",
                        fontWeight = if (selectedTab == 0) FontWeight.Bold else FontWeight.Normal,
                        fontSize = 14.sp
                    )
                }
            )
            Tab(
                selected = selectedTab == 1,
                onClick = { selectedTab = 1 },
                text = {
                    Text(
                        "Weekly Notes",
                        fontWeight = if (selectedTab == 1) FontWeight.Bold else FontWeight.Normal,
                        fontSize = 14.sp
                    )
                }
            )
        }

        if (selectedTab == 0) {
            // ==========================================
            // TAB 1: WEEKLY CHECKLIST
            // ==========================================

            // New Todo Input Bar
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
                    )
                )

                Spacer(modifier = Modifier.width(8.dp))

                IconButton(
                    onClick = {
                        if (newTodoTitle.isNotBlank()) {
                            viewModel.createTodo(newTodoTitle)
                            newTodoTitle = ""
                        }
                    },
                    modifier = Modifier
                        .size(48.dp)
                        .background(DayFlowPrimary, RoundedCornerShape(12.dp))
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Add Todo",
                        tint = Color.White
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (todos.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No weekly todos yet.\nAdd high-priority tasks above to stay accountable.",
                        fontSize = 13.sp,
                        color = TextMuted,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(todos, key = { it.id }) { todo ->
                        TodoItemRow(
                            todo = todo,
                            onToggle = { isChecked -> viewModel.toggleTodo(todo.id, isChecked) },
                            onDelete = { viewModel.deleteTodo(todo.id) }
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

@Composable
fun TodoItemRow(
    todo: TodoEntity,
    onToggle: (Boolean) -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (todo.isCompleted) SurfaceDark.copy(alpha = 0.6f) else SurfaceDark
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
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

                Spacer(modifier = Modifier.width(8.dp))

                Text(
                    text = todo.title,
                    fontSize = 14.sp,
                    fontWeight = if (todo.isCompleted) FontWeight.Normal else FontWeight.Medium,
                    color = if (todo.isCompleted) TextMuted else TextPrimary,
                    textDecoration = if (todo.isCompleted) TextDecoration.LineThrough else TextDecoration.None
                )
            }

            IconButton(
                onClick = onDelete,
                modifier = Modifier.size(28.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = "Delete",
                    tint = TextMuted,
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}
