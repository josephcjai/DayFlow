package com.dayflow.app.presentation.settings

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.widget.Toast
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
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
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsBottomSheet(
    viewModel: SettingsViewModel,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var showAddCategoryDialog by remember { mutableStateOf(false) }
    var showRestoreDialog by remember { mutableStateOf(false) }
    var showChangePasswordDialog by remember { mutableStateOf(false) }
    var exportSuccessSummary by remember { mutableStateOf<String?>(null) }

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
                    SettingsToggleRow(
                        title = "Slot Boundary Reminders",
                        subtitle = "Alert 5 minutes before focus slot ends",
                        checked = state.notificationsEnabled,
                        onCheckedChange = { viewModel.setNotificationsEnabled(it) }
                    )

                    Spacer(modifier = Modifier.height(12.dp))

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

                    SettingsToggleRow(
                        title = "Weekend Silence",
                        subtitle = "Mute notifications automatically on Sat & Sun",
                        checked = state.muteWeekends,
                        onCheckedChange = { viewModel.setMuteWeekends(it) }
                    )

                    Spacer(modifier = Modifier.height(12.dp))

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

            // SECTION 3: TIME & SCHEDULE PREFERENCES (12h vs 24h PARITY)
            Text(
                text = "⏰ Time & Display Formatting",
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
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Timeline Time Format",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "Affects schedule grid slot labels & timeblocks",
                                fontSize = 11.sp,
                                color = TextMuted
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        PresetPill(
                            label = "12-Hour (AM/PM)",
                            isSelected = state.timeFormat == "12h",
                            modifier = Modifier.weight(1f)
                        ) {
                            viewModel.setTimeFormat("12h")
                            Toast.makeText(context, "Switched to 12-Hour format (AM/PM)", Toast.LENGTH_SHORT).show()
                        }

                        PresetPill(
                            label = "24-Hour (Military)",
                            isSelected = state.timeFormat == "24h",
                            modifier = Modifier.weight(1f)
                        ) {
                            viewModel.setTimeFormat("24h")
                            Toast.makeText(context, "Switched to 24-Hour format", Toast.LENGTH_SHORT).show()
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(SurfaceDark))
                    Spacer(modifier = Modifier.height(14.dp))

                    Text(
                        text = "🎯 Daily Points Goal",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary
                    )
                    Text(
                        text = "Gamification target for daily habit routines & completed tasks",
                        fontSize = 11.sp,
                        color = TextMuted
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf(30, 50, 75, 100).forEach { targetPts ->
                            PresetPill(
                                label = "$targetPts pts",
                                isSelected = state.dailyPointsTarget == targetPts,
                                modifier = Modifier.weight(1f)
                            ) {
                                viewModel.setDailyPointsTarget(targetPts)
                                Toast.makeText(context, "Daily goal set to $targetPts pts", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // SECTION 4: DATA BACKUP & RESTORE (DayFlow Cross-Platform JSON Parity)
            Text(
                text = "💾 Data Backup & Restore",
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
                    Text(
                        text = "Cross-Platform JSON Portability",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary
                    )
                    Text(
                        text = "Export your full schedule, habits, todos, and categories as standard DayFlow JSON, or restore from an existing backup file.",
                        fontSize = 11.sp,
                        color = TextMuted,
                        lineHeight = 15.sp
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Export Button
                        Button(
                            onClick = {
                                coroutineScope.launch {
                                    val json = viewModel.exportBackupJson()
                                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                    val clip = ClipData.newPlainText("DayFlow_Backup.json", json)
                                    clipboard.setPrimaryClip(clip)

                                    // Open Android Share Intent
                                    val sendIntent = Intent().apply {
                                        action = Intent.ACTION_SEND
                                        putExtra(Intent.EXTRA_TEXT, json)
                                        type = "text/plain"
                                    }
                                    val shareIntent = Intent.createChooser(sendIntent, "Share or Save DayFlow Backup")
                                    context.startActivity(shareIntent)

                                    exportSuccessSummary = "Backup exported (${json.length} characters)! Copied to clipboard and share dialog launched."
                                }
                            },
                            modifier = Modifier.weight(1f).height(44.dp),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary)
                        ) {
                            Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Export JSON", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }

                        // Restore Button
                        Button(
                            onClick = { showRestoreDialog = true },
                            modifier = Modifier.weight(1f).height(44.dp),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = SurfaceDark),
                            border = BorderStroke(1.dp, DayFlowPrimary.copy(alpha = 0.5f))
                        ) {
                            Icon(Icons.Default.Upload, contentDescription = null, tint = DayFlowPrimary, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Restore Data", color = DayFlowPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // SECTION 5: ACCOUNT & APP SECURITY
            Text(
                text = "🛡️ Account & App Security",
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
                    // Biometric Lock
                    SettingsToggleRow(
                        title = "Biometric App Lock",
                        subtitle = "Require fingerprint or face unlock to access DayFlow",
                        checked = state.biometricsEnabled,
                        onCheckedChange = {
                            viewModel.setBiometricsEnabled(it)
                            Toast.makeText(
                                context,
                                if (it) "Biometric Lock enabled" else "Biometric Lock disabled",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // Change Password Action
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                            Text(
                                text = "Account Password",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "Change password for cloud sync authentication",
                                fontSize = 11.sp,
                                color = TextMuted
                            )
                        }

                        Button(
                            onClick = { showChangePasswordDialog = true },
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = SurfaceDark),
                            border = BorderStroke(1.dp, DayFlowPrimary.copy(alpha = 0.4f))
                        ) {
                            Text("Change", color = DayFlowPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

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

    // Modal Dialogs
    if (showAddCategoryDialog) {
        AddCategoryDialog(
            onDismiss = { showAddCategoryDialog = false },
            onAdd = { name, color, icon, isProd ->
                viewModel.addCategory(name, color, icon, isProd)
                showAddCategoryDialog = false
            }
        )
    }

    if (exportSuccessSummary != null) {
        Dialog(onDismissRequest = { exportSuccessSummary = null }) {
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = SurfaceDark,
                tonalElevation = 6.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = StatusDone, modifier = Modifier.size(40.dp))
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("Backup Export Ready", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = exportSuccessSummary ?: "",
                        fontSize = 12.sp,
                        color = TextSecondary,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { exportSuccessSummary = null },
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Done", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }

    if (showRestoreDialog) {
        RestoreBackupDialog(
            viewModel = viewModel,
            onDismiss = {
                viewModel.clearBackupInspection()
                showRestoreDialog = false
            },
            onRestored = { countMsg ->
                Toast.makeText(context, countMsg, Toast.LENGTH_LONG).show()
                viewModel.clearBackupInspection()
                showRestoreDialog = false
            }
        )
    }

    if (showChangePasswordDialog) {
        ChangePasswordDialog(
            viewModel = viewModel,
            onDismiss = { showChangePasswordDialog = false },
            onSuccess = { msg ->
                Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
                showChangePasswordDialog = false
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
        border = if (isSelected) BorderStroke(1.dp, DayFlowPrimary) else BorderStroke(0.5.dp, SurfaceElevated)
    ) {
        Box(modifier = Modifier.padding(vertical = 8.dp, horizontal = 4.dp), contentAlignment = Alignment.Center) {
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

@Composable
private fun RestoreBackupDialog(
    viewModel: SettingsViewModel,
    onDismiss: () -> Unit,
    onRestored: (String) -> Unit
) {
    val context = LocalContext.current
    val state by viewModel.uiState.collectAsState()
    var jsonText by remember { mutableStateOf("") }
    var wipeExisting by remember { mutableStateOf(false) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(18.dp),
            color = SurfaceDark,
            tonalElevation = 6.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    text = "📥 Restore Data from Backup",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Paste your DayFlow JSON backup string below. Works with Web and Mobile backup archives.",
                    fontSize = 11.sp,
                    color = TextMuted
                )

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = jsonText,
                    onValueChange = {
                        jsonText = it
                        if (it.isNotBlank()) {
                            viewModel.inspectBackup(it)
                        } else {
                            viewModel.clearBackupInspection()
                        }
                    },
                    placeholder = { Text("Paste DayFlow JSON backup here...", color = TextMuted, fontSize = 11.sp) },
                    modifier = Modifier.fillMaxWidth().height(140.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = DayFlowPrimary,
                        unfocusedBorderColor = SurfaceElevated,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    )
                )

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Button(
                        onClick = {
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            val clipText = clipboard.primaryClip?.getItemAt(0)?.text?.toString() ?: ""
                            if (clipText.isNotBlank()) {
                                jsonText = clipText
                                viewModel.inspectBackup(clipText)
                            } else {
                                Toast.makeText(context, "Clipboard is empty", Toast.LENGTH_SHORT).show()
                            }
                        },
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = SurfaceElevated)
                    ) {
                        Text("Paste from Clipboard", fontSize = 11.sp, color = DayFlowPrimary)
                    }

                    if (jsonText.isNotBlank()) {
                        Text(
                            text = "${jsonText.length} chars",
                            fontSize = 10.sp,
                            color = TextMuted
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Live Validation Preview Banner
                val insp = state.backupInspection
                if (insp != null) {
                    if (insp.isValid) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = StatusDone.copy(alpha = 0.15f),
                            border = BorderStroke(1.dp, StatusDone),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Check, contentDescription = null, tint = StatusDone, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Valid DayFlow Backup", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = StatusDone)
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Found: ${insp.slotCount} slots, ${insp.habitCount} habits, ${insp.todoCount} todos, ${insp.categoryCount} categories",
                                    fontSize = 11.sp,
                                    color = TextPrimary
                                )
                            }
                        }
                    } else {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = StatusMissed.copy(alpha = 0.15f),
                            border = BorderStroke(1.dp, StatusMissed),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(modifier = Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Warning, contentDescription = null, tint = StatusMissed, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(insp.errorMessage ?: "Invalid JSON format", fontSize = 11.sp, color = StatusMissed)
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Wipe existing data checkbox
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth().clickable { wipeExisting = !wipeExisting }
                ) {
                    Checkbox(
                        checked = wipeExisting,
                        onCheckedChange = { wipeExisting = it },
                        colors = CheckboxDefaults.colors(checkedColor = StatusMissed)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Wipe existing data before restore (Clean Replace)",
                        fontSize = 11.sp,
                        color = if (wipeExisting) StatusMissed else TextSecondary
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

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
                            viewModel.restoreBackup(jsonText, wipeExisting) { success, msg ->
                                if (success) {
                                    onRestored(msg)
                                } else {
                                    Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
                                }
                            }
                        },
                        enabled = (insp?.isValid == true) && !state.isLoading,
                        modifier = Modifier.weight(1f).height(42.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary)
                    ) {
                        if (state.isLoading) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Text("Confirm Restore", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChangePasswordDialog(
    viewModel: SettingsViewModel,
    onDismiss: () -> Unit,
    onSuccess: (String) -> Unit
) {
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(18.dp),
            color = SurfaceDark,
            tonalElevation = 6.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(text = "🔑 Change Account Password", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "Password must be at least 6 characters long.", fontSize = 11.sp, color = TextMuted)

                Spacer(modifier = Modifier.height(14.dp))

                OutlinedTextField(
                    value = currentPassword,
                    onValueChange = { currentPassword = it; errorMessage = null },
                    placeholder = { Text("Current Password", color = TextMuted) },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = DayFlowPrimary,
                        unfocusedBorderColor = SurfaceElevated,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    )
                )

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = newPassword,
                    onValueChange = { newPassword = it; errorMessage = null },
                    placeholder = { Text("New Password (min 6 chars)", color = TextMuted) },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = DayFlowPrimary,
                        unfocusedBorderColor = SurfaceElevated,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    )
                )

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it; errorMessage = null },
                    placeholder = { Text("Confirm New Password", color = TextMuted) },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = DayFlowPrimary,
                        unfocusedBorderColor = SurfaceElevated,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    )
                )

                if (errorMessage != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = errorMessage ?: "", color = StatusMissed, fontSize = 11.sp)
                }

                Spacer(modifier = Modifier.height(18.dp))

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
                            when {
                                currentPassword.isBlank() -> errorMessage = "Please enter your current password"
                                newPassword.length < 6 -> errorMessage = "New password must be at least 6 characters"
                                newPassword != confirmPassword -> errorMessage = "New passwords do not match"
                                else -> {
                                    isSubmitting = true
                                    viewModel.changePassword(currentPassword, newPassword) { success, msg ->
                                        isSubmitting = false
                                        if (success) {
                                            onSuccess(msg)
                                        } else {
                                            errorMessage = msg
                                        }
                                    }
                                }
                            }
                        },
                        enabled = !isSubmitting,
                        modifier = Modifier.weight(1f).height(42.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary)
                    ) {
                        if (isSubmitting) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Text("Update", fontWeight = FontWeight.Bold)
                        }
                    }
                }
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
    var selectedIcon by remember { mutableStateOf("📋") }
    var selectedColor by remember { mutableStateOf("#3B82F6") }
    var isProductive by remember { mutableStateOf(false) }

    val emojis = listOf("📋", "💼", "📚", "🏋️", "💡", "🎨", "🧘", "🎯", "💻", "👥", "🍎", "🔥", "🚀", "✈️")
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
