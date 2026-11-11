package com.dayflow.app.presentation.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// DayFlow Brand Colors
val DayFlowPrimary = Color(0xFF0284C7) // Sky Blue
val DayFlowPrimaryDark = Color(0xFF0369A1)
val DayFlowSecondary = Color(0xFF6366F1) // Indigo
val DayFlowTertiary = Color(0xFF059669) // Emerald

// Theme Modes enum (matching DayFlow Web App)
enum class DayFlowThemeMode(val key: String, val displayName: String, val subtitle: String) {
    DARK("dark", "Deep Midnight", "Slate and navy dark mode"),
    OLED("oled", "OLED Black", "Pure #000000 true black"),
    EMERALD("emerald", "Emerald Forest", "Botanical dark green"),
    LIGHT("light", "Clean Light", "Crisp daytime light mode");

    companion object {
        fun fromKey(key: String?): DayFlowThemeMode = entries.firstOrNull { it.key == key } ?: DARK
    }
}

// DayFlow Palette data class
data class DayFlowPalette(
    val id: String,
    val name: String,
    val background: Color,
    val surface: Color,
    val surfaceElevated: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val isLight: Boolean = false
)

// Default / Static theme palettes
val MidnightPalette = DayFlowPalette(
    id = "dark",
    name = "Deep Midnight",
    background = Color(0xFF0B1120),
    surface = Color(0xFF1E293B),
    surfaceElevated = Color(0xFF334155),
    textPrimary = Color(0xFFF8FAFC),
    textSecondary = Color(0xFF94A3B8),
    textMuted = Color(0xFF64748B),
    isLight = false
)

val OledPalette = DayFlowPalette(
    id = "oled",
    name = "OLED Black",
    background = Color(0xFF000000),
    surface = Color(0xFF0C0C0C),
    surfaceElevated = Color(0xFF1E1E1E),
    textPrimary = Color(0xFFF8FAFC),
    textSecondary = Color(0xFFA1A1AA),
    textMuted = Color(0xFF71717A),
    isLight = false
)

val EmeraldPalette = DayFlowPalette(
    id = "emerald",
    name = "Emerald Forest",
    background = Color(0xFF022C22),
    surface = Color(0xFF064E3B),
    surfaceElevated = Color(0xFF0D5A46),
    textPrimary = Color(0xFFF0FDF4),
    textSecondary = Color(0xFFA7F3D0),
    textMuted = Color(0xFF6EE7B7),
    isLight = false
)

val LightPalette = DayFlowPalette(
    id = "light",
    name = "Clean Light",
    background = Color(0xFFF8FAFC),
    surface = Color(0xFFFFFFFF),
    surfaceElevated = Color(0xFFE2E8F0),
    textPrimary = Color(0xFF0F172A),
    textSecondary = Color(0xFF475569),
    textMuted = Color(0xFF64748B),
    isLight = true
)

val LocalDayFlowPalette = staticCompositionLocalOf { MidnightPalette }

// Dynamic theme surfaces and typography that adapt to LocalDayFlowPalette
val BackgroundDark: Color
    @Composable
    get() = LocalDayFlowPalette.current.background

val SurfaceDark: Color
    @Composable
    get() = LocalDayFlowPalette.current.surface

val SurfaceElevated: Color
    @Composable
    get() = LocalDayFlowPalette.current.surfaceElevated

val TextPrimary: Color
    @Composable
    get() = LocalDayFlowPalette.current.textPrimary

val TextSecondary: Color
    @Composable
    get() = LocalDayFlowPalette.current.textSecondary

val TextMuted: Color
    @Composable
    get() = LocalDayFlowPalette.current.textMuted

// DayFlow Category Colors (Standardized Hex Palette)
val CategoryLearning = Color(0xFF6366F1) // Indigo
val CategoryWork = Color(0xFF0284C7)     // Sky Blue
val CategoryHousehold = Color(0xFFD97706)// Amber
val CategoryFamily = Color(0xFFDB2777)   // Pink
val CategoryHealth = Color(0xFF059669)   // Emerald
val CategoryTravel = Color(0xFF7C3AED)   // Purple

// Status Colors
val StatusDone = Color(0xFF10B981)
val StatusPartial = Color(0xFFF59E0B)
val StatusMissed = Color(0xFFEF4444)
val StatusPending = Color(0xFF64748B)
val TimeLockedBadge = Color(0xFFF43F5E)
