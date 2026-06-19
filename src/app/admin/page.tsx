// src/app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db, ref, get, set, update, remove, push, onValue } from '@/lib/firebase';
import UserMenu from '@/components/UserMenu';

type Tab = 'users' | 'ads' | 'stats' | 'reports';

interface AppUser {
  id: string;
  username: string;
  email: string;
  gender: string;
  profilePhoto: string;
  role: string;
  status: string;
  dailyMatches: number;
  totalMatches: number;
  premiumSince?: string;
  premiumExpiry?: string;
  bannedUntil?: string;
  banReason?: string;
}

interface AdData {
  id: string;
  name: string;
  type: string;
  position: string;
  imageUrl: string;
  targetUrl: string;
  isActive: boolean;
  impressions: number;
  clicks: number;
  startDate: string;
  endDate: string;
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [ads, setAds] = useState<AdData[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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
          const usersSnap = await get(ref(db, 'users'));
          if (usersSnap.exists()) {
            const data = usersSnap.val();
            const userList = Object.keys(data).map(key => ({
              id: key,
              ...data[key]
            }));
            setUsers(userList);
          } else {
            setUsers([]);
          }
          break;

        case 'ads':
          const adsSnap = await get(ref(db, 'advertisements'));
          if (adsSnap.exists()) {
            const data = adsSnap.val();
            const adList = Object.keys(data).map(key => ({
              id: key,
              ...data[key]
            }));
            setAds(adList);
          } else {
            setAds([]);
          }
          break;

        case 'stats':
          const statsSnap = await get(ref(db, 'statistics'));
          if (statsSnap.exists()) {
            const data = statsSnap.val();
            const statsList = Object.keys(data).map(key => ({
              id: key,
              ...data[key]
            }));
            setStats(statsList);
          } else {
            setStats([]);
          }
          break;
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (userId: string) => {
    const reason = prompt('Yasaklama sebebi:') || 'Kurallara uymama';
    await update(ref(db, `users/${userId}`), {
      status: 'banned',
      banReason: reason,
      bannedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
    loadData();
  };

  const handleUnbanUser = async (userId: string) => {
    await update(ref(db, `users/${userId}`), {
      status: 'offline',
      bannedUntil: null,
      banReason: null
    });
    loadData();
  };

  const handleMakePremium = async (userId: string) => {
    const days = prompt('Premium süresi (gün):', '30');
    if (!days) return;
    
    await update(ref(db, `users/${userId}`), {
      role: 'premium',
      premiumSince: new Date().toISOString(),
      premiumExpiry: new Date(Date.now() + parseInt(days) * 24 * 60 * 60 * 1000).toISOString()
    });
    loadData();
  };

  const handleAddAd = async () => {
    if (!adForm.name || !adForm.startDate || !adForm.endDate) {
      alert('Tüm alanları doldurun!');
      return;
    }

    const newAdRef = push(ref(db, 'advertisements'));
    await set(newAdRef, {
      name: adForm.name,
      type: adForm.type,
      position: adForm.position,
      imageUrl: adForm.imageUrl,
      targetUrl: adForm.targetUrl,
      isActive: adForm.isActive,
      impressions: 0,
      clicks: 0,
      startDate: new Date(adForm.startDate).toISOString(),
      endDate: new Date(adForm.endDate).toISOString(),
      createdBy: user?.id || ''
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
    alert('Reklam başarıyla eklendi!');
  };

  const handleDeleteAd = async (adId: string) => {
    if (confirm('Bu reklamı silmek istediğinizden emin misiniz?')) {
      await remove(ref(db, `advertisements/${adId}`));
      loadData();
    }
  };

  const handleToggleAdStatus = async (adId: string, currentStatus: boolean) => {
    await update(ref(db, `advertisements/${adId}`), {
      isActive: !currentStatus
    });
    loadData();
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (!user || user.role !== 'admin') return null;

  const menuItems = [
    { id: 'users', label: 'Kullanıcılar', icon: '👥' },
    { id: 'ads', label: 'Reklam Yönetimi', icon: '📢' },
    { id: 'stats', label: 'İstatistikler', icon: '📊' },
    { id: 'reports', label: 'Şikayetler', icon: '🚨' }
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Üst Bar */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-400 hover:text-white focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
              Admin Panel
            </h1>
          </div>

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center space-x-2 hover:bg-gray-700 rounded-lg px-3 py-2 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {user.username?.[0]?.toUpperCase() || 'A'}
                </span>
              </div>
              <span className="hidden md:block text-sm">{user.username}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-700">
                  <p className="text-sm font-semibold">{user.username}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                  <span className="inline-block mt-1 px-2 py-1 bg-yellow-600 text-xs rounded-full">Admin</span>
                </div>
                <button onClick={() => { router.push('/'); setUserMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700">🏠 Ana Sayfa</button>
                <button onClick={() => { router.push('/chat'); setUserMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700">💬 Sohbete Git</button>
                <hr className="border-gray-700 my-1" />
                <button onClick={() => { handleLogout(); setUserMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 text-red-400">🚪 Çıkış Yap</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Mobil Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed md:static inset-y-0 left-0 z-50
          w-64 bg-gray-800 min-h-screen p-6
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}>
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
              Admin Panel
            </h1>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <nav className="space-y-2">
            {menuItems.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as Tab); setSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === tab.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Ana İçerik */}
        <main className="flex-1 p-4 md:p-8 overflow-x-auto">
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
                          <th className="py-4 px-4 text-left">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.length === 0 ? (
                          <tr><td colSpan={5} className="py-8 text-center text-gray-400">Henüz kullanıcı bulunmuyor</td></tr>
                        ) : (
                          users.map((u) => (
                            <tr key={u.id} className="border-b border-gray-700 hover:bg-gray-750">
                              <td className="py-4 px-4">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
                                    <span className="text-white font-bold">{u.username?.[0]?.toUpperCase() || '?'}</span>
                                  </div>
                                  <span>{u.username}</span>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-sm">{u.email}</td>
                              <td className="py-4 px-4">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  u.status === 'online' ? 'bg-green-600' : u.status === 'banned' ? 'bg-red-600' : 'bg-gray-600'
                                }`}>{u.status}</span>
                              </td>
                              <td className="py-4 px-4">
                                <span className={`px-2 py-1 rounded-full text-xs ${u.role === 'premium' ? 'bg-yellow-600' : 'bg-gray-600'}`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex flex-wrap gap-2">
                                  {u.role !== 'premium' && (
                                    <button onClick={() => handleMakePremium(u.id)} className="bg-yellow-600 px-2 py-1 rounded-lg text-xs hover:bg-yellow-700">Premium Yap</button>
                                  )}
                                  {u.status === 'banned' ? (
                                    <button onClick={() => handleUnbanUser(u.id)} className="bg-green-600 px-2 py-1 rounded-lg text-xs hover:bg-green-700">Yasak Kaldır</button>
                                  ) : (
                                    <button onClick={() => handleBanUser(u.id)} className="bg-red-600 px-2 py-1 rounded-lg text-xs hover:bg-red-700">Yasakla</button>
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
                  
                  <div className="bg-gray-800 rounded-xl p-4 md:p-6 mb-8">
                    <h3 className="text-xl font-semibold mb-4">Yeni Reklam Ekle</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Reklam Adı</label>
                        <input type="text" value={adForm.name} onChange={(e) => setAdForm({...adForm, name: e.target.value})}
                          className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white" placeholder="Reklam adı" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Tür</label>
                        <select value={adForm.type} onChange={(e) => setAdForm({...adForm, type: e.target.value})}
                          className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white">
                          <option value="banner">Banner</option>
                          <option value="popup">Popup</option>
                          <option value="script">Script</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Pozisyon</label>
                        <select value={adForm.position} onChange={(e) => setAdForm({...adForm, position: e.target.value})}
                          className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white">
                          <option value="top">Üst</option>
                          <option value="bottom">Alt</option>
                          <option value="fixed">Sabit</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Görsel URL</label>
                        <input type="text" value={adForm.imageUrl} onChange={(e) => setAdForm({...adForm, imageUrl: e.target.value})}
                          className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white" placeholder="https://..." />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Hedef Link</label>
                        <input type="text" value={adForm.targetUrl} onChange={(e) => setAdForm({...adForm, targetUrl: e.target.value})}
                          className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white" placeholder="https://..." />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Başlangıç</label>
                        <input type="datetime-local" value={adForm.startDate} onChange={(e) => setAdForm({...adForm, startDate: e.target.value})}
                          className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Bitiş</label>
                        <input type="datetime-local" value={adForm.endDate} onChange={(e) => setAdForm({...adForm, endDate: e.target.value})}
                          className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white" />
                      </div>
                    </div>
                    <button onClick={handleAddAd}
                      className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all">
                      Reklam Ekle
                    </button>
                  </div>

                  <div className="bg-gray-800 rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="py-4 px-4 text-left">Reklam</th>
                          <th className="py-4 px-4 text-left">Tür</th>
                          <th className="py-4 px-4 text-left">Gösterim</th>
                          <th className="py-4 px-4 text-left">Tıklama</th>
                          <th className="py-4 px-4 text-left">Durum</th>
                          <th className="py-4 px-4 text-left">İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ads.length === 0 ? (
                          <tr><td colSpan={6} className="py-8 text-center text-gray-400">Henüz reklam eklenmemiş</td></tr>
                        ) : (
                          ads.map((ad) => (
                            <tr key={ad.id} className="border-b border-gray-700">
                              <td className="py-4 px-4 text-sm">{ad.name}</td>
                              <td className="py-4 px-4 text-sm">{ad.type}</td>
                              <td className="py-4 px-4 text-sm">{ad.impressions || 0}</td>
                              <td className="py-4 px-4 text-sm">{ad.clicks || 0}</td>
                              <td className="py-4 px-4">
                                <button onClick={() => handleToggleAdStatus(ad.id, ad.isActive)}
                                  className={`px-2 py-1 rounded-full text-xs ${ad.isActive ? 'bg-green-600' : 'bg-red-600'}`}>
                                  {ad.isActive ? 'Aktif' : 'Pasif'}
                                </button>
                              </td>
                              <td className="py-4 px-4">
                                <button onClick={() => handleDeleteAd(ad.id)}
                                  className="bg-red-600 px-2 py-1 rounded-lg text-xs hover:bg-red-700">Sil</button>
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
                  <div className="bg-gray-800 rounded-xl p-6 text-center text-gray-400">
                    <p className="text-2xl mb-2">📊</p>
                    <p>İstatistik verisi henüz bulunmamaktadır.</p>
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
        </main>
      </div>
    </div>
  );
}
