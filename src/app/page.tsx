import Header from "../components/Header";
import Banner from "../components/Banner";

export default function Home() {
  return (
    <div className="">
      <Header />
      <Banner />

      <main>
        <section className="pt-6 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-black text-4md font-semibold pd-5">Available Caregiver Near you</h2>
        </section>
      </main>
    </div>
  );
}