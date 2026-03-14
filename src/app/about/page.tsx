import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about InstaCares mission to connect Canadian families with trusted, verified childcare providers across Canada.'
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            About InstaCares
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Canada's trusted platform connecting families with verified childcare providers
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Mission</h2>
          <p className="text-gray-700 mb-6">
            InstaCares is dedicated to making quality childcare accessible to every Canadian family.
            We connect parents with trusted, verified caregivers who share our commitment to child
            safety, development, and well-being.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Why Choose InstaCares?</h2>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">🔍 Verified Caregivers</h3>
              <p className="text-gray-600">
                Every caregiver undergoes comprehensive background checks and verification
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">🇨🇦 Canadian-Focused</h3>
              <p className="text-gray-600">
                Built specifically for Canadian families with local expertise
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">💰 Transparent Pricing</h3>
              <p className="text-gray-600">
                No hidden fees - you see exactly what you pay before booking
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">📱 Easy to Use</h3>
              <p className="text-gray-600">
                Simple booking process from search to payment
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Story</h2>
          <p className="text-gray-700 mb-4">
            Founded in 2024, InstaCares was born from the recognition that Canadian families
            needed a reliable, safe, and convenient way to find quality childcare. As parents
            ourselves, we understood the challenges of finding trusted caregivers who align
            with your family's values and needs.
          </p>
          <p className="text-gray-700">
            Today, InstaCares serves families across Canada, from Vancouver to Halifax,
            helping thousands of families connect with caregivers who make a difference
            in children's lives every day.
          </p>
        </div>

        <div className="bg-blue-50 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Ready to Get Started?</h2>
          <p className="text-gray-700 mb-6">
            Join thousands of Canadian families who trust InstaCares for their childcare needs
          </p>
          <div className="space-x-4">
            <a
              href="/search"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Find a Caregiver
            </a>
            <a
              href="/signup?type=caregiver"
              className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium border border-blue-600 hover:bg-blue-50 transition-colors"
            >
              Become a Caregiver
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}