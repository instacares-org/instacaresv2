import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Safety & Trust',
  description: 'Learn about InstaCares safety measures, caregiver verification process, and how we protect families across Canada.',
};

export default function SafetyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Safety & Trust
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Your family's safety is our top priority. Learn about our comprehensive verification process and safety measures.
            </p>
          </div>
        </div>
      </div>

      {/* Safety Measures */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Comprehensive Caregiver Verification
            </h2>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="font-semibold text-gray-900">Background Checks</h3>
                  <p className="text-gray-600">Comprehensive criminal background screening for all caregivers</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="font-semibold text-gray-900">Reference Verification</h3>
                  <p className="text-gray-600">Multiple reference checks from previous employers and families</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="font-semibold text-gray-900">Identity Verification</h3>
                  <p className="text-gray-600">Government ID verification and photo confirmation</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="font-semibold text-gray-900">Qualification Checks</h3>
                  <p className="text-gray-600">Verification of certifications, training, and experience</p>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:order-first">
            <div className="bg-blue-100 rounded-lg p-8 text-center">
              <div className="text-6xl mb-4">🛡️</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                100% Verified Caregivers
              </h3>
              <p className="text-gray-600">
                Every caregiver on our platform has passed our comprehensive verification process
              </p>
            </div>
          </div>
        </div>

        {/* Safety Features */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Platform Safety Features
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-sm p-6 text-center">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Secure Messaging
              </h3>
              <p className="text-gray-600">
                All communication happens through our secure platform, protecting your privacy
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 text-center">
              <div className="text-4xl mb-4">⭐</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Rating System
              </h3>
              <p className="text-gray-600">
                Transparent rating and review system helps you make informed decisions
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 text-center">
              <div className="text-4xl mb-4">🚨</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                24/7 Support
              </h3>
              <p className="text-gray-600">
                Our support team is available around the clock for any safety concerns
              </p>
            </div>
          </div>
        </div>

        {/* Safety Tips */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Safety Tips for Parents
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Before the First Visit</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Meet the caregiver in person or via video call</li>
                <li>• Discuss your expectations and house rules</li>
                <li>• Share emergency contacts and important information</li>
                <li>• Ask to see their ID and any relevant certifications</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">During Care</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Use our messaging system for updates</li>
                <li>• Trust your instincts if something feels off</li>
                <li>• Keep communication open with your children</li>
                <li>• Contact us immediately if you have concerns</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Emergency Contacts */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-red-900 mb-4">
            Emergency Support
          </h2>
          <p className="text-red-800 mb-4">
            If you have immediate safety concerns or encounter an emergency situation:
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="bg-white rounded-lg p-4 border border-red-200">
              <h3 className="font-semibold text-red-900 mb-1">Emergency</h3>
              <p className="text-red-800">Call 911 immediately</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-red-200">
              <h3 className="font-semibold text-red-900 mb-1">InstaCares Support</h3>
              <p className="text-red-800">+1 (647) 955-7780</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-red-200">
              <h3 className="font-semibold text-red-900 mb-1">Email</h3>
              <p className="text-red-800">safety@instacares.com</p>
            </div>
          </div>
        </div>

        {/* Trust Statement */}
        <div className="text-center mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Our Commitment to Safety
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            InstaCares is committed to providing the safest possible platform for Canadian families.
            We continuously improve our safety measures and work with families to ensure the best possible
            childcare experience. Your trust is our most valuable asset.
          </p>
          <div className="mt-8">
            <span className="text-sm text-gray-500">Made in Canada 🍁 • Trusted by families nationwide</span>
          </div>
        </div>
      </div>
    </div>
  );
}