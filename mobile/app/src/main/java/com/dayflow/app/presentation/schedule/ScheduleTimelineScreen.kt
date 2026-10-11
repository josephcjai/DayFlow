package com.dayflow.app.presentation.schedule

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dayflow.app.data.sync.SyncStatus
import com.dayflow.app.domain.model.Slot
import com.dayflow.app.domain.model.SlotStatus
import com.dayflow.app.presentation.theme.BackgroundDark
import com.dayflow.app.presentation.theme.DayFlowPrimary
import com.dayflow.app.presentation.theme.StatusDone
import com.dayflow.app.presentation.theme.StatusMissed
import com.dayflow.app.presentation.theme.StatusPartial
import com.dayflow.app.presentation.theme.StatusPending
import com.dayflow.app.presentation.theme.SurfaceDark
import com.dayflow.app.presentation.theme.SurfaceElevated
import com.dayflow.app.presentation.theme.TextMuted
import com.dayflow.app.presentation.theme.TextPrimary
import com.dayflow.app.presentation.theme.TextSecondary
import com.dayflow.app.presentation.theme.TimeLockedBadge
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleTimelineScreen(
    viewModel: ScheduleViewModel
) {
    val uiState by viewModel.uiState.collectAsState()
    val daySlots by viewModel.daySlots.collectAsState()

    val monthYearTitle = uiState.selectedDate.format(DateTimeFormatter.ofPattern("MMMM yyyy"))

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
    ) {
        // 1. Week Navigation Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = monthYearTitle,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                if (uiState.selectedDate != LocalDate.now()) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Surface(
                        modifier = Modifier.clickable { viewModel.selectToday() },
                        color = DayFlowPrimary.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = "Today",
                            color = DayFlowPrimary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = { viewModel.previousWeek() },
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Previous Week",
                        tint = TextSecondary,
                        modifier = Modifier.size(18.dp)
                    )
                }

                IconButton(
                    onClick = { viewModel.nextWeek() },
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = "Next Week",
                        tint = TextSecondary,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }

        // 2. Day Switcher Strip (Monday - Sunday)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            uiState.weekDays.forEach { date ->
                val isSelected = date == uiState.selectedDate
                val isToday = date == LocalDate.now()
                val dayName = date.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.getDefault())
                val dayNumber = date.dayOfMonth.toString()

                Surface(
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 2.dp)
                        .clickable { viewModel.selectDate(date) },
                    color = if (isSelected) DayFlowPrimary else SurfaceDark,
                    shape = RoundedCornerShape(12.dp),
                    border = if (!isSelected && isToday) androidx.compose.foundation.BorderStroke(1.5.dp, DayFlowPrimary) else null
                ) {
                    Column(
                        modifier = Modifier.padding(vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = dayName,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = if (isSelected) Color.White else TextMuted
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = dayNumber,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isSelected) Color.White else TextPrimary
                        )
                    }
                }
            }
        }

        // 3. Offline / Sync Status Indicator Banner
        AnimatedVisibility(
            visible = uiState.syncStatus == SyncStatus.OFFLINE,
            enter = fadeIn() + slideInVertically(),
            exit = fadeOut() + slideOutVertically()
        ) {
            if (uiState.syncStatus == SyncStatus.OFFLINE) {
                Surface(
                    color = Color(0xFFF59E0B).copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.CloudOff,
                            contentDescription = "Offline",
                            tint = Color(0xFFF59E0B),
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Offline Mode · Changes are saved locally and will auto-sync",
                            color = Color(0xFFF59E0B),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            } else if (uiState.syncStatus == SyncStatus.SYNCING) {
                Surface(
                    color = DayFlowPrimary.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            strokeWidth = 2.dp,
                            color = DayFlowPrimary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Syncing changes with server...",
                            color = DayFlowPrimary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        val activeSlots = remember(daySlots) { daySlots.mapNotNull { it.slot } }
        val grandPlannedMins = remember(activeSlots) { activeSlots.sumOf { it.plannedDuration } }
        val grandActualMins = remember(activeSlots) { activeSlots.sumOf { it.actualDuration } }
        val productiveActualMins = remember(activeSlots) {
            activeSlots.filter { it.isProductiveSlot() }.sumOf { it.actualDuration }
        }
        val plannedHrs = String.format(Locale.US, "%.1f", grandPlannedMins / 60f)
        val actualHrs = String.format(Locale.US, "%.1f", grandActualMins / 60f)
        val productiveHrs = String.format(Locale.US, "%.1f", productiveActualMins / 60f)
        val completionScore = if (grandPlannedMins > 0) ((grandActualMins.toFloat() / grandPlannedMins) * 100).toInt().coerceAtMost(100) else 0
        val effectivenessScore = if (grandActualMins > 0) ((productiveActualMins.toFloat() / grandActualMins) * 100).toInt().coerceAtMost(100) else 0

        if (grandPlannedMins > 0 || grandActualMins > 0) {
            DailyEffectivenessCard(
                plannedHrs = plannedHrs,
                actualHrs = actualHrs,
                productiveHrs = productiveHrs,
                completionScore = completionScore,
                effectivenessScore = effectivenessScore
            )
        }

        // 4. Pull-to-Refresh & 48-Slot Timeline List
        PullToRefreshBox(
            isRefreshing = uiState.isRefreshing,
            onRefresh = { viewModel.refreshSchedule() },
            modifier = Modifier.fillMaxSize()
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp)
            ) {
                items(daySlots, key = { it.slotKey }) { row ->
                    TimelineSlotItem(
                        row = row,
                        onSlotClick = { viewModel.openSlotEditor(row.slotKey, row.slot) },
                        onStatusClick = { slot -> viewModel.quickToggleStatus(slot) }
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }

                item {
                    Spacer(modifier = Modifier.height(64.dp))
                }
            }
        }
    }

    // Task Editor Modal BottomSheet
    uiState.editingSlot?.let { slot ->
        TaskEditorBottomSheet(
            slot = slot,
            isNewSlot = uiState.isEditingNewSlot,
            errorMessage = uiState.errorMessage,
            onSave = { updatedSlot -> viewModel.saveSlot(updatedSlot) },
            onDelete = { key -> viewModel.deleteSlot(key) },
            onDismiss = { viewModel.closeSlotEditor() }
        )
    }
}

@Composable
fun TimelineSlotItem(
    row: SlotRowUiModel,
    onSlotClick: () -> Unit,
    onStatusClick: (Slot) -> Unit
) {
    val hasTask = row.slot != null && (row.slot.plannedTask.isNotBlank() || row.slot.actualTask.isNotBlank())
    val categoryColor = if (hasTask) {
        Color(android.graphics.Color.parseColor(row.slot!!.category.hexColor))
    } else {
        Color.Transparent
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Left Column: Time label
        Column(
            modifier = Modifier.width(46.dp),
            horizontalAlignment = Alignment.Start
        ) {
            Text(
                text = row.timeLabel,
                fontSize = 12.sp,
                fontWeight = if (row.isCurrentSlot) FontWeight.Bold else FontWeight.Medium,
                color = if (row.isCurrentSlot) DayFlowPrimary else TextSecondary
            )
            Text(
                text = row.endTimeLabel,
                fontSize = 10.sp,
                color = TextMuted
            )
        }

        // Slot Body Card
        Card(
            modifier = Modifier
                .weight(1f)
                .clickable { onSlotClick() },
            colors = CardDefaults.cardColors(
                containerColor = if (row.isCurrentSlot) SurfaceElevated else SurfaceDark
            ),
            shape = RoundedCornerShape(12.dp),
            border = if (row.isCurrentSlot) androidx.compose.foundation.BorderStroke(1.5.dp, DayFlowPrimary) else null
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Category color accent stripe
                if (hasTask) {
                    Box(
                        modifier = Modifier
                            .width(4.dp)
                            .height(36.dp)
                            .background(categoryColor, shape = RoundedCornerShape(2.dp))
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                }

                // Center Column: Task details
                Column(
                    modifier = Modifier.weight(1f)
                ) {
                    if (hasTask) {
                        val displayTask = if (row.slot.plannedTask.isNotBlank()) row.slot.plannedTask else row.slot.actualTask
                        Text(
                            text = displayTask,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = TextPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )

                        if (row.slot.actualTask.isNotBlank() && row.slot.actualTask != row.slot.plannedTask && row.slot.plannedTask.isNotBlank()) {
                            Text(
                                text = "Actual: ${row.slot.actualTask}",
                                fontSize = 12.sp,
                                color = TextSecondary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(top = 4.dp)
                        ) {
                            Text(
                                text = row.slot.category.displayName,
                                fontSize = 11.sp,
                                color = categoryColor,
                                fontWeight = FontWeight.Medium
                            )

                            if (row.slot.isProductiveSlot()) {
                                Spacer(modifier = Modifier.width(6.dp))
                                Surface(
                                    color = Color(0xFFF59E0B).copy(alpha = 0.2f),
                                    shape = RoundedCornerShape(4.dp)
                                ) {
                                    Text(
                                        text = "⚡ High Impact",
                                        color = Color(0xFFF59E0B),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                    )
                                }
                            }

                            val durationToShow = if (row.slot.actualDuration > 0) row.slot.actualDuration else row.slot.plannedDuration
                            Text(
                                text = "  •  ${durationToShow}m",
                                fontSize = 11.sp,
                                color = TextMuted
                            )

                            if (row.isTimePassed) {
                                Spacer(modifier = Modifier.width(6.dp))
                                Icon(
                                    imageVector = Icons.Default.Lock,
                                    contentDescription = "Plan Locked",
                                    tint = TimeLockedBadge,
                                    modifier = Modifier.size(11.dp)
                                )
                            }
                        }
                    } else {
                        // Empty slot prompt
                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = "Add task",
                                tint = TextMuted.copy(alpha = 0.5f),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (row.isTimePassed) "Available slot (past)" else "Available slot",
                                fontSize = 13.sp,
                                color = TextMuted.copy(alpha = 0.6f)
                            )
                        }
                    }
                }

                // Right Status Chip / Action Button
                if (hasTask) {
                    StatusChip(
                        status = row.slot.status,
                        onClick = { onStatusClick(row.slot) }
                    )
                }
            }
        }
    }
}

