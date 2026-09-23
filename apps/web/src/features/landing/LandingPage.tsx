import { motion, useScroll, useSpring } from 'motion/react';
import { Benefits } from './components/Benefits/Benefits';
import { Cta } from './components/Cta/Cta';
import { Features } from './components/Features/Features';
import { Footer } from './components/Footer/Footer';
import { Hero } from './components/Hero/Hero';
import { Ticker } from './components/Hero/Ticker';
import { Info } from './components/Info/Info';
import { Manifesto } from './components/Manifesto/Manifesto';
import { Navbar } from './components/Navbar/Navbar';
import { Pricing } from './components/Pricing/Pricing';
import { Showcase } from './components/Showcase/Showcase';
import { SportsGrid } from './components/Sports/SportsGrid';
import { Stats } from './components/Stats/Stats';
import { useDocumentTitle } from './hooks/useDocumentTitle';
import { useSmoothScroll } from './hooks/useSmoothScroll';
import './landing.css';

/** Composes all landing sections in display order. */
export function LandingPage() {
  useSmoothScroll();
  useDocumentTitle('Sports Center — Sân & phòng tập 10 bộ môn');

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });

  return (
    <div className="lp">
      <motion.div className="lp-progress" style={{ scaleX: progress }} />
      <Navbar />

      <main>
        <div className="lp-pin">
          <Hero />
        </div>
        <div className="lp-after">
          <Ticker />
          <Stats />
          <Manifesto />
          <SportsGrid />
          <Showcase />
          <Features />
          <Benefits />
          <Pricing />
          <Info />
          <Cta />
        </div>
      </main>

      <Footer />
    </div>
  );
}
