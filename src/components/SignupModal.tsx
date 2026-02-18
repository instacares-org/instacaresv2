"use client";

import { useState, useEffect, useCallback } from 'react';
import { XMarkIcon, EyeIcon, EyeSlashIcon, ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/outline';
import { addCSRFHeader } from '@/lib/csrf';
import dynamic from 'next/dynamic';
import SocialLogin from './SocialLogin';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import { useLanguage } from '../contexts/LanguageContext';

// Dynamic import to avoid SSR issues with Mapbox - loading state handled in component
const MapboxAddressAutocomplete = dynamic(
  () => import('./MapboxAddressAutocomplete'),
  {
    ssr: false,
    loading: () => (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Address
        </label>
        <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 animate-pulse">
          Loading...
        </div>
      </div>
    )
  }
);

interface OAuthUserData {
  email: string;
  firstName: string;
  lastName: string;
  image?: string;
}

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'signup' | 'oauthCompletion';
  oauthUserData?: OAuthUserData;
  onOAuthComplete?: () => void;
  /** For OAuth mode - specifies whether completing profile as parent or caregiver or babysitter */
  oauthUserType?: 'parent' | 'caregiver' | 'babysitter';
  /** For regular signup - pre-select parent or caregiver or babysitter */
  initialUserType?: 'parent' | 'caregiver' | 'babysitter';
}

