import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description: 'Get answers to common questions about InstaCares childcare services in Canada.',
};

export default function FAQPage() {
  const faqs = [
    {
      category: "Getting Started",
      questions: [
        {
          q: "How do I sign up as a parent?",
          a: "Click 'Sign Up as Parent' on the homepage, fill out your profile information, verify your email, and start searching for caregivers in your area."
        },
        {
          q: "How do I become a caregiver on InstaCares?",
          a: "Click 'Become a Caregiver', complete your profile with qualifications and experience, upload required documents, and wait for approval from our team."
        },
        {
          q: "Is InstaCares available across Canada?",
          a: "Yes! InstaCares connects families with caregivers across all provinces and territories in Canada."
        }
      ]
    },
    {
      category: "Safety & Trust",
      questions: [
        {
          q: "How are caregivers verified?",
          a: "All caregivers undergo background checks, reference verification, and document validation before being approved on our platform."
        },
        {
          q: "What safety measures are in place?",
          a: "We verify all caregiver credentials, conduct background checks, provide secure messaging, and maintain a rating system for transparency."
        },
        {
          q: "Can I see caregiver reviews?",
          a: "Yes, you can view ratings and reviews from other families who have used each caregiver's services."
        }
      ]
    },
    {
      category: "Booking & Payments",
      questions: [
        {
          q: "How do I book a caregiver?",
          a: "Search for caregivers in your area, view their profiles, send a booking request with your requirements, and wait for confirmation."
        },
        {
          q: "How does payment work?",
          a: "Payments are processed securely through our platform. You can pay by credit card or other supported payment methods."
        },
        {
          q: "Can I cancel a booking?",
          a: "Yes, you can cancel bookings according to our cancellation policy. Please check the specific terms when booking."
        }
      ]
    },
    {
      category: "Communication",
      questions: [
        {
          q: "How do I communicate with caregivers?",
          a: "Once a booking is confirmed, you can use our secure in-app messaging system to communicate directly with your caregiver."
        },
        {
          q: "Can I call or text caregivers directly?",
          a: "For safety and privacy, we recommend using our secure messaging system. Personal contact information can be shared at your discretion."
        }
      ]
    },
    {
      category: "Support",
      questions: [
        {
          q: "How do I contact customer support?",
          a: "You can reach us at info@instacares.com or call us at +1 (647) 955-7780. We're here to help!"
        },
        {
          q: "What if I have an issue with a caregiver?",
          a: "Contact our support team immediately. We take all concerns seriously and will work to resolve any issues quickly."
        },
        {
          q: "How do I update my profile?",
          a: "Log into your dashboard and navigate to your profile settings to update your information at any time."
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-gray-600">
            Find answers to common questions about using InstaCares
          </p>
        </div>
      </div>

      {/* FAQ Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {faqs.map((category, categoryIndex) => (
          <div key={categoryIndex} className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 border-b-2 border-blue-600 pb-2">
              {category.category}
            </h2>
            <div className="space-y-6">
              {category.questions.map((faq, faqIndex) => (
                <div key={faqIndex} className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">
                    {faq.q}
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Contact Section */}
        <div className="bg-blue-50 rounded-lg p-8 mt-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Still have questions?
          </h2>
          <p className="text-gray-700 mb-4">
            Can't find what you're looking for? Our support team is here to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="/contact"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
            >
              Contact Support
            </a>
            <a
              href="mailto:info@instacares.com"
              className="bg-white text-blue-600 border border-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors text-center"
            >
              Email Us
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}