package com.dayflow.app.presentation.schedule

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.BookmarkAdd
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dayflow.app.domain.model.CategoryItem
import com.dayflow.app.domain.model.DayTemplate
import com.dayflow.app.domain.model.TemplateSlot
import com.dayflow.app.presentation.theme.BackgroundDark
import com.dayflow.app.presentation.theme.DayFlowPrimary
import com.dayflow.app.presentation.theme.DayFlowSecondary
import com.dayflow.app.presentation.theme.StatusMissed
import com.dayflow.app.presentation.theme.SurfaceDark
import com.dayflow.app.presentation.theme.SurfaceElevated
import com.dayflow.app.presentation.theme.TextMuted
import com.dayflow.app.presentation.theme.TextPrimary
import com.dayflow.app.presentation.theme.TextSecondary
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ApplyTemplateBottomSheet(
    selectedDate: LocalDate,
    templates: List<DayTemplate>,
    categories: List<CategoryItem> = emptyList(),
    currentDaySlots: List<SlotRowUiModel> = emptyList(),
    onApplyTemplate: (DayTemplate) -> Unit,
    onSaveDayAsTemplate: (name: String, description: String) -> Unit,
    onUpdateTemplate: (templateId: String, name: String, description: String, slots: Map<String, TemplateSlot>) -> Unit = { _, _, _, _ -> },
    onDeleteTemplate: (templateId: String) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val formattedDate = selectedDate.format(DateTimeFormatter.ofPattern("EEEE, MMM d"))
    val dayName = selectedDate.format(DateTimeFormatter.ofPattern("EEEE"))

    // Active slots for today
    val datePrefix = selectedDate.toString()
    val activeDayTasks = currentDaySlots
        .mapNotNull { it.slot }
        .filter { it.slotKey.startsWith(datePrefix) && (it.plannedTask.isNotBlank() || it.actualTask.isNotBlank()) }

    var isSaveDialogOpen by remember { mutableStateOf(false) }
    var templateToDelete by remember { mutableStateOf<DayTemplate?>(null) }
    var templateToEdit by remember { mutableStateOf<DayTemplate?>(null) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = SurfaceDark,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "⚡ Day Templates & Blueprints",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Target: $formattedDate",
                        fontSize = 13.sp,
                        color = DayFlowPrimary,
                        fontWeight = FontWeight.Medium
                    )
                }

                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = TextSecondary
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // 1. Save Current Day as Template Action Card
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceElevated),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { isSaveDialogOpen = true }
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Surface(
                            color = DayFlowPrimary.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.size(38.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.BookmarkAdd,
                                    contentDescription = "Save Day",
                                    tint = DayFlowPrimary,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column {
                            Text(
                                text = "Save Today as Blueprint",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Text(
                                text = "${activeDayTasks.size} tasks planned on $dayName",
                                fontSize = 11.sp,
                                color = if (activeDayTasks.isNotEmpty()) DayFlowSecondary else TextMuted
                            )
                        }
                    }

                    Button(
                        onClick = { isSaveDialogOpen = true },
                        colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = "Capture",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Least Priority Rule Info Card
            Surface(
                color = DayFlowPrimary.copy(alpha = 0.10f),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = null,
                        tint = DayFlowPrimary,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = "Least Priority Rule: Blueprints only fill empty 30-min slots. Existing planned tasks are strictly preserved.",
                        fontSize = 12.sp,
                        color = TextSecondary,
                        lineHeight = 16.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Templates List
            if (templates.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No templates available",
                        color = TextMuted,
                        fontSize = 14.sp
                    )
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(templates, key = { it.id }) { template ->
                        TemplateCard(
                            template = template,
                            onApply = { onApplyTemplate(template) },
                            onEdit = { templateToEdit = template },
                            onDelete = if (!template.isDefault) {
                                { templateToDelete = template }
                            } else null
                        )
                    }
                }
            }
        }
    }

    // Save Day As Template Dialog
    if (isSaveDialogOpen) {
        SaveDayTemplateDialog(
            dayName = dayName,
            formattedDate = formattedDate,
            activeTasks = activeDayTasks,
            onDismiss = { isSaveDialogOpen = false },
            onConfirm = { name, desc ->
                onSaveDayAsTemplate(name, desc)
                isSaveDialogOpen = false
            }
        )
    }

    // Edit Template Dialog
    templateToEdit?.let { template ->
        EditDayTemplateDialog(
            template = template,
            categories = categories,
            onDismiss = { templateToEdit = null },
            onSave = { updatedName, updatedDesc, updatedSlots ->
                if (template.isDefault) {
                    // For default templates, saving saves as a custom blueprint
                    onSaveDayAsTemplate(updatedName, updatedDesc)
                } else {
                    onUpdateTemplate(template.id, updatedName, updatedDesc, updatedSlots)
                }
                templateToEdit = null
            }
        )
    }

    // Delete Template Confirmation Dialog
    templateToDelete?.let { template ->
        AlertDialog(
            onDismissRequest = { templateToDelete = null },
            containerColor = SurfaceElevated,
            title = {
                Text(
                    text = "Delete Blueprint?",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
            },
            text = {
                Text(
                    text = "Are you sure you want to delete blueprint \"${template.name}\" (${template.slots.size} slots)?",
                    fontSize = 14.sp,
                    color = TextSecondary
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        onDeleteTemplate(template.id)
                        templateToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = StatusMissed)
                ) {
                    Text("Delete", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { templateToDelete = null }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }
}

@Composable
private fun TemplateCard(
    template: DayTemplate,
    onApply: () -> Unit,
    onEdit: () -> Unit,
    onDelete: (() -> Unit)? = null
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceElevated),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = template.name,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    Surface(
                        color = if (template.isDefault) DayFlowPrimary.copy(alpha = 0.15f) else DayFlowSecondary.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = if (template.isDefault) "Default" else "Custom",
                            color = if (template.isDefault) DayFlowPrimary else DayFlowSecondary,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        color = SurfaceDark,
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = "${template.slots.size} slots",
                            color = TextSecondary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }

                    if (onDelete != null) {
                        Spacer(modifier = Modifier.width(4.dp))
                        IconButton(
                            onClick = onDelete,
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Delete,
                                contentDescription = "Delete Template",
                                tint = TextMuted,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }

            if (template.description.isNotBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = template.description,
                    fontSize = 13.sp,
                    color = TextSecondary,
                    lineHeight = 18.sp
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Sample Slots Preview (first 3)
            val sampleSlots = template.slots.entries.sortedBy { it.key }.take(3)
            Column(
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                sampleSlots.forEach { (time, slot) ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = time,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = DayFlowPrimary,
                            modifier = Modifier.width(42.dp)
                        )
                        Text(
                            text = "${slot.title} (${slot.category})",
                            fontSize = 11.sp,
                            color = TextMuted,
                            maxLines = 1
                        )
                    }
                }
                if (template.slots.size > 3) {
                    Text(
                        text = "+ ${template.slots.size - 3} more 30-min blocks",
                        fontSize = 10.sp,
                        color = TextMuted,
                        modifier = Modifier.padding(start = 42.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Action Buttons: Edit & Apply
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onEdit,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = DayFlowPrimary),
                    border = BorderStroke(1.dp, DayFlowPrimary.copy(alpha = 0.5f))
                ) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = null,
                        modifier = Modifier.size(15.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Edit",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Button(
                    onClick = onApply,
                    modifier = Modifier.weight(2f),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary)
                ) {
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Apply Blueprint",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
fun EditDayTemplateDialog(
    template: DayTemplate,
    categories: List<CategoryItem>,
    onDismiss: () -> Unit,
    onSave: (name: String, description: String, slots: Map<String, TemplateSlot>) -> Unit
) {
    var templateName by remember {
        mutableStateOf(if (template.isDefault) "${template.name} (Custom)" else template.name)
    }
    var description by remember { mutableStateOf(template.description) }

    // All standard 48 30-minute grid slots (00:00 to 23:30)
    val standard30MinSlots = remember {
        (0 until 24).flatMap { h ->
            listOf(
                String.format("%02d:00", h),
                String.format("%02d:30", h)
            )
        }
    }

    fun isValid30MinSlot(time: String): Boolean {
        val parts = time.split(":")
        if (parts.size != 2) return false
        val h = parts[0].toIntOrNull() ?: return false
        val m = parts[1].toIntOrNull() ?: return false
        return h in 0..23 && (m == 0 || m == 30)
    }

    // Editable slots map
    val slotsState = remember {
        mutableStateMapOf<String, TemplateSlot>().apply {
            putAll(template.slots)
        }
    }

    // New Slot fields strictly aligned to 30-min increments
    var newTime by remember {
        mutableStateOf(
            standard30MinSlots.firstOrNull { it >= "09:00" && !slotsState.containsKey(it) } ?: "09:00"
        )
    }
    var isTimeDropdownOpen by remember { mutableStateOf(false) }
    var newTitle by remember { mutableStateOf("") }
    var newCategory by remember { mutableStateOf(categories.firstOrNull()?.name ?: "Work") }
    var isCategoryDropdownOpen by remember { mutableStateOf(false) }

    val hasInvalidSlots = slotsState.keys.any { !isValid30MinSlot(it) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceElevated,
        shape = RoundedCornerShape(18.dp),
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "✏️ Edit Blueprint",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    if (template.isDefault) {
                        Text(
                            text = "Saving will create a custom copy",
                            fontSize = 11.sp,
                            color = DayFlowSecondary,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
                IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = TextSecondary
                    )
                }
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = templateName,
                    onValueChange = { templateName = it },
                    label = { Text("Blueprint Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = DayFlowPrimary,
                        unfocusedBorderColor = SurfaceDark,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    )
                )

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = DayFlowPrimary,
                        unfocusedBorderColor = SurfaceDark,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    )
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Schedule Slots (${slotsState.size})",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = "30-min timeline grid",
                        fontSize = 10.sp,
                        color = DayFlowSecondary
                    )
                }

                if (hasInvalidSlots) {
                    Surface(
                        color = StatusMissed.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "⚠️ Some slots are not on 30-min intervals. Remove or replace them to prevent scheduler overlap.",
                            fontSize = 11.sp,
                            color = StatusMissed,
                            modifier = Modifier.padding(8.dp)
                        )
                    }
                }

                // Scrollable Slots List
                if (slotsState.isEmpty()) {
                    Surface(
                        color = SurfaceDark,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "No slots in this blueprint yet. Add one below.",
                            fontSize = 12.sp,
                            color = TextMuted,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 160.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        val sortedTimes = slotsState.keys.sorted()
                        items(sortedTimes, key = { it }) { time ->
                            val slot = slotsState[time] ?: return@items
                            val isValid = isValid30MinSlot(time)
                            Surface(
                                color = if (isValid) SurfaceDark else StatusMissed.copy(alpha = 0.12f),
                                shape = RoundedCornerShape(8.dp),
                                border = if (!isValid) BorderStroke(1.dp, StatusMissed.copy(alpha = 0.5f)) else null,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Column {
                                            Text(
                                                text = time,
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = if (isValid) DayFlowPrimary else StatusMissed,
                                                modifier = Modifier.width(46.dp)
                                            )
                                            if (!isValid) {
                                                Text(
                                                    text = "Off-grid",
                                                    fontSize = 9.sp,
                                                    color = StatusMissed
                                                )
                                            }
                                        }
                                        Column {
                                            Text(
                                                text = slot.title.ifBlank { "Untitled Task" },
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                color = TextPrimary,
                                                maxLines = 1
                                            )
                                            Text(
                                                text = slot.category,
                                                fontSize = 10.sp,
                                                color = DayFlowSecondary
                                            )
                                        }
                                    }

                                    IconButton(
                                        onClick = { slotsState.remove(time) },
                                        modifier = Modifier.size(28.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Close,
                                            contentDescription = "Remove Slot",
                                            tint = if (isValid) TextMuted else StatusMissed,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(2.dp))

                // Add Slot Section with STRICT 30-minute interval picker
                Surface(
                    color = SurfaceDark.copy(alpha = 0.7f),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text(
                            text = "+ Add / Replace 30-Min Time Block",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = DayFlowPrimary
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Strict 30-Minute Interval Dropdown
                            Box {
                                Surface(
                                    color = SurfaceElevated,
                                    shape = RoundedCornerShape(8.dp),
                                    border = BorderStroke(1.dp, DayFlowPrimary.copy(alpha = 0.4f)),
                                    modifier = Modifier
                                        .clickable { isTimeDropdownOpen = true }
                                ) {
                                    Column(
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                    ) {
                                        Text(
                                            text = "Slot Time",
                                            fontSize = 9.sp,
                                            color = TextMuted
                                        )
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(
                                                text = newTime,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = DayFlowPrimary
                                            )
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text(
                                                text = "▾",
                                                fontSize = 10.sp,
                                                color = TextSecondary
                                            )
                                        }
                                    }
                                }

                                DropdownMenu(
                                    expanded = isTimeDropdownOpen,
                                    onDismissRequest = { isTimeDropdownOpen = false },
                                    modifier = Modifier.heightIn(max = 260.dp)
                                ) {
                                    standard30MinSlots.forEach { slotTime ->
                                        val isOccupied = slotsState.containsKey(slotTime)
                                        DropdownMenuItem(
                                            text = {
                                                Row(
                                                    modifier = Modifier.fillMaxWidth(),
                                                    horizontalArrangement = Arrangement.SpaceBetween,
                                                    verticalAlignment = Alignment.CenterVertically
                                                ) {
                                                    Text(
                                                        text = slotTime,
                                                        fontWeight = if (slotTime == newTime) FontWeight.Bold else FontWeight.Normal,
                                                        color = if (slotTime == newTime) DayFlowPrimary else TextPrimary,
                                                        fontSize = 12.sp
                                                    )
                                                    if (isOccupied) {
                                                        Text(
                                                            text = "Replaces",
                                                            fontSize = 10.sp,
                                                            color = DayFlowSecondary,
                                                            modifier = Modifier.padding(start = 12.dp)
                                                        )
                                                    }
                                                }
                                            },
                                            onClick = {
                                                newTime = slotTime
                                                isTimeDropdownOpen = false
                                            }
                                        )
                                    }
                                }
                            }

                            // Task Title Field
                            OutlinedTextField(
                                value = newTitle,
                                onValueChange = { newTitle = it },
                                label = { Text("Task Title", fontSize = 10.sp) },
                                singleLine = true,
                                modifier = Modifier.weight(1f),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = DayFlowPrimary,
                                    unfocusedBorderColor = SurfaceElevated,
                                    focusedTextColor = TextPrimary,
                                    unfocusedTextColor = TextPrimary
                                )
                            )
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box {
                                Surface(
                                    color = SurfaceElevated,
                                    shape = RoundedCornerShape(6.dp),
                                    modifier = Modifier.clickable { isCategoryDropdownOpen = true }
                                ) {
                                    Text(
                                        text = "Category: $newCategory ▾",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = TextSecondary,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                                    )
                                }

                                DropdownMenu(
                                    expanded = isCategoryDropdownOpen,
                                    onDismissRequest = { isCategoryDropdownOpen = false }
                                ) {
                                    val catList = if (categories.isNotEmpty()) categories.map { it.name } else listOf("Work", "Study", "Personal", "Health", "Break")
                                    catList.forEach { catName ->
                                        DropdownMenuItem(
                                            text = { Text(catName, color = TextPrimary, fontSize = 12.sp) },
                                            onClick = {
                                                newCategory = catName
                                                isCategoryDropdownOpen = false
                                            }
                                        )
                                    }
                                }
                            }

                            Button(
                                onClick = {
                                    if (newTitle.isNotBlank()) {
                                        slotsState[newTime] = TemplateSlot(
                                            time = newTime,
                                            title = newTitle.trim(),
                                            plannedTask = newTitle.trim(),
                                            category = newCategory,
                                            planned = 30
                                        )
                                        newTitle = ""
                                        // Auto advance to next slot
                                        val currentIndex = standard30MinSlots.indexOf(newTime)
                                        if (currentIndex in 0 until standard30MinSlots.size - 1) {
                                            newTime = standard30MinSlots[currentIndex + 1]
                                        }
                                    }
                                },
                                enabled = newTitle.isNotBlank(),
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary),
                                modifier = Modifier.height(34.dp)
                            ) {
                                Text(
                                    text = if (slotsState.containsKey(newTime)) "Replace Slot" else "+ Add Slot",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val cleanSlots = slotsState.filterKeys { isValid30MinSlot(it) }
                    if (templateName.isNotBlank() && cleanSlots.isNotEmpty()) {
                        onSave(templateName.trim(), description.trim(), cleanSlots)
                    }
                },
                enabled = templateName.isNotBlank() && slotsState.any { isValid30MinSlot(it.key) },
                colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary)
            ) {
                Text("Save Changes", fontWeight = FontWeight.Bold)
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
fun SaveDayTemplateDialog(
    dayName: String,
    formattedDate: String,
    activeTasks: List<com.dayflow.app.domain.model.Slot>,
    onDismiss: () -> Unit,
    onConfirm: (name: String, description: String) -> Unit
) {
    var templateName by remember { mutableStateOf("$dayName Routine") }
    var description by remember { mutableStateOf("Template captured from $formattedDate") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceElevated,
        shape = RoundedCornerShape(16.dp),
        title = {
            Text(
                text = "💾 Save Day as Blueprint",
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
                Text(
                    text = "Capturing ${activeTasks.size} tasks from $formattedDate",
                    fontSize = 12.sp,
                    color = DayFlowPrimary,
                    fontWeight = FontWeight.SemiBold
                )

                OutlinedTextField(
                    value = templateName,
                    onValueChange = { templateName = it },
                    label = { Text("Blueprint Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = DayFlowPrimary,
                        unfocusedBorderColor = SurfaceDark,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    )
                )

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description (Optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = DayFlowPrimary,
                        unfocusedBorderColor = SurfaceDark,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    )
                )

                // Tasks Preview
                Text(
                    text = "Tasks Preview (${activeTasks.size})",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextSecondary
                )

                if (activeTasks.isEmpty()) {
                    Surface(
                        color = SurfaceDark,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "No planned tasks found on this day. Schedule some tasks before capturing as a blueprint.",
                            fontSize = 12.sp,
                            color = TextMuted,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(120.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        items(activeTasks, key = { it.slotKey }) { slot ->
                            val timePart = slot.slotKey.substringAfter("_", "")
                            val taskTitle = slot.plannedTask.ifBlank { slot.actualTask }
                            Surface(
                                color = SurfaceDark,
                                shape = RoundedCornerShape(6.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text(
                                            text = timePart,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = DayFlowPrimary
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = taskTitle,
                                            fontSize = 11.sp,
                                            color = TextPrimary,
                                            maxLines = 1
                                        )
                                    }
                                    Text(
                                        text = slot.categoryName.ifBlank { slot.category.displayName },
                                        fontSize = 10.sp,
                                        color = TextMuted
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (templateName.isNotBlank() && activeTasks.isNotEmpty()) {
                        onConfirm(templateName.trim(), description.trim())
                    }
                },
                enabled = templateName.isNotBlank() && activeTasks.isNotEmpty(),
                colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary)
            ) {
                Text("Save Blueprint", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = TextSecondary)
            }
        }
    )
}
