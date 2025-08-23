"use client";

import { useState, useEffect } from "react";
import ChildProfile from "../../components/ChildProfile";
import CheckInOut from "../../components/CheckInOut";
import SafetyBadges from "../../components/SafetyBadges";

interface Child {
  id?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  allergies: any[];
  medications: any[];
  medicalConditions: any[];
  emergencyMedicalInfo: string;
  bloodType: string;
  emergencyContacts: any[];
  dietaryRestrictions: string[];
  specialInstructions: string;
  pickupInstructions: string;
  photoUrl?: string;
}

export default function TestSafetyPage() {
  const [showChildProfile, setShowChildProfile] = useState(false);
  const [showCheckInOut, setShowCheckInOut] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  // Sample verification data for testing
  const sampleVerification = {
    backgroundCheck: true,
    backgroundCheckDate: "2024-08-01",
    idVerificationStatus: "APPROVED",
    insuranceStatus: "APPROVED", 
    insuranceProvider: "Childcare Liability Insurance Co.",
    insuranceExpiryDate: "2025-12-31",
    verificationScore: 95,
    certifications: [
      {
        type: "CPR",
        title: "Adult & Child CPR/AED",
        isVerified: true,
        expirationDate: "2026-01-15"
      },
      {
        type: "FIRST_AID", 
        title: "Pediatric First Aid",
        isVerified: true,
        expirationDate: "2026-01-15"
      },
      {
        type: "BACKGROUND_CHECK",
        title: "Enhanced Background Check", 
        isVerified: true,
        expirationDate: "2025-08-01"
      }
    ]
  };

  // Sample check-in/out data
  const sampleCheckInOut = {
    bookingId: "test-booking-001",
    childId: "test-child-001", 
    childName: "Emma Johnson",
    childPhoto: "/placeholder-child.jpg",
    caregiverId: "test-caregiver-001",
    status: "PENDING" as const,
    activities: [],
    meals: [],
    behaviorNotes: ""
  };

  useEffect(() => {
    // Simulate loading children data
    const timer = setTimeout(() => {
      setChildren([
        {
          id: "test-child-001",
          firstName: "Emma",
          lastName: "Johnson", 
          dateOfBirth: "2020-03-15",
          gender: "Female",
          bloodType: "A+",
          allergies: [
            {
              id: "1",
              name: "Peanuts",
              severity: "Severe",
              reaction: "Anaphylaxis, swelling, difficulty breathing",
              treatment: "Use EpiPen immediately, call 911"
            }
          ],
          medications: [
            {
              id: "1",
              name: "EpiPen Jr.",
              dosage: "0.15mg", 
              frequency: "As needed for allergic reactions",
              instructions: "Inject into thigh muscle, call 911 immediately",
              prescribedBy: "Dr. Sarah Wilson"
            }
          ],
          medicalConditions: [
            {
              id: "1",
              condition: "Asthma",
              description: "Exercise-induced asthma",
              treatment: "Albuterol inhaler as needed",
              doctorContact: "Dr. Michael Chen - (555) 123-4567"
            }
          ],
          emergencyMedicalInfo: "Severe peanut allergy - EpiPen in backpack. Asthma inhaler in case of breathing difficulties.",
          dietaryRestrictions: ["No peanuts", "No tree nuts", "Lactose-free milk only"],
          specialInstructions: "Emma needs her comfort blanket for nap time. She is very social but can get overwhelmed in large groups.",
          pickupInstructions: "Only authorized by parents or grandmother (Mary Johnson). Requires photo ID verification.",
          emergencyContacts: [
            {
              id: "1",
              name: "Mary Johnson",
              relationship: "Grandmother", 
              phone: "(555) 987-6543",
              email: "mary.johnson@email.com",
              canPickup: true
            }
          ]
        }
      ]);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleSaveChild = (childData: Child) => {
    console.log("Saving child data:", childData);
    setChildren(prev => {
      const existing = prev.findIndex(c => c.id === childData.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = childData;
        return updated;
      } else {
        return [...prev, { ...childData, id: Date.now().toString() }];
      }
    });
    setShowChildProfile(false);
    alert("Child profile saved successfully!");
  };

  const handleCheckIn = (data: any) => {
    console.log("Check-in data:", data);
    alert("Child checked in successfully!");
  };

  const handleCheckOut = (data: any) => {
    console.log("Check-out data:", data);
    alert("Child checked out successfully!");
  };

  const handleUpdateActivities = (data: any) => {
    console.log("Activities updated:", data);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          🔐 Safety & Trust Features Test Page
        </h1>

        {/* Safety Badges Demo */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            1. Safety Badges Display
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Compact View</h3>
              <SafetyBadges verification={sampleVerification} compact={true} />
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Detailed View</h3>
              <SafetyBadges verification={sampleVerification} showDetails={true} />
            </div>
          </div>
        </div>

        {/* Child Profile Management */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              2. Child Profile Management
            </h2>
            <button
              onClick={() => setShowChildProfile(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
            >
              Add Child Profile
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading children...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {children.map(child => (
                <div key={child.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {child.firstName} {child.lastName}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    DOB: {new Date(child.dateOfBirth).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Blood Type: {child.bloodType}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                    ⚠️ {child.allergies.length} allergies, {child.medications.length} medications
                  </p>
                  <button
                    onClick={() => setShowChildProfile(true)}
                    className="mt-3 text-green-600 dark:text-green-400 text-sm hover:underline"
                  >
                    Edit Profile
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Check-In/Out System */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              3. Check-In/Out System
            </h2>
            <button
              onClick={() => setShowCheckInOut(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Test Check-In/Out
            </button>
          </div>

          <div className="text-gray-600 dark:text-gray-400">
            <p>• Photo capture for arrival and departure</p>
            <p>• Activity and meal tracking throughout the day</p>
            <p>• GPS location verification</p>
            <p>• Daily summary reports for parents</p>
          </div>
        </div>

        {/* Test Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-300 mb-4">
            📋 Testing Instructions
          </h2>
          
          <div className="space-y-4 text-blue-800 dark:text-blue-200">
            <div>
              <h3 className="font-medium">Safety Badges:</h3>
              <p className="text-sm">Check that badges display correctly in both light and dark mode. Verify trust score and certification icons.</p>
            </div>
            
            <div>
              <h3 className="font-medium">Child Profiles:</h3>
              <p className="text-sm">Add/edit child profiles with medical information, allergies, and emergency contacts. Test form validation.</p>
            </div>
            
            <div>
              <h3 className="font-medium">Check-In/Out:</h3>
              <p className="text-sm">Test photo capture (use camera if available), activity tracking, and location services.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ChildProfile
        isOpen={showChildProfile}
        onSave={handleSaveChild}
        onCancel={() => setShowChildProfile(false)}
        child={showChildProfile ? children[0] : undefined}
      />

      <CheckInOut
        isOpen={showCheckInOut}
        data={sampleCheckInOut}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
        onUpdateActivities={handleUpdateActivities}
        isCaregiver={true}
        onClose={() => setShowCheckInOut(false)}
      />
    </div>
  );
}