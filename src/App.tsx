/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginScreen } from './components/LoginScreen';
import { TelemetryView } from './components/TelemetryView';
import { BlocksView } from './components/BlocksView';
import { ChannelsView } from './components/ChannelsView';
import { CategoriesView } from './components/CategoriesView';
import { AnnouncementsView } from './components/AnnouncementsView';
import { StatusView } from './components/StatusView';
import { SettingsView } from './components/SettingsView';
import { ToastContainer } from './components/Toast';
import {
  clearAdminKey,
  fetchStatus,
  getAdminKey,
  getWorkerUrl,
  setUnauthorizedHandler,
} from './services/api';
import { TabType, ToastMessage } from './types';

export default function App() {
  const [adminKey, setAdminKeyState] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('telemetry');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Worker indicator state
  const [isWorkerHealthy, setIsWorkerHealthy] = useState(true);
  const [workerStatusText, setWorkerStatusText] = useState('جاري الفحص...');

  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('yt_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (
    type: 'success' | 'error' | 'info' | 'warning',
    title: string,
    description?: string
  ) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, title, description }]);

    setTimeout(() => {
      dismissToast(id);
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Synchronize dark theme class on document element
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('yt_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('yt_theme', 'light');
    }
  }, [isDark]);

  // Initial check for existing admin key
  useEffect(() => {
    const saved = getAdminKey();
    if (saved) {
      setAdminKeyState(saved);
    }

    // Set up 401 unauthorized interceptor
    setUnauthorizedHandler((msg) => {
      setAdminKeyState(null);
      addToast('error', 'انتهت الجلسة (401)', msg || 'مفتاح المشرف غير صالح أو انتهت صلاحيته.');
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  // Check worker health when logged in
  useEffect(() => {
    if (!adminKey) return;

    let isMounted = true;
    fetchStatus()
      .then((res) => {
        if (!isMounted) return;
        setIsWorkerHealthy(res?.ok !== false);
        setWorkerStatusText(res?.status || '200 OK');
      })
      .catch(() => {
        if (!isMounted) return;
        setIsWorkerHealthy(false);
        setWorkerStatusText('خطأ في الاتصال');
      });

    return () => {
      isMounted = false;
    };
  }, [adminKey, refreshTrigger]);

  const handleLoginSuccess = (key: string) => {
    setAdminKeyState(key);
    addToast('success', 'تم تسجيل الدخول بنجاح', 'أهلاً بك في لوحة تحكم admin-youngtube');
  };

  const handleLogout = () => {
    clearAdminKey();
    setAdminKeyState(null);
    addToast('info', 'تم تسجيل الخروج', 'تم مسح مفتاح المشرف من التخزين بنجاح');
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger((prev) => prev + 1);
    addToast('info', 'جاري التحديث', 'يتم جلب البيانات الحديثة من الـ Worker...');
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  // If not authenticated, show Login Screen
  if (!adminKey) {
    return (
      <div dir="rtl">
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // Authenticated Dashboard Layout
  return (
    <div id="admin-app-root" dir="rtl" className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        workerUrl={getWorkerUrl()}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-6">
        <Header
          activeTab={activeTab}
          workerUrl={getWorkerUrl()}
          isRefreshing={isRefreshing}
          onRefresh={handleManualRefresh}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
          workerStatusText={workerStatusText}
          isWorkerHealthy={isWorkerHealthy}
        />

        <main id="main-content-view" className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {activeTab === 'telemetry' && (
            <TelemetryView key={refreshTrigger} onNotify={addToast} />
          )}

          {activeTab === 'blocks' && (
            <BlocksView key={refreshTrigger} onNotify={addToast} />
          )}

          {activeTab === 'channels' && (
            <ChannelsView key={refreshTrigger} onNotify={addToast} />
          )}

          {activeTab === 'categories' && (
            <CategoriesView key={refreshTrigger} onNotify={addToast} />
          )}

          {activeTab === 'announcements' && (
            <AnnouncementsView key={refreshTrigger} onNotify={addToast} />
          )}

          {activeTab === 'status' && (
            <StatusView key={refreshTrigger} onNotify={addToast} />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              key={refreshTrigger}
              onNotify={addToast}
              onLogout={handleLogout}
              isDark={isDark}
              onToggleTheme={toggleTheme}
            />
          )}
        </main>
      </div>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
