import { Link } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <img src="/logo.png" alt="ShopHub" className="h-12 w-auto object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span className="text-white text-lg font-bold">
              Shop<span className="text-orange-400">Hub</span>
            </span>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            Your one-stop destination for quality products at the best prices.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-white font-semibold mb-3">Quick Links</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/products" className="hover:text-orange-400 transition-colors">All Products</Link></li>
            <li><Link to="/cart" className="hover:text-orange-400 transition-colors">Cart</Link></li>
            <li><Link to="/login" className="hover:text-orange-400 transition-colors">Login</Link></li>
            <li><Link to="/signup" className="hover:text-orange-400 transition-colors">Sign Up</Link></li>
          </ul>
        </div>

        {/* Seller */}
        <div>
          <h4 className="text-white font-semibold mb-3">Sell With Us</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/signup?role=seller" className="hover:text-orange-400 transition-colors">Become a Seller</Link></li>
            <li><Link to="/seller/products" className="hover:text-orange-400 transition-colors">Seller Dashboard</Link></li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-white font-semibold mb-3">Contact</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Mail size={14} className="text-orange-400" />
              hardikbandhiya2004@gmail.com
            </li>
            <li className="flex items-center gap-2">
              <Phone size={14} className="text-orange-400" />
              +91 95103 33096
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-800 py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} ShopHub. All rights reserved.
      </div>
    </footer>
  );
}
