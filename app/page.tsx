'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [ticketCount, setTicketCount] = useState(0);
  const [adsToday, setAdsToday] = useState(0);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [winningNumbers, setWinningNumbers] = useState<number[]>([]);
  const [currentRound, setCurrentRound] = useState<number | null>(null);

  // 데이터 및 세션 초기화
  const clearAllData = useCallback(() => {
    setUser(null);
    setTicketCount(0);
    setAdsToday(0);
    setHistory([]);
    setSelectedNumbers([]);
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach(key => {
        if (key.includes('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
    }
  }, []);

  const fetchGlobalData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('winning_numbers')
        .select('*')
        .not('round', 'is', null) // [추가] round가 NULL이 아닌 것만 가져오기
        .order('draw_date', { ascending: false }) // 날짜순으로 정렬
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setWinningNumbers(data.numbers.map((n: any) => Number(n)));
        setCurrentRound(Number(data.round));
        return Number(data.round);
      }
    } catch (e) {
      console.error("데이터 로드 에러:", e);
    }
    return null;
  }, []);
  // 유저 정보 로드
  const fetchUserData = useCallback(async (userId: string) => {
    try {
      const { data: balance } = await supabase.from('user_balances').select('*').eq('id', userId).maybeSingle();
      if (balance) {
        setTicketCount(balance.ticket_count);
        setAdsToday(balance.ads_watched_today);
      }
      const { data: draws } = await supabase.from('lucky_draws').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (draws) setHistory(draws);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const initApp = async () => {
      await fetchGlobalData();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchUserData(session.user.id);
      }
      setIsInitialLoading(false);
    };
    initApp();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
        await fetchUserData(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        clearAllData();
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchGlobalData, fetchUserData, clearAllData]);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    clearAllData();
    setLoading(false);
    window.location.href = '/';
  };

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);

    let targetRound = currentRound;
    if (!targetRound) targetRound = await fetchGlobalData();

    if (!targetRound) {
      alert('회차 정보를 불러오지 못했습니다.');
      setLoading(false);
      return;
    }

    if (!user || ticketCount <= 0 || selectedNumbers.length !== 5) {
      alert('응모 조건을 확인해주세요.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('lucky_draws').insert({
      user_id: user.id,
      selected_numbers: selectedNumbers,
      round: targetRound
    });

    if (!error) {
      await supabase.from('user_balances').update({ ticket_count: ticketCount - 1 }).eq('id', user.id);
      alert('응모 완료!');
      setSelectedNumbers([]);
      await fetchUserData(user.id);
    }
    setLoading(false);
  };

  const handleWatchAd = async () => {
    if (!user) return;
    setLoading(true);
    const { data }: any = await supabase.rpc('reward_ad_tickets', { target_user_id: user.id });
    if (data?.success) {
      alert(data.message);
      await fetchUserData(user.id);
    }
    setLoading(false);
  };

  const toggleNumber = (n: number) => {
    if (selectedNumbers.includes(n)) {
      setSelectedNumbers(selectedNumbers.filter(num => num !== n));
    } else if (selectedNumbers.length < 5) {
      setSelectedNumbers([...selectedNumbers, n].sort((a, b) => a - b));
    }
  };

  const handleAutoSelect = () => {
    const res: number[] = [];
    while (res.length < 5) {
      const r = Math.floor(Math.random() * 28) + 1;
      if (!res.includes(r)) res.push(r);
    }
    // .sort() 에러 방지를 위해 새 배열 생성 후 정렬
    setSelectedNumbers([...res].sort((a, b) => a - b));
  };

  if (isInitialLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-yellow-500 font-black animate-pulse uppercase italic">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 font-sans pb-10">
      <div className="max-w-md mx-auto space-y-6">
        <header className="flex justify-between items-center py-2">
          <h1 className="text-xl font-black text-yellow-500 italic uppercase">Lucky 5/28</h1>
          {!user ? (
            <button onClick={handleLogin} className="px-4 py-2 bg-white text-black text-xs font-bold rounded-full">LOGIN</button>
          ) : (
            <button onClick={handleLogout} className="text-xs text-slate-500 font-bold underline px-3 py-2">{loading ? 'WAIT...' : 'LOGOUT'}</button>
          )}
        </header>

        <section className="bg-slate-900 p-6 rounded-[2rem] border border-yellow-500/20">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-black text-yellow-500 uppercase">Winning Numbers</h3>
            <span className="text-[9px] text-slate-500 font-mono italic">ROUND {currentRound || '??'}</span>
          </div>
          <div className="flex justify-center gap-3">
            {winningNumbers.map((num, idx) => (
              <div key={idx} className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-black flex items-center justify-center font-black text-sm shadow-lg">
                {num}
              </div>
            ))}
          </div>
        </section>

        {user && (
          <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 flex justify-between items-center">
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase mb-1">My Tickets</p>
              <h2 className="text-4xl font-black text-yellow-500 italic tracking-tighter">{ticketCount} EA</h2>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Today Ads</p>
              <p className="text-lg font-bold text-slate-300">{adsToday} / 20</p>
            </div>
          </div>
        )}

        <button onClick={handleWatchAd} disabled={loading || !user || adsToday >= 20} className="w-full py-4 bg-yellow-500 text-black rounded-2xl font-black text-sm disabled:bg-slate-800">
          WATCH AD (+5 TICKETS)
        </button>

        <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/50">Pick 5 Numbers</h3>
            <button onClick={handleAutoSelect} className="text-[10px] font-black text-yellow-500 underline uppercase">Auto Select</button>
          </div>
          <div className="grid grid-cols-7 gap-2 mb-8">
            {Array.from({ length: 28 }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => toggleNumber(n)} className={`aspect-square rounded-xl text-xs font-black transition-all ${selectedNumbers.includes(n) ? 'bg-yellow-500 text-black' : 'bg-slate-950 text-slate-600 border border-slate-800'}`}>
                {n}
              </button>
            ))}
          </div>
          <button onClick={handleSubmit} disabled={loading || selectedNumbers.length !== 5 || ticketCount <= 0} className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black uppercase tracking-widest disabled:bg-slate-800">
            {loading ? 'Processing...' : (ticketCount <= 0 ? 'Need Tickets' : 'Submit Entry')}
          </button>
        </section>
      </div>
    </div>
  );
}