package com.dayflow.app.presentation.todos

import androidx.compose.foundation.BorderStroke

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dayflow.app.data.local.TodoEntity
import com.dayflow.app.domain.usecase.ScheduleTodoResult
import com.dayflow.app.domain.util.DateTimeUtils
import com.dayflow.app.presentation.theme.*
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleTodoBottomSheet(
    todo: TodoEntity,
    onDismiss: () -> Unit,
    viewModel: TodosViewModel,
    onScheduled: (String) -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val today = remember { LocalDate.now() }
    val (parsedSlotDate, parsedSlotTime) = remember(todo.scheduledSlotKey) {
        if (!todo.scheduledSlotKey.isNullOrBlank()) {
            try {
                DateTimeUtils.parseSlotKey(todo.scheduledSlotKey)
            } catch (e: Exception) {
                Pair(today, java.time.LocalTime.of(9, 0))
            }
        } else {
            Pair(today, java.time.LocalTime.of(9, 0))
        }
    }

    var selectedDate by remember { mutableStateOf(parsedSlotDate) }
    var selectedTime by remember {
        mutableStateOf(String.format("%02d:%02d", parsedSlotTime.hour, parsedSlotTime.minute))
    }

    // Week dates: Monday to Sunday
    val weekDates: List<LocalDate> = remember(selectedDate) {
        val monday = DateTimeUtils.getMondayOfWeek(selectedDate)
        DateTimeUtils.generateWeekDays(monday)
    }

    val allTimeSlots = remember {
        (0..23).flatMap { hour ->
            listOf(
                String.format("%02d:00", hour),
                String.format("%02d:30", hour)
            )
        }
    }

    var conflictInfo by remember { mutableStateOf<Pair<String, String>?>(null) }
    var forceOverwrite by remember { mutableStateOf(false) }
    var isCheckingConflict by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Check conflict when date or time changes
    LaunchedEffect(selectedDate, selectedTime) {
        isCheckingConflict = true
        forceOverwrite = false
        val (hasConflict, conflict) = viewModel.checkSlotConflict(selectedDate, selectedTime)
        conflictInfo = if (hasConflict) conflict else null
        isCheckingConflict = false
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = SurfaceDark,
        dragHandle = { BottomSheetDefaults.DragHandle(color = SurfaceElevated) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 10.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.CalendarMonth,
                        contentDescription = null,
                        tint = DayFlowPrimary,
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Schedule to Timeline",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                }

                IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = TextMuted)
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Todo Preview Card
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = SurfaceElevated.copy(alpha = 0.5f),
                shape = RoundedCornerShape(10.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = todo.title,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = TextPrimary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            // Priority badge
                            val priorityColor = when (todo.priority.lowercase()) {
                                "high" -> Color(0xFFEF4444)
                                "low" -> Color(0xFF10B981)
                                else -> Color(0xFFF59E0B)
                            }
                            Surface(
                                color = priorityColor.copy(alpha = 0.2f),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(
                                    text = todo.priority,
                                    color = priorityColor,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                            // Category badge
                            Surface(
                                color = DayFlowPrimary.copy(alpha = 0.15f),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(
                                    text = todo.category,
                                    color = DayFlowPrimary,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }

                    if (!todo.scheduledSlotKey.isNullOrBlank()) {
                        TextButton(
                            onClick = {
                                viewModel.unscheduleTodo(todo)
                                onDismiss()
                            }
                        ) {
                            Text("Unschedule", color = Color(0xFFEF4444), fontSize = 12.sp)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // 1. Target Date Selector
            Text(
                text = "SELECT DATE",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = TextMuted,
                letterSpacing = 0.8.sp
            )
            Spacer(modifier = Modifier.height(8.dp))

            LazyRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(weekDates) { date: LocalDate ->
                    val isSelected = date == selectedDate
                    val isToday = date == today
                    val dayName = date.format(DateTimeFormatter.ofPattern("EEE"))
                    val dayNum = date.dayOfMonth.toString()

                    Surface(
                        modifier = Modifier
                            .clickable { selectedDate = date }
                            .width(58.dp)
                            .height(64.dp),
                        color = if (isSelected) DayFlowPrimary else SurfaceElevated,
                        shape = RoundedCornerShape(10.dp),
                        border = if (isToday && !isSelected) BorderStroke(1.dp, DayFlowPrimary) else null
                    ) {
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = dayName,
                                fontSize = 11.sp,
                                color = if (isSelected) Color.White.copy(alpha = 0.8f) else TextMuted,
                                fontWeight = FontWeight.Medium
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = dayNum,
                                fontSize = 16.sp,
                                color = if (isSelected) Color.White else TextPrimary,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // 2. Target Time Slot Selector
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "SELECT 30-MIN SLOT",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextMuted,
                    letterSpacing = 0.8.sp
                )

                TextButton(
                    onClick = {
                        coroutineScope.launch {
                            val freeSlot = viewModel.findNextFreeSlot(selectedDate, selectedTime)
                            if (freeSlot != null) {
                                selectedTime = freeSlot
                            }
                        }
                    },
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Icon(Icons.Default.FlashOn, contentDescription = null, modifier = Modifier.size(14.dp), tint = Color(0xFFF59E0B))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Auto-Find Next Free", fontSize = 12.sp, color = Color(0xFFF59E0B))
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Horizontal scrollable slots row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                allTimeSlots.forEach { slotTime ->
                    val isSelected = slotTime == selectedTime
                    Surface(
                        modifier = Modifier
                            .clickable { selectedTime = slotTime }
                            .padding(vertical = 2.dp),
                        color = if (isSelected) DayFlowPrimary else SurfaceElevated,
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = slotTime,
                            fontSize = 13.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            color = if (isSelected) Color.White else TextPrimary,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // 3. Conflict Warning Banner
            if (conflictInfo != null) {
                val (task, cat) = conflictInfo!!
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = Color(0xFFEF4444).copy(alpha = 0.15f),
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, Color(0xFFEF4444).copy(alpha = 0.4f))
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFEF4444), modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Slot Occupied Conflict",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFEF4444)
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Slot $selectedTime is currently assigned to \"$task\" ($cat).",
                            fontSize = 12.sp,
                            color = TextPrimary
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.clickable { forceOverwrite = !forceOverwrite }
                        ) {
                            Checkbox(
                                checked = forceOverwrite,
                                onCheckedChange = { forceOverwrite = it },
                                colors = CheckboxDefaults.colors(
                                    checkedColor = Color(0xFFEF4444),
                                    checkmarkColor = Color.White
                                )
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Overwrite existing task with this Todo",
                                fontSize = 12.sp,
                                color = TextPrimary,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
            }

            if (errorMessage != null) {
                Text(
                    text = errorMessage!!,
                    color = Color(0xFFEF4444),
                    fontSize = 12.sp,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
            }

            // 4. Action Button
            Button(
                onClick = {
                    errorMessage = null
                    viewModel.scheduleTodoToGrid(
                        todo = todo,
                        date = selectedDate,
                        timeStr = selectedTime,
                        forceOverwrite = forceOverwrite
                    ) { result ->
                        when (result) {
                            is ScheduleTodoResult.Success -> {
                                onScheduled(result.slotKey)
                                onDismiss()
                            }
                            is ScheduleTodoResult.Conflict -> {
                                errorMessage = "Slot is occupied. Select 'Overwrite' or pick another slot."
                            }
                            is ScheduleTodoResult.Error -> {
                                errorMessage = result.message
                            }
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                enabled = conflictInfo == null || forceOverwrite,
                colors = ButtonDefaults.buttonColors(
                    containerColor = DayFlowPrimary,
                    disabledContainerColor = SurfaceElevated
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(Icons.Default.CalendarMonth, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (conflictInfo != null && forceOverwrite) "Overwrite & Schedule to $selectedTime" else "Schedule to $selectedTime",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
