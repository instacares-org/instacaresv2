"use client";

import { useState } from 'react';
import Cookies from 'js-cookie';

export default function TestLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<any>(null);

  const testLogin = async () => {
    try {
      console.log('Testing login with:', email);
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          userType: 'parent'
        })
      });

      const data = await response.json();
      console.log('Login response:', { status: response.status, data });
      
      setResult({
        status: response.status,
        data,
        cookies: {
          jsCookie: Cookies.get('auth-token'),
          localStorage: localStorage.getItem('auth-token'),
        }
      });

    } catch (error) {
      console.error('Login test error:', error);
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const testAuthMe = async () => {
    try {
      const token = localStorage.getItem('auth-token') || Cookies.get('auth-token');
      console.log('Testing /api/auth/me with token:', !!token);
      
      const headers: any = {};
      if (token) {
        headers['x-auth-token'] = token;
        headers['authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers,
      });

      const data = await response.json();
      console.log('/api/auth/me response:', { status: response.status, data });
      
      setResult({
        status: response.status,
        data,
        tokenUsed: !!token
      });

    } catch (error) {
      console.error('/api/auth/me error:', error);
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const testDebug = async () => {
    try {
      const response = await fetch('/api/auth/debug', {
        credentials: 'include',
      });
      const data = await response.json();
      console.log('Debug response:', data);
      setResult(data);
    } catch (error) {
      console.error('Debug error:', error);
    }
  };

  const clearTokens = () => {
    Cookies.remove('auth-token');
    localStorage.removeItem('auth-token');
    setResult({ message: 'Tokens cleared' });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Login Testing</h1>
        
        <div className="space-y-4 mb-6">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>

        <div className="space-x-4 mb-6">
          <button
            onClick={testLogin}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Test Login
          </button>
          <button
            onClick={testAuthMe}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Test /api/auth/me
          </button>
          <button
            onClick={testDebug}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
          >
            Test Debug
          </button>
          <button
            onClick={clearTokens}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Clear Tokens
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