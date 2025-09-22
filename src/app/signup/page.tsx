"use client";

import { useState } from "react";
import { CheckCircleIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import Image from "next/image";

export default function SignupPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    userType: "parent", // parent or provider
    agreeToTerms: false,
    agreeToMarketing: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else {
      const issues: string[] = [];
      
      if (formData.password.length < 8) {
        issues.push("Password must be at least 8 characters long");
      }
      
      if (!/[a-z]/.test(formData.password)) {
        issues.push("Password must contain at least one lowercase letter");
      }
      
      if (!/[A-Z]/.test(formData.password)) {
        issues.push("Password must contain at least one uppercase letter");
      }
      
      if (!/\d/.test(formData.password)) {
        issues.push("Password must contain at least one number");
      }
      
      if (!/[@$!%*?&]/.test(formData.password)) {
        issues.push("Password must contain at least one special character (@$!%*?&)");
      }
      
      if (issues.length > 0) {
        newErrors.password = issues[0]; // Show first issue
      }
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = "You must acknowledge and agree to the Terms of Service and Privacy Policy to create an account";
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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          phone: formData.phone,
          userType: formData.userType,
          agreeToTerms: formData.agreeToTerms,
          agreeToMarketing: formData.agreeToMarketing
        })
      });

      const data = await response.json();

      if (response.ok) {
        setIsSubmitted(true);
      } else {
        // Handle specific error messages
        if (data.error) {
          setErrors({ general: data.error });
        } else {
          setErrors({ general: 'Failed to create account. Please try again.' });
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({ general: 'Failed to create account. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg text-center">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto" />
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Account Created Successfully!</h2>
            <p className="text-gray-600 mb-6">
              Your account has been created and is pending approval by our admin team. 
              You will receive a notification once your account is approved and you can start using the platform.
            </p>
            <div className="space-y-3">
              <Link
                href="/account-status"
                className="w-full bg-rose-500 hover:bg-rose-600 text-white font-medium py-3 px-4 rounded-lg transition duration-150 inline-block"
              >
                Check Account Status
              </Link>
              <Link
                href="/"
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition duration-150 inline-block"
              >
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm relative z-10">
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

      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-rose-100 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-100 rounded-full opacity-20 blur-3xl"></div>
      </div>

      {/* Sign Up Form */}
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-2xl backdrop-blur-sm border border-white/20 relative overflow-hidden">
          {/* Form card inner shadow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent pointer-events-none rounded-2xl"></div>
          <div className="relative z-10">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 text-center mb-2">
                Create your account
              </h2>
              <p className="text-center text-gray-600">
                Join Instacares to find trusted childcare
              </p>
            </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* General Error Message */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {errors.general}
              </div>
            )}
            
            {/* User Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                I am a:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    name="userType"
                    value="parent"
                    checked={formData.userType === "parent"}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <div className={`p-3 text-center rounded-lg border-2 transition ${
                    formData.userType === "parent" 
                      ? 'border-rose-500 bg-rose-50 text-rose-700' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <div className="font-medium">Parent</div>
                    <div className="text-sm text-gray-500">Looking for childcare</div>
                  </div>
                </label>
                
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    name="userType"
                    value="provider"
                    checked={formData.userType === "provider"}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <div className={`p-3 text-center rounded-lg border-2 transition ${
                    formData.userType === "provider" 
                      ? 'border-rose-500 bg-rose-50 text-rose-700' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <div className="font-medium">Provider</div>
                    <div className="text-sm text-gray-500">Offering childcare</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={`mt-1 block w-full px-3 py-2 border ${
                    errors.firstName ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg shadow-sm focus:outline-none focus:ring-rose-500 focus:border-rose-500`}
                />
                {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  className={`mt-1 block w-full px-3 py-2 border ${
                    errors.lastName ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg shadow-sm focus:outline-none focus:ring-rose-500 focus:border-rose-500`}
                />
                {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                } rounded-lg shadow-sm focus:outline-none focus:ring-rose-500 focus:border-rose-500`}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                } rounded-lg shadow-sm focus:outline-none focus:ring-rose-500 focus:border-rose-500`}
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  className={`block w-full px-3 py-2 pr-10 border ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg shadow-sm focus:outline-none focus:ring-rose-500 focus:border-rose-500`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              {!errors.password && (
                <div className="mt-1 text-xs text-gray-500">
                  Password must contain: lowercase, uppercase, number, and special character (@$!%*?&)
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <div className="relative mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`block w-full px-3 py-2 pr-10 border ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg shadow-sm focus:outline-none focus:ring-rose-500 focus:border-rose-500`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
            </div>

            {/* Terms and Marketing */}
            <div className="space-y-3">
              <div className="flex items-start">
                <input
                  id="agreeToTerms"
                  name="agreeToTerms"
                  type="checkbox"
                  checked={formData.agreeToTerms}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-rose-600 focus:ring-rose-500 border-gray-300 rounded"
                />
                <label htmlFor="agreeToTerms" className="ml-2 text-sm text-gray-700">
                  I acknowledge that I have read, understood, and agree to be bound by InstaCares'{" "}
                  <Link href="/terms" className="text-rose-600 hover:text-rose-500 font-medium" target="_blank">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-rose-600 hover:text-rose-500 font-medium" target="_blank">
                    Privacy Policy
                  </Link>
                  . I understand that I am waiving certain legal rights, including the right to sue or claim compensation in certain circumstances.
                </label>
              </div>
              {errors.agreeToTerms && <p className="text-red-500 text-xs">{errors.agreeToTerms}</p>}

              <div className="flex items-start">
                <input
                  id="agreeToMarketing"
                  name="agreeToMarketing"
                  type="checkbox"
                  checked={formData.agreeToMarketing}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-rose-600 focus:ring-rose-500 border-gray-300 rounded"
                />
                <label htmlFor="agreeToMarketing" className="ml-2 text-sm text-gray-700">
                  I'd like to receive updates and special offers from Instacares
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-medium py-3 px-4 rounded-lg transition duration-150 flex items-center justify-center"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link href="/login" className="text-rose-600 hover:text-rose-500 font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}