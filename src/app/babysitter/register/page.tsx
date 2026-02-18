'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { addCSRFHeader } from '@/lib/csrf';
import Header from '@/components/Header';
import {
  User,
  FileText,
  Users,
  Phone,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Upload,
  Shield,
  Award,
  AlertCircle,
  Loader2,
  Camera
} from 'lucide-react';

// Step components
interface StepProps {
  data: Record<string, unknown>;
  updateData: (data: Record<string, unknown>) => void;
  errors: Record<string, string>;
}

// Step 1: Basic Information
function BasicInfoStep({ data, updateData, errors }: StepProps) {
  const avatarPreview = data.avatarPreview as string | undefined;

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    updateData({
      avatarFile: file,
      avatarPreview: URL.createObjectURL(file),
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Tell us about yourself</h2>
        <p className="text-gray-600 mt-2">Let&apos;s start with your basic information</p>
      </div>

      {/* Profile Photo */}
      <div className="flex flex-col items-center py-4 bg-gray-50 rounded-lg">
        <label htmlFor="babysitter-avatar-upload" className="cursor-pointer">
          <div className="relative group">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar preview"
                className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-10 h-10 text-gray-400" />
              </div>
            )}
            <div className="absolute bottom-0 right-0 bg-[#8B5CF6] text-white p-1.5 rounded-full shadow-lg group-hover:bg-[#7C3AED] transition-colors">
              <Camera className="w-4 h-4" />
            </div>
          </div>
        </label>
        <p className="text-sm font-medium text-gray-700 mt-2">Profile Photo</p>
        <p className="text-xs text-gray-500">Click to upload (optional)</p>
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleAvatarSelect}
          className="hidden"
          id="babysitter-avatar-upload"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Legal First Name *
          </label>
          <input
            type="text"
            value={(data.firstName as string) || ''}
            onChange={(e) => updateData({ firstName: e.target.value })}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent ${
              errors.firstName ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your first name"
          />
          {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Legal Last Name *
          </label>
          <input
            type="text"
            value={(data.lastName as string) || ''}
            onChange={(e) => updateData({ lastName: e.target.value })}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent ${
              errors.lastName ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your last name"
          />
          {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Date of Birth * <span className="text-gray-500 text-xs">(Private - must be 18+)</span>
        </label>
        <input
          type="date"
          value={(data.dateOfBirth as string) || ''}
          onChange={(e) => updateData({ dateOfBirth: e.target.value })}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent ${
            errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.dateOfBirth && <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Phone Number *
        </label>
        <input
          type="tel"
          value={(data.phone as string) || ''}
          onChange={(e) => updateData({ phone: e.target.value })}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent ${
            errors.phone ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="(123) 456-7890"
        />
        {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Street Address *
        </label>
        <input
          type="text"
          value={(data.streetAddress as string) || ''}
          onChange={(e) => updateData({ streetAddress: e.target.value })}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent ${
            errors.streetAddress ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="123 Main Street"
        />
        {errors.streetAddress && <p className="text-red-500 text-sm mt-1">{errors.streetAddress}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            City *
          </label>
          <input
            type="text"
            value={(data.city as string) || ''}
            onChange={(e) => updateData({ city: e.target.value })}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent ${
              errors.city ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Toronto"
          />
          {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Province *
          </label>
          <select
            value={(data.state as string) || ''}
            onChange={(e) => updateData({ state: e.target.value })}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent ${
              errors.state ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Select province</option>
            <option value="ON">Ontario</option>
            <option value="BC">British Columbia</option>
            <option value="AB">Alberta</option>
            <option value="QC">Quebec</option>
            <option value="MB">Manitoba</option>
            <option value="SK">Saskatchewan</option>
            <option value="NS">Nova Scotia</option>
            <option value="NB">New Brunswick</option>
            <option value="NL">Newfoundland</option>
            <option value="PE">Prince Edward Island</option>
            <option value="NT">Northwest Territories</option>
            <option value="YT">Yukon</option>
            <option value="NU">Nunavut</option>
          </select>
          {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Postal Code *
          </label>
          <input
            type="text"
            value={(data.zipCode as string) || ''}
            onChange={(e) => updateData({ zipCode: e.target.value.toUpperCase() })}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent ${
              errors.zipCode ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="M5V 3L9"
          />
          {errors.zipCode && <p className="text-red-500 text-sm mt-1">{errors.zipCode}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Short Bio * <span className="text-gray-500 text-xs">(10-500 characters)</span>
        </label>
        <textarea
          value={(data.bio as string) || ''}
          onChange={(e) => updateData({ bio: e.target.value })}
          rows={4}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent ${
            errors.bio ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Tell parents about yourself, your personality, and why you love working with children..."
        />
        <p className="text-gray-500 text-sm mt-1">
          {((data.bio as string) || '').length}/500 characters
        </p>
        {errors.bio && <p className="text-red-500 text-sm mt-1">{errors.bio}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Years of Experience *
          </label>
          <select
            value={(data.experienceYears as number) || 0}
            onChange={(e) => updateData({ experienceYears: parseInt(e.target.value) })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent"
          >
            <option value={0}>Less than 1 year</option>
            <option value={1}>1 year</option>
            <option value={2}>2 years</option>
            <option value={3}>3 years</option>
            <option value={4}>4 years</option>
            <option value={5}>5+ years</option>
            <option value={10}>10+ years</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Hourly Rate (CAD) *
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              min={15}
              max={100}
              value={(data.hourlyRate as number) || 20}
              onChange={(e) => updateData({ hourlyRate: parseFloat(e.target.value) })}
              className={`w-full pl-8 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent ${
                errors.hourlyRate ? 'border-red-500' : 'border-gray-300'
              }`}
            />
          </div>
          <p className="text-gray-500 text-sm mt-1">Min: $15/hr, Max: $100/hr</p>
          {errors.hourlyRate && <p className="text-red-500 text-sm mt-1">{errors.hourlyRate}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Experience Summary <span className="text-gray-500 text-xs">(Optional)</span>
        </label>
        <textarea
          value={(data.experienceSummary as string) || ''}
          onChange={(e) => updateData({ experienceSummary: e.target.value })}
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent"
          placeholder="Describe your babysitting experience, types of families you've worked with, age groups, etc."
        />
      </div>
    </div>
  );
}

// Step 2: Document Upload
function DocumentsStep({ data, updateData, errors }: StepProps) {
  const [uploading, setUploading] = useState<string | null>(null);

  const handleFileUpload = async (field: string, file: File) => {
    setUploading(field);

    // TODO: Implement actual file upload to cloud storage (S3/Cloudinary)
    // For now, simulate upload with a placeholder URL
    await new Promise(resolve => setTimeout(resolve, 1500));

    // In production, this would be the URL from your file upload service
    const fakeUrl = `https://storage.instacares.net/documents/${Date.now()}-${file.name}`;
    updateData({ [field]: fakeUrl });

    setUploading(null);
  };

  const DocumentUploadBox = ({
    field,
    label,
    description,
    required = true
  }: {
    field: string;
    label: string;
    description: string;
    required?: boolean;
  }) => {
    const value = data[field] as string;
    const isUploading = uploading === field;

    return (
      <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        value ? 'border-green-400 bg-green-50' : errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-[#8B5CF6]'
      }`}>
        <input
          type="file"
          id={field}
          accept="image/*,.pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(field, file);
          }}
          className="hidden"
        />
        <label htmlFor={field} className="cursor-pointer block">
          {isUploading ? (
            <Loader2 className="w-10 h-10 mx-auto text-[#8B5CF6] animate-spin" />
          ) : value ? (
            <CheckCircle className="w-10 h-10 mx-auto text-green-500" />
          ) : (
            <Upload className="w-10 h-10 mx-auto text-gray-400" />
          )}
          <p className="mt-2 font-medium text-gray-900">
            {label} {required && <span className="text-red-500">*</span>}
          </p>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
          {value && <p className="text-sm text-green-600 mt-2">Uploaded successfully</p>}
          {errors[field] && <p className="text-sm text-red-500 mt-2">{errors[field]}</p>}
        </label>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Upload Your Documents</h2>
        <p className="text-gray-600 mt-2">These documents are required for verification</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <p className="text-blue-800 font-medium">Your documents are secure</p>
            <p className="text-blue-700 text-sm mt-1">
              We use bank-level encryption to store your documents. They are only used for verification
              and are never shared with parents.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DocumentUploadBox
          field="governmentIdFront"
          label="Government ID (Front)"
          description="Driver's license, passport, or provincial ID"
        />
        <DocumentUploadBox
          field="governmentIdBack"
          label="Government ID (Back)"
          description="Back side of your ID document"
        />
      </div>

      <DocumentUploadBox
        field="policeCheck"
        label="Police Check (Vulnerable Sector)"
        description="Recent vulnerable sector check document"
      />

      <DocumentUploadBox
        field="selfieForMatch"
        label="Selfie for ID Verification"
        description="Clear photo of your face to match with ID"
      />

      <div className="border-t pt-6 mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Award className="w-5 h-5 mr-2 text-[#8B5CF6]" />
          Optional Certifications (Trust Badges)
        </h3>
        <p className="text-gray-600 text-sm mb-4">
          Adding certifications helps build trust with parents and earns you special badges on your profile.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DocumentUploadBox
            field="cprCertificate"
            label="CPR & First Aid Certificate"
            description="Current certification document"
            required={false}
          />
          <DocumentUploadBox
            field="eceCertificate"
            label="ECE Certificate"
            description="Early Childhood Education credential"
            required={false}
          />
        </div>
      </div>
    </div>
  );
}

// Step 3: References
function ReferencesStep({ data, updateData }: StepProps) {
  const references = (data.references as Array<{
    name: string;
    relationship: string;
    contactMethod: string;
    contactValue: string;
  }>) || [];

  const addReference = () => {
    if (references.length < 3) {
      updateData({
        references: [...references, { name: '', relationship: '', contactMethod: 'phone', contactValue: '' }]
      });
    }
  };

  const updateReference = (index: number, field: string, value: string) => {
    const updated = [...references];
    updated[index] = { ...updated[index], [field]: value };
    updateData({ references: updated });
  };

  const removeReference = (index: number) => {
    updateData({ references: references.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Add References</h2>
        <p className="text-gray-600 mt-2">
          References are optional but recommended. They help build trust with parents.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <p className="text-amber-800 font-medium">References are preferred, not required</p>
            <p className="text-amber-700 text-sm mt-1">
              You can add up to 3 references. Having references earns you a special trust badge
              and helps you get more bookings.
            </p>
          </div>
        </div>
      </div>

      {references.map((ref, index) => (
        <div key={index} className="border rounded-lg p-6 bg-gray-50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">Reference #{index + 1}</h3>
            <button
              type="button"
              onClick={() => removeReference(index)}
              className="text-red-600 hover:text-red-700 text-sm"
            >
              Remove
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={ref.name}
                onChange={(e) => updateReference(index, 'name', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent"
                placeholder="Reference name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
              <input
                type="text"
                value={ref.relationship}
                onChange={(e) => updateReference(index, 'relationship', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent"
                placeholder="e.g., Former employer, Family friend"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Method</label>
              <select
                value={ref.contactMethod}
                onChange={(e) => updateReference(index, 'contactMethod', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent"
              >
                <option value="phone">Phone</option>
                <option value="email">Email</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {ref.contactMethod === 'phone' ? 'Phone Number' : 'Email Address'}
              </label>
              <input
                type={ref.contactMethod === 'phone' ? 'tel' : 'email'}
                value={ref.contactValue}
                onChange={(e) => updateReference(index, 'contactValue', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent"
                placeholder={ref.contactMethod === 'phone' ? '(123) 456-7890' : 'email@example.com'}
              />
            </div>
          </div>
        </div>
      ))}

      {references.length < 3 && (
        <button
          type="button"
          onClick={addReference}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#8B5CF6] hover:text-[#8B5CF6] transition-colors"
        >
          + Add Reference ({3 - references.length} remaining)
        </button>
      )}

      {references.length === 0 && (
        <p className="text-center text-gray-500 py-4">
          No references added yet. You can skip this step or add up to 3 references.
        </p>
      )}
    </div>
  );
}

// Step 4: Review & Submit
function ReviewStep({ data }: { data: Record<string, unknown> }) {
  const references = (data.references as Array<{
    name: string;
    relationship: string;
  }>) || [];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Review Your Application</h2>
        <p className="text-gray-600 mt-2">Please review your information before submitting</p>
      </div>

      <div className="bg-white border rounded-lg divide-y">
        {/* Basic Info */}
        <div className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
            <User className="w-5 h-5 mr-2 text-[#8B5CF6]" />
            Basic Information
          </h3>
          {(data.avatarPreview as string) && (
            <div className="flex items-center mb-4">
              <img
                src={data.avatarPreview as string}
                alt="Profile photo"
                className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 mr-3"
              />
              <span className="text-sm text-green-600 font-medium">Profile photo added</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Name:</span>
              <p className="font-medium">{data.firstName as string} {data.lastName as string}</p>
            </div>
            <div>
              <span className="text-gray-500">Phone:</span>
              <p className="font-medium">{data.phone as string}</p>
            </div>
            <div>
              <span className="text-gray-500">Experience:</span>
              <p className="font-medium">{data.experienceYears as number} years</p>
            </div>
            <div>
              <span className="text-gray-500">Hourly Rate:</span>
              <p className="font-medium">${data.hourlyRate as number}/hr</p>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-gray-500 text-sm">Bio:</span>
            <p className="text-sm mt-1">{data.bio as string}</p>
          </div>
        </div>

        {/* Documents */}
        <div className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-[#8B5CF6]" />
            Documents
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { key: 'governmentIdFront', label: 'ID Front' },
              { key: 'governmentIdBack', label: 'ID Back' },
              { key: 'policeCheck', label: 'Police Check' },
              { key: 'selfieForMatch', label: 'Selfie' },
              { key: 'cprCertificate', label: 'CPR Certificate' },
              { key: 'eceCertificate', label: 'ECE Certificate' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center">
                {data[key] ? (
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                ) : (
                  <div className="w-4 h-4 border-2 border-gray-300 rounded-full mr-2" />
                )}
                <span className={data[key] ? 'text-green-700' : 'text-gray-400'}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* References */}
        <div className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-[#8B5CF6]" />
            References ({references.length})
          </h3>
          {references.length > 0 ? (
            <div className="space-y-2">
              {references.map((ref, i) => (
                <div key={i} className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  <span>{ref.name} - {ref.relationship}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No references added</p>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">What happens next?</h4>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>• Your application will be reviewed by our team</li>
          <li>• We&apos;ll verify your documents and ID</li>
          <li>• You&apos;ll receive an email once approved (usually within 24-48 hours)</li>
          <li>• After approval, you can set up Stripe to receive payments</li>
        </ul>
      </div>
    </div>
  );
}

// Main Registration Page
export default function BabysitterRegisterPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, unknown>>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    phone: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    bio: '',
    experienceYears: 0,
    experienceSummary: '',
    hourlyRate: 20,
    governmentIdFront: '',
    governmentIdBack: '',
    policeCheck: '',
    selfieForMatch: '',
    cprCertificate: '',
    eceCertificate: '',
    references: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const steps = [
    { title: 'Basic Info', icon: User },
    { title: 'Documents', icon: FileText },
    { title: 'References', icon: Users },
    { title: 'Review', icon: CheckCircle },
  ];

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/babysitter/register');
    }
  }, [authLoading, isAuthenticated, router]);

  // Pre-fill user data if available
  useEffect(() => {
    if (user?.profile) {
      setFormData(prev => ({
        ...prev,
        firstName: user.profile?.firstName || '',
        lastName: user.profile?.lastName || '',
        phone: user.profile?.phone || '',
      }));
    }
  }, [user]);

  const updateFormData = (data: Record<string, unknown>) => {
    setFormData(prev => ({ ...prev, ...data }));
    // Clear errors for updated fields
    const clearedErrors = { ...errors };
    Object.keys(data).forEach(key => delete clearedErrors[key]);
    setErrors(clearedErrors);
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!formData.firstName) newErrors.firstName = 'First name is required';
      if (!formData.lastName) newErrors.lastName = 'Last name is required';
      if (!formData.dateOfBirth) {
        newErrors.dateOfBirth = 'Date of birth is required';
      } else {
        const dob = new Date(formData.dateOfBirth as string);
        const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (age < 18) newErrors.dateOfBirth = 'You must be at least 18 years old';
      }
      if (!formData.phone) newErrors.phone = 'Phone number is required';
      if (!formData.streetAddress) newErrors.streetAddress = 'Street address is required';
      if (!formData.city) newErrors.city = 'City is required';
      if (!formData.state) newErrors.state = 'Province is required';
      if (!formData.zipCode) newErrors.zipCode = 'Postal code is required';
      if (!formData.bio || (formData.bio as string).length < 10) {
        newErrors.bio = 'Bio must be at least 10 characters';
      }
      const rate = formData.hourlyRate as number;
      if (!rate || rate < 15 || rate > 100) {
        newErrors.hourlyRate = 'Hourly rate must be between $15 and $100';
      }
    }

    if (step === 1) {
      if (!formData.governmentIdFront) newErrors.governmentIdFront = 'Government ID (front) is required';
      if (!formData.governmentIdBack) newErrors.governmentIdBack = 'Government ID (back) is required';
      if (!formData.policeCheck) newErrors.policeCheck = 'Police check is required';
      if (!formData.selfieForMatch) newErrors.selfieForMatch = 'Selfie is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Step 1: Register basic info
      const registerResponse = await fetch('/api/babysitter/register', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: formData.dateOfBirth,
          phone: formData.phone,
          streetAddress: formData.streetAddress,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          bio: formData.bio,
          experienceYears: formData.experienceYears,
          experienceSummary: formData.experienceSummary,
          hourlyRate: formData.hourlyRate,
        }),
      });

      if (!registerResponse.ok) {
        const error = await registerResponse.json();
        throw new Error(error.error || 'Failed to register');
      }

      // Step 2: Upload documents
      const documentsResponse = await fetch('/api/babysitter/documents', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          governmentIdFront: formData.governmentIdFront,
          governmentIdBack: formData.governmentIdBack,
          policeCheck: formData.policeCheck,
          selfieForMatch: formData.selfieForMatch,
          cprCertificate: formData.cprCertificate || undefined,
          eceCertificate: formData.eceCertificate || undefined,
        }),
      });

      if (!documentsResponse.ok) {
        const error = await documentsResponse.json();
        throw new Error(error.error || 'Failed to upload documents');
      }

      // Step 3: Add references if any
      const references = formData.references as Array<{
        name: string;
        relationship: string;
        contactMethod: string;
        contactValue: string;
      }>;

      if (references && references.length > 0) {
        const validRefs = references.filter(r => r.name && r.relationship && r.contactValue);
        if (validRefs.length > 0) {
          await fetch('/api/babysitter/references', {
            method: 'POST',
            headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(validRefs),
          });
        }
      }

      // Step 4: Upload avatar if one was selected
      if (formData.avatarFile) {
        try {
          const avatarFormData = new FormData();
          avatarFormData.append('avatar', formData.avatarFile as File);

          await fetch('/api/profile/upload-avatar', {
            method: 'POST',
            headers: addCSRFHeader(),
            body: avatarFormData,
            credentials: 'include',
          });
        } catch (avatarError) {
          // Avatar upload failure shouldn't block registration
          console.error('Avatar upload failed:', avatarError);
        }
      }

      // Success - redirect to success page or dashboard
      router.push('/babysitter/register/success');

    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit application');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B5CF6]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.title} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                  index < currentStep
                    ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white'
                    : index === currentStep
                    ? 'border-[#8B5CF6] text-[#8B5CF6]'
                    : 'border-gray-300 text-gray-300'
                }`}>
                  {index < currentStep ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <span className={`ml-2 text-sm font-medium hidden sm:block ${
                  index <= currentStep ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {step.title}
                </span>
                {index < steps.length - 1 && (
                  <div className={`w-12 sm:w-24 h-0.5 mx-2 sm:mx-4 ${
                    index < currentStep ? 'bg-[#8B5CF6]' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-xl shadow-sm border p-6 sm:p-8">
          {currentStep === 0 && (
            <BasicInfoStep data={formData} updateData={updateFormData} errors={errors} />
          )}
          {currentStep === 1 && (
            <DocumentsStep data={formData} updateData={updateFormData} errors={errors} />
          )}
          {currentStep === 2 && (
            <ReferencesStep data={formData} updateData={updateFormData} errors={errors} />
          )}
          {currentStep === 3 && (
            <ReviewStep data={formData} />
          )}

          {submitError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {submitError}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 0}
              className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
                currentStep === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Back
            </button>

            {currentStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center px-6 py-3 bg-[#8B5CF6] text-white rounded-lg font-medium hover:bg-[#7C3AED] transition-colors"
              >
                Next
                <ChevronRight className="w-5 h-5 ml-1" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center px-6 py-3 bg-[#8B5CF6] text-white rounded-lg font-medium hover:bg-[#7C3AED] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Application
                    <CheckCircle className="w-5 h-5 ml-2" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
