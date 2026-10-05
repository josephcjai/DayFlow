package com.dayflow.app.presentation

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
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
import com.dayflow.app.presentation.theme.DayFlowTheme
import com.dayflow.app.presentation.theme.SurfaceDark
import com.dayflow.app.presentation.theme.SurfaceElevated
import com.dayflow.app.presentation.theme.TextMuted
import com.dayflow.app.presentation.theme.TextPrimary
import com.dayflow.app.presentation.theme.TextSecondary
import com.dayflow.app.presentation.todos.TodosScreen
import com.dayflow.app.presentation.todos.TodosViewModel
import dagger.hilt.android.AndroidEntryPoint

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
    var selectedNavIndex by remember { mutableIntStateOf(0) } // 0 = Schedule, 1 = Habits, 2 = Todos

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = BackgroundDark,
        topBar = {
            Surface(
                color = SurfaceDark,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
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
                        Text(
                            text = authState.displayName ?: "Active User",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = TextSecondary
                        )

                        Spacer(modifier = Modifier.width(4.dp))

                        IconButton(
                            onClick = onLogout,
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ExitToApp,
                                contentDescription = "Log Out",
                                tint = TextMuted,
                                modifier = Modifier.size(18.dp)
                            )
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
        }
    }
}
