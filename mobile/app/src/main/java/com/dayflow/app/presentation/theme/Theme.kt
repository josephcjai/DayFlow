package com.dayflow.app.presentation.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

@Composable
fun DayFlowTheme(
    themeMode: DayFlowThemeMode = DayFlowThemeMode.DARK,
    content: @Composable () -> Unit
) {
    android.util.Log.d("DayFlowTheme", "DayFlowTheme composing with mode: " + themeMode + ", isLight: " + (themeMode == DayFlowThemeMode.LIGHT))
    val palette = when (themeMode) {
        DayFlowThemeMode.DARK -> MidnightPalette
        DayFlowThemeMode.OLED -> OledPalette
        DayFlowThemeMode.EMERALD -> EmeraldPalette
        DayFlowThemeMode.LIGHT -> LightPalette
    }

    val colorScheme = if (palette.isLight) {
        lightColorScheme(
            primary = DayFlowPrimary,
            onPrimary = Color.White,
            secondary = DayFlowSecondary,
            onSecondary = Color.White,
            tertiary = DayFlowTertiary,
            background = palette.background,
            surface = palette.surface,
            onBackground = palette.textPrimary,
            onSurface = palette.textPrimary,
            surfaceVariant = palette.surfaceElevated,
            onSurfaceVariant = palette.textSecondary
        )
    } else {
        darkColorScheme(
            primary = DayFlowPrimary,
            onPrimary = palette.textPrimary,
            secondary = DayFlowSecondary,
            onSecondary = palette.textPrimary,
            tertiary = DayFlowTertiary,
            background = palette.background,
            surface = palette.surface,
            onBackground = palette.textPrimary,
            onSurface = palette.textPrimary,
            surfaceVariant = palette.surfaceElevated,
            onSurfaceVariant = palette.textSecondary
        )
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = palette.background.toArgb()
            window.navigationBarColor = palette.background.toArgb()
            val insetsController = WindowCompat.getInsetsController(window, view)
            insetsController.isAppearanceLightStatusBars = palette.isLight
            insetsController.isAppearanceLightNavigationBars = palette.isLight
        }
    }

    CompositionLocalProvider(
        LocalDayFlowPalette provides palette
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = Typography,
            content = content
        )
    }
}
