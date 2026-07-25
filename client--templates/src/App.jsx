import "./App.css";

import Header from "./components/Header";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Services from "./components/ServicesBar";
import About from "./components/About";

function App() {
  return (
    <>
      <Header />
      <Navbar />
      <Hero />
      <Services />
      <About />
    </>
  );
}

export default App;