@Composable
fun StatusChip(
    status: SlotStatus,
    onClick: () -> Unit
) {
    val (bgColor, textColor, text) = when (status) {
        SlotStatus.DONE -> Triple(StatusDone.copy(alpha = 0.2f), StatusDone, "Done")
        SlotStatus.PARTIAL -> Triple(StatusPartial.copy(alpha = 0.2f), StatusPartial, "Partial")
        SlotStatus.MISSED -> Triple(StatusMissed.copy(alpha = 0.2f), StatusMissed, "Missed")
        SlotStatus.PENDING -> Triple(StatusPending.copy(alpha = 0.15f), StatusPending, "Pending")
    }

    Surface(
        modifier = Modifier.clickable { onClick() },
        color = bgColor,
        shape = RoundedCornerShape(8.dp)
    ) {
        Text(
            text = text,
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@Composable
fun DailyEffectivenessCard(
    plannedHrs: String,
    actualHrs: String,
    productiveHrs: String,
    completionScore: Int,
    effectivenessScore: Int
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
        shape = RoundedCornerShape(14.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, SurfaceElevated)
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Daily Focus & Effectiveness",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextPrimary
                )
                Surface(
                    color = Color(0xFFF59E0B).copy(alpha = 0.15f),
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Text(
                        text = "⚡ High Impact",
                        color = Color(0xFFF59E0B),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Planned
                Column {
                    Text("Planned", fontSize = 11.sp, color = TextMuted)
                    Spacer(modifier = Modifier.height(2.dp))
                    Text("${plannedHrs}h", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                }
                // Actual
                Column {
                    Text("Actual", fontSize = 11.sp, color = TextMuted)
                    Spacer(modifier = Modifier.height(2.dp))
                    Text("${actualHrs}h", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                }
                // Completion
                Column {
                    Text("Score", fontSize = 11.sp, color = TextMuted)
                    Spacer(modifier = Modifier.height(2.dp))
                    Text("${completionScore}%", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = DayFlowPrimary)
                }
                // Work Effectiveness
                Column(horizontalAlignment = Alignment.End) {
                    Text("Work Effectiveness", fontSize = 11.sp, color = Color(0xFFF59E0B))
                    Spacer(modifier = Modifier.height(2.dp))
                    Text("${effectivenessScore}%", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF59E0B))
                    Text("${productiveHrs}h of ${actualHrs}h logged", fontSize = 10.sp, color = TextMuted)
                }
            }
        }
    }
}
