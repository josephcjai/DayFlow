package com.dayflow.app.data.remote

import com.dayflow.app.data.model.AuthResponse
import com.dayflow.app.data.model.CategoriesResponse
import com.dayflow.app.data.model.CategoryDto
import com.dayflow.app.data.model.DayTemplateDto
import com.dayflow.app.data.model.TemplatesResponse
import com.dayflow.app.data.model.TemplateUpsertResponse
import com.dayflow.app.data.model.CreateTodoRequest
import com.dayflow.app.data.model.DeleteSlotRequest
import com.dayflow.app.data.model.ChangePasswordRequest
import com.dayflow.app.data.model.DeleteAccountRequest
import com.dayflow.app.data.model.ForgotPasswordRequest
import com.dayflow.app.data.model.HabitLogDto
import com.dayflow.app.data.model.LogHabitRequest
import com.dayflow.app.data.model.LogHabitResponse
import com.dayflow.app.data.model.LoginRequest
import com.dayflow.app.data.model.GoogleLoginRequest
import com.dayflow.app.data.model.AuthConfigResponse
import com.dayflow.app.data.model.MessageResponse
import com.dayflow.app.data.model.RegisterRequest
import com.dayflow.app.data.model.SaveNotesRequest
import com.dayflow.app.data.model.SaveSlotRequest
import com.dayflow.app.data.model.SaveSlotResponse
import com.dayflow.app.data.model.TodoItemDto
import com.dayflow.app.data.model.UpdateTodoRequest
import com.dayflow.app.data.model.UserProfileResponse
import com.dayflow.app.data.model.WeekScheduleResponse
import com.dayflow.app.data.model.WeekTodosResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.HTTP
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

interface DayFlowApiService {

    // ==========================================
    // 1. Authentication Endpoints
    // ==========================================

    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("auth/google")
    suspend fun googleLogin(@Body request: GoogleLoginRequest): Response<AuthResponse>

    @GET("auth/config")
    suspend fun getAuthConfig(): Response<AuthConfigResponse>

    @GET("auth/me")
    suspend fun getCurrentUser(): Response<UserProfileResponse>

    @POST("auth/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequest): Response<MessageResponse>

    @POST("auth/forgot-password")
    suspend fun forgotPassword(@Body request: ForgotPasswordRequest): Response<MessageResponse>

    @HTTP(method = "DELETE", path = "auth/account", hasBody = true)
    suspend fun deleteAccount(@Body request: DeleteAccountRequest): Response<MessageResponse>

    // ==========================================
    // 2. Schedule Endpoints
    // ==========================================

    @GET("schedule/week/{weekStart}")
    suspend fun getWeekSchedule(@Path("weekStart") weekStart: String): Response<WeekScheduleResponse>

    @POST("schedule/slot")
    suspend fun saveSlot(@Body request: SaveSlotRequest): Response<SaveSlotResponse>

    @HTTP(method = "DELETE", path = "schedule/slot", hasBody = true)
    suspend fun deleteSlot(@Body request: DeleteSlotRequest): Response<MessageResponse>

    // ==========================================
    // 3. Habit Endpoints
    // ==========================================

    @POST("habits/log")
    suspend fun logHabit(@Body request: LogHabitRequest): Response<LogHabitResponse>

    @DELETE("habits/{id}")
    suspend fun deleteHabit(@Path("id") id: String): Response<MessageResponse>

    // ==========================================
    // 4. Todo & Notes Endpoints
    // ==========================================

    @GET("todos/week/{weekStart}")
    suspend fun getWeekTodos(@Path("weekStart") weekStart: String): Response<WeekTodosResponse>

    @POST("todos/todo")
    suspend fun createTodo(@Body request: CreateTodoRequest): Response<TodoItemDto>

    @PATCH("todos/{id}")
    suspend fun updateTodo(
        @Path("id") id: String,
        @Body request: UpdateTodoRequest
    ): Response<TodoItemDto>

    @DELETE("todos/{id}")
    suspend fun deleteTodo(@Path("id") id: String): Response<MessageResponse>

    @POST("todos/notes")
    suspend fun saveNotes(@Body request: SaveNotesRequest): Response<MessageResponse>

    // ==========================================
    // 5. Category Endpoints (v2.9.0 Parity)
    // ==========================================

    @GET("categories")
    suspend fun getCategories(): Response<CategoriesResponse>

    @POST("categories")
    suspend fun createCategory(@Body request: CategoryDto): Response<CategoryDto>

    @DELETE("categories/{id}")
    suspend fun deleteCategory(@Path("id") id: String): Response<Unit>

    // ==========================================
    // 6. Day Template Endpoints (v2.7.0 Web Parity)
    // ==========================================

    @GET("templates")
    suspend fun getTemplates(): Response<TemplatesResponse>

    @POST("templates")
    suspend fun createTemplate(@Body request: DayTemplateDto): Response<TemplateUpsertResponse>

    @PUT("templates/{id}")
    suspend fun updateTemplate(
        @Path("id") id: String,
        @Body request: DayTemplateDto
    ): Response<TemplateUpsertResponse>

    @DELETE("templates/{id}")
    suspend fun deleteTemplate(@Path("id") id: String): Response<Unit>

    companion object {
        const val GOOGLE_SERVER_CLIENT_ID = "1033021313424-jm6ke98n03tjl3ti7gndk10fv2pphq8p.apps.googleusercontent.com"
        const val PROD_BASE_URL = "https://dayflowlive.com/api/"
        const val DEV_EMULATOR_BASE_URL = "http://10.0.2.2:5000/api/"
        const val DEV_PHYSICAL_BASE_URL = "http://192.168.1.100:5000/api/"
    }
}
