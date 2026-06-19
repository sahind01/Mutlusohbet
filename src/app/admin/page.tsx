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
  deleteDoc
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
    type: 'banner' as 'banner' | 'popup' | 'script',
    position: 'top' as 'top' | 'bottom' | 'fixed',
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
          const usersData = usersSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              username: data.username || '',
              email: data.email || '',
              gender: data.gender || 'other',
              profilePhoto: data.profilePhoto || '/default-avatar.png',
              role: data.role || 'free',
              status: data.status || 'offline',
              dailyMatches: data.dailyMatches || 0,
              totalMatches: data.totalMatches || 0,
              reports: data.reports || [],
              matchHistory: data.matchHistory || [],
              createdAt: data.createdAt?.toDate() || new Date(),
              lastActive: data.lastActive?.toDate() || new Date(),
              premiumSince: data.premiumSince?.toDate(),
              premiumExpiry: data.premiumExpiry?.toDate(),
              bannedUntil: data.bannedUntil?.toDate(),
              banReason: data.banReason
            } as AppUser;
          });
          setUsers(usersData);
          break;

        case 'ads':
          const adsSnapshot = await getDocs(collection(db, 'advertisements'));
          const adsData = adsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || '',
              type: data.type || 'banner',
              position: data.position || 'top',
              imageUrl: data.imageUrl || '',
              gifUrl: data.gifUrl || '',
              targetUrl: data.targetUrl || '',
              scriptCode: data.scriptCode || '',
              isActive: data.isActive || false,
              impressions: data.impressions || 0,
              clicks: data.clicks || 0,
              startDate: data.startDate?.toDate() || new Date(),
              endDate: data.endDate?.toDate() || new Date(),
              createdBy: data.createdBy || '',
              customStyles: data.customStyles || {}
            } as Advertisement;
          });
          setAds(adsData);
          break;

        case 'stats':
          const statsSnapshot = await getDocs(
            query(collection(db, 'statistics'), orderBy('date', 'desc'), limit(30))
          );
          const statsData = statsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              dailyUsers: data.dailyUsers || 0,
              dailyMatches: data.dailyMatches || 0,
              premiumSales: data.premiumSales || 0,
              adImpressions: data.adImpressions || 0,
              adClicks: data.adClicks || 0,
              activeUsers: data.activeUsers || 0,
              date: data.date?.toDate() || new Date()
            } as Statistics;
          });
          setStats(statsData);
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
      const reason = prompt('Yasaklama sebebi:') || 'Kurallara uymama';
      await updateDoc(doc(db, 'users', userId), {
        status: 'banned',
        banReason: reason,
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
      const adData = {
        name: adForm.name,
        type: adForm.type,
        position: adForm.position,
        imageUrl: adForm.imageUrl,
        targetUrl: adForm.targetUrl,
        isActive: adForm.isActive,
        impressions: 0,
        clicks: 0,
        startDate: new Date(adForm.startDate),
        endDate: new Date(adForm.endDate),
        createdBy: user?.id || '',
        scriptCode: '',
        gifUrl: '',
        customStyles: {}
      };

      await addDoc(collection(db, 'advertisements'), adData);
      
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
      alert('Reklam başarıyla eklendi!');
    } catch (error) {
      console.error('Reklam ekleme hatası:', error);
      alert('Reklam eklenirken bir hata oluştu!');
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

  const handleMakePremium = async (userId: string) => {
    try {
      const days = prompt('Premium süresi (gün):', '30');
      if (!days) return;
      
      await updateDoc(doc(db, 'users', userId), {
        role: 'premium',
        premiumSince: new Date(),
        premiumExpiry: new Date(Date.now() + parseInt(days) * 24 * 60 * 60 * 1000)
      });
      loadData();
    } catch (error) {
      console.error('Premium yapma hatası:', error);
    }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-64 bg-gray-800 min-h-screen p-6">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
              Admin Panel
            </h1>
            <button
              onClick={() => router.push('/')}
              className="md:hidden text-gray-400 hover:text-white"
            >
              Ana Sayfa
            </button>
          </div>
          
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
        <div className="flex-1 p-4 md:p-8 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <>
              {/* Kullanıcı Yönetimi */}
              {activeTab === 'users' && (
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl md:text-3xl font-bold">Kullanıcı Yönetimi</h2>
                    <span className="text-gray-400">{users.length} kullanıcı</span>
                  </div>
                  
                  <div className="bg-gray-800 rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="py-4 px-4 text-left">Kullanıcı</th>
                          <th className="py-4 px-4 text-left">E-posta</th>
                          <th className="py-4 px-4 text-left">Durum</th>
                          <th className="py-4 px-4 text-left">Üyelik</th>
                          <th className="py-4 px-4 text-left">Eşleşme</th>
                          <th className="py-4 px-4 text-left">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-gray-400">
                              Henüz kullanıcı bulunmuyor
                            </td>
                          </tr>
                        ) : (
                          users.map((u) => (
                            <tr key={u.id} className="border-b border-gray-700 hover:bg-gray-750">
                              <td className="py-4 px-4">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                                    <span className="text-white font-bold text-sm">
                                      {u.username?.[0]?.toUpperCase() || '?'}
                                    </span>
                                  </div>
                                  <span className="text-sm md:text-base truncate max-w-[120px] md:max-w-none">
                                    {u.username}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-sm">{u.email}</td>
                              <td className="py-4 px-4">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  u.status === 'online' ? 'bg-green-600' :
                                  u.status === 'offline' ? 'bg-gray-600' :
                                  u.status === 'banned' ? 'bg-red-600' :
                                  'bg-blue-600'
                                }`}>
                                  {u.status}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  u.role === 'premium' ? 'bg-yellow-600' : 'bg-gray-600'
                                }`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-sm">{u.totalMatches || 0}</td>
                              <td className="py-4 px-4">
                                <div className="flex flex-wrap gap-2">
                                  {u.role !== 'premium' && (
                                    <button
                                      onClick={() => handleMakePremium(u.id)}
                                      className="bg-yellow-600 px-2 py-1 rounded-lg text-xs hover:bg-yellow-700 transition-colors"
                                    >
                                      Premium Yap
                                    </button>
                                  )}
                                  {u.status === 'banned' ? (
                                    <button
                                      onClick={() => handleUnbanUser(u.id)}
                                      className="bg-green-600 px-2 py-1 rounded-lg text-xs hover:bg-green-700 transition-colors"
                                    >
                                      Yasak Kaldır
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleBanUser(u.id)}
                                      className="bg-red-600 px-2 py-1 rounded-lg text-xs hover:bg-red-700 transition-colors"
                                    >
                                      Yasakla
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Reklam Yönetimi */}
              {activeTab === 'ads' && (
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-8">Reklam Yönetimi</h2>
                  
                  {/* Yeni Reklam Ekleme Formu */}
                  <div className="bg-gray-800 rounded-xl p-4 md:p-6 mb-8">
                    <h3 className="text-xl font-semibold mb-4">Yeni Reklam Ekle</h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Reklam Adı</label>
                        <input
                          type="text"
                          placeholder="Reklam Adı"
                          value={adForm.name}
                          onChange={(e) => setAdForm({ ...adForm, name: e.target.value })}
                          className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Reklam Türü</label>
                        <select
                          value={adForm.type}
                          onChange={(e) => setAdForm({ ...adForm, type: e.target.value as any })}
                          className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                        >
                          <option value="banner">Banner</option>
                          <option value="popup">Popup</option>
                          <option value="script">Script</option>
                        </select>
                      </div>
                      
                      {adForm.type !== 'script' && (
                        <>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Pozisyon</label>
                            <select
                              value={adForm.position}
                              onChange={(e) => setAdForm({ ...adForm, position: e.target.value as any })}
                              className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                            >
                              <option value="top">Üst</option>
                              <option value="bottom">Alt</option>
                              <option value="fixed">Sabit</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Görsel URL</label>
                            <input
                              type="text"
                              placeholder="https://..."
                              value={adForm.imageUrl}
                              onChange={(e) => setAdForm({ ...adForm, imageUrl: e.target.value })}
                              className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                            />
                          </div>
                        </>
                      )}
                      
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Hedef Link</label>
                        <input
                          type="text"
                          placeholder="https://..."
                          value={adForm.targetUrl}
                          onChange={(e) => setAdForm({ ...adForm, targetUrl: e.target.value })}
                          className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Başlangıç Tarihi</label>
                        <input
                          type="datetime-local"
                          value={adForm.startDate}
                          onChange={(e) => setAdForm({ ...adForm, startDate: e.target.value })}
                          className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Bitiş Tarihi</label>
                        <input
                          type="datetime-local"
                          value={adForm.endDate}
                          onChange={(e) => setAdForm({ ...adForm, endDate: e.target.value })}
                          className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                        />
                      </div>
                    </div>
                    
                    <button
                      onClick={handleAddAd}
                      disabled={!adForm.name || !adForm.startDate || !adForm.endDate}
                      className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50"
                    >
                      Reklam Ekle
                    </button>
                  </div>

                  {/* Mevcut Reklamlar */}
                  <div className="bg-gray-800 rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="py-4 px-4 text-left">Reklam</th>
                          <th className="py-4 px-4 text-left">Tür</th>
                          <th className="py-4 px-4 text-left">Gösterim</th>
                          <th className="py-4 px-4 text-left">Tıklama</th>
                          <th className="py-4 px-4 text-left">Tarih</th>
                          <th className="py-4 px-4 text-left">Durum</th>
                          <th className="py-4 px-4 text-left">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ads.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-gray-400">
                              Henüz reklam eklenmemiş
                            </td>
                          </tr>
                        ) : (
                          ads.map((ad) => (
                            <tr key={ad.id} className="border-b border-gray-700">
                              <td className="py-4 px-4 text-sm">{ad.name}</td>
                              <td className="py-4 px-4 text-sm">{ad.type}</td>
                              <td className="py-4 px-4 text-sm">{ad.impressions.toLocaleString()}</td>
                              <td className="py-4 px-4 text-sm">{ad.clicks.toLocaleString()}</td>
                              <td className="py-4 px-4 text-xs">
                                {ad.startDate.toLocaleDateString('tr-TR')} - {ad.endDate.toLocaleDateString('tr-TR')}
                              </td>
                              <td className="py-4 px-4">
                                <button
                                  onClick={() => handleToggleAdStatus(ad.id, ad.isActive)}
                                  className={`px-2 py-1 rounded-full text-xs ${
                                    ad.isActive ? 'bg-green-600' : 'bg-red-600'
                                  }`}
                                >
                                  {ad.isActive ? 'Aktif' : 'Pasif'}
                                </button>
                              </td>
                              <td className="py-4 px-4">
                                <button
                                  onClick={() => handleDeleteAd(ad.id)}
                                  className="bg-red-600 px-2 py-1 rounded-lg text-xs hover:bg-red-700 transition-colors"
                                >
                                  Sil
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* İstatistikler */}
              {activeTab === 'stats' && (
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-8">İstatistikler</h2>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
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

                  <div className="bg-gray-800 rounded-xl p-6 text-center text-gray-400">
                    <p className="text-2xl mb-2">📊</p>
                    <p>Detaylı istatistikler için veritabanına veri girişi yapılması gerekmektedir.</p>
                    <p className="mt-2 text-sm">Firebase Console'dan statistics koleksiyonuna veri ekleyebilirsiniz.</p>
                  </div>
                </div>
              )}

              {/* Şikayetler */}
              {activeTab === 'reports' && (
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-8">Şikayetler</h2>
                  <div className="bg-gray-800 rounded-xl p-6 text-center text-gray-400">
                    <p className="text-2xl mb-2">🚨</p>
                    <p>Henüz şikayet bulunmamaktadır.</p>
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
    <div className={`${color} rounded-xl p-4 md:p-6`}>
      <p className="text-sm md:text-lg opacity-90">{title}</p>
      <p className="text-2xl md:text-3xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}
