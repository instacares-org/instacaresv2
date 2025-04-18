import Image from 'next/image';

function Banner() {
  return (
    <div className="relative h-[300px] sm:h-[400px] lg:h-[500px] xl:h-[600px] 2xl:h-[700px]">
      <Image
        src="/insta_baner.png"
        alt="banner"
        layout="fill"
        objectFit="cover"
      />
      <div className="absolute top-1/2 w-full text-center">
        <p className="text-black text-sm sm:text-lg">A safer way to find Care </p>
        <button className="text-orange-500 bg-white px-7 py-4 shadow-md rounded-full font-bold my-3 hover:shadow-xl active:scale-90 transition duration-150">Find Childcare</button>
      </div>
    </div>
  );
}

export default Banner;