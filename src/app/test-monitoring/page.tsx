"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";

export default function TestMonitoringPage() {
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testClientError = () => {
    try {
      addResult("Triggering client-side error...");
      throw new Error("Test client-side error for Sentry");
    } catch (error: unknown) {
      Sentry.captureException(error);
      addResult("✅ Client error sent to Sentry");
    }
  };

  const testUnhandledError = () => {
    const shouldProceed = window.confirm(
      "This will trigger an unhandled error to test the error boundary.\n\n" +
      "The page will show an error screen, which you can reset.\n\n" +
      "Continue?"
    );

    if (shouldProceed) {
      addResult("Triggering unhandled error (check console and Sentry)...");
      setTimeout(() => {
        throw new Error("Test unhandled error - should be caught by error boundary");
      }, 100);
    }
  };

  const testApiError = async () => {
    try {
      addResult("Testing API error...");
      const response = await fetch("/api/test-error");
      if (!response.ok) {
        addResult("✅ API returned error status: " + response.status);
      }
    } catch (error: unknown) {
      addResult("✅ API error occurred: " + (error as Error).message);
    }
  };

  const testHealthCheck = async () => {
    try {
      addResult("Testing health check endpoint...");
      const response = await fetch("/api/health");
      const data = await response.json();
      addResult(`✅ Health status: ${data.status}, Database: ${data.checks.database.status}`);
    } catch (error: unknown) {
      addResult("❌ Health check failed: " + (error as Error).message);
    }
  };

  const testReadyCheck = async () => {
    try {
      addResult("Testing ready check endpoint...");
      const response = await fetch("/api/ready");
      const data = await response.json();
      addResult(`✅ Ready: ${data.ready}, Database: ${data.checks.database}, Migrations: ${data.checks.migrations}`);
    } catch (error: unknown) {
      addResult("❌ Ready check failed: " + (error as Error).message);
    }
  };

  const testStatusCheck = async () => {
    try {
      addResult("Testing status endpoint (requires auth)...");
      const response = await fetch("/api/status");
      if (response.status === 401) {
        addResult("⚠️ Status endpoint requires authentication (working as expected)");
        return;
      }
      const data = await response.json();
      addResult(`✅ Status: ${data.status}, Uptime: ${data.uptime.formatted}`);
    } catch (error: unknown) {
      addResult("❌ Status check failed: " + (error as Error).message);
    }
  };

  const testSentryMessage = () => {
    addResult("Sending info message to Sentry...");
    Sentry.captureMessage("Test message from monitoring test page", "info");
    addResult("✅ Test message sent to Sentry");
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Monitoring Test Page</h1>

      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
        <p className="text-sm">
          <strong>Note:</strong> Sentry errors will only be sent if NEXT_PUBLIC_SENTRY_DSN is configured.
          Check your browser console for additional details.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-3">Error Tracking Tests</h2>
          <div className="space-y-2">
            <button
              onClick={testClientError}
              className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Test Client Error
            </button>
            <button
              onClick={testSentryMessage}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Test Sentry Message
            </button>
            <button
              onClick={testApiError}
              className="w-full px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              Test API Error
            </button>
            <button
              onClick={testUnhandledError}
              className="w-full px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800"
            >
              Test Unhandled Error ⚠️
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">Health Check Tests</h2>
          <div className="space-y-2">
            <button
              onClick={testHealthCheck}
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Test /api/health
            </button>
            <button
              onClick={testReadyCheck}
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Test /api/ready
            </button>
            <button
              onClick={testStatusCheck}
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Test /api/status
            </button>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Test Results</h3>
          <button
            onClick={clearResults}
            className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
        <div className="bg-gray-50 rounded p-3 min-h-[200px] max-h-[400px] overflow-y-auto font-mono text-sm">
          {testResults.length === 0 ? (
            <p className="text-gray-400">Click buttons above to run tests...</p>
          ) : (
            testResults.map((result, index) => (
              <div key={index} className="py-1 border-b border-gray-200 last:border-0">
                {result}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold mb-2">What to Check:</h3>
        <ul className="text-sm space-y-1 list-disc list-inside">
          <li>Open browser DevTools Console to see if Sentry is initialized</li>
          <li>Health endpoints should return JSON without authentication</li>
          <li>Status endpoint should require authentication</li>
          <li>If Sentry DSN is configured, check your Sentry dashboard for test errors</li>
          <li>Check the server logs for Winston logging output</li>
        </ul>
      </div>
    </div>
  );
}