import Link from 'next/link'

const Footer: React.FC = () => {
  return (
    <footer className="home-footer">
      <div className="home-footer-surface">
        <div className="home-footer-brand">
          <span className="logo" />
          <span>ATLAS</span>
        </div>

        <nav className="home-footer-links">
          <Link href="/about">About Us</Link>
          <Link href="/contact">Contact Us</Link>
        </nav>

        <p className="home-footer-copy">© {new Date().getFullYear()} Atlas. All rights reserved.</p>
      </div>
    </footer>
  )
}

export default Footer
