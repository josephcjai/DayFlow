package com.dayflowapp.mobile.di

import com.dayflowapp.mobile.data.sync.ConnectivityManagerNetworkMonitor
import com.dayflowapp.mobile.data.sync.NetworkMonitor
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class SyncModule {

    @Binds
    @Singleton
    abstract fun bindNetworkMonitor(
        impl: ConnectivityManagerNetworkMonitor
    ): NetworkMonitor
}
