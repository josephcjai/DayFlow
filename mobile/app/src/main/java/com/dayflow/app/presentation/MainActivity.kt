package com.dayflow.app.presentation

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import androidx.compose.material.icons.filled.Widgets
import androidx.compose.ui.platform.LocalContext
import com.dayflow.app.presentation.widget.DayFlowWidgetReceiver
import androidx.fragment.app.FragmentActivity
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.dayflow.app.presentation.auth.AuthScreen
import com.dayflow.app.presentation.auth.AuthViewModel
import com.dayflow.app.presentation.habits.HabitsScreen
import com.dayflow.app.presentation.habits.HabitsViewModel
import com.dayflow.app.presentation.navigation.Screen
import com.dayflow.app.presentation.schedule.ScheduleTimelineScreen
import com.dayflow.app.presentation.schedule.ScheduleViewModel
import com.dayflow.app.presentation.theme.BackgroundDark
import com.dayflow.app.presentation.theme.DayFlowPrimary
import com.dayflow.app.presentation.theme.DayFlowSecondary
import com.dayflow.app.presentation.theme.StatusDone
import com.dayflow.app.presentation.theme.DayFlowTheme
import com.dayflow.app.presentation.theme.SurfaceDark
import com.dayflow.app.presentation.theme.SurfaceElevated
import com.dayflow.app.presentation.theme.TextMuted
import com.dayflow.app.presentation.theme.TextPrimary
import com.dayflow.app.presentation.theme.TextSecondary
import com.dayflow.app.presentation.todos.TodosScreen
import com.dayflow.app.presentation.todos.TodosViewModel
import com.dayflow.app.presentation.settings.SettingsBottomSheet
import com.dayflow.app.presentation.settings.SettingsViewModel
import androidx.compose.material.icons.filled.Settings
import dagger.hilt.android.AndroidEntryPoint
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.core.content.ContextCompat
import com.dayflow.app.notification.SlotNotificationScheduler
import com.dayflow.app.presentation.util.BiometricHelper

@AndroidEntryPoint
class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            DayFlowTheme {
                val navController = rememberNavController()
                val authViewModel: AuthViewModel = hiltViewModel()
                val authState by authViewModel.uiState.collectAsState()

                val startDestination = if (authState.isAuthenticated) {
                    Screen.Dashboard.route
                } else {
                    Screen.Auth.route
                }

