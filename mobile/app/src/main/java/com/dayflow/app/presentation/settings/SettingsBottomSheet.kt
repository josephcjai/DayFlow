package com.dayflow.app.presentation.settings

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.dayflow.app.domain.model.CategoryItem
import com.dayflow.app.presentation.theme.DayFlowPrimary
import com.dayflow.app.presentation.theme.DayFlowSecondary
import com.dayflow.app.presentation.theme.StatusDone
import com.dayflow.app.presentation.theme.StatusMissed
import com.dayflow.app.presentation.theme.SurfaceDark
import com.dayflow.app.presentation.theme.SurfaceElevated
import com.dayflow.app.presentation.theme.TextMuted
import com.dayflow.app.presentation.theme.TextPrimary
import com.dayflow.app.presentation.theme.TextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsBottomSheet(
    viewModel: SettingsViewModel,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val state by viewModel.uiState.collectAsState()
    var showAddCategoryDialog by remember { mutableStateOf(false) }

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
                .padding(bottom = 36.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Settings,
                        contentDescription = null,
                        tint = DayFlowPrimary,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = "DayFlow Settings",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                }

                Surface(
                    color = DayFlowPrimary.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "v2.9.0",
                        color = DayFlowPrimary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // SECTION 1: NOTIFICATION INTELLIGENCE (v2.9.0 PARITY)
            Text(
                text = "🔔 Notification Intelligence",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = DayFlowPrimary
            )
            Spacer(modifier = Modifier.height(10.dp))

            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceElevated.copy(alpha = 0.6f)),
                shape = RoundedCornerShape(14.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    // Global Toggle
                    SettingsToggleRow(
                        title = "Slot Boundary Reminders",
                        subtitle = "Alert 5 minutes before focus slot ends",
                        checked = state.notificationsEnabled,
                        onCheckedChange = { viewModel.setNotificationsEnabled(it) }
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Active Window (Quiet Hours) Toggle
                    SettingsToggleRow(
                        title = "Active Hours Window",
                        subtitle = if (state.activeWindowEnabled)
                            "Quiet Hours active outside ${String.format("%02d:00", state.startHour)} – ${String.format("%02d:00", state.endHour)}"
                        else "Notifications active 24/7 (Quiet hours disabled)",
                        checked = state.activeWindowEnabled,
                        onCheckedChange = { viewModel.setActiveWindowEnabled(it) }
                    )

                    AnimatedVisibility(visible = state.activeWindowEnabled) {
                        Column(modifier = Modifier.padding(top = 12.dp)) {
                            Text(
                                text = "Quick Window Presets",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = TextSecondary
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                PresetPill("Standard (8-22)", state.startHour == 8 && state.endHour == 22, Modifier.weight(1f)) {
                                    viewModel.setHours(8, 22)
                                }
                                PresetPill("Work (9-18)", state.startHour == 9 && state.endHour == 18, Modifier.weight(1f)) {
                                    viewModel.setHours(9, 18)
                                }
                                PresetPill("24/7", state.startHour == 0 && state.endHour == 24, Modifier.weight(1f)) {
                                    viewModel.setHours(0, 24)
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Weekend Silence Toggle
                    SettingsToggleRow(
                        title = "Weekend Silence",
                        subtitle = "Mute notifications automatically on Sat & Sun",
                        checked = state.muteWeekends,
                        onCheckedChange = { viewModel.setMuteWeekends(it) }
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Productive-Only Filter Toggle
                    SettingsToggleRow(
                        title = "Productive-Only Filter",
                        subtitle = "Only notify for tasks marked as productive",
                        checked = state.onlyProductive,
                        onCheckedChange = { viewModel.setOnlyProductive(it) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // SECTION 2: CATEGORY MANAGEMENT (v2.9.0 PARITY)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "🏷️ Custom Categories",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = DayFlowPrimary
                )

                Surface(
                    modifier = Modifier.clickable { showAddCategoryDialog = true },
                    color = DayFlowPrimary.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, tint = DayFlowPrimary, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("+ Add Category", color = DayFlowPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
            Spacer(modifier = Modifier.height(10.dp))

            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceElevated.copy(alpha = 0.6f)),
                shape = RoundedCornerShape(14.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    state.categories.forEachIndexed { index, cat ->
                        CategoryRowItem(
                            category = cat,
                            onDelete = { viewModel.deleteCategory(cat.id) }
                        )
                        if (index < state.categories.size - 1) {
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Close Button
            Button(
                onClick = onDismiss,
                modifier = Modifier.fillMaxWidth().height(46.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SurfaceElevated)
            ) {
                Text("Close Settings", color = TextPrimary, fontWeight = FontWeight.SemiBold)
            }
        }
    }

    if (showAddCategoryDialog) {
        AddCategoryDialog(
            onDismiss = { showAddCategoryDialog = false },
            onAdd = { name, color, icon, isProd ->
                viewModel.addCategory(name, color, icon, isProd)
                showAddCategoryDialog = false
            }
        )
    }
}

@Composable
private fun SettingsToggleRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
            Text(text = title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
            Text(text = subtitle, fontSize = 11.sp, color = TextMuted, lineHeight = 15.sp)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = DayFlowPrimary,
                uncheckedThumbColor = TextMuted,
                uncheckedTrackColor = SurfaceDark
            )
        )
    }
}

@Composable
private fun PresetPill(
    label: String,
    isSelected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        modifier = modifier.clickable { onClick() },
        color = if (isSelected) DayFlowPrimary.copy(alpha = 0.25f) else SurfaceDark,
        shape = RoundedCornerShape(8.dp),
        border = if (isSelected) BorderStroke(1.dp, DayFlowPrimary) else null
    ) {
        Box(modifier = Modifier.padding(vertical = 6.dp), contentAlignment = Alignment.Center) {
            Text(
                text = label,
                fontSize = 11.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                color = if (isSelected) DayFlowPrimary else TextSecondary
            )
        }
    }
}

@Composable
private fun CategoryRowItem(
    category: CategoryItem,
    onDelete: () -> Unit
) {
    val catColor = try {
        Color(android.graphics.Color.parseColor(category.hexColor))
    } catch (e: Exception) {
        DayFlowPrimary
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(text = category.icon, fontSize = 16.sp)
            Spacer(modifier = Modifier.width(8.dp))
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = category.name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                    if (category.isSystem) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Surface(color = TextMuted.copy(alpha = 0.2f), shape = RoundedCornerShape(4.dp)) {
                            Text("System", color = TextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp))
                        }
                    }
                }
                Text(
                    text = if (category.isProductive) "⚡ Productive" else "Standard task",
                    fontSize = 10.sp,
                    color = if (category.isProductive) Color(0xFFF59E0B) else TextMuted
                )
            }
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(12.dp).background(catColor, CircleShape)
            )
            Spacer(modifier = Modifier.width(12.dp))
            if (!category.isSystem) {
                IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = StatusMissed, modifier = Modifier.size(16.dp))
                }
            } else {
                Icon(Icons.Default.Lock, contentDescription = "Protected", tint = TextMuted.copy(alpha = 0.5f), modifier = Modifier.size(16.dp))
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AddCategoryDialog(
    onDismiss: () -> Unit,
    onAdd: (name: String, color: String, icon: String, isProd: Boolean) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var selectedIcon by remember { mutableStateOf("🎯") }
    var selectedColor by remember { mutableStateOf("#3B82F6") }
    var isProductive by remember { mutableStateOf(false) }

    val emojis = listOf("🎯", "💼", "📚", "🏃", "🧹", "👨‍👩‍👧", "✈️", "📌", "💻", "🎨", "🎵", "🧘", "🍳", "🚗")
    val colors = listOf("#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EC4899", "#06B6D4", "#64748B", "#EF4444", "#14B8A6", "#F97316")

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(18.dp),
            color = SurfaceDark,
            tonalElevation = 6.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(text = "Add Custom Category", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Spacer(modifier = Modifier.height(14.dp))

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    placeholder = { Text("Category Name (e.g. Reading)", color = TextMuted) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = DayFlowPrimary,
                        unfocusedBorderColor = SurfaceElevated,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    )
                )

                Spacer(modifier = Modifier.height(12.dp))

                Text(text = "Choose Icon", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                Spacer(modifier = Modifier.height(6.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    emojis.forEach { emoji ->
                        val isSelected = selectedIcon == emoji
                        Surface(
                            modifier = Modifier.clickable { selectedIcon = emoji },
                            color = if (isSelected) DayFlowPrimary.copy(alpha = 0.25f) else SurfaceElevated,
                            shape = RoundedCornerShape(8.dp),
                            border = if (isSelected) BorderStroke(1.5.dp, DayFlowPrimary) else null
                        ) {
                            Text(text = emoji, fontSize = 16.sp, modifier = Modifier.padding(6.dp))
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(text = "Choose Color", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                Spacer(modifier = Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    colors.take(7).forEach { hex ->
                        val col = Color(android.graphics.Color.parseColor(hex))
                        val isSelected = selectedColor == hex
                        Box(
                            modifier = Modifier
                                .size(24.dp)
                                .background(col, CircleShape)
                                .clickable { selectedColor = hex },
                            contentAlignment = Alignment.Center
                        ) {
                            if (isSelected) {
                                Box(modifier = Modifier.size(10.dp).background(Color.White, CircleShape))
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "Classify as Productive", fontSize = 13.sp, color = TextPrimary)
                    Switch(
                        checked = isProductive,
                        onCheckedChange = { isProductive = it },
                        colors = SwitchDefaults.colors(checkedTrackColor = DayFlowPrimary)
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f).height(42.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = SurfaceElevated)
                    ) {
                        Text("Cancel", color = TextSecondary)
                    }

                    Button(
                        onClick = {
                            if (name.isNotBlank()) {
                                onAdd(name.trim(), selectedColor, selectedIcon, isProductive)
                            }
                        },
                        enabled = name.isNotBlank(),
                        modifier = Modifier.weight(1f).height(42.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary)
                    ) {
                        Text("Create", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