export default function SignupModal({
  isOpen,
  onClose,
  mode = 'signup',
  oauthUserData,
  onOAuthComplete,
  oauthUserType = 'parent',
  initialUserType = 'parent'
}: SignupModalProps) {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(1);
  const [userType, setUserType] = useState<'parent' | 'caregiver' | 'babysitter'>(initialUserType);

  // For OAuth mode with caregiver or babysitter, we need to track if questionnaire is completed
  const isCaregiverOAuth = mode === 'oauthCompletion' && oauthUserType === 'caregiver';
  const isBabysitterOAuth = mode === 'oauthCompletion' && oauthUserType === 'babysitter';

  // Questionnaire data for caregivers
  const [questionnaireData, setQuestionnaireData] = useState({
    hasInsurance: null as boolean | null,
    hasFireAlarmCO: null as boolean | null,
    hasPets: null as boolean | null,
    petsDescription: '',
    hasBackgroundCheck: null as boolean | null,
    hasFirstAidCPR: null as boolean | null,
    hasOtherCertifications: null as boolean | null,
    otherCertificationsDescription: ''
  });

  // Babysitter-specific registration data
  const [babysitterData, setBabysitterData] = useState({
    experienceYears: 0,
    experienceSummary: '',
    hourlyRate: 20,
    bio: '',
    hasCPR: false,
    hasECE: false,
  });

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    dateOfBirth: '',
    streetAddress: '',
    apartment: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'CA',
    agreeToTerms: false,
    agreeToMarketing: false
  });

  // For OAuth completion mode, determine starting step and total steps
  const isOAuthMode = mode === 'oauthCompletion';
  // OAuth for parents: 2 steps (Profile Info, Address+Terms)
  // OAuth for caregivers: 3 steps (Questionnaire, Profile Info, Address+Terms)
  // OAuth for babysitters: 3 steps (Babysitter Info, Profile Info, Address+Terms)
  // Normal signup for babysitters: 4 steps (Account Type + Babysitter Info, Profile Info, Account Details, redirect to document upload)
  const totalSteps = isOAuthMode
    ? (isCaregiverOAuth || isBabysitterOAuth ? 3 : 2)
    : (userType === 'babysitter' ? 4 : 3);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailValidation, setEmailValidation] = useState({
    isChecking: false,
    exists: false,
    message: '',
    isValid: true
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string>('');

  // Reset form when modal closes or initialize OAuth mode
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setUserType('parent');
      setQuestionnaireData({
        hasInsurance: null,
        hasFireAlarmCO: null,
        hasPets: null,
        petsDescription: '',
        hasBackgroundCheck: null,
        hasFirstAidCPR: null,
        hasOtherCertifications: null,
        otherCertificationsDescription: ''
      });
      setBabysitterData({
        experienceYears: 0,
        experienceSummary: '',
        hourlyRate: 20,
        bio: '',
        hasCPR: false,
        hasECE: false,
      });
      setFormData(prev => ({
        ...prev,
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        dateOfBirth: '',
        streetAddress: '',
        apartment: '',
        city: '',
        province: '',
        postalCode: '',
        country: 'CA',
        agreeToTerms: false,
        agreeToMarketing: false
      }));
      setAvatarFile(null);
      setAvatarPreview(null);
    } else if (isOpen && isOAuthMode && oauthUserData) {
      // Initialize form with OAuth user data
      setFormData(prev => ({
        ...prev,
        firstName: oauthUserData.firstName || '',
        lastName: oauthUserData.lastName || '',
        email: oauthUserData.email || ''
      }));
      if (oauthUserData.image) {
        setAvatarPreview(oauthUserData.image);
      }
      // Start at step 1 for OAuth (which is the profile step)
      setCurrentStep(1);
    }
  }, [isOpen, isOAuthMode, oauthUserData]);

  // Debounced email validation
  const checkEmailAvailability = useCallback(async (email: string) => {
    if (!email || email.length < 3 || !email.includes('@')) {
      setEmailValidation({
        isChecking: false,
        exists: false,
        message: '',
        isValid: true
      });
      return;
    }

    setEmailValidation(prev => ({ ...prev, isChecking: true }));

    try {
      const response = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        const result = await response.json();
        setEmailValidation({
          isChecking: false,
          exists: result.exists,
          message: result.exists
            ? 'This email is already registered.'
            : 'Email available',
          isValid: !result.exists
        });
      } else {
        setEmailValidation({
          isChecking: false,
          exists: false,
          message: '',
          isValid: true
        });
      }
    } catch (error) {
      setEmailValidation({
        isChecking: false,
        exists: false,
        message: '',
        isValid: true
      });
    }
  }, []);

  // Debounce email checking
  useEffect(() => {
    const timer = setTimeout(() => {
      checkEmailAvailability(formData.email);
    }, 800);

    return () => clearTimeout(timer);
  }, [formData.email, checkEmailAvailability]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    // Phone validation
    if (name === 'phone') {
      const digitsOnly = value.replace(/\D/g, '');
      if (value && digitsOnly.length < 10) {
        setPhoneError(t('signup.phoneMinDigits'));
      } else {
        setPhoneError('');
      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleQuestionnaireChange = (field: string, value: boolean | string) => {
    setQuestionnaireData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBabysitterChange = (field: string, value: string | number | boolean) => {
    setBabysitterData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Helper function to check if user is at least 18 years old
  const isAtLeast18 = (dateOfBirth: string): boolean => {
    if (!dateOfBirth) return false;
    const dob = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    // Check if birthday hasn't happened yet this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      return age - 1 >= 18;
    }
    return age >= 18;
  };

  // Calculate max date for date of birth (must be 18+)
  // Using December 31st ensures the picker allows all days in the target year
  const getMaxDate = () => {
    const today = new Date();
    const maxYear = today.getFullYear() - 18;
    // Use December 31st of 18 years ago to ensure all months/days work
    return `${maxYear}-12-31`;
  };

  // Validation for each step
  const canProceedToNextStep = () => {
    if (isOAuthMode) {
      if (isCaregiverOAuth) {
        // Caregiver OAuth mode: Step 1 = Questionnaire, Step 2 = Profile Info, Step 3 = Address + Terms
        if (currentStep === 1) {
          // Validate questionnaire is complete
          return (
            questionnaireData.hasInsurance !== null &&
            questionnaireData.hasFireAlarmCO !== null &&
            questionnaireData.hasPets !== null &&
            questionnaireData.hasBackgroundCheck !== null &&
            questionnaireData.hasFirstAidCPR !== null
          );
        }
        if (currentStep === 2) {
          const phoneDigits = formData.phone.replace(/\D/g, '');
          const phoneValid = phoneDigits.length >= 10;
          const dobValid = formData.dateOfBirth !== '' && isAtLeast18(formData.dateOfBirth);
          return (
            formData.firstName.trim() !== '' &&
            formData.lastName.trim() !== '' &&
            phoneValid &&
            dobValid
          );
        }
        return true;
      } else if (isBabysitterOAuth) {
        // Babysitter OAuth mode: Step 1 = Babysitter Info, Step 2 = Profile Info, Step 3 = Address + Terms
        if (currentStep === 1) {
          return (
            babysitterData.bio.trim().length >= 50 &&
            babysitterData.hourlyRate >= 15 &&
            babysitterData.experienceYears >= 0
          );
        }
        if (currentStep === 2) {
          const phoneDigits = formData.phone.replace(/\D/g, '');
          const phoneValid = phoneDigits.length >= 10;
          const dobValid = formData.dateOfBirth !== '' && isAtLeast18(formData.dateOfBirth);
          return (
            formData.firstName.trim() !== '' &&
            formData.lastName.trim() !== '' &&
            phoneValid &&
            dobValid
          );
        }
        return true;
      } else {
        // Parent OAuth mode: Step 1 = Profile Info (name, phone, DOB), Step 2 = Address + Terms
        if (currentStep === 1) {
          const phoneDigits = formData.phone.replace(/\D/g, '');
          const phoneValid = phoneDigits.length >= 10;
          // Validate date of birth is provided AND user is at least 18
          const dobValid = formData.dateOfBirth !== '' && isAtLeast18(formData.dateOfBirth);
          return (
            formData.firstName.trim() !== '' &&
            formData.lastName.trim() !== '' &&
            phoneValid &&
            dobValid
          );
        }
        return true;
      }
    }

    // Normal signup mode
    if (currentStep === 1) {
      if (userType === 'caregiver') {
        return (
          questionnaireData.hasInsurance !== null &&
          questionnaireData.hasFireAlarmCO !== null &&
          questionnaireData.hasPets !== null &&
          questionnaireData.hasBackgroundCheck !== null &&
          questionnaireData.hasFirstAidCPR !== null
        );
      }
      if (userType === 'babysitter') {
        return (
          babysitterData.bio.trim().length >= 50 &&
          babysitterData.hourlyRate >= 15 &&
          babysitterData.experienceYears >= 0
        );
      }
      return true;
    }
    if (currentStep === 2) {
      const phoneDigits = formData.phone.replace(/\D/g, '');
      const phoneValid = !formData.phone || phoneDigits.length >= 10;
      return formData.firstName.trim() !== '' && formData.lastName.trim() !== '' && phoneValid;
    }
    return true;
  };

  const handleNextStep = () => {
    if (canProceedToNextStep() && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Handle OAuth profile completion submission
  const handleOAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.agreeToTerms) {
      alert(t('signup.validation.agreeToTermsRequired'));
      return;
    }

    // Validate required fields
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      alert(t('signup.validation.phoneRequired'));
      return;
    }

    if (!formData.dateOfBirth) {
      alert(t('signup.validation.dobRequired'));
      return;
    }

    if (!formData.streetAddress || !formData.city || !formData.province || !formData.postalCode) {
      alert(t('signup.validation.addressRequired'));
      return;
    }

    setIsSubmitting(true);

    try {
      // Build request body - include questionnaire data for caregivers
      const requestBody: Record<string, unknown> = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth,
        streetAddress: formData.streetAddress,
        apartment: formData.apartment,
        city: formData.city,
        state: formData.province,
        zipCode: formData.postalCode,
        country: formData.country || 'CA'
      };

      // Add questionnaire data for caregivers
      if (isCaregiverOAuth) {
        requestBody.userType = 'caregiver';
        requestBody.questionnaireData = questionnaireData;
      }

      const response = await fetch('/api/profile/complete', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to complete profile');
      }

      // Call the OAuth complete callback
      if (onOAuthComplete) {
        onOAuthComplete();
      }
      onClose();
    } catch (error) {
      console.error('Profile completion error:', error);
      alert(error instanceof Error ? error.message : t('signup.messages.profileCompleteFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert(t('signup.validation.passwordsNoMatch'));
      return;
    }

    if (!formData.agreeToTerms) {
      alert(t('signup.validation.agreeToTermsRequired'));
      return;
    }

    if (emailValidation.exists) {
      alert(t('signup.validation.emailAlreadyRegistered'));
      return;
    }

    setIsSubmitting(true);

    try {
      const submitData = new FormData();
      submitData.append('firstName', formData.firstName);
      submitData.append('lastName', formData.lastName);
      submitData.append('email', formData.email);
      submitData.append('password', formData.password);
      submitData.append('confirmPassword', formData.confirmPassword);
      submitData.append('phone', formData.phone);
      submitData.append('streetAddress', formData.streetAddress);
      submitData.append('apartment', formData.apartment);
      submitData.append('city', formData.city);
      submitData.append('province', formData.province);
      submitData.append('postalCode', formData.postalCode);
      submitData.append('country', formData.country || 'CA');
      submitData.append('userType', userType === 'caregiver' ? 'provider' : userType === 'babysitter' ? 'babysitter' : 'parent');
      submitData.append('agreeToTerms', formData.agreeToTerms.toString());
      submitData.append('agreeToMarketing', formData.agreeToMarketing.toString());

      if (userType === 'caregiver') {
        submitData.append('questionnaireData', JSON.stringify(questionnaireData));
      }

      if (userType === 'babysitter') {
        submitData.append('babysitterData', JSON.stringify(babysitterData));
      }

      if (avatarFile) {
        submitData.append('avatar', avatarFile);
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: addCSRFHeader(),
        body: submitData,
      });

      if (response.ok) {
        alert(t('signup.messages.registrationSuccess'));
        onClose();
        setCurrentStep(1);
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          confirmPassword: '',
          phone: '',
          dateOfBirth: '',
          streetAddress: '',
          apartment: '',
          city: '',
          province: '',
          postalCode: '',
          country: 'CA',
          agreeToTerms: false,
          agreeToMarketing: false
        });
        setQuestionnaireData({
          hasInsurance: null,
          hasFireAlarmCO: null,
          hasPets: null,
          petsDescription: '',
          hasBackgroundCheck: null,
          hasFirstAidCPR: null,
          hasOtherCertifications: null,
          otherCertificationsDescription: ''
        });
        setAvatarFile(null);
        setAvatarPreview(null);
      } else {
        const errorData = await response.json();
        if (response.status === 409) {
          alert(t('signup.validation.emailExists'));
        } else {
          alert(errorData.error || t('signup.messages.registrationFailed'));
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert(t('signup.messages.registrationFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Yes/No Question Component
  const YesNoQuestion = ({
    question,
    value,
    onChange,
    required = true
  }: {
    question: string;
    value: boolean | null;
    onChange: (val: boolean) => void;
    required?: boolean;
  }) => (
    <div className="mb-4">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {question}{required && <span className="text-rose-500">*</span>}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition ${
            value === true
              ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
              : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 text-gray-700 dark:text-gray-300'
          }`}
        >
          {t('signup.questionnaire.yes')}
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition ${
            value === false
              ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
              : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 text-gray-700 dark:text-gray-300'
          }`}
        >
          {t('signup.questionnaire.no')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-gray-800 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-gray-50/50 dark:from-gray-900/80 dark:to-gray-800/50 rounded-2xl pointer-events-none"></div>
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b dark:border-gray-800">
            <div className="flex items-center gap-3">
              {currentStep > 1 && (
                <button
                  onClick={handlePrevStep}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
                >
                  <ArrowLeftIcon className="h-4 w-4 dark:text-gray-400" />
                </button>
              )}
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {isOAuthMode ? t('signup.completeProfile') : t('signup.title')}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
            >
              <XMarkIcon className="h-5 w-5 dark:text-gray-400" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="px-4 pt-3">
            <div className="flex items-center justify-center mb-4">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      currentStep > step
                        ? 'bg-green-500 text-white'
                        : currentStep === step
                        ? 'bg-rose-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {currentStep > step ? <CheckIcon className="h-4 w-4" /> : step}
                  </div>
                  {step < totalSteps && (
                    <div
                      className={`w-16 sm:w-24 h-1 mx-2 ${
                        currentStep > step ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 mb-2">
              {isOAuthMode ? (
                isCaregiverOAuth ? (
                  <>
                    {currentStep === 1 && t('signup.steps.caregiverQuestionnaire')}
                    {currentStep === 2 && t('signup.steps.profileInfo')}
                    {currentStep === 3 && t('signup.steps.addressTerms')}
                  </>
                ) : (
                  <>
                    {currentStep === 1 && t('signup.steps.profileInfo')}
                    {currentStep === 2 && t('signup.steps.addressTerms')}
                  </>
                )
              ) : (
                <>
                  {currentStep === 1 && (userType === 'caregiver' ? t('signup.steps.questionnaire') : userType === 'babysitter' ? 'Babysitter Info' : t('signup.steps.accountType'))}
                  {currentStep === 2 && t('signup.steps.profileInfo')}
                  {currentStep === 3 && t('signup.steps.accountDetails')}
                  {currentStep === 4 && userType === 'babysitter' && 'Document Upload'}
                </>
              )}
            </div>
          </div>

          {/* Step 1: User Type & Questionnaire (Normal) OR Profile Info/Questionnaire (OAuth) */}
          {currentStep === 1 && (
            <div className="p-4">
              {isOAuthMode ? (
                isCaregiverOAuth ? (
                  /* Caregiver OAuth Mode Step 1: Questionnaire */
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                      {t('signup.questionnaire.welcomeCaregiver')}
                    </p>

                    <YesNoQuestion
                      question={t('signup.questionnaire.hasInsurance')}
                      value={questionnaireData.hasInsurance}
                      onChange={(val) => handleQuestionnaireChange('hasInsurance', val)}
                    />

                    <YesNoQuestion
                      question={t('signup.questionnaire.hasFireAlarmCO')}
                      value={questionnaireData.hasFireAlarmCO}
                      onChange={(val) => handleQuestionnaireChange('hasFireAlarmCO', val)}
                    />

                    <YesNoQuestion
                      question={t('signup.questionnaire.hasPets')}
                      value={questionnaireData.hasPets}
                      onChange={(val) => handleQuestionnaireChange('hasPets', val)}
                    />

                    {questionnaireData.hasPets && (
                      <div className="mb-4 ml-4">
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          {t('signup.questionnaire.describePets')}
                        </label>
                        <input
                          type="text"
                          value={questionnaireData.petsDescription}
                          onChange={(e) => handleQuestionnaireChange('petsDescription', e.target.value)}
                          placeholder={t('signup.questionnaire.petsPlaceholder')}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg"
                        />
                      </div>
                    )}

                    <YesNoQuestion
                      question={t('signup.questionnaire.hasBackgroundCheck')}
                      value={questionnaireData.hasBackgroundCheck}
                      onChange={(val) => handleQuestionnaireChange('hasBackgroundCheck', val)}
                    />

                    <YesNoQuestion
                      question={t('signup.questionnaire.hasFirstAidCPR')}
                      value={questionnaireData.hasFirstAidCPR}
                      onChange={(val) => handleQuestionnaireChange('hasFirstAidCPR', val)}
                    />

                    <YesNoQuestion
                      question={t('signup.questionnaire.hasOtherCertifications')}
                      value={questionnaireData.hasOtherCertifications}
                      onChange={(val) => handleQuestionnaireChange('hasOtherCertifications', val)}
                      required={false}
                    />

                    {questionnaireData.hasOtherCertifications && (
                      <div className="mb-4 ml-4">
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          {t('signup.questionnaire.describeCertifications')}
                        </label>
                        <input
                          type="text"
                          value={questionnaireData.otherCertificationsDescription}
                          onChange={(e) => handleQuestionnaireChange('otherCertificationsDescription', e.target.value)}
                          placeholder={t('signup.questionnaire.certificationsPlaceholder')}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  /* Parent OAuth Mode Step 1: Profile Information */
                  <div className="space-y-4">
                    {/* Welcome message for OAuth */}
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                      {t('signup.questionnaire.welcomeParent')}
                    </p>

                    {/* Name Fields */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('auth.firstName')}<span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('auth.lastName')}<span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                          required
                        />
                      </div>
                    </div>

                    {/* Avatar (from Google - display only) */}
                    {avatarPreview && (
                      <div className="flex justify-center">
                        <img
                          src={avatarPreview}
                          alt="Profile"
                          className="w-20 h-20 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700"
                        />
                      </div>
                    )}

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('auth.phone')}<span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder={t('signup.phonePlaceholder')}
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-1 ${
                          phoneError
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:border-rose-500 focus:ring-rose-500'
                        } dark:text-gray-100`}
                        required
                      />
                      {phoneError && (
                        <p className="mt-1 text-xs text-red-600">{phoneError}</p>
                      )}
                    </div>

                    {/* Date of Birth */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('signup.dateOfBirth')}<span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                        max={getMaxDate()}
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-rose-500 focus:ring-1 focus:ring-rose-500 dark:bg-gray-800 dark:text-gray-100 ${
                          formData.dateOfBirth && !isAtLeast18(formData.dateOfBirth)
                            ? 'border-red-500 dark:border-red-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                        required
                      />
                      {formData.dateOfBirth && !isAtLeast18(formData.dateOfBirth) ? (
                        <p className="mt-1 text-xs text-red-500">{t('signup.mustBe18Error')}</p>
                      ) : (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('signup.mustBe18')}</p>
                      )}
                    </div>
                  </div>
                )
              ) : (
                /* Normal Signup Step 1: User Type Selection */
                <>
                  {/* User Type Selection */}
                  <div className="mb-4">
                    <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">{t('signup.userType.iAmA')}</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setUserType('parent')}
                        className={`p-3 rounded-lg border-2 transition ${
                          userType === 'parent'
                            ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
                            : 'border-gray-300 hover:border-gray-400 dark:border-gray-600'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-xl mb-1">👨‍👩‍👧‍👦</div>
                          <div className="font-medium text-sm">{t('signup.userType.parent')}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{t('signup.userType.parentDesc')}</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserType('caregiver')}
                        className={`p-3 rounded-lg border-2 transition ${
                          userType === 'caregiver'
                            ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
                            : 'border-gray-300 hover:border-gray-400 dark:border-gray-600'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-xl mb-1">👩‍🏫</div>
                          <div className="font-medium text-sm">{t('signup.userType.caregiver')}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{t('signup.userType.caregiverDesc')}</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserType('babysitter')}
                        className={`p-3 rounded-lg border-2 transition ${
                          userType === 'babysitter'
                            ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
                            : 'border-gray-300 hover:border-gray-400 dark:border-gray-600'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-xl mb-1">👶</div>
                          <div className="font-medium text-sm">Babysitter</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Provide childcare</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Babysitter Registration Info */}
                  {userType === 'babysitter' && (
                    <div className="mt-4 pt-4 border-t dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Tell us about yourself
                      </h4>

                      {/* Bio */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Bio / Introduction<span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          value={babysitterData.bio}
                          onChange={(e) => handleBabysitterChange('bio', e.target.value)}
                          placeholder="Tell parents about yourself, your experience with children, and why you love babysitting..."
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg h-24 resize-none"
                          maxLength={500}
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {babysitterData.bio.length}/500 characters (minimum 50)
                        </p>
                      </div>

                      {/* Experience */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Years of Experience<span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={babysitterData.experienceYears}
                          onChange={(e) => handleBabysitterChange('experienceYears', parseInt(e.target.value))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg"
                        >
                          <option value={0}>Less than 1 year</option>
                          <option value={1}>1-2 years</option>
                          <option value={3}>3-5 years</option>
                          <option value={5}>5-10 years</option>
                          <option value={10}>10+ years</option>
                        </select>
                      </div>

                      {/* Hourly Rate */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Hourly Rate (CAD)<span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="number"
                            value={babysitterData.hourlyRate}
                            onChange={(e) => handleBabysitterChange('hourlyRate', parseFloat(e.target.value) || 15)}
                            min={15}
                            max={100}
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg"
                          />
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Minimum $15/hour
                        </p>
                      </div>

                      {/* Certifications */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Certifications (optional)
                        </label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={babysitterData.hasCPR}
                              onChange={(e) => handleBabysitterChange('hasCPR', e.target.checked)}
                              className="h-4 w-4 text-rose-600 border-gray-300 rounded"
                            />
                            I have CPR/First Aid certification
                          </label>
                          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={babysitterData.hasECE}
                              onChange={(e) => handleBabysitterChange('hasECE', e.target.checked)}
                              className="h-4 w-4 text-rose-600 border-gray-300 rounded"
                            />
                            I have ECE (Early Childhood Education) certification
                          </label>
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-800 dark:text-blue-300">
                        <strong>Note:</strong> After creating your account, you&apos;ll need to upload identification documents and complete verification before your profile becomes visible to parents.
                      </div>
                    </div>
                  )}

                  {/* Caregiver Questionnaire */}
                  {userType === 'caregiver' && (
                    <div className="mt-4 pt-4 border-t dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        {t('signup.questionnaire.title')}
                      </h4>

                      <YesNoQuestion
                        question={t('signup.questionnaire.hasInsurance')}
                        value={questionnaireData.hasInsurance}
                        onChange={(val) => handleQuestionnaireChange('hasInsurance', val)}
                      />

                      <YesNoQuestion
                        question={t('signup.questionnaire.hasFireAlarmCO')}
                        value={questionnaireData.hasFireAlarmCO}
                        onChange={(val) => handleQuestionnaireChange('hasFireAlarmCO', val)}
                      />

                      <YesNoQuestion
                        question={t('signup.questionnaire.hasPets')}
                        value={questionnaireData.hasPets}
                        onChange={(val) => handleQuestionnaireChange('hasPets', val)}
                      />

                      {questionnaireData.hasPets && (
                        <div className="mb-4 ml-4">
                          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                            {t('signup.questionnaire.describePets')}
                          </label>
                          <input
                            type="text"
                            value={questionnaireData.petsDescription}
                            onChange={(e) => handleQuestionnaireChange('petsDescription', e.target.value)}
                            placeholder={t('signup.questionnaire.petsPlaceholder')}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg"
                          />
                        </div>
                      )}

                      <YesNoQuestion
                        question={t('signup.questionnaire.hasBackgroundCheck')}
                        value={questionnaireData.hasBackgroundCheck}
                        onChange={(val) => handleQuestionnaireChange('hasBackgroundCheck', val)}
                      />

                      <YesNoQuestion
                        question={t('signup.questionnaire.hasFirstAidCPR')}
                        value={questionnaireData.hasFirstAidCPR}
                        onChange={(val) => handleQuestionnaireChange('hasFirstAidCPR', val)}
                      />

                      <YesNoQuestion
                        question={t('signup.questionnaire.hasOtherCertifications')}
                        value={questionnaireData.hasOtherCertifications}
                        onChange={(val) => handleQuestionnaireChange('hasOtherCertifications', val)}
                        required={false}
                      />

                      {questionnaireData.hasOtherCertifications && (
                        <div className="mb-4 ml-4">
                          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                            {t('signup.questionnaire.describeCertifications')}
                          </label>
                          <input
                            type="text"
                            value={questionnaireData.otherCertificationsDescription}
                            onChange={(e) => handleQuestionnaireChange('otherCertificationsDescription', e.target.value)}
                            placeholder={t('signup.questionnaire.certificationsPlaceholder')}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Continue button for Step 1 */}
              <button
                type="button"
                onClick={handleNextStep}
                disabled={!canProceedToNextStep()}
                className="w-full mt-4 bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition"
              >
                {t('signup.continue')}
              </button>
            </div>
          )}

          {/* Step 2: Address + Terms (Parent OAuth) OR Profile Info (Caregiver OAuth / Normal) */}
          {currentStep === 2 && (
            <div className="p-4">
              {isOAuthMode ? (
                isCaregiverOAuth ? (
                  /* Caregiver OAuth Mode Step 2: Profile Information */
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                      {t('signup.questionnaire.provideProfileInfo')}
                    </p>

                    {/* Name Fields */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('auth.firstName')}<span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('auth.lastName')}<span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                          required
                        />
                      </div>
                    </div>

                    {/* Avatar (from Google - display only) */}
                    {avatarPreview && (
                      <div className="flex justify-center">
                        <img
                          src={avatarPreview}
                          alt="Profile"
                          className="w-20 h-20 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700"
                        />
                      </div>
                    )}

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('auth.phone')}<span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder={t('signup.phonePlaceholder')}
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-1 ${
                          phoneError
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:border-rose-500 focus:ring-rose-500'
                        } dark:text-gray-100`}
                        required
                      />
                      {phoneError && (
                        <p className="mt-1 text-xs text-red-600">{phoneError}</p>
                      )}
                    </div>

                    {/* Date of Birth */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('signup.dateOfBirth')}<span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                        max={getMaxDate()}
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-rose-500 focus:ring-1 focus:ring-rose-500 dark:bg-gray-800 dark:text-gray-100 ${
                          formData.dateOfBirth && !isAtLeast18(formData.dateOfBirth)
                            ? 'border-red-500 dark:border-red-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                        required
                      />
                      {formData.dateOfBirth && !isAtLeast18(formData.dateOfBirth) ? (
                        <p className="mt-1 text-xs text-red-500">{t('signup.mustBe18Error')}</p>
                      ) : (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('signup.mustBe18')}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleNextStep}
                      disabled={!canProceedToNextStep()}
                      className="w-full mt-4 bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition"
                    >
                      {t('signup.continue')}
                    </button>
                  </div>
                ) : (
                  /* Parent OAuth Mode Step 2: Address + Terms - Final Step */
                  <form onSubmit={handleOAuthSubmit} className="space-y-3">
                    {/* Address */}
                    <MapboxAddressAutocomplete
                      label={t('signup.address')}
                      placeholder={t('signup.addressPlaceholder')}
                      defaultValue=""
                      onAddressSelect={(address) => {
                        setFormData(prev => ({
                          ...prev,
                          streetAddress: address.streetAddress,
                          apartment: address.apartment || '',
                          city: address.city,
                          province: address.state === 'Ontario' ? 'ON' : address.state,
                          postalCode: address.zipCode,
                          country: address.country || 'CA'
                        }));
                      }}
                      className="text-sm"
                    />

                    {/* Apartment */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('signup.apartment')}
                      </label>
                      <input
                        type="text"
                        value={formData.apartment}
                        onChange={(e) => setFormData(prev => ({ ...prev, apartment: e.target.value }))}
                        placeholder={t('signup.apartmentPlaceholder')}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg"
                      />
                    </div>

                    {/* Terms */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          name="agreeToTerms"
                          checked={formData.agreeToTerms}
                          onChange={handleInputChange}
                          className="mt-1 h-4 w-4 text-rose-600 border-gray-300 rounded"
                          required
                        />
                        <label className="text-xs text-gray-700 dark:text-gray-300">
                          I agree to InstaCares&apos;{' '}
                          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-rose-600 underline">{t('signup.terms.termsOfService')}</a>
                          {' '}{t('signup.or')}{' '}
                          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-rose-600 underline">{t('signup.terms.privacyPolicy')}</a>
                        </label>
                      </div>

                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          name="agreeToMarketing"
                          checked={formData.agreeToMarketing}
                          onChange={handleInputChange}
                          className="mt-1 h-4 w-4 text-rose-600 border-gray-300 rounded"
                        />
                        <label className="text-xs text-gray-700 dark:text-gray-300">
                          {t('signup.terms.agreeToMarketing')}
                        </label>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || !formData.agreeToTerms}
                      className="w-full mt-4 bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition"
                    >
                      {isSubmitting ? t('signup.completingProfile') : t('signup.completeProfileBtn')}
                    </button>
                  </form>
                )
              ) : (
                /* Normal Signup Step 2: Profile Info */
                <div className="space-y-4">
                  {/* Name Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('auth.firstName')}<span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:border-rose-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('auth.lastName')}<span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:border-rose-500"
                        required
                      />
                    </div>
                  </div>

                  {/* Avatar Upload */}
                  <div className="text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <label htmlFor="avatar-upload" className="cursor-pointer">
                      <div className="flex flex-col items-center">
                        {avatarPreview ? (
                          <img
                            src={avatarPreview}
                            alt="Avatar preview"
                            className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700 mb-2"
                          />
                        ) : (
                          <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-2">
                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('signup.profilePhoto')}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('signup.clickToUpload')}</p>
                      </div>
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            alert(t('signup.fileSizeError'));
                            return;
                          }
                          setAvatarFile(file);
                          setAvatarPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="hidden"
                      id="avatar-upload"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('auth.phone')}
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-rose-500 ${
                        phoneError
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                          : 'border-gray-300 dark:border-gray-600 dark:bg-gray-800'
                      } dark:text-gray-100`}
                    />
                    {phoneError && (
                      <p className="mt-1 text-xs text-red-600">{phoneError}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={!canProceedToNextStep()}
                    className="w-full mt-4 bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition"
                  >
                    {t('signup.continue')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Address + Terms (Caregiver OAuth) OR Account Details (Normal Signup) */}
          {currentStep === 3 && isCaregiverOAuth && (
            <div className="p-4">
              <form onSubmit={handleOAuthSubmit} className="space-y-3">
                {/* Address */}
                <MapboxAddressAutocomplete
                  label={t('signup.address')}
                  placeholder={t('signup.addressPlaceholder')}
                  defaultValue=""
                  onAddressSelect={(address) => {
                    setFormData(prev => ({
                      ...prev,
                      streetAddress: address.streetAddress,
                      apartment: address.apartment || '',
                      city: address.city,
                      province: address.state === 'Ontario' ? 'ON' : address.state,
                      postalCode: address.zipCode,
                      country: address.country || 'CA'
                    }));
                  }}
                  className="text-sm"
                />

                {/* Apartment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('signup.apartment')}
                  </label>
                  <input
                    type="text"
                    value={formData.apartment}
                    onChange={(e) => setFormData(prev => ({ ...prev, apartment: e.target.value }))}
                    placeholder={t('signup.apartmentPlaceholder')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg"
                  />
                </div>

                {/* Terms */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      name="agreeToTerms"
                      checked={formData.agreeToTerms}
                      onChange={handleInputChange}
                      className="mt-1 h-4 w-4 text-rose-600 border-gray-300 rounded"
                      required
                    />
                    <label className="text-xs text-gray-700 dark:text-gray-300">
                      {t('signup.terms.agreeToTerms').split('{termsLink}')[0]}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-rose-600 underline">{t('signup.terms.termsOfService')}</a>
                      {t('signup.terms.agreeToTerms').split('{termsLink}')[1]?.split('{privacyLink}')[0]}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-rose-600 underline">{t('signup.terms.privacyPolicy')}</a>
                    </label>
                  </div>

                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      name="agreeToMarketing"
                      checked={formData.agreeToMarketing}
                      onChange={handleInputChange}
                      className="mt-1 h-4 w-4 text-rose-600 border-gray-300 rounded"
                    />
                    <label className="text-xs text-gray-700 dark:text-gray-300">
                      {t('signup.terms.agreeToMarketing')}
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !formData.agreeToTerms}
                  className="w-full mt-4 bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition"
                >
                  {isSubmitting ? t('signup.completingProfile') : t('signup.completeProfileBtn')}
                </button>
              </form>
            </div>
          )}

          {/* Step 3: Account Details (Normal Signup Only) */}
          {currentStep === 3 && !isOAuthMode && (
            <form onSubmit={handleSubmit} className="p-4">
              <div className="space-y-3">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('auth.email')}<span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 text-sm border rounded-lg ${
                        emailValidation.exists
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                          : 'border-gray-300 dark:border-gray-600 dark:bg-gray-800'
                      } dark:text-gray-100 focus:border-rose-500`}
                      required
                    />
                    {emailValidation.isChecking && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-rose-600"></div>
                      </div>
                    )}
                  </div>
                  {emailValidation.message && (
                    <p className={`mt-1 text-xs ${emailValidation.exists ? 'text-red-600' : 'text-green-600'}`}>
                      {emailValidation.message}
                    </p>
                  )}
                </div>

                {/* Password Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('auth.password')}<span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:border-rose-500"
                        required
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
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('auth.confirmPassword')}<span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:border-rose-500"
                        required
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
                  </div>
                </div>

                {formData.password && (
                  <PasswordStrengthIndicator password={formData.password} showRequirements={true} />
                )}

                {/* Address */}
                <MapboxAddressAutocomplete
                  label={t('signup.address')}
                  placeholder={t('signup.addressPlaceholder')}
                  defaultValue=""
                  onAddressSelect={(address) => {
                    setFormData(prev => ({
                      ...prev,
                      streetAddress: address.streetAddress,
                      apartment: address.apartment || '',
                      city: address.city,
                      province: address.state === 'Ontario' ? 'ON' : address.state,
                      postalCode: address.zipCode,
                      country: address.country || 'CA'
                    }));
                  }}
                  className="text-sm"
                />

                {/* Apartment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('signup.apartment')}
                  </label>
                  <input
                    type="text"
                    value={formData.apartment}
                    onChange={(e) => setFormData(prev => ({ ...prev, apartment: e.target.value }))}
                    placeholder={t('signup.apartmentPlaceholder')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg"
                  />
                </div>

                {/* Terms */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      name="agreeToTerms"
                      checked={formData.agreeToTerms}
                      onChange={handleInputChange}
                      className="mt-1 h-4 w-4 text-rose-600 border-gray-300 rounded"
                      required
                    />
                    <label className="text-xs text-gray-700 dark:text-gray-300">
                      {t('signup.terms.agreeToTerms').split('{termsLink}')[0]}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-rose-600 underline">{t('signup.terms.termsOfService')}</a>
                      {t('signup.terms.agreeToTerms').split('{termsLink}')[1]?.split('{privacyLink}')[0]}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-rose-600 underline">{t('signup.terms.privacyPolicy')}</a>
                    </label>
                  </div>

                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      name="agreeToMarketing"
                      checked={formData.agreeToMarketing}
                      onChange={handleInputChange}
                      className="mt-1 h-4 w-4 text-rose-600 border-gray-300 rounded"
                    />
                    <label className="text-xs text-gray-700 dark:text-gray-300">
                      {t('signup.terms.agreeToMarketing')}
                    </label>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || emailValidation.exists || emailValidation.isChecking || !formData.agreeToTerms}
                className="w-full mt-4 bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition"
              >
                {isSubmitting ? t('signup.creatingAccount') : t('signup.title')}
              </button>

              {/* Social Login */}
              <div className="mt-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white dark:bg-gray-900 text-gray-500">{t('signup.or')}</span>
                  </div>
                </div>
                <div className="mt-4">
                  <SocialLogin
                    userType={userType === 'babysitter' ? 'caregiver' : userType}
                    onSocialLogin={(provider) => {
                      console.log(`Social signup with ${provider}`);
                      onClose();
                    }}
                  />
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
