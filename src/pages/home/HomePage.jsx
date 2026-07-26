import TopBar from "../../components/home/TopBar/TopBar";
import Navbar from "../../components/home/Navbar/Navbar";
import HeroSection from "../../components/home/HeroSection/HeroSection";
import WhyChooseSection from "../../components/home/WhyChooseSection/WhyChooseSection";
import ConsultationSection from "../../components/home/ConsultationSection/ConsultationSection";
import Footer from "../../components/home/Footer/Footer";

function HomePage() {
  return (
    <>
      <TopBar />
      <Navbar />
      <main id="why-solar">
        <HeroSection />
        <WhyChooseSection />
        <ConsultationSection />
      </main>
      <Footer />
    </>
  );
}

export default HomePage;
