import Image from 'next/image';
import Link from 'next/link';

function Banner() {
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
      <div className="absolute top-1/2 w-full text-center">
        <p className="text-white text-sm sm:text-lg font-semibold drop-shadow-lg">A safer way to find Care </p>
        <Link href="/search" className="inline-block">
          <button className="text-orange-500 bg-white dark:bg-gray-800 dark:text-orange-400 px-7 py-4 shadow-md rounded-full font-bold my-3 hover:shadow-xl active:scale-90 transition duration-150">Find Childcare</button>
        </Link>
      </div>
    </div>
  );
}

export default Banner;