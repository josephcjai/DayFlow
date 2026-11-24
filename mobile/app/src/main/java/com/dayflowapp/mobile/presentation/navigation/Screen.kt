package com.dayflowapp.mobile.presentation.navigation

sealed class Screen(val route: String) {
    data object Auth : Screen("auth")
    data object Dashboard : Screen("dashboard")
}
