import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Preserve diagnostics without exposing credentials or application payloads.
    console.error('[YoungTube admin view error]', error.message, info.componentStack);
  }

  private retry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section className="m-4 rounded-2xl border border-rose-200 bg-white p-6 text-slate-900 dark:border-rose-900 dark:bg-slate-900 dark:text-slate-100" role="alert" dir="rtl">
          <h2 className="text-lg font-extrabold">{this.props.fallbackTitle || 'حدث خطأ أثناء عرض هذه الصفحة'}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            تعذر عرض هذا القسم بسبب خطأ غير متوقع. بقية لوحة الإدارة تظل متاحة. أعد المحاولة، وإذا تكرر الخطأ راجع سجل أخطاء المتصفح.
          </p>
          <button onClick={this.retry} className="mt-4 rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300">
            إعادة المحاولة
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}
