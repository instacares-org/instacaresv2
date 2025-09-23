"use client";

import { useState, useEffect } from "react";
import { EyeIcon, EyeSlashIcon, UserIcon, HeartIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import SocialLogin from "../../../components/SocialLogin";

export default function ParentLoginPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login, isAuthenticated, loading, isParent } = useAuth();

  // Redirect if already authenticated as parent
  useEffect(() => {
    if (!loading && isAuthenticated && isParent && !isLoading) {
      router.replace('/parent-dashboard');
    }
  }, [loading, isAuthenticated, isParent, router, isLoading]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await login(formData.email, formData.password, 'parent', formData.rememberMe);
      
      if (result.success) {
        // Clear any existing errors and show success
        setErrors({});
        
        // Don't redirect manually - let the useEffect handle it after state updates
        // The useEffect will automatically redirect when isAuthenticated becomes true
      } else {
        if (result.status === 'pending_approval') {
          // Redirect to account status page
          router.push('/account-status');
          return;
        } else if (result.status === 'REJECTED') {
          router.push('/account-status');
          return;
        } else if (result.status === 'SUSPENDED') {
          router.push('/account-status');
          return;
        } else {
          setErrors({ 
            general: result.error || 'Login failed. Please check your credentials.' 
          });
        }
      }
    } catch (error) {
      setErrors({ 
        general: 'Network error. Please try again.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = (provider: string, userType: string) => {
    // In real app, would handle social login with provider
    console.log(`Social login with ${provider} for ${userType}`);
    router.push('/parent-dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="flex items-center">
            <div className="relative h-15 w-24">
              <Image
                src="/logo.png"
                fill
                alt="Instacares Logo"
                className="object-contain"
              />
            </div>
          </Link>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-80px)]">
        {/* Left Side - Welcome Content */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 p-12 text-white flex-col justify-center">
          <div className="max-w-md">
            <div className="mb-8">
              <HeartIcon className="h-16 w-16 text-blue-200 mb-6" />
              <h1 className="text-4xl font-bold mb-4">
                Welcome Back, Parents!
              </h1>
              <p className="text-xl text-blue-100 leading-relaxed">
                Find trusted, verified caregivers in your neighborhood. Your family's safety and peace of mind is our priority.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold">✓</span>
                </div>
                <span className="text-blue-100">Background-checked caregivers</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold">✓</span>
                </div>
                <span className="text-blue-100">Real reviews from real families</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold">✓</span>
                </div>
                <span className="text-blue-100">24/7 support and safety monitoring</span>
              </div>
            </div>

            <div className="mt-12 p-6 bg-white/10 rounded-xl backdrop-blur-sm">
              <p className="text-blue-100 text-sm italic">
                "Instacares helped me find the perfect caregiver for my twins. The process was so easy and I felt confident knowing everyone was verified."
              </p>
              <p className="text-blue-200 text-sm mt-2 font-medium">- Jennifer M., NYC Parent</p>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <UserIcon className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Parent Login
              </h2>
              <p className="text-gray-600">
                Sign in to find trusted childcare
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* General Error */}
              {errors.general && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{errors.general}</p>
                </div>
              )}

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your email"
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 pr-12 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                      errors.password ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="rememberMe"
                    name="rememberMe"
                    type="checkbox"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-700">
                    Remember me
                  </label>
                </div>
                
                <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-500 transition">
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition duration-150 flex items-center justify-center"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            {/* Social Login */}
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <SocialLogin 
                userType="parent" 
                onSocialLogin={handleSocialLogin}
              />
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Don't have an account?</span>
              </div>
            </div>

            {/* Sign Up Link */}
            <div className="text-center space-y-2">
              <Link
                href="/?signup=true"
                className="w-full bg-white hover:bg-gray-50 text-blue-600 font-medium py-3 px-4 rounded-lg border-2 border-blue-600 transition duration-150 inline-block"
              >
                Create Parent Account
              </Link>
              
              <p className="text-sm text-gray-600">
                Are you a caregiver?{" "}
                <Link href="/login/caregiver" className="text-blue-600 hover:text-blue-500 font-medium">
                  Sign in here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}