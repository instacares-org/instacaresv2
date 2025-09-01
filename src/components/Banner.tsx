"use client";

import Image from 'next/image';
import Link from 'next/link';

interface BannerProps {
  onBadgeClick?: () => void;
}

function Banner({ onBadgeClick }: BannerProps) {

  return (
    <div className="relative h-[300px] sm:h-[400px] lg:h-[500px] xl:h-[600px] 2xl:h-[700px]">
      <div suppressHydrationWarning>
        <Image
          src="/banner.png"
          alt="banner"
          width={1920}
          height={700}
          className="object-cover w-full h-full"
          priority={true}
        />
      </div>
      <div className="absolute top-1/2 w-full text-center transform -translate-y-1/2" suppressHydrationWarning>
        <div className="max-w-4xl mx-auto px-4" suppressHydrationWarning>
          {/* Single action button */}
          <div className="flex justify-center">
            <Link href="/search">
              <button 
                className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-8 py-4 shadow-2xl rounded-full font-bold text-lg hover:shadow-3xl hover:shadow-teal-500/30 active:scale-95 transition-all duration-300 border-2 border-teal-500/50 hover:border-teal-400" 
                suppressHydrationWarning
              >
                Find Trusted Childcare Now
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Banner;