                NavHost(
                    navController = navController,
                    startDestination = startDestination
                ) {
                    composable(Screen.Auth.route) {
                        AuthScreen(
                            viewModel = authViewModel,
                            onAuthSuccess = {
                                navController.navigate(Screen.Dashboard.route) {
                                    popUpTo(Screen.Auth.route) { inclusive = true }
                                }
                            }
                        )
                    }

                    composable(Screen.Dashboard.route) {
                        val scheduleViewModel: ScheduleViewModel = hiltViewModel()
                        val habitsViewModel: HabitsViewModel = hiltViewModel()
                        val todosViewModel: TodosViewModel = hiltViewModel()

                        DashboardScreen(
                            authViewModel = authViewModel,
                            scheduleViewModel = scheduleViewModel,
                            habitsViewModel = habitsViewModel,
                            todosViewModel = todosViewModel,
                            onLogout = {
                                authViewModel.logout()
                                navController.navigate(Screen.Auth.route) {
                                    popUpTo(Screen.Dashboard.route) { inclusive = true }
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun DashboardScreen(
    authViewModel: AuthViewModel,
    scheduleViewModel: ScheduleViewModel,
    habitsViewModel: HabitsViewModel,
    todosViewModel: TodosViewModel,
    onLogout: () -> Unit
) {
    val authState by authViewModel.uiState.collectAsState()
    val context = LocalContext.current
    val activity = context as? FragmentActivity
    var selectedNavIndex by remember { mutableIntStateOf(0) } // 0 = Schedule, 1 = Habits, 2 = Todos
    val settingsViewModel: SettingsViewModel = hiltViewModel()
    var showSettingsSheet by remember { mutableStateOf(false) }

    val hasBiometrics = remember { BiometricHelper.isBiometricAvailable(context) }
    var isUnlocked by rememberSaveable { mutableStateOf(!hasBiometrics) }
    var biometricError by remember { mutableStateOf<String?>(null) }

    // Request notification permission and start slot boundary scheduler
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { }

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        SlotNotificationScheduler.scheduleNextReminder(context)

        // Trigger biometric prompt on entry if locked
        if (hasBiometrics && !isUnlocked && activity != null) {
            BiometricHelper.authenticate(
                activity = activity,
                onSuccess = {
                    isUnlocked = true
                    biometricError = null
                },
                onError = { err ->
                    biometricError = err
                }
            )
        }
    }

    Scaffold(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding(),
        containerColor = BackgroundDark,
        topBar = {
            Surface(
                color = SurfaceDark,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "DayFlow",
                            fontSize = 22.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = DayFlowPrimary,
                            letterSpacing = (-0.5).sp
                        )

                        if (authState.isDemoMode) {
                            Spacer(modifier = Modifier.width(8.dp))
                            Surface(
                                color = DayFlowSecondary.copy(alpha = 0.2f),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(
                                    text = "DEMO",
                                    color = DayFlowSecondary,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            modifier = Modifier.clickable { showSettingsSheet = true },
                            color = SurfaceElevated,
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, TextMuted.copy(alpha = 0.3f))
                        ) {
                            Box(modifier = Modifier.padding(6.dp)) {
                                Icon(
                                    imageVector = Icons.Default.Settings,
                                    contentDescription = "Settings",
                                    tint = DayFlowPrimary,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Column(
                            horizontalAlignment = Alignment.End,
                            modifier = Modifier.padding(end = 10.dp)
                        ) {
                            Text(
                                text = authState.displayName ?: if (authState.isDemoMode) "Demo User" else "Active User",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = TextPrimary
                            )
                            Text(
                                text = if (authState.isDemoMode) "Local Storage" else "Docker Sync",
                                fontSize = 10.sp,
                                color = if (authState.isDemoMode) DayFlowSecondary else StatusDone
                            )
                        }

                        if (hasBiometrics) {
                            Surface(
                                modifier = Modifier.clickable {
                                    isUnlocked = false
                                },
                                color = SurfaceElevated,
                                shape = RoundedCornerShape(8.dp),
                                border = BorderStroke(1.dp, TextMuted.copy(alpha = 0.3f))
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Lock,
                                        contentDescription = "Lock App",
                                        tint = DayFlowSecondary,
                                        modifier = Modifier.size(15.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "Lock",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = DayFlowSecondary
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(6.dp))
                        }

                        Surface(
                            modifier = Modifier.clickable {
                                val appWidgetManager = AppWidgetManager.getInstance(context)
                                val myProvider = ComponentName(context, DayFlowWidgetReceiver::class.java)
                                if (appWidgetManager.isRequestPinAppWidgetSupported) {
                                    appWidgetManager.requestPinAppWidget(myProvider, null, null)
                                }
                            },
                            color = SurfaceElevated,
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, TextMuted.copy(alpha = 0.3f))
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Widgets,
                                    contentDescription = "Pin Widget",
                                    tint = DayFlowPrimary,
                                    modifier = Modifier.size(15.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "Widget",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = DayFlowPrimary
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            modifier = Modifier.clickable {
                                SlotNotificationScheduler.cancelReminder(context)
                                onLogout()
                            },
                            color = SurfaceElevated,
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, TextMuted.copy(alpha = 0.3f))
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ExitToApp,
                                    contentDescription = "Log Out",
                                    tint = DayFlowSecondary,
                                    modifier = Modifier.size(15.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "Logout",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = DayFlowSecondary
                                )
                            }
                        }
                    }
                }
            }
        },
        bottomBar = {
            NavigationBar(
                containerColor = SurfaceDark,
                tonalElevation = 8.dp
            ) {
                NavigationBarItem(
                    selected = selectedNavIndex == 0,
                    onClick = { selectedNavIndex = 0 },
                    icon = {
                        Icon(Icons.Default.CalendarMonth, contentDescription = "Schedule")
                    },
                    label = { Text("Schedule", fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = DayFlowPrimary,
                        selectedTextColor = DayFlowPrimary,
                        unselectedIconColor = TextMuted,
                        unselectedTextColor = TextMuted,
                        indicatorColor = DayFlowPrimary.copy(alpha = 0.15f)
                    )
                )

                NavigationBarItem(
                    selected = selectedNavIndex == 1,
                    onClick = { selectedNavIndex = 1 },
                    icon = {
                        Icon(Icons.Default.EmojiEvents, contentDescription = "Habits")
                    },
                    label = { Text("Habits", fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = DayFlowSecondary,
                        selectedTextColor = DayFlowSecondary,
                        unselectedIconColor = TextMuted,
                        unselectedTextColor = TextMuted,
                        indicatorColor = DayFlowSecondary.copy(alpha = 0.15f)
                    )
                )

                NavigationBarItem(
                    selected = selectedNavIndex == 2,
                    onClick = { selectedNavIndex = 2 },
                    icon = {
                        Icon(Icons.Default.Checklist, contentDescription = "Todos & Notes")
                    },
                    label = { Text("Todos", fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = DayFlowPrimary,
                        selectedTextColor = DayFlowPrimary,
                        unselectedIconColor = TextMuted,
                        unselectedTextColor = TextMuted,
                        indicatorColor = DayFlowPrimary.copy(alpha = 0.15f)
                    )
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (selectedNavIndex) {
                0 -> ScheduleTimelineScreen(viewModel = scheduleViewModel)
                1 -> HabitsScreen(viewModel = habitsViewModel)
                2 -> TodosScreen(viewModel = todosViewModel)
            }

            // Biometric Quick-Resume Lock Overlay
            if (hasBiometrics && !isUnlocked) {
                Surface(
                    color = BackgroundDark.copy(alpha = 0.98f),
                    modifier = Modifier.fillMaxSize()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Surface(
                            color = DayFlowPrimary.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(24.dp),
                            modifier = Modifier.size(80.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.Fingerprint,
                                    contentDescription = "Biometrics",
                                    tint = DayFlowPrimary,
                                    modifier = Modifier.size(48.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(24.dp))

                        Text(
                            text = "DayFlow Quick Resume",
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = "Confirm biometric credentials or screen lock to access your schedule.",
                            fontSize = 14.sp,
                            color = TextSecondary,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )

                        if (biometricError != null) {
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = biometricError ?: "",
                                fontSize = 12.sp,
                                color = DayFlowSecondary
                            )
                        }

                        Spacer(modifier = Modifier.height(32.dp))

                        Button(
                            onClick = {
                                if (activity != null) {
                                    BiometricHelper.authenticate(
                                        activity = activity,
                                        onSuccess = {
                                            isUnlocked = true
                                            biometricError = null
                                        },
                                        onError = { err ->
                                            biometricError = err
                                        }
                                    )
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = DayFlowPrimary),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth().height(50.dp)
                        ) {
                            Text("Unlock DayFlow", fontWeight = FontWeight.Bold, color = BackgroundDark)
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        OutlinedButton(
                            onClick = {
                                SlotNotificationScheduler.cancelReminder(context)
                                onLogout()
                            },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth().height(50.dp)
                        ) {
                            Text("Log Out", color = DayFlowSecondary)
                        }
                    }
                }
            }
        }
    }

    if (showSettingsSheet) {
        SettingsBottomSheet(
            viewModel = settingsViewModel,
            onDismiss = { showSettingsSheet = false }
        )
    }
}
