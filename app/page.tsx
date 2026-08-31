import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import About from "@/components/About";
import HowItWorks from "@/components/HowItWorks";
import Transparency from "@/components/Transparency";
import NoNewSystem from "@/components/NoNewSystem";
import RoiCalculator from "@/components/RoiCalculator";
import FiveInvoices from "@/components/FiveInvoices";
import Trust from "@/components/Trust";
import Faq from "@/components/Faq";
import FinalCta from "@/components/FinalCta";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <About />
        <HowItWorks />
        <Transparency />
        <NoNewSystem />
        <RoiCalculator />
        <FiveInvoices />
        <Trust />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
