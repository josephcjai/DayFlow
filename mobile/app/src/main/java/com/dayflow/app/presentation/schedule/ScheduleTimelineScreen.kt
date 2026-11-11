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
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.TextButton
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
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.dayflow.app.data.sync.SyncStatus
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.HorizontalDivider
import androidx.compose.ui.text.style.TextAlign
import com.dayflow.app.domain.model.AnalyticsScope
import com.dayflow.app.domain.model.CategoryDistributionItem
import com.dayflow.app.domain.model.DayConsistencyItem
import com.dayflow.app.domain.model.ScheduleAnalyticsData
import com.dayflow.app.domain.model.CategoryItem
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
    val categories by viewModel.categories.collectAsState()
    val templates by viewModel.templates.collectAsState()
    val analyticsData by viewModel.analyticsData.collectAsState()
    val dayCategoryCounts by viewModel.dayCategoryCounts.collectAsState()
    val undoMessage by viewModel.undoMessage.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }
    val listState = rememberLazyListState()
    var hasAutoScrolledToNow by remember(uiState.selectedDate) { mutableStateOf(false) }

    LaunchedEffect(daySlots, uiState.selectedDate) {
        if (!hasAutoScrolledToNow && uiState.selectedDate == LocalDate.now()) {
            val currentIndex = daySlots.indexOfFirst { it.isCurrentSlot }
            if (currentIndex >= 0) {
                listState.animateScrollToItem(maxOf(0, currentIndex - 1))
                hasAutoScrolledToNow = true
            }
        }
    }

    LaunchedEffect(undoMessage) {
        undoMessage?.let { msg ->
            val isRestored = msg.startsWith("↩️")
            val result = snackbarHostState.showSnackbar(
                message = msg,
                actionLabel = if (isRestored) null else "Undo",
                duration = SnackbarDuration.Short
            )
            if (result == SnackbarResult.ActionPerformed) {
                viewModel.undoLastAction()
            }
            viewModel.clearUndoMessage()
        }
    }

    val monthYearTitle = uiState.selectedDate.format(DateTimeFormatter.ofPattern("MMMM yyyy"))

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
    ) {
        // 1. Week Navigation Header or Contextual Selection Header
        if (uiState.isSelectionMode) {
            Surface(
                color = SurfaceElevated,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(
                            onClick = { viewModel.clearSelection() },
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Cancel",
                                tint = TextPrimary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = "${uiState.selectedSlotKeys.size} selected",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    }

                    TextButton(
                        onClick = { viewModel.selectAllCurrentDaySlots() }
                    ) {
                        Text(
                            text = "Select All",
                            color = DayFlowPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        } else {
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
                Spacer(modifier = Modifier.width(8.dp))
                Surface(
                    modifier = Modifier.clickable { viewModel.openTemplateSheet() },
                    color = Color(0xFF6366F1).copy(alpha = 0.20f),
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Text(
                        text = "⚡ Template",
                        color = Color(0xFF818CF8),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp)
                    )
                }
                Spacer(modifier = Modifier.width(6.dp))
                Surface(
                    modifier = Modifier.clickable {
                        val firstKey = daySlots.firstOrNull { it.slot != null }?.slotKey ?: daySlots.firstOrNull()?.slotKey ?: ""
                        viewModel.enterSelectionMode(firstKey)
                    },
                    color = DayFlowPrimary.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Text(
                        text = "☑ Select",
                        color = DayFlowPrimary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp)
                    )
                }

                if (uiState.clipboardSlot != null && !uiState.isSelectionMode) {
                    Spacer(modifier = Modifier.width(6.dp))
                    Surface(
                        color = DayFlowPrimary.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(6.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, DayFlowPrimary.copy(alpha = 0.5f)),
                        modifier = Modifier.clickable { viewModel.clearClipboard() }
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "📋 ${uiState.clipboardSlot?.plannedTask?.ifBlank { uiState.clipboardSlot?.actualTask }?.take(8) ?: "Task"}",
                                color = DayFlowPrimary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("✕", color = DayFlowPrimary, fontSize = 10.sp)
                        }
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

        // 2b. Template Feedback Banner
        AnimatedVisibility(visible = uiState.templateFeedbackMessage != null) {
            uiState.templateFeedbackMessage?.let { feedback ->
                Surface(
                    color = DayFlowPrimary.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp)
                        .clickable { viewModel.clearTemplateFeedback() }
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "✓ $feedback",
                            color = DayFlowPrimary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = "Dismiss",
                            color = TextMuted,
                            fontSize = 11.sp
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

        if (analyticsData.plannedMinutes > 0 || analyticsData.actualMinutes > 0) {
            DailyEffectivenessCard(
                analytics = analyticsData,
                isExpanded = uiState.isAnalyticsExpanded,
                onToggleExpand = { viewModel.toggleAnalyticsExpanded() },
                onScopeChanged = { scope -> viewModel.setAnalyticsScope(scope) }
            )
        }

        // Horizontal Category Filter Bar (Web Parity: Filter by category)
        TimelineCategoryFilterBar(
            categories = categories,
            selectedCategoryFilter = uiState.selectedCategoryFilter,
            categoryCounts = dayCategoryCounts,
            onCategorySelected = { catName -> viewModel.setCategoryFilter(catName) }
        )

        Spacer(modifier = Modifier.height(2.dp))

        // 4. Pull-to-Refresh & 48-Slot Timeline List with Bulk Actions
        Box(modifier = Modifier.fillMaxSize()) {
            PullToRefreshBox(
                isRefreshing = uiState.isRefreshing,
                onRefresh = { viewModel.refreshSchedule() },
                modifier = Modifier.fillMaxSize()
            ) {
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp)
                ) {
                    if (uiState.selectedCategoryFilter != "ALL" && daySlots.isNotEmpty()) {
                        item {
                            Surface(
                                color = SurfaceDark,
                                shape = RoundedCornerShape(8.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, SurfaceElevated),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "Filtered by '${uiState.selectedCategoryFilter}' (${daySlots.size} slots)",
                                        fontSize = 11.sp,
                                        color = DayFlowPrimary,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                    Text(
                                        text = "Clear Filter",
                                        fontSize = 11.sp,
                                        color = TextMuted,
                                        modifier = Modifier.clickable { viewModel.setCategoryFilter("ALL") }
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                        }
                    }

                    if (daySlots.isEmpty() && uiState.selectedCategoryFilter != "ALL") {
                        item {
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 16.dp),
                                colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                                shape = RoundedCornerShape(14.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, SurfaceElevated)
                            ) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(24.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text("📌", fontSize = 28.sp)
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "No tasks in '${uiState.selectedCategoryFilter}'",
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimary
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = "No time blocks scheduled with this category for today.",
                                        fontSize = 12.sp,
                                        color = TextMuted,
                                        textAlign = TextAlign.Center
                                    )
                                    Spacer(modifier = Modifier.height(14.dp))
                                    Button(
                                        onClick = { viewModel.setCategoryFilter("ALL") },
                                        colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary),
                                        shape = RoundedCornerShape(8.dp)
                                    ) {
                                        Text("Show All Slots", fontSize = 12.sp, color = Color.White)
                                    }
                                }
                            }
                        }
                    }

                    items(daySlots, key = { it.slotKey }) { row ->
                        TimelineSlotItem(
                            row = row,
                            categories = categories,
                            isSelectionMode = uiState.isSelectionMode,
                            isSelected = uiState.selectedSlotKeys.contains(row.slotKey),
                            onSlotClick = {
                                if (uiState.isSelectionMode) {
                                    viewModel.toggleSlotSelection(row.slotKey)
                                } else {
                                    viewModel.openSlotEditor(row.slotKey, row.slot)
                                }
                            },
                            onSlotLongClick = {
                                viewModel.enterSelectionMode(row.slotKey)
                            },
                            onPasteDirect = if (uiState.clipboardSlot != null && !uiState.isSelectionMode && row.slot == null) {
                                { viewModel.pasteToSlot(row.slotKey) }
                            } else null,
                            onStatusClick = { slot -> viewModel.quickToggleStatus(slot) }
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }

                    item {
                        Spacer(modifier = Modifier.height(88.dp))
                    }
                }
            }

            // Floating Bulk Action Bar
            androidx.compose.animation.AnimatedVisibility(
                visible = uiState.isSelectionMode,
                enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
                exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 16.dp, start = 16.dp, end = 16.dp)
            ) {
                Surface(
                    color = SurfaceElevated,
                    shape = RoundedCornerShape(16.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, DayFlowPrimary.copy(alpha = 0.3f)),
                    shadowElevation = 8.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (uiState.selectedSlotKeys.size == 1) {
                            val singleKey = uiState.selectedSlotKeys.first()
                            val selectedSlot = daySlots.firstOrNull { it.slotKey == singleKey }?.slot
                            if (selectedSlot != null && (selectedSlot.plannedTask.isNotBlank() || selectedSlot.actualTask.isNotBlank())) {
                                Button(
                                    onClick = { viewModel.copySlot(selectedSlot) },
                                    colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary.copy(alpha = 0.15f)),
                                    shape = RoundedCornerShape(10.dp),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp)
                                ) {
                                    Text("📋", fontSize = 12.sp)
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Copy", color = DayFlowPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                                }
                            }
                        }

                        if (uiState.clipboardSlot != null) {
                            Button(
                                onClick = { viewModel.bulkPasteToSelectedSlots() },
                                colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary),
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp)
                            ) {
                                Text("📥", fontSize = 12.sp)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Paste", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                            }
                        }

                        Button(
                            onClick = { viewModel.bulkMarkAsDone() },
                            colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary.copy(alpha = 0.15f)),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = null,
                                tint = DayFlowPrimary,
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Done", color = DayFlowPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                        }

                        Button(
                            onClick = { viewModel.openBulkCategoryPicker() },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF59E0B).copy(alpha = 0.15f)),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Edit,
                                contentDescription = null,
                                tint = Color(0xFFF59E0B),
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Category", color = Color(0xFFF59E0B), fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                        }

                        Button(
                            onClick = { viewModel.bulkClearSlots() },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444).copy(alpha = 0.15f)),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Delete,
                                contentDescription = null,
                                tint = Color(0xFFEF4444),
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Clear", color = Color(0xFFEF4444), fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                        }
                    }
                }
            }

            // Floating Undo / Action Snackbar
            SnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = if (uiState.isSelectionMode) 84.dp else 20.dp, start = 16.dp, end = 16.dp)
            ) { data ->
                Snackbar(
                    snackbarData = data,
                    containerColor = SurfaceElevated,
                    contentColor = TextPrimary,
                    actionColor = DayFlowPrimary,
                    shape = RoundedCornerShape(12.dp)
                )
            }
        }
    }

    // Bulk Category Picker BottomSheet
    if (uiState.isCategoryPickerOpen) {
        BulkCategoryPickerBottomSheet(
            categories = categories,
            selectedCount = uiState.selectedSlotKeys.size,
            onCategorySelected = { cat -> viewModel.bulkAssignCategory(cat) },
            onDismiss = { viewModel.closeBulkCategoryPicker() }
        )
    }

    // Apply Template BottomSheet
    if (uiState.isTemplateSheetOpen) {
        ApplyTemplateBottomSheet(
            selectedDate = uiState.selectedDate,
            templates = templates,
            categories = categories,
            currentDaySlots = daySlots,
            onApplyTemplate = { tmpl -> viewModel.applyTemplate(tmpl) },
            onSaveDayAsTemplate = { name, desc -> viewModel.saveCurrentDayAsTemplate(name, desc) },
            onUpdateTemplate = { id, name, desc, slots -> viewModel.updateTemplate(id, name, desc, slots) },
            onDeleteTemplate = { tmplId -> viewModel.deleteTemplate(tmplId) },
            onDismiss = { viewModel.closeTemplateSheet() }
        )
    }

    // Task Editor Modal BottomSheet
    uiState.editingSlot?.let { slot ->
        TaskEditorBottomSheet(
            slot = slot,
            isNewSlot = uiState.isEditingNewSlot,
            categories = categories,
            clipboardSlot = uiState.clipboardSlot,
            errorMessage = uiState.errorMessage,
            onCopy = { copied -> viewModel.copySlot(copied) },
            onDuplicateToNext = { slotToDup ->
                viewModel.saveSlot(slotToDup)
                viewModel.duplicateToNextSlot(slotToDup)
                viewModel.closeSlotEditor()
            },
            onSave = { updatedSlot -> viewModel.saveSlot(updatedSlot) },
            onDelete = { key -> viewModel.deleteSlot(key) },
            onDismiss = { viewModel.closeSlotEditor() }
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun TimelineSlotItem(
    row: SlotRowUiModel,
    categories: List<CategoryItem> = emptyList(),
    isSelectionMode: Boolean = false,
    isSelected: Boolean = false,
    onSlotClick: () -> Unit,
    onSlotLongClick: () -> Unit = {},
    onPasteDirect: (() -> Unit)? = null,
    onStatusClick: (Slot) -> Unit
) {
    val hasTask = row.slot != null && (row.slot.plannedTask.isNotBlank() || row.slot.actualTask.isNotBlank())
    val matchedCat = remember(row.slot?.categoryName, categories) {
        categories.firstOrNull { it.name.equals(row.slot?.categoryName, ignoreCase = true) }
    }
    val categoryColor = if (hasTask) {
        if (matchedCat != null) {
            try { Color(android.graphics.Color.parseColor(matchedCat.hexColor)) } catch (e: Exception) { Color(0xFF64748B) }
        } else {
            try { Color(android.graphics.Color.parseColor(row.slot!!.category.hexColor)) } catch (e: Exception) { Color(0xFF64748B) }
        }
    } else {
        Color.Transparent
    }
    val categoryIcon = matchedCat?.icon ?: row.slot?.category?.icon ?: "📌"
    val categoryDisplayName = matchedCat?.name ?: row.slot?.categoryName ?: row.slot?.category?.displayName ?: "General"

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Left Column: Time label
        Column(
            modifier = Modifier.width(62.dp),
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
                .combinedClickable(
                    onClick = onSlotClick,
                    onLongClick = onSlotLongClick
                ),
            colors = CardDefaults.cardColors(
                containerColor = if (isSelected) DayFlowPrimary.copy(alpha = 0.18f) else if (row.isCurrentSlot) SurfaceElevated else SurfaceDark
            ),
            shape = RoundedCornerShape(12.dp),
            border = if (isSelected) androidx.compose.foundation.BorderStroke(1.5.dp, DayFlowPrimary)
                     else if (row.isCurrentSlot) androidx.compose.foundation.BorderStroke(1.5.dp, DayFlowPrimary)
                     else null
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                if (isSelectionMode) {
                    Icon(
                        imageVector = if (isSelected) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                        contentDescription = if (isSelected) "Selected" else "Not selected",
                        tint = if (isSelected) DayFlowPrimary else TextMuted,
                        modifier = Modifier
                            .padding(end = 8.dp)
                            .size(20.dp)
                    )
                }
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
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (row.isCurrentSlot) {
                                NowIndicatorBadge()
                                Spacer(modifier = Modifier.width(6.dp))
                            }
                            Text(
                                text = displayTask,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = TextPrimary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

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
                                text = "$categoryIcon $categoryDisplayName",
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
                            if (row.isCurrentSlot) {
                                NowIndicatorBadge()
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "+ Log current task",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = DayFlowPrimary
                                )
                            } else {
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
                }

                // Right Status Chip / Action Button
                if (hasTask) {
                    StatusChip(
                        status = row.slot.status,
                        onClick = { onStatusClick(row.slot) }
                    )
                } else if (row.isCurrentSlot) {
                    Surface(
                        color = DayFlowPrimary.copy(alpha = 0.18f),
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, DayFlowPrimary.copy(alpha = 0.4f)),
                        modifier = Modifier.clickable { onSlotClick() }
                    ) {
                        Text(
                            text = "+ Log",
                            color = DayFlowPrimary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                } else if (onPasteDirect != null) {
                    Surface(
                        color = DayFlowPrimary.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, DayFlowPrimary.copy(alpha = 0.4f)),
                        modifier = Modifier.clickable { onPasteDirect() }
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("📥", fontSize = 11.sp)
                            Spacer(modifier = Modifier.width(3.dp))
                            Text(
                                text = "Paste",
                                color = DayFlowPrimary,
                                fontSize = 11.sp,
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
    analytics: ScheduleAnalyticsData,
    isExpanded: Boolean,
    onToggleExpand: () -> Unit,
    onScopeChanged: (AnalyticsScope) -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 3.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, SurfaceElevated)
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            // Header Row: Scope Selector & Expand Toggle
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onToggleExpand() },
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f, fill = false)
                ) {
                    Text(
                        text = if (analytics.scope == AnalyticsScope.DAY) "Daily Focus Analytics" else "Weekly Focus Analytics",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Icon(
                        imageVector = if (isExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                        contentDescription = if (isExpanded) "Minimise" else "Expand",
                        tint = DayFlowPrimary,
                        modifier = Modifier.size(16.dp)
                    )

                    if (!isExpanded) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            color = SurfaceElevated,
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = "${analytics.plannedHours}h • ${analytics.completionScore}%",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = DayFlowPrimary,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }

                // Scope selector toggle
                Row(
                    modifier = Modifier
                        .background(SurfaceElevated, RoundedCornerShape(8.dp))
                        .padding(2.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    ScopePill(
                        label = "Day",
                        isSelected = analytics.scope == AnalyticsScope.DAY,
                        onClick = { onScopeChanged(AnalyticsScope.DAY) }
                    )
                    ScopePill(
                        label = "Week",
                        isSelected = analytics.scope == AnalyticsScope.WEEK,
                        onClick = { onScopeChanged(AnalyticsScope.WEEK) }
                    )
                }
            }

            // Expandable Content: KPI Metrics + Category Distribution & 7-Day Consistency Trend
            AnimatedVisibility(visible = isExpanded) {
                Column(modifier = Modifier.padding(top = 10.dp)) {
                    HorizontalDivider(
                        modifier = Modifier.fillMaxWidth(),
                        thickness = 1.dp,
                        color = SurfaceElevated
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    // KPI Metrics Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        // Planned
                        Column {
                            Text("Planned", fontSize = 11.sp, color = TextMuted)
                            Spacer(modifier = Modifier.height(2.dp))
                            Text("${analytics.plannedHours}h", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        }
                        // Actual
                        Column {
                            Text("Actual", fontSize = 11.sp, color = TextMuted)
                            Spacer(modifier = Modifier.height(2.dp))
                            Text("${analytics.actualHours}h", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        }
                        // Score
                        Column {
                            Text("Score", fontSize = 11.sp, color = TextMuted)
                            Spacer(modifier = Modifier.height(2.dp))
                            Text("${analytics.completionScore}%", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = DayFlowPrimary)
                        }
                        // Work Effectiveness
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Work Effectiveness", fontSize = 11.sp, color = Color(0xFFF59E0B))
                            Spacer(modifier = Modifier.height(2.dp))
                            Text("${analytics.effectivenessScore}%", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF59E0B))
                            Text("${analytics.productiveHours}h of ${analytics.actualHours}h logged", fontSize = 10.sp, color = TextMuted)
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    HorizontalDivider(
                        modifier = Modifier.fillMaxWidth(),
                        thickness = 1.dp,
                        color = SurfaceElevated
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    // 1. Category Focus Distribution
                    Text(
                        text = "Category Focus Distribution",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    if (analytics.categoryDistribution.isEmpty()) {
                        Text(
                            text = "No focus blocks recorded for this period.",
                            fontSize = 11.sp,
                            color = TextMuted,
                            modifier = Modifier.padding(vertical = 4.dp)
                        )
                    } else {
                        analytics.categoryDistribution.forEach { catItem ->
                            CategoryDistributionRow(item = catItem)
                            Spacer(modifier = Modifier.height(6.dp))
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    HorizontalDivider(
                        modifier = Modifier.fillMaxWidth(),
                        thickness = 1.dp,
                        color = SurfaceElevated
                    )
                    Spacer(modifier = Modifier.height(10.dp))

                    // 2. 7-Day Consistency Trend
                    Text(
                        text = "7-Day Consistency Context (Mon – Sun)",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "Showing daily logged focus hours (⭐ = Selected Day)",
                        fontSize = 10.sp,
                        color = TextMuted
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    WeeklyTrendRow(trend = analytics.weeklyConsistencyTrend)
                }
            }
        }
    }
}

@Composable
private fun ScopePill(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier.clickable { onClick() },
        color = if (isSelected) DayFlowPrimary else Color.Transparent,
        shape = RoundedCornerShape(6.dp)
    ) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = if (isSelected) Color.White else TextMuted,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

@Composable
private fun CategoryDistributionRow(item: CategoryDistributionItem) {
    val parsedColor = remember(item.hexColor) {
        try {
            val hex = if (item.hexColor.startsWith("#")) item.hexColor else "#${item.hexColor}"
            Color(android.graphics.Color.parseColor(hex))
        } catch (e: Exception) {
            DayFlowPrimary
        }
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(text = item.icon, fontSize = 12.sp)
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = item.categoryName,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = TextPrimary
                )
                if (item.isProductive) {
                    Spacer(modifier = Modifier.width(6.dp))
                    Surface(
                        color = Color(0xFFF59E0B).copy(alpha = 0.15f),
                        shape = RoundedCornerShape(4.dp)
                    ) {
                        Text(
                            text = "⚡ High Impact",
                            color = Color(0xFFF59E0B),
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                        )
                    }
                }
            }

            Text(
                text = "Plan: ${item.plannedHours}h | Act: ${item.actualHours}h (${item.completionPercentage}%)",
                fontSize = 10.sp,
                color = TextMuted
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(5.dp)
                .background(SurfaceElevated, RoundedCornerShape(3.dp))
        ) {
            val fillFraction = (item.completionPercentage / 100f).coerceIn(0f, 1f)
            Box(
                modifier = Modifier
                    .fillMaxWidth(fillFraction)
                    .fillMaxHeight()
                    .background(parsedColor, RoundedCornerShape(3.dp))
            )
        }
    }
}

@Composable
private fun WeeklyTrendRow(trend: List<DayConsistencyItem>) {
    val maxActual = remember(trend) {
        val maxMins = trend.maxOfOrNull { it.actualMinutes } ?: 0
        maxMins.coerceAtLeast(120)
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(SurfaceElevated.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .padding(horizontal = 4.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Bottom
    ) {
        trend.forEach { day ->
            val fillFraction = (day.actualMinutes.toFloat() / maxActual.toFloat()).coerceIn(0.06f, 1f)
            val barColor = if (day.isSelected) DayFlowPrimary else if (day.actualMinutes > 0) Color(0xFF818CF8) else TextMuted.copy(alpha = 0.3f)

            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 2.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = if (day.isSelected) "🎯" else if (day.isToday) "📍" else " ",
                    fontSize = 8.sp
                )
                Spacer(modifier = Modifier.height(2.dp))

                Box(
                    modifier = Modifier
                        .width(16.dp)
                        .height(40.dp)
                        .background(SurfaceDark, RoundedCornerShape(4.dp)),
                    contentAlignment = Alignment.BottomCenter
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .fillMaxHeight(fillFraction)
                            .background(barColor, RoundedCornerShape(4.dp))
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = day.dayLabel,
                    fontSize = 9.sp,
                    fontWeight = if (day.isSelected) FontWeight.Bold else FontWeight.Medium,
                    color = if (day.isSelected) DayFlowPrimary else TextMuted
                )

                Text(
                    text = if (day.actualMinutes > 0) "${day.actualHours}h" else "0h",
                    fontSize = 8.sp,
                    color = if (day.isSelected) TextPrimary else TextMuted
                )
            }
        }
    }
}

@Composable
fun TimelineCategoryFilterBar(
    categories: List<CategoryItem>,
    selectedCategoryFilter: String,
    categoryCounts: Map<String, Int>,
    onCategorySelected: (String) -> Unit
) {
    val totalScheduled = categoryCounts.values.sum()

    LazyRow(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // "All" chip
        item {
            val isAllSelected = selectedCategoryFilter == "ALL"
            Surface(
                modifier = Modifier.clickable { onCategorySelected("ALL") },
                color = if (isAllSelected) DayFlowPrimary else SurfaceDark,
                shape = RoundedCornerShape(20.dp),
                border = if (!isAllSelected) androidx.compose.foundation.BorderStroke(1.dp, SurfaceElevated) else null
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "All",
                        fontSize = 11.sp,
                        fontWeight = if (isAllSelected) FontWeight.Bold else FontWeight.Medium,
                        color = if (isAllSelected) Color.White else TextSecondary
                    )
                    if (totalScheduled > 0) {
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "($totalScheduled)",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (isAllSelected) Color.White.copy(alpha = 0.85f) else TextMuted
                        )
                    }
                }
            }
        }

        // Active Category chips
        items(categories, key = { it.id.ifBlank { it.name } }) { cat ->
            val isSelected = selectedCategoryFilter.equals(cat.name, ignoreCase = true)
            val count = categoryCounts[cat.name] ?: 0
            val parsedColor = remember(cat.hexColor) {
                try {
                    val hex = if (cat.hexColor.startsWith("#")) cat.hexColor else "#${cat.hexColor}"
                    Color(android.graphics.Color.parseColor(hex))
                } catch (e: Exception) {
                    DayFlowPrimary
                }
            }

            Surface(
                modifier = Modifier.clickable { onCategorySelected(cat.name) },
                color = if (isSelected) parsedColor else SurfaceDark,
                shape = RoundedCornerShape(20.dp),
                border = if (!isSelected) androidx.compose.foundation.BorderStroke(1.dp, SurfaceElevated) else null
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = cat.icon, fontSize = 11.sp)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = cat.name,
                        fontSize = 11.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                        color = if (isSelected) Color.White else TextSecondary
                    )
                    if (count > 0) {
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "($count)",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (isSelected) Color.White.copy(alpha = 0.85f) else parsedColor
                        )
                    }
                }
            }
        }
    }
}


@Composable
fun NowIndicatorBadge(
    modifier: Modifier = Modifier
) {
    val infiniteTransition = rememberInfiniteTransition(label = "now_pulse")
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.45f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_alpha"
    )

    Surface(
        color = DayFlowPrimary.copy(alpha = 0.18f * alpha),
        shape = RoundedCornerShape(6.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, DayFlowPrimary.copy(alpha = alpha)),
        modifier = modifier
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .background(DayFlowPrimary.copy(alpha = alpha), shape = CircleShape)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = "📍 NOW",
                color = DayFlowPrimary,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp
            )
        }
    }
}

