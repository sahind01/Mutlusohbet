// src/app/auth/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData.email, formData.password);
      router.push('/chat');
    } catch (err: any) {
      console.error('Giriş hatası:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-posta veya şifre hatalı');
      } else if (err.code === 'auth/invalid-email') {
        setError('Geçersiz e-posta adresi');
      } else {
        setError(err.message || 'Giriş yaparken bir hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 px-4">
      <div className="max-w-md w-full bg-gray-800 rounded-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
            Mutlu Sohbet
          </h1>
          <p className="text-gray-400 mt-2">Hesabınıza giriş yapın</p>
        </div>

        {error && (
          <div className="bg-red-600 bg-opacity-20 border border-red-600 text-red-400 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">E-posta</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              placeholder="ornek@email.com"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Şifre</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50"
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-400">
          Hesabınız yok mu?{' '}
          <Link href="/auth/register" className="text-purple-400 hover:text-purple-300">
            Kayıt Ol
          </Link>
        </p>
      </div>
    </div>
  );
}
