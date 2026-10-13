package com.dayflow.app.presentation.habits

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dayflow.app.data.local.HabitLogEntity
import com.dayflow.app.domain.model.Category
import com.dayflow.app.presentation.theme.BackgroundDark
import com.dayflow.app.presentation.theme.DayFlowPrimary
import com.dayflow.app.presentation.theme.DayFlowSecondary
import com.dayflow.app.presentation.theme.DayFlowTertiary
import com.dayflow.app.presentation.theme.StatusMissed
import com.dayflow.app.presentation.theme.SurfaceDark
import com.dayflow.app.presentation.theme.SurfaceElevated
import com.dayflow.app.presentation.theme.TextMuted
import com.dayflow.app.presentation.theme.TextPrimary
import com.dayflow.app.presentation.theme.TextSecondary

@Composable
fun HabitsScreen(
    viewModel: HabitsViewModel
) {
    val loggedHabits by viewModel.loggedHabits.collectAsState()
    val totalPoints by viewModel.totalPoints.collectAsState()
    val quickTemplates by viewModel.quickTemplates.collectAsState()
    val isAddRoutineDialogOpen by viewModel.isAddRoutineDialogOpen.collectAsState()
    val routineToDelete by viewModel.routineToDelete.collectAsState()
    val haptic = LocalHapticFeedback.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(16.dp)
    ) {
        // 1. Productivity Points Banner
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = SurfaceDark),
            shape = RoundedCornerShape(16.dp)
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .background(DayFlowTertiary.copy(alpha = 0.2f), RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.EmojiEvents,
                            contentDescription = null,
                            tint = DayFlowTertiary,
                            modifier = Modifier.size(24.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(14.dp))

                    Column {
                        Text(
                            text = "Habit Ledger",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Text(
                            text = "Tap cards below for instant 1-tap logging",
                            fontSize = 11.sp,
                            color = TextMuted
                        )
                    }
                }

                Surface(
                    color = DayFlowTertiary.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text(
                        text = "+$totalPoints pts",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = DayFlowTertiary,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // 2. Routines Header with "+ New Routine" Action
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Quick 1-Tap Routines",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextSecondary
            )

            Surface(
                modifier = Modifier.clickable { viewModel.openAddRoutineDialog() },
                color = DayFlowPrimary.copy(alpha = 0.15f),
                shape = RoundedCornerShape(8.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Add Routine",
                        tint = DayFlowPrimary,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "New Routine",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = DayFlowPrimary
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // 3. Quick Tap Cards (2 Columns)
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            quickTemplates.chunked(2).forEach { rowTemplates ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    rowTemplates.forEach { template ->
                        QuickHabitCard(
                            template = template,
                            modifier = Modifier.weight(1f),
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                viewModel.logQuickHabit(template)
                            },
                            onDelete = if (template.isCustom) {
                                { viewModel.promptDeleteRoutine(template) }
                            } else null
                        )
                    }
                    if (rowTemplates.size == 1) {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // 4. Logged Habits History
        Text(
            text = "Logged Ledger (${loggedHabits.size})",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = TextSecondary
        )
        Spacer(modifier = Modifier.height(8.dp))

        if (loggedHabits.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No habits logged this week yet.\nTap a routine card above to log your first habit!",
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
                items(loggedHabits, key = { it.id }) { habit ->
                    LoggedHabitRow(
                        habit = habit,
                        onDelete = { viewModel.deleteHabit(habit.id) }
                    )
                }
            }
        }
    }

    // Add Habit Preset Dialog
    if (isAddRoutineDialogOpen) {
        AddHabitPresetDialog(
            onDismiss = { viewModel.closeAddRoutineDialog() },
            onSave = { name, cat, pts, icon, notes ->
                viewModel.addCustomRoutine(name, cat, pts, icon, notes)
            }
        )
    }

    // Delete Routine Confirmation Dialog
    routineToDelete?.let { routine ->
        AlertDialog(
            onDismissRequest = { viewModel.cancelDeleteRoutine() },
            containerColor = SurfaceElevated,
            title = {
                Text(
                    text = "Delete Routine?",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
            },
            text = {
                Text(
                    text = "Are you sure you want to delete the custom routine \"${routine.name}\"?",
                    fontSize = 14.sp,
                    color = TextSecondary
                )
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.confirmDeleteRoutine() },
                    colors = ButtonDefaults.buttonColors(containerColor = StatusMissed)
                ) {
                    Text("Delete", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.cancelDeleteRoutine() }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }
}

@Composable
fun QuickHabitCard(
    template: QuickHabitTemplate,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
    onDelete: (() -> Unit)? = null
) {
    val catColor = Color(android.graphics.Color.parseColor(template.category.hexColor))

    Card(
        modifier = modifier.clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = template.icon,
                fontSize = 16.sp
            )
            Spacer(modifier = Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = template.name,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextPrimary,
                    maxLines = 1
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .background(catColor, CircleShape)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "+${template.points} pts",
                        fontSize = 10.sp,
                        color = catColor,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            if (onDelete != null) {
                IconButton(
                    onClick = onDelete,
                    modifier = Modifier.size(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Remove routine",
                        tint = TextMuted,
                        modifier = Modifier.size(14.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun AddHabitPresetDialog(
    onDismiss: () -> Unit,
    onSave: (name: String, category: Category, points: Int, icon: String, notes: String?) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf(Category.WORK) }
    var selectedPoints by remember { mutableIntStateOf(10) }
    var selectedEmoji by remember { mutableStateOf("⚡") }
    var notes by remember { mutableStateOf("") }

    val emojis = listOf("🎯", "💧", "🏃", "📚", "🧘", "🍽️", "⚡", "💻", "🎨", "🚶")
    val pointOptions = listOf(5, 10, 15, 20)

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceElevated,
        shape = RoundedCornerShape(16.dp),
        title = {
            Text(
                text = "⚡ Add Custom Routine",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Name Input
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Routine Name (e.g. Guitar Practice)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = DayFlowPrimary,
                        unfocusedBorderColor = SurfaceDark,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    )
                )

                // Emoji Picker
                Text(
                    text = "Icon / Emoji",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextSecondary
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    emojis.forEach { emoji ->
                        val isSelected = selectedEmoji == emoji
                        Surface(
                            modifier = Modifier.clickable { selectedEmoji = emoji },
                            color = if (isSelected) DayFlowPrimary.copy(alpha = 0.3f) else SurfaceDark,
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = emoji,
                                fontSize = 18.sp,
                                modifier = Modifier.padding(8.dp)
                            )
                        }
                    }
                }

                // Points Selector
                Text(
                    text = "Productivity Points",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextSecondary
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    pointOptions.forEach { pts ->
                        val isSelected = selectedPoints == pts
                        Surface(
                            modifier = Modifier.clickable { selectedPoints = pts },
                            color = if (isSelected) DayFlowTertiary.copy(alpha = 0.3f) else SurfaceDark,
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = "+$pts pts",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isSelected) DayFlowTertiary else TextMuted,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                }

                // Category Selector
                Text(
                    text = "Category",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextSecondary
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Category.entries.forEach { cat ->
                        val isSelected = selectedCategory == cat
                        val catColor = Color(android.graphics.Color.parseColor(cat.hexColor))
                        Surface(
                            modifier = Modifier.clickable { selectedCategory = cat },
                            color = if (isSelected) catColor.copy(alpha = 0.25f) else SurfaceDark,
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = cat.displayName,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (isSelected) catColor else TextMuted,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp)
                            )
                        }
                    }
                }

                // Notes / Label Input
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Default Notes / Subtitle (Optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = DayFlowPrimary,
                        unfocusedBorderColor = SurfaceDark,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    )
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        onSave(name, selectedCategory, selectedPoints, selectedEmoji, notes.ifBlank { null })
                    }
                },
                enabled = name.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary)
            ) {
                Text("Save Routine", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = TextSecondary)
            }
        }
    )
}

@Composable
fun LoggedHabitRow(
    habit: HabitLogEntity,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
        shape = RoundedCornerShape(10.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = habit.habitName,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextPrimary
                )
                if (!habit.notes.isNullOrBlank()) {
                    Text(
                        text = habit.notes,
                        fontSize = 11.sp,
                        color = TextMuted
                    )
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    color = DayFlowTertiary.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Text(
                        text = "+${habit.pointsImpact} pts",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = DayFlowTertiary,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }

                Spacer(modifier = Modifier.width(6.dp))

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
}
