import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="relative h-8 w-12">
                <Image
                  src="/logo.png"
                  fill
                  alt="InstaCares Logo"
                  className="object-contain"
                />
              </div>
              <span className="text-2xl font-bold">InstaCares</span>
            </div>
            <p className="text-gray-400 mb-4 max-w-md">
              Connecting families with trusted, verified childcare providers across Canada. 
              Safe, reliable, and convenient childcare solutions for modern families.
            </p>
            <div className="space-y-2 text-sm text-gray-400">
              <p>22 King Street South, Suite 300</p>
              <p>Waterloo, Ontario, N2J 1N8</p>
              <p>
                <a href="tel:+18883940259" className="hover:text-white transition">
                  (888) 394-0259
                </a>
              </p>
              <p>
                <a href="mailto:info@instacares.com" className="hover:text-white transition">
                  info@instacares.com
                </a>
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/search" className="text-gray-400 hover:text-white transition">
                  Find Caregivers
                </Link>
              </li>
              <li>
                <Link href="/signup?type=caregiver" className="text-gray-400 hover:text-white transition">
                  Become a Caregiver
                </Link>
              </li>
              <li>
                <Link href="/signup?type=parent" className="text-gray-400 hover:text-white transition">
                  Sign Up as Parent
                </Link>
              </li>
              <li>
                <Link href="/admin" className="text-gray-400 hover:text-white transition">
                  Admin Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Support */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Legal & Support</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/terms" className="text-gray-400 hover:text-white transition">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-400 hover:text-white transition">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <a href="mailto:support@instacares.com" className="text-gray-400 hover:text-white transition">
                  Support
                </a>
              </li>
              <li>
                <a href="mailto:safety@instacares.com" className="text-gray-400 hover:text-white transition">
                  Safety & Trust
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-6 text-sm text-gray-400">
              <p>&copy; {currentYear} InstaCares. All rights reserved.</p>
              <p>Made in Canada 🍁</p>
            </div>
            
            {/* Social Links (if needed in future) */}
            <div className="flex space-x-4">
              <div className="text-sm text-gray-400">
                Follow safety guidelines • Verified caregivers • Trusted platform
              </div>
            </div>
          </div>
        </div>

        {/* Safety Notice */}
        <div className="mt-6 pt-6 border-t border-gray-800">
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400 text-center">
              <span className="font-semibold text-yellow-400">Safety First:</span> Always meet caregivers in person, check references, 
              and verify credentials before hiring. InstaCares facilitates connections but users are responsible for their own safety and decisions.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}