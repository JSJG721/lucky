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

  // 1. [보안/로그아웃] 모든 세션 및 로컬 데이터 강제 소거
  const forceLogoutAndClear = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("SignOut error:", e);
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        setUser(null);
        setTicketCount(0);
        setAdsToday(0);
        setHistory([]);
        // 토큰 찌꺼기 제거를 위해 페이지 루트로 강제 리다이렉트
        window.location.href = window.location.origin;
      }
    }
  }, []);

  // 2. [데이터] 최신 당첨 회차 정보 로드 (NULL 데이터 방어)
  const fetchGlobalData = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('winning_numbers')
        .select('*')
        .not('round', 'is', null)
        .order('draw_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) {
        const nums = Array.isArray(data.numbers) ? data.numbers.map((n: any) => Number(n)) : [];
        setWinningNumbers(nums);
        setCurrentRound(Number(data.round));
        return Number(data.round);
      }
    } catch (e) {
      console.error("Global data fetch error:", e);
    }
    return null;
  }, []);

  // 3. [데이터] 유저별 티켓/광고/응모내역 로드
  const fetchUserData = useCallback(async (userId: string) => {
    try {
      const { data: balance } = await supabase.from('user_balances').select('*').eq('id', userId).maybeSingle();
      if (balance) {
        setTicketCount(balance.ticket_count);
        setAdsToday(balance.ads_watched_today);
      }
      const { data: draws } = await supabase
        .from('lucky_draws')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (draws) setHistory(draws);
    } catch (e) {
      console.error("User data fetch error:", e);
    }
  }, []);

  // 4. [초기화] 앱 시작 시 세션 체크 및 데이터 바인딩
  useEffect(() => {
    const initApp = async () => {
      await fetchGlobalData();
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        await forceLogoutAndClear();
        return;
      }

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
        forceLogoutAndClear();
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchGlobalData, fetchUserData, forceLogoutAndClear]);

  // 5. [로직] 하이라이트 판별 (숫자 일치 + 회차 일치 필수)
  const isCorrectWinningNum = (num: number, itemRound: number) => {
    if (!currentRound || itemRound !== currentRound) return false;
    return winningNumbers.includes(num);
  };

  // 6. [이벤트] 핸들러 함수들
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const handleSubmit = async () => {
    if (loading || !user || selectedNumbers.length !== 5) return;
    setLoading(true);
    
    const latestRound = await fetchGlobalData();
    if (!latestRound) {
      alert('회차 정보를 불러오지 못했습니다.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('lucky_draws').insert({
      user_id: user.id,
      selected_numbers: selectedNumbers,
      round: latestRound
    });

    if (!error) {
      await supabase.from('user_balances').update({ ticket_count: ticketCount - 1 }).eq('id', user.id);
      alert(`${latestRound}회차 응모 완료!`);
      setSelectedNumbers([]);
      await fetchUserData(user.id);
    }
    setLoading(false);
  };

  const handleWatchAd = async () => {
    if (!user || loading) return;
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

  if (isInitialLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-yellow-500 font-black animate-pulse">
      LOADING...
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 font-sans pb-10">
      <div className="max-w-md mx-auto space-y-6">
        <header className="flex justify-between items-center py-2">
          <h1 className="text-xl font-black text-yellow-500 italic uppercase tracking-tighter">Lucky 5/28</h1>
          {!user ? (
            <button onClick={handleLogin} className="px-4 py-2 bg-white text-black text-xs font-bold rounded-full">LOGIN</button>
          ) : (
            <button onClick={forceLogoutAndClear} className="text-xs text-slate-500 font-bold underline px-3 py-2">LOGOUT</button>
          )}
        </header>

        {/* 당첨 번호 섹션 */}
        <section className="bg-slate-900 p-6 rounded-[2rem] border border-yellow-500/20 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Winning Numbers</h3>
            <span className="text-[9px] text-slate-500 font-mono italic">ROUND {currentRound ?? '??'}</span>
          </div>
          <div className="flex justify-center gap-3">
            {winningNumbers.length > 0 ? winningNumbers.map((num, idx) => (
              <div key={idx} className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-black flex items-center justify-center font-black text-sm shadow-lg border border-yellow-300/50">{num}</div>
            )) : <div className="text-slate-600 text-xs py-2">대기 중...</div>}
          </div>
        </section>

        {user && (
          <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 flex justify-between items-center shadow-lg">
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

        <button 
          onClick={handleWatchAd} 
          disabled={loading || !user || adsToday >= 20} 
          className="w-full py-4 bg-yellow-500 text-black rounded-2xl font-black text-sm disabled:bg-slate-800 shadow-lg active:scale-95 transition-transform"
        >
          {loading ? 'WAIT...' : 'WATCH AD (+5 TICKETS)'}
        </button>

        {/* 번호 선택 섹션 */}
        <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-inner">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black uppercase text-white/50">Pick 5 Numbers</h3>
            <button onClick={() => {
              const res: number[] = []; 
              while(res.length < 5) { 
                const r = Math.floor(Math.random() * 28) + 1; 
                if(!res.includes(r)) res.push(r); 
              }
              setSelectedNumbers([...res].sort((a,b)=>a-b));
            }} className="text-[10px] font-black text-yellow-500 underline uppercase">Auto Select</button>
          </div>
          <div className="grid grid-cols-7 gap-2 mb-8">
            {Array.from({ length: 28 }, (_, i) => i + 1).map(n => (
              <button 
                key={n} 
                onClick={() => toggleNumber(n)} 
                className={`aspect-square rounded-xl text-xs font-black transition-all ${
                  selectedNumbers.includes(n) 
                  ? 'bg-yellow-500 text-black scale-110 shadow-md' 
                  : 'bg-slate-950 text-slate-600 border border-slate-800 hover:border-slate-600'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <button 
            onClick={handleSubmit} 
            disabled={loading || selectedNumbers.length !== 5 || ticketCount <= 0} 
            className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black uppercase tracking-widest disabled:bg-slate-800 disabled:text-slate-500 shadow-xl active:scale-[0.98] transition-all"
          >
            {loading ? 'Processing...' : (ticketCount <= 0 ? 'Need Tickets' : 'Submit Entry')}
          </button>
        </section>

        {/* 히스토리 섹션 */}
        {user && history.length > 0 && (
          <section className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6">My History</h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {history.map((h, i) => (
                <div key={i} className="p-4 bg-slate-950 rounded-3xl border border-slate-800 flex justify-between items-center transition-all">
                  <div className="flex gap-2">
                    {h.selected_numbers.map((num: number, idx: number) => (
                      <span 
                        key={idx} 
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black border transition-colors ${
                          isCorrectWinningNum(num, h.round) 
                          ? 'bg-yellow-500 border-yellow-500 text-black shadow-lg' 
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                        }`}
                      >
                        {num}
                      </span>
                    ))}
                  </div>
                  <div className="text-right">
                    <div className={`text-[8px] font-mono mb-1 uppercase ${h.round === currentRound ? 'text-yellow-500 font-bold' : 'text-slate-600'}`}>
                      Round {h.round}
                    </div>
                    <div className="text-[8px] text-slate-700 font-mono italic">
                      {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}