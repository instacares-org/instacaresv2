"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { 
  UserIcon, 
  HeartIcon, 
  ExclamationTriangleIcon,
  CameraIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";

interface Allergy {
  id?: string;
  name: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  reaction: string;
  treatment: string;
}

interface Medication {
  id?: string;
  name: string;
  dosage: string;
  frequency: string;
  instructions: string;
  prescribedBy: string;
}

interface MedicalCondition {
  id?: string;
  condition: string;
  description: string;
  treatment: string;
  doctorContact: string;
}

interface EmergencyContact {
  id?: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  canPickup: boolean;
}

interface Child {
  id?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  allergies: Allergy[];
  medications: Medication[];
  medicalConditions: MedicalCondition[];
  emergencyMedicalInfo: string;
  bloodType: string;
  emergencyContacts: EmergencyContact[];
  dietaryRestrictions: string[];
  specialInstructions: string;
  pickupInstructions: string;
  photoUrl?: string;
}

interface ChildProfileProps {
  child?: Child;
  onSave: (child: Child) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export default function ChildProfile({ child, onSave, onCancel, isOpen }: ChildProfileProps) {
  const [formData, setFormData] = useState<Child>(child || {
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    allergies: [],
    medications: [],
    medicalConditions: [],
    emergencyMedicalInfo: '',
    bloodType: '',
    emergencyContacts: [],
    dietaryRestrictions: [],
    specialInstructions: '',
    pickupInstructions: '',
    photoUrl: undefined
  });

  const [activeTab, setActiveTab] = useState<'basic' | 'medical' | 'emergency' | 'preferences'>('basic');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleInputChange = (field: keyof Child, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addAllergy = () => {
    const newAllergy: Allergy = {
      id: Date.now().toString(),
      name: '',
      severity: 'Mild',
      reaction: '',
      treatment: ''
    };
    handleInputChange('allergies', [...formData.allergies, newAllergy]);
  };

  const updateAllergy = (index: number, field: keyof Allergy, value: string) => {
    const updatedAllergies = [...formData.allergies];
    updatedAllergies[index] = { ...updatedAllergies[index], [field]: value };
    handleInputChange('allergies', updatedAllergies);
  };

  const removeAllergy = (index: number) => {
    const updatedAllergies = formData.allergies.filter((_, i) => i !== index);
    handleInputChange('allergies', updatedAllergies);
  };

  const addMedication = () => {
    const newMedication: Medication = {
      id: Date.now().toString(),
      name: '',
      dosage: '',
      frequency: '',
      instructions: '',
      prescribedBy: ''
    };
    handleInputChange('medications', [...formData.medications, newMedication]);
  };

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    const updatedMedications = [...formData.medications];
    updatedMedications[index] = { ...updatedMedications[index], [field]: value };
    handleInputChange('medications', updatedMedications);
  };

  const removeMedication = (index: number) => {
    const updatedMedications = formData.medications.filter((_, i) => i !== index);
    handleInputChange('medications', updatedMedications);
  };

  const addEmergencyContact = () => {
    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name: '',
      relationship: '',
      phone: '',
      email: '',
      canPickup: false
    };
    handleInputChange('emergencyContacts', [...formData.emergencyContacts, newContact]);
  };

  const updateEmergencyContact = (index: number, field: keyof EmergencyContact, value: any) => {
    const updatedContacts = [...formData.emergencyContacts];
    updatedContacts[index] = { ...updatedContacts[index], [field]: value };
    handleInputChange('emergencyContacts', updatedContacts);
  };

