// src/app/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useAdvertisements } from '@/hooks/useAdvertisements';
import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  const { user } = useAuth();
  const { currentAd: topBannerAd, recordImpression: recordTopImpression } = useAdvertisements('top');
  const { currentAd: bottomBannerAd, recordImpression: recordBottomImpression } = useAdvertisements('bottom');
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      {/* Üst Banner Reklam */}
      {!user?.role || user?.role === 'free' ? (
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4">
          {topBannerAd ? (
            <div className="container mx-auto flex items-center justify-between">
              <a 
                href={topBannerAd.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => recordTopImpression(topBannerAd.id)}
                className="flex-1 text-center hover:opacity-90 transition-opacity"
              >
                {topBannerAd.imageUrl && (
                  <Image
                    src={topBannerAd.imageUrl}
                    alt={topBannerAd.name}
                    width={728}
                    height={90}
                    className="mx-auto rounded-lg"
                  />
                )}
              </a>
              <button className="ml-4 bg-yellow-400 text-black px-6 py-2 rounded-full font-bold hover:bg-yellow-300 transition-colors">
                Premium'a Geç - Reklamsız Deneyim
              </button>
            </div>
          ) : (
            <div className="text-center py-2">
              <span className="text-yellow-300">🌟 Premium üyelik ile reklamsız sohbet keyfi!</span>
            </div>
          )}
        </div>
      ) : null}

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
          <FeatureCard
            icon="🎥"
            title="HD Görüntülü Sohbet"
            description="Kristal netliğinde görüntü kalitesiyle yüz yüze sohbet deneyimi"
          />
          <FeatureCard
            icon="🌍"
            title="Küresel Topluluk"
            description="Dünyanın dört bir yanından milyonlarca kullanıcıyla tanış"
          />
          <FeatureCard
            icon="⚡"
            title="Hızlı Eşleşme"
            description="Saniyeler içinde rastgele kullanıcılarla eşleş, hemen sohbete başla"
          />
        </div>
      </div>

      {/* Premium Modal */}
      {showPremiumModal && (
        <PremiumModal onClose={() => setShowPremiumModal(false)} />
      )}

      {/* Alt Banner Reklam */}
      {(!user?.role || user?.role === 'free') && bottomBannerAd && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 p-4">
          <div className="container mx-auto flex items-center justify-between">
            <a
              href={bottomBannerAd.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => recordBottomImpression(bottomBannerAd.id)}
              className="flex-1"
            >
              {bottomBannerAd.imageUrl && (
                <Image
                  src={bottomBannerAd.imageUrl}
                  alt={bottomBannerAd.name}
                  width={728}
                  height={90}
                  className="mx-auto rounded-lg"
                />
              )}
            </a>
            <button className="ml-4 text-gray-400 hover:text-white">✕</button>
          </div>
        </div>
      )}
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

function PremiumModal({ onClose }: { onClose: () => void }) {
  const premiumPackages = [
    { name: 'Aylık', price: '49.99 TL', duration: '30 gün' },
    { name: '3 Aylık', price: '129.99 TL', duration: '90 gün', popular: true },
    { name: 'Yıllık', price: '399.99 TL', duration: '365 gün', bestValue: true }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-2xl p-8 max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Premium Üyelik</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          {premiumPackages.map((pkg, index) => (
            <div key={index} className={`bg-gray-700 p-6 rounded-xl text-center relative ${pkg.popular ? 'ring-2 ring-yellow-400' : ''} ${pkg.bestValue ? 'ring-2 ring-green-400' : ''}`}>
              {pkg.popular && (
                <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-black px-3 py-1 rounded-full text-sm">Popüler</span>
              )}
              {pkg.bestValue && (
                <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-green-400 text-black px-3 py-1 rounded-full text-sm">En Avantajlı</span>
              )}
              <h3 className="text-xl font-bold mb-2">{pkg.name}</h3>
              <p className="text-3xl font-bold text-purple-400 mb-2">{pkg.price}</p>
              <p className="text-gray-400 text-sm mb-4">{pkg.duration}</p>
              <button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all">
                Seç
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          <h3 className="text-xl font-semibold">Premium Avantajları:</h3>
          <ul className="space-y-2">
            <PremiumFeature text="Sınırsız eşleşme hakkı" />
            <PremiumFeature text="Reklamsız kullanım" />
            <PremiumFeature text="Premium rozet" />
            <PremiumFeature text="Öncelikli eşleşme" />
            <PremiumFeature text="HD görüntü kalitesi" />
          </ul>
        </div>
      </div>
    </div>
  );
}

function PremiumFeature({ text }: { text: string }) {
  return (
    <li className="flex items-center space-x-2">
      <span className="text-green-400">✓</span>
      <span>{text}</span>
    </li>
  );
}
