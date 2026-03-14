'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Shield,
  Bell,
  Download,
  Trash2,
  ArrowLeft,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Loader2,
  X,
  Lock,
  Smartphone,
  Copy,
} from 'lucide-react';
import { addCSRFHeader } from '@/lib/csrf';

// ---------------------------------------------------------------------------
// Confirmation Modal component
// ---------------------------------------------------------------------------

function DeleteAccountModal({
  isOpen,
  onClose,
  onConfirm,
  userEmail,
  isDeleting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userEmail: string;
  isDeleting: boolean;
}) {
  const [confirmEmail, setConfirmEmail] = useState('');
  const emailMatches =
    confirmEmail.trim().toLowerCase() === userEmail.toLowerCase();

  // Reset input when the modal opens / closes
  useEffect(() => {
    if (!isOpen) setConfirmEmail('');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <h2
            id="delete-modal-title"
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            Delete Your Account
          </h2>
        </div>

        <div className="space-y-3 mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            This action is <strong>permanent and cannot be undone</strong>. All
            of the following will be deleted:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <li>Your profile and personal information</li>
            <li>Booking history and payment records</li>
            <li>Messages and chat history</li>
            <li>Reviews you have given or received</li>
            <li>Child profiles and emergency contacts</li>
            <li>Notification preferences</li>
          </ul>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            To confirm, please type your email address below:
          </p>
          <p className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded text-gray-800 dark:text-gray-200 select-all">
            {userEmail}
          </p>
        </div>

        <input
          type="email"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          placeholder="Type your email to confirm"
          autoComplete="off"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                     placeholder-gray-400 dark:placeholder-gray-500
                     focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent
                     text-sm mb-4"
        />

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
                       bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
                       rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!emailMatches || isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600
                       hover:bg-red-700 rounded-lg transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Permanently Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Settings Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Data export state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [twoFASetupData, setTwoFASetupData] = useState<{
    qrCode: string;
    secret: string;
    recoveryCodes: string[];
  } | null>(null);
  const [twoFAVerifyCode, setTwoFAVerifyCode] = useState('');
  const [twoFADisableCode, setTwoFADisableCode] = useState('');
  const [twoFAError, setTwoFAError] = useState<string | null>(null);
  const [twoFASuccess, setTwoFASuccess] = useState<string | null>(null);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);

  // -----------------------------------------------------------------------
  // Auth guard
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      // Check current 2FA status from session
      const u = session?.user as Record<string, any> | undefined;
      if (u?.twoFactorEnabled) {
        setTwoFAEnabled(true);
      }
    }
  }, [status, session]);

  // -----------------------------------------------------------------------
  // Download My Data
  // -----------------------------------------------------------------------
  const handleExportData = async () => {
    try {
      setExporting(true);
      setExportError(null);

      const res = await fetch('/api/user/export', {
        headers: addCSRFHeader({}),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || 'Failed to export data');
      }

      // Trigger file download from the response blob
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;

      // Extract filename from Content-Disposition header, or use a default
      const disposition = res.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
      anchor.download = filenameMatch?.[1] || 'my-data-export.json';

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Delete Account
  // -----------------------------------------------------------------------
  const handleDeleteAccount = async () => {
    if (!session?.user?.email) return;

    try {
      setIsDeleting(true);
      setDeleteError(null);

      const res = await fetch('/api/user/delete', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ confirmEmail: session.user.email }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || 'Failed to delete account');
      }

      // Sign out and redirect to home on success
      await signOut({ redirect: false });
      router.push('/');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Deletion failed');
      setIsDeleting(false);
    }
  };

  // -----------------------------------------------------------------------
  // 2FA: Begin Setup
  // -----------------------------------------------------------------------
  const handleSetup2FA = async () => {
    try {
      setTwoFALoading(true);
      setTwoFAError(null);
      setTwoFASuccess(null);
      setTwoFASetupData(null);

      const res = await fetch('/api/user/2fa/setup', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to start 2FA setup');
      }

      setTwoFASetupData({
        qrCode: json.data.qrCode,
        secret: json.data.secret,
        recoveryCodes: json.data.recoveryCodes,
      });
    } catch (err) {
      setTwoFAError(err instanceof Error ? err.message : '2FA setup failed');
    } finally {
      setTwoFALoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // 2FA: Verify code to enable
  // -----------------------------------------------------------------------
  const handleVerify2FA = async () => {
    try {
      setTwoFALoading(true);
      setTwoFAError(null);

      const res = await fetch('/api/user/2fa/verify', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ token: twoFAVerifyCode }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Invalid verification code');
      }

      setTwoFAEnabled(true);
      setTwoFASetupData(null);
      setTwoFAVerifyCode('');
      setShowRecoveryCodes(true);
      setTwoFASuccess('Two-factor authentication enabled successfully!');
      setTimeout(() => setTwoFASuccess(null), 5000);
    } catch (err) {
      setTwoFAError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setTwoFALoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // 2FA: Disable
  // -----------------------------------------------------------------------
  const handleDisable2FA = async () => {
    try {
      setTwoFALoading(true);
      setTwoFAError(null);

      const res = await fetch('/api/user/2fa/disable', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ token: twoFADisableCode }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to disable 2FA');
      }

      setTwoFAEnabled(false);
      setTwoFADisableCode('');
      setTwoFASuccess('Two-factor authentication has been disabled.');
      setTimeout(() => setTwoFASuccess(null), 5000);
    } catch (err) {
      setTwoFAError(err instanceof Error ? err.message : 'Failed to disable 2FA');
    } finally {
      setTwoFALoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // Derived values
  // -----------------------------------------------------------------------
  const user = session?.user as Record<string, any> | undefined;
  const userName = user?.name || user?.profile?.firstName
    ? `${user?.profile?.firstName ?? ''} ${user?.profile?.lastName ?? ''}`.trim()
    : 'User';
  const userEmail = user?.email ?? '';
  const userType: string = user?.activeRole || user?.userType || 'PARENT';
  const memberSince = user?.createdAt
    ? new Date(user.createdAt as string).toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const dashboardHref =
    userType === 'CAREGIVER'
      ? '/caregiver-dashboard'
      : userType === 'BABYSITTER'
        ? '/babysitter-dashboard'
        : '/parent-dashboard';

  // -----------------------------------------------------------------------
  // Loading / unauthenticated states
  // -----------------------------------------------------------------------
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null; // redirect handled by useEffect
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link
            href={dashboardHref}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Settings
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ================================================================
            Section 1 - Account Information
        ================================================================ */}
        <section
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          aria-labelledby="account-heading"
        >
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-green-600 dark:text-green-400" />
            <h2
              id="account-heading"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              Account Information
            </h2>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Name</dt>
              <dd className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">
                {userName}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Email</dt>
              <dd className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">
                {userEmail}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Account Type</dt>
              <dd className="mt-0.5 font-medium text-gray-900 dark:text-gray-100 capitalize">
                {userType.toLowerCase()}
              </dd>
            </div>
            {memberSince && (
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Member Since</dt>
                <dd className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">
                  {memberSince}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-5">
            <Link
              href={dashboardHref}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400
                         hover:text-green-700 dark:hover:text-green-300 transition-colors"
            >
              Edit Profile
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        {/* ================================================================
            Section 2 - Privacy & Data (PIPEDA)
        ================================================================ */}
        <section
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          aria-labelledby="privacy-heading"
        >
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
            <h2
              id="privacy-heading"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              Privacy & Data
            </h2>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
            Under Canada&apos;s Personal Information Protection and Electronic
            Documents Act (PIPEDA), you have the right to access and request
            deletion of your personal data.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Download My Data */}
            <button
              onClick={handleExportData}
              disabled={exporting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium
                         text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20
                         border border-green-200 dark:border-green-700 rounded-lg
                         hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {exporting ? 'Preparing...' : 'Download My Data'}
            </button>

            {/* Privacy Policy Link */}
            <Link
              href="/privacy-policy"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium
                         text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700
                         border border-gray-200 dark:border-gray-600 rounded-lg
                         hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <Shield className="h-4 w-4" />
              Privacy Policy
            </Link>
          </div>

          {exportError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
              {exportError}
            </p>
          )}
        </section>

        {/* ================================================================
            Section 3 - Notifications
        ================================================================ */}
        <section
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          aria-labelledby="notifications-heading"
        >
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-green-600 dark:text-green-400" />
            <h2
              id="notifications-heading"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              Notifications
            </h2>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            All notifications on InstaCares are essential for the safety and
            security of your bookings. You will receive notifications for:
          </p>

          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span><strong>Booking updates</strong> &mdash; confirmations, cancellations, and status changes</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span><strong>Payment alerts</strong> &mdash; receipts, refunds, and extension payment reminders</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span><strong>Security alerts</strong> &mdash; login notifications and account security events</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span><strong>Booking reminders</strong> &mdash; upcoming booking reminders and follow-ups</span>
            </li>
          </ul>

          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
            These notifications cannot be disabled as they are required for the
            safe operation of the platform and your bookings.
          </p>
        </section>

        {/* ================================================================
            Section 4 - Two-Factor Authentication
        ================================================================ */}
        <section
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          aria-labelledby="twofa-heading"
        >
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-5 w-5 text-green-600 dark:text-green-400" />
            <h2
              id="twofa-heading"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              Two-Factor Authentication (2FA)
            </h2>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Add an extra layer of security to your account. When enabled, you&apos;ll
            need to enter a code from your authenticator app each time you sign in.
          </p>

          {/* Status badge */}
          <div className="flex items-center gap-2 mb-5">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                twoFAEnabled
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              {twoFAEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          {/* Success message */}
          {twoFASuccess && (
            <div className="mb-4 flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-4 py-3">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              {twoFASuccess}
            </div>
          )}

          {/* Error message */}
          {twoFAError && (
            <div className="mb-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3" role="alert">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {twoFAError}
            </div>
          )}

          {/* ── Not enabled and no setup in progress ── */}
          {!twoFAEnabled && !twoFASetupData && (
            <button
              onClick={handleSetup2FA}
              disabled={twoFALoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                         text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {twoFALoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
              Set Up 2FA
            </button>
          )}

          {/* ── Setup in progress: show QR code ── */}
          {!twoFAEnabled && twoFASetupData && (
            <div className="space-y-5">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Step 1: Scan QR Code
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Open your authenticator app (Google Authenticator, Authy, etc.) and scan this QR code.
                </p>
                <div className="flex justify-center mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={twoFASetupData.qrCode}
                    alt="2FA QR Code"
                    width={200}
                    height={200}
                    className="rounded-lg"
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Or enter this key manually:
                  </p>
                  <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded px-3 py-1.5">
                    <code className="text-sm font-mono text-gray-800 dark:text-gray-200 select-all">
                      {twoFASetupData.secret}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(twoFASetupData.secret);
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      aria-label="Copy secret"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Step 2: Enter Verification Code
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Enter the 6-digit code from your authenticator app to confirm setup.
                </p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={twoFAVerifyCode}
                    onChange={(e) => {
                      setTwoFAVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setTwoFAError(null);
                    }}
                    placeholder="000000"
                    className="w-32 px-3 py-2 text-center text-lg font-mono tracking-widest
                               border border-gray-300 dark:border-gray-600 rounded-lg
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                               placeholder-gray-400 dark:placeholder-gray-500
                               focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleVerify2FA}
                    disabled={twoFAVerifyCode.length !== 6 || twoFALoading}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                               text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {twoFALoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Verify & Enable
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  setTwoFASetupData(null);
                  setTwoFAVerifyCode('');
                  setTwoFAError(null);
                }}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Cancel setup
              </button>
            </div>
          )}

          {/* ── Recovery codes (shown after successful enable) ── */}
          {showRecoveryCodes && twoFASetupData && (
            <div className="mt-5 border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
                Save Your Recovery Codes
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                Store these codes in a safe place. Each code can only be used once to sign in if you lose access to your authenticator app.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {twoFASetupData.recoveryCodes.map((code, i) => (
                  <code
                    key={i}
                    className="text-sm font-mono bg-white dark:bg-gray-800 px-3 py-1.5 rounded border border-amber-200 dark:border-amber-700 text-gray-800 dark:text-gray-200 text-center"
                  >
                    {code}
                  </code>
                ))}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    twoFASetupData.recoveryCodes.join('\n')
                  );
                }}
                className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy all codes
              </button>
              <button
                onClick={() => setShowRecoveryCodes(false)}
                className="ml-4 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                I&apos;ve saved them
              </button>
            </div>
          )}

          {/* ── 2FA is enabled: show disable option ── */}
          {twoFAEnabled && !twoFASetupData && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Disable Two-Factor Authentication
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Enter a code from your authenticator app to confirm you want to disable 2FA.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFADisableCode}
                  onChange={(e) => {
                    setTwoFADisableCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setTwoFAError(null);
                  }}
                  placeholder="000000"
                  className="w-32 px-3 py-2 text-center text-lg font-mono tracking-widest
                             border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                             placeholder-gray-400 dark:placeholder-gray-500
                             focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <button
                  onClick={handleDisable2FA}
                  disabled={twoFADisableCode.length !== 6 || twoFALoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                             text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20
                             border border-red-300 dark:border-red-700 rounded-lg
                             hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {twoFALoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Disable 2FA'
                  )}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ================================================================
            Section 5 - Danger Zone (Delete Account)
        ================================================================ */}
        <section
          className="bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-red-200 dark:border-red-800 p-6"
          aria-labelledby="danger-heading"
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <h2
              id="danger-heading"
              className="text-lg font-semibold text-red-600 dark:text-red-400"
            >
              Danger Zone
            </h2>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            Permanently delete your account and all associated data. This action
            cannot be reversed. Your profile, booking history, messages, reviews,
            child profiles, and payment records will all be permanently removed.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            If you have any active bookings, please cancel or complete them
            before deleting your account.
          </p>

          {deleteError && (
            <p className="mb-4 text-sm text-red-600 dark:text-red-400" role="alert">
              {deleteError}
            </p>
          )}

          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                       text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20
                       border border-red-300 dark:border-red-700 rounded-lg
                       hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete My Account
          </button>
        </section>
      </main>

      {/* Delete confirmation modal */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteModal(false);
            setDeleteError(null);
          }
        }}
        onConfirm={handleDeleteAccount}
        userEmail={userEmail}
        isDeleting={isDeleting}
      />
    </div>
  );
}
