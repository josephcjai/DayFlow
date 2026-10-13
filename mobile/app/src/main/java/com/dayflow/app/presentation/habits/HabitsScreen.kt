package com.dayflow.app.presentation.habits

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.text.style.TextAlign
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
    val quickTemplates by viewModel.quickTemplates.collectAsState()
    val pointsBreakdown by viewModel.pointsBreakdown.collectAsState()
    val consistencyMatrix by viewModel.consistencyMatrix.collectAsState()
    val isBreakdownSheetOpen by viewModel.isBreakdownSheetOpen.collectAsState()
    val isEditTargetDialogOpen by viewModel.isEditTargetDialogOpen.collectAsState()
    val selectedAuditFilter by viewModel.selectedAuditFilter.collectAsState()
    val isAddRoutineDialogOpen by viewModel.isAddRoutineDialogOpen.collectAsState()
    val routineToDelete by viewModel.routineToDelete.collectAsState()
    val haptic = LocalHapticFeedback.current

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Gamification Discipline Target Card
        item {
            GamificationTargetCard(
                summary = pointsBreakdown,
                onInspectPoints = { viewModel.openBreakdownSheet() },
                onEditTarget = { viewModel.openEditTargetDialog() }
            )
        }

        // 2. 7-Day Consistency Matrix
        item {
            HabitConsistencyMatrixCard(matrix = consistencyMatrix)
        }

        // 3. Routines Header with "+ New Routine" Action
        item {
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
        }

        // 4. Quick Tap Cards (2 Columns)
        item {
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
        }

        // 5. Logged Habits History Header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Logged Ledger (${loggedHabits.size})",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextSecondary
                )

                if (loggedHabits.isNotEmpty()) {
                    Text(
                        text = "+${loggedHabits.sumOf { it.pointsImpact }} pts earned",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = DayFlowTertiary
                    )
                }
            }
        }

        // 6. Logged Habits Items or Empty State
        if (loggedHabits.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No habits logged this week yet.\nTap a routine card above to log your first action!",
                        fontSize = 13.sp,
                        color = TextMuted,
                        textAlign = TextAlign.Center
                    )
                }
            }
        } else {
            items(loggedHabits, key = { it.id }) { habit ->
                LoggedHabitRow(
                    habit = habit,
                    onDelete = { viewModel.deleteHabit(habit.id) }
                )
            }
        }

        item {
            Spacer(modifier = Modifier.height(24.dp))
        }
    }

    // Points Breakdown Bottom Sheet
    if (isBreakdownSheetOpen) {
        PointsBreakdownBottomSheet(
            summary = pointsBreakdown,
            selectedFilter = selectedAuditFilter,
            onFilterChange = { viewModel.setAuditFilter(it) },
            onDismiss = { viewModel.closeBreakdownSheet() }
        )
    }

    // Edit Target Dialog
    if (isEditTargetDialogOpen) {
        EditTargetDialog(
            currentTarget = pointsBreakdown.dailyTarget,
            onDismiss = { viewModel.closeEditTargetDialog() },
            onSave = { viewModel.setDailyPointsTarget(it) }
        )
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
fun GamificationTargetCard(
    summary: PointsBreakdownSummary,
    onInspectPoints: () -> Unit,
    onEditTarget: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .background(DayFlowTertiary.copy(alpha = 0.2f), RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.EmojiEvents,
                            contentDescription = null,
                            tint = DayFlowTertiary,
                            modifier = Modifier.size(22.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Column {
                        Text(
                            text = "Daily Discipline Goal",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        val pct = if (summary.dailyTarget > 0) (summary.totalPoints * 100 / summary.dailyTarget) else 0
                        Text(
                            text = "${summary.totalPoints} / ${summary.dailyTarget} pts ($pct%)",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (summary.isTargetReached) DayFlowTertiary else TextSecondary
                        )
                    }
                }

                Surface(
                    modifier = Modifier.clickable { onInspectPoints() },
                    color = DayFlowTertiary.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "+${summary.totalPoints} pts",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = DayFlowTertiary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Linear Progress Bar
            val progress = summary.targetProgressPct
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .background(SurfaceElevated, RoundedCornerShape(4.dp))
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(fraction = progress)
                        .height(8.dp)
                        .background(
                            if (summary.isTargetReached) DayFlowTertiary else DayFlowPrimary,
                            RoundedCornerShape(4.dp)
                        )
                )
            }

            // Target Celebration Banner
            if (summary.isTargetReached) {
                Spacer(modifier = Modifier.height(10.dp))
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = DayFlowTertiary.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "🎯 Daily Points Goal Achieved! (+${summary.totalPoints} pts earned)",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = DayFlowTertiary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Actions row: Inspect Breakdown & Edit Goal
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(
                    onClick = onInspectPoints,
                    contentPadding = PaddingValues(horizontal = 4.dp, vertical = 2.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.FilterList,
                        contentDescription = null,
                        tint = DayFlowPrimary,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Inspect Points (${summary.items.size})",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = DayFlowPrimary
                    )
                }

                Surface(
                    modifier = Modifier.clickable { onEditTarget() },
                    color = SurfaceElevated,
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Goal: ${summary.dailyTarget} pts",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = TextSecondary
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun HabitConsistencyMatrixCard(
    matrix: List<HabitDaySummary>
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "7-Day Consistency Matrix",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = "Mon – Sun execution trend",
                        fontSize = 11.sp,
                        color = TextMuted
                    )
                }

                val activeDaysCount = matrix.count { it.points > 0 }
                Surface(
                    color = DayFlowPrimary.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "$activeDaysCount/7 Days Active",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = DayFlowPrimary,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            val maxPoints = matrix.maxOfOrNull { it.points }?.coerceAtLeast(30) ?: 30

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom
            ) {
                matrix.forEach { day ->
                    val barHeightFraction = (day.points.toFloat() / maxPoints.toFloat()).coerceIn(0.08f, 1f)

                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.width(38.dp)
                    ) {
                        // Points indicator
                        Text(
                            text = if (day.points > 0) "+${day.points}" else "·",
                            fontSize = 10.sp,
                            fontWeight = if (day.points > 0) FontWeight.Bold else FontWeight.Normal,
                            color = if (day.isTargetReached) DayFlowTertiary else if (day.points > 0) TextSecondary else TextMuted
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        // Vertical bar container
                        Box(
                            modifier = Modifier
                                .width(14.dp)
                                .height(56.dp)
                                .background(
                                    if (day.isToday) SurfaceElevated else BackgroundDark,
                                    RoundedCornerShape(7.dp)
                                )
                                .then(
                                    if (day.isToday) Modifier.border(1.dp, DayFlowPrimary, RoundedCornerShape(7.dp))
                                    else Modifier
                                ),
                            contentAlignment = Alignment.BottomCenter
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(if (day.points > 0) (56.dp * barHeightFraction) else 0.dp)
                                    .background(
                                        if (day.isTargetReached) DayFlowTertiary
                                        else if (day.points > 0) DayFlowPrimary
                                        else Color.Transparent,
                                        RoundedCornerShape(bottomStart = 7.dp, bottomEnd = 7.dp, topStart = 4.dp, topEnd = 4.dp)
                                    )
                            )
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        // Day Name
                        Text(
                            text = day.dayName,
                            fontSize = 10.sp,
                            fontWeight = if (day.isToday) FontWeight.Bold else FontWeight.Medium,
                            color = if (day.isToday) DayFlowPrimary else TextSecondary
                        )

                        // Day of month
                        Text(
                            text = "${day.date.dayOfMonth}",
                            fontSize = 9.sp,
                            color = if (day.isToday) TextPrimary else TextMuted
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun EditTargetDialog(
    currentTarget: Int,
    onDismiss: () -> Unit,
    onSave: (Int) -> Unit
) {
    var targetValue by remember { mutableStateOf(currentTarget.toString()) }
    val presets = listOf(30, 50, 75, 100)

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceElevated,
        title = {
            Text(
                text = "🎯 Daily Points Goal",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(
                    text = "Set your daily gamification points target from habit triggers and completed goals.",
                    fontSize = 13.sp,
                    color = TextSecondary
                )

                // Quick preset pills
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    presets.forEach { preset ->
                        val isSelected = targetValue == preset.toString()
                        Surface(
                            modifier = Modifier.clickable { targetValue = preset.toString() },
                            color = if (isSelected) DayFlowTertiary.copy(alpha = 0.25f) else SurfaceDark,
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = "$preset pts",
                                fontSize = 12.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                color = if (isSelected) DayFlowTertiary else TextSecondary,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = targetValue,
                    onValueChange = { targetValue = it.filter { char -> char.isDigit() }.take(3) },
                    label = { Text("Points Target (10 - 500)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = DayFlowTertiary,
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
                    val pts = targetValue.toIntOrNull() ?: currentTarget
                    onSave(pts.coerceIn(10, 500))
                },
                colors = ButtonDefaults.buttonColors(containerColor = DayFlowTertiary)
            ) {
                Text("Save Goal", color = Color.Black, fontWeight = FontWeight.Bold)
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
                fontSize = 24.sp,
                modifier = Modifier.padding(end = 10.dp)
            )

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = template.name,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary,
                        maxLines = 1
                    )
                    if (template.isCustom) {
                        Spacer(modifier = Modifier.width(4.dp))
                        Surface(
                            color = DayFlowPrimary.copy(alpha = 0.2f),
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                text = "CUSTOM",
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Bold,
                                color = DayFlowPrimary,
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(2.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Surface(
                        color = catColor.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(4.dp)
                    ) {
                        Text(
                            text = template.category.displayName,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium,
                            color = catColor,
                            modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                        )
                    }

                    Surface(
                        color = DayFlowTertiary.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(4.dp)
                    ) {
                        Text(
                            text = "+${template.points} pts",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = DayFlowTertiary,
                            modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            if (onDelete != null) {
                IconButton(
                    onClick = onDelete,
                    modifier = Modifier.size(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Delete Routine",
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
    var selectedCategory by remember { mutableStateOf(Category.HEALTH) }
    var selectedPoints by remember { mutableIntStateOf(10) }
    var selectedEmoji by remember { mutableStateOf("⚡") }
    var notes by remember { mutableStateOf("") }

    val emojis = listOf("⚡", "💧", "🏃", "📚", "🧘", "🥗", "🎯", "💻", "🧹", "💊", "☕", "🚴")
    val pointOptions = listOf(5, 10, 15, 20, 25)

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceElevated,
        title = {
            Text(
                text = "New 1-Tap Habit Routine",
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
                    label = { Text("Routine Name *") },
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