  const removeEmergencyContact = (index: number) => {
    const updatedContacts = formData.emergencyContacts.filter((_, i) => i !== index);
    handleInputChange('emergencyContacts', updatedContacts);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      // In a real implementation, you would upload to your server/cloud storage
      // For now, we'll create a local URL
      const photoUrl = URL.createObjectURL(file);
      handleInputChange('photoUrl', photoUrl);
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = () => {
    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.dateOfBirth) {
      alert('Please fill in all required fields');
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {child ? 'Edit Child Profile' : 'Add Child Profile'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'basic', label: 'Basic Info' },
            { id: 'medical', label: 'Medical Info' },
            { id: 'emergency', label: 'Emergency' },
            { id: 'preferences', label: 'Preferences' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              {/* Photo Upload */}
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    {formData.photoUrl ? (
                      <Image
                        src={formData.photoUrl}
                        alt={`${formData.firstName} ${formData.lastName}`}
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UserIcon className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="absolute -bottom-1 -right-1 bg-green-600 text-white p-1.5 rounded-full hover:bg-green-700 transition"
                  >
                    <CameraIcon className="h-3 w-3" />
                  </button>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Child Photo</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Upload a clear photo for identification purposes
                  </p>
                </div>
              </div>

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Gender
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Blood Type
                  </label>
                  <select
                    value={formData.bloodType}
                    onChange={(e) => handleInputChange('bloodType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select blood type</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Medical Info Tab */}
          {activeTab === 'medical' && (
            <div className="space-y-6">
              {/* Emergency Medical Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Emergency Medical Information
                </label>
                <textarea
                  value={formData.emergencyMedicalInfo}
                  onChange={(e) => handleInputChange('emergencyMedicalInfo', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Any critical medical information that caregivers should know immediately..."
                />
              </div>

              {/* Allergies */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Allergies</h3>
                  <button
                    onClick={addAllergy}
                    className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700 transition flex items-center"
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add Allergy
                  </button>
                </div>
                
                {formData.allergies.map((allergy, index) => (
                  <div key={allergy.id || index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Allergen
                        </label>
                        <input
                          type="text"
                          value={allergy.name}
                          onChange={(e) => updateAllergy(index, 'name', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                          placeholder="e.g., Peanuts, Milk, Eggs"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Severity
                        </label>
                        <select
                          value={allergy.severity}
                          onChange={(e) => updateAllergy(index, 'severity', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                        >
                          <option value="Mild">Mild</option>
                          <option value="Moderate">Moderate</option>
                          <option value="Severe">Severe</option>
                        </select>
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Reaction & Treatment
                        </label>
                        <textarea
                          value={allergy.treatment}
                          onChange={(e) => updateAllergy(index, 'treatment', e.target.value)}
                          rows={2}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                          placeholder="Describe reactions and treatment steps..."
                        />
                      </div>
                    </div>
                    
                    <button
                      onClick={() => removeAllergy(index)}
                      className="mt-2 text-red-600 dark:text-red-400 text-xs hover:text-red-800 dark:hover:text-red-300 flex items-center"
                    >
                      <TrashIcon className="h-3 w-3 mr-1" />
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {/* Medications */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Medications</h3>
                  <button
                    onClick={addMedication}
                    className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700 transition flex items-center"
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add Medication
                  </button>
                </div>
                
                {formData.medications.map((medication, index) => (
                  <div key={medication.id || index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Medication Name
                        </label>
                        <input
                          type="text"
                          value={medication.name}
                          onChange={(e) => updateMedication(index, 'name', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Dosage
                        </label>
                        <input
                          type="text"
                          value={medication.dosage}
                          onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                          placeholder="e.g., 5mg, 1 tablet"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Frequency
                        </label>
                        <input
                          type="text"
                          value={medication.frequency}
                          onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                          placeholder="e.g., Twice daily, As needed"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Prescribed By
                        </label>
                        <input
                          type="text"
                          value={medication.prescribedBy}
                          onChange={(e) => updateMedication(index, 'prescribedBy', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                          placeholder="Doctor's name"
                        />
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Instructions
                        </label>
                        <textarea
                          value={medication.instructions}
                          onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                          rows={2}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                          placeholder="Special instructions for administration..."
                        />
                      </div>
                    </div>
                    
                    <button
                      onClick={() => removeMedication(index)}
                      className="mt-2 text-red-600 dark:text-red-400 text-xs hover:text-red-800 dark:hover:text-red-300 flex items-center"
                    >
                      <TrashIcon className="h-3 w-3 mr-1" />
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Emergency Tab */}
          {activeTab === 'emergency' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Emergency Contacts</h3>
                <button
                  onClick={addEmergencyContact}
                  className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700 transition flex items-center"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Contact
                </button>
              </div>
              
              {formData.emergencyContacts.map((contact, index) => (
                <div key={contact.id || index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={contact.name}
                        onChange={(e) => updateEmergencyContact(index, 'name', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Relationship
                      </label>
                      <input
                        type="text"
                        value={contact.relationship}
                        onChange={(e) => updateEmergencyContact(index, 'relationship', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                        placeholder="e.g., Grandmother, Uncle"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={contact.phone}
                        onChange={(e) => updateEmergencyContact(index, 'phone', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) => updateEmergencyContact(index, 'email', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={contact.canPickup}
                          onChange={(e) => updateEmergencyContact(index, 'canPickup', e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Authorized to pick up child
                        </span>
                      </label>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => removeEmergencyContact(index)}
                    className="mt-2 text-red-600 dark:text-red-400 text-xs hover:text-red-800 dark:hover:text-red-300 flex items-center"
                  >
                    <TrashIcon className="h-3 w-3 mr-1" />
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Special Instructions
                </label>
                <textarea
                  value={formData.specialInstructions}
                  onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Any special care instructions, preferences, or important notes for caregivers..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Pickup Instructions
                </label>
                <textarea
                  value={formData.pickupInstructions}
                  onChange={(e) => handleInputChange('pickupInstructions', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Who is authorized to pick up the child, special pickup procedures, etc..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
          >
            {child ? 'Update Profile' : 'Create Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}