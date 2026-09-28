package com.dayflow.app.presentation.schedule

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
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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

        Spacer(modifier = Modifier.height(8.dp))

        // 3. 48-Slot Timeline List
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
    val categoryColor = if (hasTask && row.slot != null) {
        Color(android.graphics.Color.parseColor(row.slot.category.hexColor))
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
                    .padding(vertical = 10.dp, horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Category Color Stripe (if task scheduled)
                if (hasTask) {
                    Box(
                        modifier = Modifier
                            .width(4.dp)
                            .height(34.dp)
                            .background(categoryColor, RoundedCornerShape(2.dp))
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                }

                // Task Details
                Column(modifier = Modifier.weight(1f)) {
                    if (hasTask && row.slot != null) {
                        val displayTitle = row.slot.plannedTask.ifBlank { row.slot.actualTask }

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = displayTitle,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = TextPrimary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            if (row.isTimePassed) {
                                Spacer(modifier = Modifier.width(6.dp))
                                Icon(
                                    imageVector = Icons.Default.Lock,
                                    contentDescription = "Baseline Locked",
                                    tint = TimeLockedBadge,
                                    modifier = Modifier.size(13.dp)
                                )
                            }
                        }

                        if (row.slot.actualTask.isNotBlank() && row.slot.plannedTask.isNotBlank() && row.slot.actualTask != row.slot.plannedTask) {
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "Actual: ${row.slot.actualTask}",
                                fontSize = 11.sp,
                                color = TextMuted,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    } else {
                        // Empty Slot Placeholder
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = null,
                                tint = TextMuted,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "Available slot",
                                fontSize = 12.sp,
                                color = TextMuted
                            )
                        }
                    }
                }

                // Right Status / Quick Action
                if (hasTask && row.slot != null) {
                    val statusColor = when (row.slot.status) {
                        SlotStatus.DONE -> StatusDone
                        SlotStatus.PARTIAL -> StatusPartial
                        SlotStatus.MISSED -> StatusMissed
                        SlotStatus.PENDING -> StatusPending
                    }

                    Surface(
                        modifier = Modifier.clickable { onStatusClick(row.slot) },
                        color = statusColor.copy(alpha = 0.18f),
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = row.slot.status.displayName,
                            color = statusColor,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }
        }
    }
}
