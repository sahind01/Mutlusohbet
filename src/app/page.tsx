// src/app/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import Link from 'next/link';
import UserMenu from '@/components/UserMenu';

export default function HomePage() {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      {/* Header */}
      <header className="border-b border-gray-700">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
            Mutlu Sohbet
          </Link>

          {/* Mobil Menü Butonu */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Desktop Menü */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                <Link href="/chat" className="text-gray-300 hover:text-white transition-colors">
                  Sohbete Başla
                </Link>
                <UserMenu />
              </>
            ) : (
              <>
                <Link href="/auth/login" className="text-gray-300 hover:text-white transition-colors">
                  Giriş Yap
                </Link>
                <Link
                  href="/auth/register"
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
                >
                  Kayıt Ol
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobil Menü */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-gray-800 border-t border-gray-700 px-4 py-3">
            {user ? (
              <div className="space-y-2">
                <Link 
                  href="/chat" 
                  className="block text-gray-300 hover:text-white py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  💬 Sohbete Başla
                </Link>
                <Link 
                  href="/profile" 
                  className="block text-gray-300 hover:text-white py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  👤 Profilim
                </Link>
                {user.role === 'admin' && (
                  <Link 
                    href="/admin" 
                    className="block text-purple-400 hover:text-purple-300 py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    ⚙️ Admin Panel
                  </Link>
                )}
                <Link 
                  href="/settings" 
                  className="block text-gray-300 hover:text-white py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  ⚙️ Ayarlar
                </Link>
                <button 
                  onClick={() => {
                    useAuth().logout();
                    setMobileMenuOpen(false);
                  }}
                  className="block text-red-400 hover:text-red-300 py-2 w-full text-left"
                >
                  🚪 Çıkış Yap
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Link 
                  href="/auth/login" 
                  className="block text-gray-300 hover:text-white py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Giriş Yap
                </Link>
                <Link 
                  href="/auth/register" 
                  className="block text-purple-400 hover:text-purple-300 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Kayıt Ol
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Ana İçerik */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
            Mutlu Sohbet
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Dünyanın her yerinden insanlarla anında görüntülü sohbet et!
          </p>
          
          {user ? (
            <div className="space-y-4">
              <Link
                href="/chat"
                className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105"
              >
                Hemen Sohbete Başla
              </Link>
              
              <div className="mt-4 text-sm text-gray-400">
                {user.role === 'free' ? (
                  <p>Günlük {3 - (user.dailyMatches || 0)} eşleşme hakkınız kaldı</p>
                ) : (
                  <p className="text-yellow-400">🌟 Premium Üye - Sınırsız Eşleşme</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-x-4">
              <Link
                href="/auth/login"
                className="bg-white text-gray-900 px-8 py-4 rounded-full text-lg font-semibold hover:bg-gray-100 transition-all"
              >
                Giriş Yap
              </Link>
              <Link
                href="/auth/register"
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all"
              >
                Kayıt Ol
              </Link>
            </div>
          )}
        </div>

        {/* Özellikler */}
        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <FeatureCard icon="🎥" title="HD Görüntülü Sohbet" description="Kristal netliğinde görüntü kalitesiyle yüz yüze sohbet deneyimi" />
          <FeatureCard icon="🌍" title="Küresel Topluluk" description="Dünyanın dört bir yanından milyonlarca kullanıcıyla tanış" />
          <FeatureCard icon="⚡" title="Hızlı Eşleşme" description="Saniyeler içinde rastgele kullanıcılarla eşleş, hemen sohbete başla" />
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-gray-800 p-8 rounded-2xl hover:bg-gray-700 transition-colors">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}
