function Navbar() {
  return (
    <nav className="navbar">
      <div className="container navbar-container">

        <div className="logo">
          <h2>DHATTERWAL</h2>
          <span>SOLAR ENERGY SYSTEM</span>
        </div>

        <ul className="menu">
          <li>Home</li>
          <li>About Us</li>
          <li>Our Services</li>
          <li>Products</li>
          <li>Projects</li>
          <li>Contact Us</li>
        </ul>

        <div className="nav-buttons">
          <button className="quote-btn">Get A Quote</button>
          <button className="login-btn">Login</button>
        </div>

      </div>
    </nav>
  );
}

export default Navbar;