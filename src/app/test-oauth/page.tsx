"use client";

import { signIn, signOut, useSession } from 'next-auth/react';
import { useState } from 'react';

export default function TestOAuth() {
  const { data: session, status } = useSession();
  const [result, setResult] = useState<any>(null);

  const handleGoogleSignIn = async () => {
    try {
      console.log('Attempting Google sign in...');
      const result = await signIn('google', { 
        redirect: false,
        callbackUrl: '/test-oauth'
      });
      console.log('Sign in result:', result);
      setResult(result);
    } catch (error) {
      console.error('OAuth error:', error);
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('Signing out...');
      await signOut({ redirect: false });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const testSessionEndpoint = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();
      console.log('Session endpoint response:', data);
      setResult(data);
    } catch (error) {
      console.error('Session test error:', error);
      setResult({ error: 'Failed to test session endpoint' });
    }
  };

  const checkOAuthConfig = async () => {
    try {
      const response = await fetch('/api/test/oauth-config');
      const data = await response.json();
      console.log('OAuth config:', data);
      setResult(data);
    } catch (error) {
      console.error('OAuth config error:', error);
      setResult({ error: 'Failed to check OAuth config' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">OAuth Testing</h1>
        
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Session Status</h2>
          <p><strong>Status:</strong> {status}</p>
          <p><strong>User:</strong> {session?.user?.email || 'Not logged in'}</p>
          <p><strong>Session:</strong> {session ? 'Active' : 'None'}</p>
        </div>

        <div className="space-x-4 mb-6">
          <button
            onClick={handleGoogleSignIn}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Test Google Sign In
          </button>
          
          <button
            onClick={handleSignOut}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Sign Out
          </button>
          
          <button
            onClick={testSessionEndpoint}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Test Session Endpoint
          </button>
          
          <button
            onClick={checkOAuthConfig}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
          >
            Check OAuth Config
          </button>
        </div>

        {result && (
          <div className="bg-gray-50 p-4 rounded">
            <h3 className="font-semibold mb-2">Result:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}