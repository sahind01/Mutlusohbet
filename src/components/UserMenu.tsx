// src/components/UserMenu.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/');
    setIsOpen(false);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 hover:bg-gray-700 rounded-lg px-3 py-2 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">
            {user.username?.[0]?.toUpperCase() || '?'}
          </span>
        </div>
        <span className="hidden md:block text-sm text-white">{user.username}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2 z-50">
          {/* Kullanıcı Bilgisi */}
          <div className="px-4 py-3 border-b border-gray-700">
            <p className="text-sm font-semibold text-white">{user.username}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
            <div className="flex items-center space-x-2 mt-2">
              <span className={`px-2 py-1 text-xs rounded-full ${
                user.role === 'premium' ? 'bg-yellow-600' : 
                user.role === 'admin' ? 'bg-purple-600' : 'bg-gray-600'
              }`}>
                {user.role === 'premium' ? '🌟 Premium' : 
                 user.role === 'admin' ? '👑 Admin' : 'Ücretsiz'}
              </span>
              <span className={`px-2 py-1 text-xs rounded-full ${
                user.status === 'online' ? 'bg-green-600' : 'bg-gray-600'
              }`}>
                {user.status === 'online' ? 'Çevrimiçi' : 'Çevrimdışı'}
              </span>
            </div>
          </div>

          {/* Menü Öğeleri */}
          <button
            onClick={() => {
              router.push('/chat');
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center space-x-3"
          >
            <span>💬</span>
            <span>Sohbete Başla</span>
          </button>

          <button
            onClick={() => {
              router.push('/profile');
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center space-x-3"
          >
            <span>👤</span>
            <span>Profilim</span>
          </button>

          {user.role === 'free' && (
            <button
              onClick={() => {
                router.push('/premium');
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-yellow-400 hover:bg-gray-700 transition-colors flex items-center space-x-3"
            >
              <span>⭐</span>
              <span>Premium'a Geç</span>
            </button>
          )}

          {user.role === 'admin' && (
            <button
              onClick={() => {
                router.push('/admin');
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-purple-400 hover:bg-gray-700 transition-colors flex items-center space-x-3"
            >
              <span>⚙️</span>
              <span>Admin Panel</span>
            </button>
          )}

          <hr className="border-gray-700 my-1" />

          <button
            onClick={() => {
              router.push('/settings');
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center space-x-3"
          >
            <span>⚙️</span>
            <span>Ayarlar</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-gray-700 transition-colors flex items-center space-x-3"
          >
            <span>🚪</span>
            <span>Çıkış Yap</span>
          </button>
        </div>
      )}
    </div>
  );
}
