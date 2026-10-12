package com.dayflow.app.presentation.schedule

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dayflow.app.domain.model.Category
import com.dayflow.app.domain.model.CategoryItem
import com.dayflow.app.domain.model.Slot
import com.dayflow.app.domain.model.SlotStatus
import com.dayflow.app.domain.util.DateTimeUtils
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
import java.time.LocalDateTime

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun TaskEditorBottomSheet(
    slot: Slot,
    isNewSlot: Boolean,
    categories: List<CategoryItem> = emptyList(),
    errorMessage: String? = null,
    onSave: (Slot) -> Unit,
    onDelete: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val isTimePassed = remember(slot.slotKey) {
        DateTimeUtils.isSlotTimePassed(slot.slotKey, LocalDateTime.now())
    }
    // Only lock planned task if slot is in the past AND it was already planned
    val isPlannedTaskLocked = isTimePassed && slot.plannedTask.isNotBlank()

    val (_, startTime) = remember(slot.slotKey) {
        DateTimeUtils.parseSlotKey(slot.slotKey)
    }
    val endTime = remember(startTime) { startTime.plusMinutes(30) }
    val timeRangeLabel = "${String.format("%02d:%02d", startTime.hour, startTime.minute)} - ${String.format("%02d:%02d", endTime.hour, endTime.minute)}"

    var plannedTask by remember { mutableStateOf(slot.plannedTask) }
    var actualTask by remember { mutableStateOf(if (slot.actualTask.isNotBlank()) slot.actualTask else slot.plannedTask) }
    val effectiveCategories = remember(categories) {
        if (categories.isNotEmpty()) categories else CategoryItem.DEFAULTS
    }

    var selectedCategoryName by remember {
        mutableStateOf(slot.categoryName.ifBlank { slot.category.displayName })
    }
    val currentCategoryItem = remember(selectedCategoryName, effectiveCategories) {
        effectiveCategories.firstOrNull { it.name.equals(selectedCategoryName, ignoreCase = true) }
            ?: effectiveCategories.firstOrNull()
    }
    var isProductive by remember {
        mutableStateOf(slot.isProductive ?: (currentCategoryItem?.isProductive ?: slot.category.defaultProductive))
    }
    var isProductiveUserEdited by remember {
        mutableStateOf(slot.isProductive != null)
    }
    var selectedStatus by remember { mutableStateOf(slot.status) }
    var actualDuration by remember { mutableIntStateOf(if (slot.actualDuration > 0) slot.actualDuration else slot.plannedDuration) }
    var notes by remember { mutableStateOf(slot.notes ?: "") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = SurfaceDark,
        tonalElevation = 8.dp,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // Header Row: Time Range & Date
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Schedule,
                        contentDescription = null,
                        tint = DayFlowPrimary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = timeRangeLabel,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                }

                Surface(
                    color = SurfaceElevated,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = slot.slotKey.substringBefore("_"),
                        color = TextSecondary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Error Message (if any)
            AnimatedVisibility(visible = errorMessage != null) {
                Surface(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                    color = StatusMissed.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = errorMessage ?: "",
                        color = StatusMissed,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(10.dp)
                    )
                }
            }

            // GOLDEN TIME-LOCK BANNER (if slot has passed and plan is locked)
            if (isPlannedTaskLocked) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = TimeLockedBadge.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = null,
                            tint = TimeLockedBadge,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "Baseline Plan Locked",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = TimeLockedBadge
                            )
                            Text(
                                text = "Original planned task is locked to preserve baseline discipline. Actual execution remains fully editable.",
                                fontSize = 11.sp,
                                color = TextMuted,
                                lineHeight = 15.sp
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
            }

            // 1. PLANNED TASK INPUT
            Text(
                text = "Planned Task",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (isPlannedTaskLocked) TextMuted else TextSecondary
            )
            Spacer(modifier = Modifier.height(6.dp))
            OutlinedTextField(
                value = plannedTask,
                onValueChange = { newPlanned ->
                    if (!isPlannedTaskLocked) {
                        val wasAutoSynced = actualTask.isBlank() || actualTask == plannedTask
                        plannedTask = newPlanned
                        if (wasAutoSynced) actualTask = newPlanned
                    }
                },
                enabled = !isPlannedTaskLocked,
                placeholder = { Text("What do you plan to do?", color = TextMuted) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    disabledBorderColor = SurfaceElevated,
                    disabledTextColor = TextSecondary,
                    focusedBorderColor = DayFlowPrimary,
                    unfocusedBorderColor = SurfaceElevated,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary
                )
            )

            Spacer(modifier = Modifier.height(16.dp))

            // 2. ACTUAL TASK INPUT (Always editable)
            Text(
                text = "Actual Task Executed",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextSecondary
            )
            Spacer(modifier = Modifier.height(6.dp))
            OutlinedTextField(
                value = actualTask,
                onValueChange = { actualTask = it },
                placeholder = { Text("What did you actually accomplish?", color = TextMuted) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = DayFlowPrimary,
                    unfocusedBorderColor = SurfaceElevated,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary
                )
            )

            Spacer(modifier = Modifier.height(18.dp))

            // 3. CATEGORY SELECTION
            Text(
                text = "Focus Category",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextSecondary
            )
            Spacer(modifier = Modifier.height(8.dp))
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                effectiveCategories.forEach { cat ->
                    val isSelected = selectedCategoryName.equals(cat.name, ignoreCase = true)
                    val catColor = try { Color(android.graphics.Color.parseColor(cat.hexColor)) } catch (e: Exception) { Color(0xFF64748B) }
                    Surface(
                        modifier = Modifier.clickable {
                            selectedCategoryName = cat.name
                            if (!isProductiveUserEdited) {
                                isProductive = cat.isProductive
                            }
                        },
                        color = if (isSelected) catColor.copy(alpha = 0.25f) else SurfaceElevated.copy(alpha = 0.5f),
                        shape = RoundedCornerShape(10.dp),
                        border = if (isSelected) androidx.compose.foundation.BorderStroke(1.5.dp, catColor) else null
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = cat.icon,
                                fontSize = 13.sp
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = cat.name,
                                fontSize = 12.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                color = if (isSelected) catColor else TextSecondary
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // 3.5. PRODUCTIVITY CLASSIFICATION
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                color = if (isProductive) Color(0xFFF59E0B).copy(alpha = 0.12f) else SurfaceElevated.copy(alpha = 0.5f),
                border = if (isProductive) androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFF59E0B).copy(alpha = 0.35f)) else null
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "⚡ Productive Focus Task",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isProductive) Color(0xFFF59E0B) else TextPrimary
                            )
                        }
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = if (isProductiveUserEdited) {
                                "Custom override: ${if (isProductive) "⚡ High Impact" else "Standard task"}"
                            } else {
                                "Category default (${currentCategoryItem?.name ?: selectedCategoryName}): ${if (isProductive) "⚡ High Impact" else "Standard task"}"
                            },
                            fontSize = 11.sp,
                            color = TextMuted
                        )
                    }

                    Switch(
                        checked = isProductive,
                        onCheckedChange = { checked ->
                            isProductive = checked
                            isProductiveUserEdited = true
                        },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color(0xFFF59E0B),
                            checkedTrackColor = Color(0xFFF59E0B).copy(alpha = 0.3f),
                            uncheckedThumbColor = TextMuted,
                            uncheckedTrackColor = SurfaceElevated
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            // 4. COMPLETION STATUS
            Text(
                text = "Completion Status",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextSecondary
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                StatusChip(SlotStatus.DONE, StatusDone, selectedStatus == SlotStatus.DONE, Modifier.weight(1f)) {
                    selectedStatus = SlotStatus.DONE
                    if (actualDuration == 0) actualDuration = 30
                }
                StatusChip(SlotStatus.PARTIAL, StatusPartial, selectedStatus == SlotStatus.PARTIAL, Modifier.weight(1f)) {
                    selectedStatus = SlotStatus.PARTIAL
                    if (actualDuration == 0 || actualDuration == 30) actualDuration = 15
                }
                StatusChip(SlotStatus.MISSED, StatusMissed, selectedStatus == SlotStatus.MISSED, Modifier.weight(1f)) {
                    selectedStatus = SlotStatus.MISSED
                    actualDuration = 0
                }
                StatusChip(SlotStatus.PENDING, StatusPending, selectedStatus == SlotStatus.PENDING, Modifier.weight(1f)) {
                    selectedStatus = SlotStatus.PENDING
                    actualDuration = 0
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            // 5. ACTUAL DURATION (Mins - Max 30m per slot)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Actual Duration (Max 30m)",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextSecondary
                )
                Text(
                    text = "${actualDuration}m / 30m",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = DayFlowPrimary
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf(0, 15, 20, 25, 30).forEach { mins ->
                    val isSelected = actualDuration == mins
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { actualDuration = mins },
                        color = if (isSelected) DayFlowPrimary.copy(alpha = 0.2f) else SurfaceElevated,
                        shape = RoundedCornerShape(8.dp),
                        border = if (isSelected) androidx.compose.foundation.BorderStroke(1.5.dp, DayFlowPrimary) else null
                    ) {
                        Text(
                            text = "${mins}m",
                            fontSize = 12.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) DayFlowPrimary else TextSecondary,
                            modifier = Modifier.padding(vertical = 6.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            Slider(
                value = actualDuration.coerceIn(0, 30).toFloat(),
                onValueChange = { actualDuration = ((it / 5).toInt() * 5).coerceIn(0, 30) },
                valueRange = 0f..30f,
                steps = 5,
                colors = SliderDefaults.colors(
                    thumbColor = DayFlowPrimary,
                    activeTrackColor = DayFlowPrimary,
                    inactiveTrackColor = SurfaceElevated
                )
            )

            Spacer(modifier = Modifier.height(12.dp))

            // 6. EXECUTION NOTES
            Text(
                text = "Notes",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextSecondary
            )
            Spacer(modifier = Modifier.height(6.dp))
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                placeholder = { Text("Add any context or learnings...", color = TextMuted) },
                minLines = 2,
                maxLines = 4,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = DayFlowPrimary,
                    unfocusedBorderColor = SurfaceElevated,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary
                )
            )

            Spacer(modifier = Modifier.height(24.dp))

            // ACTION BUTTONS: SAVE & DELETE
            Button(
                onClick = {
                    val resolvedPlanned = if (isPlannedTaskLocked) {
                        slot.plannedTask
                    } else {
                        plannedTask.trim().ifBlank { actualTask.trim() }
                    }
                    val resolvedActual = actualTask.trim().ifBlank { resolvedPlanned }

                    val resolvedCategory = Category.fromString(selectedCategoryName)
                    val updatedSlot = slot.copy(
                        plannedTask = resolvedPlanned,
                        actualTask = resolvedActual,
                        category = resolvedCategory,
                        categoryName = selectedCategoryName,
                        status = selectedStatus,
                        actualDuration = actualDuration,
                        notes = notes.trim().ifEmpty { null },
                        isProductive = isProductive
                    )
                    onSave(updatedSlot)
                },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary)
            ) {
                Text("Save Slot", fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }

            if (!isNewSlot) {
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedButton(
                    onClick = { onDelete(slot.slotKey) },
                    modifier = Modifier.fillMaxWidth().height(44.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = StatusMissed)
                ) {
                    Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Clear / Delete Slot", fontSize = 13.sp)
                }
            }
        }
    }
}

@Composable
private fun StatusChip(
    status: SlotStatus,
    color: Color,
    isSelected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        modifier = modifier.clickable { onClick() },
        color = if (isSelected) color.copy(alpha = 0.25f) else SurfaceElevated.copy(alpha = 0.4f),
        shape = RoundedCornerShape(8.dp),
        border = if (isSelected) androidx.compose.foundation.BorderStroke(1.dp, color) else null
    ) {
        Box(
            modifier = Modifier.padding(vertical = 8.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = status.displayName,
                color = if (isSelected) color else TextMuted,
                fontSize = 11.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
            )
        }
    }
}
