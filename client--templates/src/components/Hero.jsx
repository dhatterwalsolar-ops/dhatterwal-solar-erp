import "./Hero.css";
import hero from "../assets/hero-house.jpg";

function Hero() {
  return (
    <section className="hero">

      <div className="hero-left">

        <h5>POWERING YOUR FUTURE WITH CLEAN ENERGY</h5>

        <h1>
          DHATTERWAL <br />
          SOLAR ENERGY SYSTEM
        </h1>

        <p>
          High quality solar solutions for Home, Business and Industry.
          Save electricity bills with trusted solar installation.
        </p>

        <div className="hero-features">
          <span>✔ High Quality</span>
          <span>✔ Save Money</span>
          <span>✔ Clean Energy</span>
          <span>✔ 24/7 Support</span>
        </div>

        <div className="hero-buttons">
          <button className="quote-btn">
            GET A FREE QUOTE
          </button>

          <button className="service-btn">
            OUR SERVICES
          </button>
        </div>

      </div>

      <div className="hero-right">
        <img src={hero} alt="Solar House" />
      </div>

    </section>
  );
}

export default Hero;