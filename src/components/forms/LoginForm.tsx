"use client";

import React, { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../lib/utils';

interface LoginFormProps {
  userType: 'parent' | 'caregiver';
  onSubmit: (data: LoginFormData) => Promise<void>;
  className?: string;
}

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

const LoginForm: React.FC<LoginFormProps> = ({ userType, onSubmit, className }) => {
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
    rememberMe: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) {
      return "Email is required";
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address";
    }
    
    return undefined;
  };

  const validatePassword = (password: string): string | undefined => {
    if (!password) {
      return "Password is required";
    }
    
    if (password.length < 6) {
      return "Password must be at least 6 characters";
    }
    
    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);

    if (emailError) newErrors.email = emailError;
    if (passwordError) newErrors.password = passwordError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof LoginFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear field error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});
    
    try {
      await onSubmit(formData);
    } catch (error) {
      setErrors({
        general: error instanceof Error ? error.message : 'Login failed. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-6", className)} noValidate>
      {/* General Error */}
      {errors.general && (
        <div 
          className="bg-red-50 border border-red-200 rounded-lg p-4"
          role="alert"
          aria-live="polite"
        >
          <p className="text-sm text-red-600">{errors.general}</p>
        </div>
      )}

      {/* Email */}
      <Input
        id="email"
        type="email"
        label="Email Address"
        value={formData.email}
        onChange={handleChange('email')}
        error={errors.email}
        placeholder="Enter your email"
        autoComplete="email"
        required
        aria-describedby="email-description"
      />
      <p id="email-description" className="sr-only">
        Enter the email address associated with your {userType} account
      </p>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
          Password
          <span className="text-red-500 ml-1">*</span>
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={formData.password}
            onChange={handleChange('password')}
            className={cn(
              "flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-12",
              errors.password ? "border-red-500" : "border-gray-300"
            )}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            aria-invalid={errors.password ? 'true' : 'false'}
            aria-describedby={errors.password ? 'password-error' : 'password-description'}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center focus:outline-none focus:ring-2 focus:ring-rose-500 rounded-r-md"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeSlashIcon className="h-5 w-5 text-gray-400" />
            ) : (
              <EyeIcon className="h-5 w-5 text-gray-400" />
            )}
          </button>
        </div>
        <p id="password-description" className="sr-only">
          Enter your password to sign in to your {userType} account
        </p>
        {errors.password && (
          <p id="password-error" className="text-sm text-red-600 mt-1" role="alert">
            {errors.password}
          </p>
        )}
      </div>

      {/* Remember Me & Forgot Password */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <input
            id="rememberMe"
            type="checkbox"
            checked={formData.rememberMe}
            onChange={handleChange('rememberMe')}
            className="h-4 w-4 text-rose-600 focus:ring-rose-500 border-gray-300 rounded"
          />
          <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-700">
            Remember me
          </label>
        </div>
        
        <a 
          href="/forgot-password" 
          className="text-sm text-rose-600 hover:text-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500 rounded-md px-1 py-1 transition-colors"
        >
          Forgot password?
        </a>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        loading={isLoading}
        disabled={isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </Button>

      {/* Screen Reader Instructions */}
      <div className="sr-only" aria-live="polite">
        {isLoading && 'Please wait while we sign you in'}
        {errors.general && `Error: ${errors.general}`}
      </div>
    </form>
  );
};

export default LoginForm;