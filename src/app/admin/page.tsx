// src/app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  updateDoc, 
  doc, 
  where, 
  orderBy, 
  limit,
  addDoc,
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import type { User as AppUser, Advertisement, Statistics } from '@/types';

type Tab = 'users' | 'ads' | 'stats' | 'reports';

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [stats, setStats] = useState<Statistics[]>([]);
  const [loading, setLoading] = useState(true);

  // Yeni Reklam Formu
  const [adForm, setAdForm] = useState({
    name: '',
    type: 'banner',
    position: 'top',
    imageUrl: '',
    targetUrl: '',
    startDate: '',
    endDate: '',
    isActive: true
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }
    loadData();
  }, [user, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'users':
          const usersSnapshot = await getDocs(collection(db, 'users'));
          setUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AppUser[]);
          break;
        case 'ads':
          const adsSnapshot = await getDocs(collection(db, 'advertisements'));
          setAds(adsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Advertisement[]);
          break;
        case 'stats':
          const statsSnapshot = await getDocs(
            query(collection(db, 'statistics'), orderBy('date', 'desc'), limit(30))
          );
          setStats(statsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Statistics[]);
          break;
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: 'banned',
        banReason: prompt('Yasaklama sebebi:') || 'Kurallara uymama',
        bannedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 gün
      });
      loadData();
    } catch (error) {
      console.error('Kullanıcı yasaklama hatası:', error);
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: 'offline',
        bannedUntil: null,
        banReason: null
      });
      loadData();
    } catch (error) {
      console.error('Yasak kaldırma hatası:', error);
    }
  };

  const handleAddAd = async () => {
    try {
      await addDoc(collection(db, 'advertisements'), {
        ...adForm,
        impressions: 0,
        clicks: 0,
        startDate: new Date(adForm.startDate),
        endDate: new Date(adForm.endDate),
        createdBy: user?.id
      });
      
      setAdForm({
        name: '',
        type: 'banner',
        position: 'top',
        imageUrl: '',
        targetUrl: '',
        startDate: '',
        endDate: '',
        isActive: true
      });
      
      loadData();
    } catch (error) {
      console.error('Reklam ekleme hatası:', error);
    }
  };

  const handleDeleteAd = async (adId: string) => {
    if (confirm('Bu reklamı silmek istediğinizden emin misiniz?')) {
      try {
        await deleteDoc(doc(db, 'advertisements', adId));
        loadData();
      } catch (error) {
        console.error('Reklam silme hatası:', error);
      }
    }
  };

  const handleToggleAdStatus = async (adId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'advertisements', adId), {
        isActive: !currentStatus
      });
      loadData();
    } catch (error) {
      console.error('Reklam durumu güncelleme hatası:', error);
    }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="flex">
        <div className="w-64 bg-gray-800 min-h-screen p-6">
          <h1 className="text-2xl font-bold mb-8 bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
            Admin Panel
          </h1>
          
          <nav className="space-y-2">
            {[
              { id: 'users', label: 'Kullanıcılar', icon: '👥' },
              { id: 'ads', label: 'Reklam Yönetimi', icon: '📢' },
              { id: 'stats', label: 'İstatistikler', icon: '📊' },
              { id: 'reports', label: 'Şikayetler', icon: '🚨' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-purple-600 text-white' 
                    : 'text-gray-400 hover:bg-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Ana İçerik */}
        <div className="flex-1 p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <>
              {/* Kullanıcı Yönetimi */}
              {activeTab === 'users' && (
                <div>
                  <h2 className="text-3xl font-bold mb-8">Kullanıcı Yönetimi</h2>
                  
                  <div className="bg-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="py-4 px-6 text-left">Kullanıcı</th>
                          <th className="py-4 px-6 text-left">E-posta</th>
                          <th className="py-4 px-6 text-left">Durum</th>
                          <th className="py-4 px-6 text-left">Üyelik</th>
                          <th className="py-4 px-6 text-left">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id} className="border-b border-gray-700 hover:bg-gray-750">
                            <td className="py-4 px-6">
                              <div className="flex items-center space-x-3">
                                <img
                                  src={u.profilePhoto}
                                  alt={u.username}
                                  className="w-10 h-10 rounded-full"
                                />
                                <span>{u.username}</span>
                              </div>
                            </td>
                            <td className="py-4 px-6">{u.email}</td>
                            <td className="py-4 px-6">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                u.status === 'online' ? 'bg-green-600' :
                                u.status === 'offline' ? 'bg-gray-600' :
                                u.status === 'banned' ? 'bg-red-600' :
                                'bg-blue-600'
                              }`}>
                                {u.status}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                u.role === 'premium' ? 'bg-yellow-600' : 'bg-gray-600'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="py-4 px-6 space-x-2">
                              {u.status === 'banned' ? (
                                <button
                                  onClick={() => handleUnbanUser(u.id)}
                                  className="bg-green-600 px-3 py-1 rounded-lg hover:bg-green-700 transition-colors"
                                >
                                  Yasak Kaldır
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleBanUser(u.id)}
                                  className="bg-red-600 px-3 py-1 rounded-lg hover:bg-red-700 transition-colors"
                                >
                                  Yasakla
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Reklam Yönetimi */}
              {activeTab === 'ads' && (
                <div>
                  <h2 className="text-3xl font-bold mb-8">Reklam Yönetimi</h2>
                  
                  {/* Yeni Reklam Ekleme Formu */}
                  <div className="bg-gray-800 rounded-xl p-6 mb-8">
                    <h3 className="text-xl font-semibold mb-4">Yeni Reklam Ekle</h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Reklam Adı"
                        value={adForm.name}
                        onChange={(e) => setAdForm({ ...adForm, name: e.target.value })}
                        className="bg-gray-700 rounded-lg px-4 py-2"
                      />
                      
                      <select
                        value={adForm.type}
                        onChange={(e) => setAdForm({ ...adForm, type: e.target.value })}
                        className="bg-gray-700 rounded-lg px-4 py-2"
                      >
                        <option value="banner">Banner</option>
                        <option value="popup">Popup</option>
                        <option value="script">Script</option>
                      </select>
                      
                      {adForm.type !== 'script' && (
                        <>
                          <select
                            value={adForm.position}
                            onChange={(e) => setAdForm({ ...adForm, position: e.target.value })}
                            className="bg-gray-700 rounded-lg px-4 py-2"
                          >
                            <option value="top">Üst</option>
                            <option value="bottom">Alt</option>
                            <option value="fixed">Sabit</option>
                          </select>
                          
                          <input
                            type="text"
                            placeholder="Görsel URL"
                            value={adForm.imageUrl}
                            onChange={(e) => setAdForm({ ...adForm, imageUrl: e.target.value })}
                            className="bg-gray-700 rounded-lg px-4 py-2"
                          />
                        </>
                      )}
                      
                      <input
                        type="text"
                        placeholder="Hedef Link"
                        value={adForm.targetUrl}
                        onChange={(e) => setAdForm({ ...adForm, targetUrl: e.target.value })}
                        className="bg-gray-700 rounded-lg px-4 py-2"
                      />
                      
                      <input
                        type="datetime-local"
                        value={adForm.startDate}
                        onChange={(e) => setAdForm({ ...adForm, startDate: e.target.value })}
                        className="bg-gray-700 rounded-lg px-4 py-2"
                      />
                      
                      <input
                        type="datetime-local"
                        value={adForm.endDate}
                        onChange={(e) => setAdForm({ ...adForm, endDate: e.target.value })}
                        className="bg-gray-700 rounded-lg px-4 py-2"
                      />
                    </div>
                    
                    <button
                      onClick={handleAddAd}
                      className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
                    >
                      Reklam Ekle
                    </button>
                  </div>

                  {/* Mevcut Reklamlar */}
                  <div className="bg-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="py-4 px-6 text-left">Reklam</th>
                          <th className="py-4 px-6 text-left">Tür</th>
                          <th className="py-4 px-6 text-left">Gösterim</th>
                          <th className="py-4 px-6 text-left">Tıklama</th>
                          <th className="py-4 px-6 text-left">Durum</th>
                          <th className="py-4 px-6 text-left">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ads.map((ad) => (
                          <tr key={ad.id} className="border-b border-gray-700">
                            <td className="py-4 px-6">{ad.name}</td>
                            <td className="py-4 px-6">{ad.type}</td>
                            <td className="py-4 px-6">{ad.impressions}</td>
                            <td className="py-4 px-6">{ad.clicks}</td>
                            <td className="py-4 px-6">
                              <button
                                onClick={() => handleToggleAdStatus(ad.id, ad.isActive)}
                                className={`px-2 py-1 rounded-full text-xs ${
                                  ad.isActive ? 'bg-green-600' : 'bg-red-600'
                                }`}
                              >
                                {ad.isActive ? 'Aktif' : 'Pasif'}
                              </button>
                            </td>
                            <td className="py-4 px-6">
                              <button
                                onClick={() => handleDeleteAd(ad.id)}
                                className="bg-red-600 px-3 py-1 rounded-lg hover:bg-red-700 transition-colors"
                              >
                                Sil
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* İstatistikler */}
              {activeTab === 'stats' && (
                <div>
                  <h2 className="text-3xl font-bold mb-8">İstatistikler</h2>
                  
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <StatCard
                      title="Günlük Kullanıcı"
                      value={stats[0]?.dailyUsers || 0}
                      color="bg-blue-600"
                    />
                    <StatCard
                      title="Günlük Eşleşme"
                      value={stats[0]?.dailyMatches || 0}
                      color="bg-purple-600"
                    />
                    <StatCard
                      title="Premium Satış"
                      value={stats[0]?.premiumSales || 0}
                      color="bg-yellow-600"
                    />
                    <StatCard
                      title="Reklam Gösterim"
                      value={stats[0]?.adImpressions || 0}
                      color="bg-green-600"
                    />
                    <StatCard
                      title="Reklam Tıklama"
                      value={stats[0]?.adClicks || 0}
                      color="bg-pink-600"
                    />
                    <StatCard
                      title="Aktif Kullanıcı"
                      value={stats[0]?.activeUsers || 0}
                      color="bg-indigo-600"
                    />
                  </div>

                  {/* İstatistik Tablosu */}
                  <div className="bg-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="py-4 px-6 text-left">Tarih</th>
                          <th className="py-4 px-6 text-left">Kullanıcı</th>
                          <th className="py-4 px-6 text-left">Eşleşme</th>
                          <th className="py-4 px-6 text-left">Premium</th>
                          <th className="py-4 px-6 text-left">Reklam Gösterim</th>
                          <th className="py-4 px-6 text-left">Reklam Tıklama</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.map((stat) => (
                          <tr key={stat.id} className="border-b border-gray-700">
                            <td className="py-4 px-6">{new Date(stat.date).toLocaleDateString('tr-TR')}</td>
                            <td className="py-4 px-6">{stat.dailyUsers}</td>
                            <td className="py-4 px-6">{stat.dailyMatches}</td>
                            <td className="py-4 px-6">{stat.premiumSales}</td>
                            <td className="py-4 px-6">{stat.adImpressions}</td>
                            <td className="py-4 px-6">{stat.adClicks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div className={`${color} rounded-xl p-6`}>
      <p className="text-lg opacity-90">{title}</p>
      <p className="text-3xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}
