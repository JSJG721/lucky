'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';

export default function Home() {
  // --- [상태 관리] ---
  const [user, setUser] = useState<any>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [ticketCount, setTicketCount] = useState(0);
  const [adsToday, setAdsToday] = useState(0);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [winningNumbers, setWinningNumbers] = useState<number[]>([]);
  const [currentRound, setCurrentRound] = useState<number | null>(null);

  // --- [데이터 로드 함수들] ---
  const fetchGlobalData = useCallback(async () => {
    try {
      const { data: wins, error } = await supabase
        .from('winning_numbers')
        .select('round, numbers')
        .order('round', { ascending: false })
        .limit(1);
      
      if (error) throw error;

      if (wins && wins.length > 0) {
        setWinningNumbers(wins[0].numbers.map((n: any) => Number(n)));
        setCurrentRound(Number(wins[0].round)); // 확실하게 숫자로 형변환
        return Number(wins[0].round);
      }
      return null;
    } catch (e) {
      console.error("Global data fetch error", e);
      return null;
    }
  }, []);

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      const { data: balance } = await supabase
        .from('user_balances')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (balance) {
        setTicketCount(balance.ticket_count);
        setAdsToday(balance.ads_watched_today);
      }

      const { data: userDraws } = await supabase
        .from('lucky_draws')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (userDraws) setHistory(userDraws);
    } catch (e) {
      console.error("User data fetch error", e);
    }
  }, []);

  // --- [초기화 효과] ---
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // 1. 전역 데이터(회차 정보)부터 가져오기
        await fetchGlobalData();
        
        // 2. 로그인 세션이 있으면 유저 정보 가져오기
        if (session?.user) {
          setUser(session.user);
          await fetchUserData(session.user.id);
        }
      } catch (error) {
        console.error("Init error:", error);
      } finally {
        setTimeout(() => setIsInitialLoading(false), 600);
      }
    };

    init();
  
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        await fetchUserData(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setTicketCount(0);
        setHistory([]);
        setAdsToday(0);
      }
    });
  
    return () => subscription.unsubscribe();
  }, [fetchGlobalData, fetchUserData]);

  // --- [액션 핸들러] ---
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      setUser(null);
      setTicketCount(0);
      setAdsToday(0);
      setHistory([]);
      setLoading(false);
    }
  };

  const handleWatchAd = async () => {
    if (!user) return alert('로그인이 필요합니다.');
    setLoading(true);
    const { data }: any = await supabase.rpc('reward_ad_tickets', { 
      target_user_id: user.id 
    });

    if (data?.success) {
      alert(data.message);
      await fetchUserData(user.id);
    } else {
      alert(data?.message || '보상 지급 실패');
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    // [강화된 부분] 응모 시점에 회차 정보가 없으면 다시 한번 즉시 호출
    let activeRound = currentRound;
    if (!activeRound) {
      activeRound = await fetchGlobalData();
    }

    if (!activeRound) {
      alert('회차 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      setLoading(false);
      return;
    }

    if (!user || ticketCount <= 0 || selectedNumbers.length !== 5) {
      alert('번호 5개를 선택하고 티켓이 있는지 확인해주세요.');
      setLoading(false);
      return;
    }
    
    const { error: drawError } = await supabase.from('lucky_draws').insert({ 
      user_id: user.id, 
      selected_numbers: selectedNumbers,
      round: activeRound
    });

    if (!drawError) {
      await supabase.from('user_balances').update({ 
        ticket_count: ticketCount - 1 
      }).eq('id', user.id);
      
      alert('응모가 완료되었습니다!');
      setSelectedNumbers([]);
      await fetchUserData(user.id);
    } else {
      alert('응모 처리 중 오류가 발생했습니다.');
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
    const randomNums: number[] = [];
    while (randomNums.length < 5) {
      const n = Math.floor(Math.random() * 28) + 1;
      if (!randomNums.includes(n)) randomNums.push(n);
    }
    setSelectedNumbers(randomNums.sort((a, b) => a - b));
  };

  const checkIsWinning = (entryRound: number | null, num: number) => {
    if (!winningNumbers || !currentRound || !entryRound) return false;
    return Number(entryRound) === Number(currentRound) && winningNumbers.includes(num);
  };

  // --- [UI 렌더링] ---
  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 font-sans">
        <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-yellow-500 font-black italic animate-pulse tracking-widest">CONNECTING...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 font-sans pb-10">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* 헤더 */}
        <header className="flex justify-between items-center py-2">
          <h1 className="text-xl font-black text-yellow-500 italic uppercase tracking-tighter">Lucky 5/28</h1>
          {!user ? (
            <button onClick={handleLogin} className="px-4 py-2 bg-white text-black text-xs font-bold rounded-full">LOGIN</button>
          ) : (
            <button onClick={handleLogout} className="text-xs text-slate-500 font-bold underline px-3 py-2">{loading ? 'WAIT...' : 'LOGOUT'}</button>
          )}
        </header>

        {/* 당첨 번호 */}
        <section className="bg-slate-900 p-6 rounded-[2rem] border border-yellow-500/20 shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-center mb-4 relative z-10">
            <h3 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Winning Numbers</h3>
            <span className="text-[9px] text-slate-500 font-mono italic">ROUND {currentRound || '??'}</span>
          </div>
          <div className="flex justify-center gap-3 relative z-10">
            {winningNumbers.map((num, idx) => (
              <div key={idx} className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-black flex items-center justify-center font-black text-sm shadow-lg">
                {num}
              </div>
            ))}
          </div>
        </section>

        {/* 내 정보 */}
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

        {/* 광고 버튼 */}
        <button 
          onClick={handleWatchAd}
          disabled={loading || !user || adsToday >= 20}
          className="w-full py-4 bg-yellow-500 text-black rounded-2xl font-black text-sm disabled:bg-slate-800 disabled:text-slate-600 shadow-lg active:scale-95 transition-all"
        >
          {adsToday >= 20 ? 'DAILY LIMIT REACHED' : 'WATCH AD (+5 TICKETS)'}
        </button>

        {/* 번호 선택 */}
        <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/50">Pick 5 Numbers</h3>
            <button onClick={handleAutoSelect} className="text-[10px] font-black text-yellow-500 underline uppercase">Auto Select</button>
          </div>
          <div className="grid grid-cols-7 gap-2 mb-8">
            {Array.from({ length: 28 }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => toggleNumber(n)}
                className={`aspect-square rounded-xl text-xs font-black transition-all ${selectedNumbers.includes(n) ? 'bg-yellow-500 text-black scale-110 shadow-lg' : 'bg-slate-950 text-slate-600 border border-slate-800'}`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedNumbers.length !== 5 || ticketCount <= 0}
            className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black uppercase tracking-widest disabled:bg-slate-800 disabled:text-slate-600 active:scale-95 transition-all"
          >
            {ticketCount <= 0 ? 'Need Tickets' : 'Submit Entry'}
          </button>
        </section>

        {/* 응모 기록 */}
        <section className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6">History</h3>
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
            {history.length > 0 ? (
              history.map((h, i) => (
                <div key={i} className="p-4 bg-slate-950 rounded-3xl border border-slate-800 flex justify-between items-center">
                  <div className="flex gap-2">
                    {h.selected_numbers.map((num: number, idx: number) => (
                      <span 
                        key={idx} 
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black border transition-all ${
                          checkIsWinning(h.round, num) 
                            ? 'bg-yellow-500 border-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.4)]' 
                            : 'bg-slate-900 border-slate-800 text-slate-500'
                        }`}
                      >
                        {num}
                      </span>
                    ))}
                  </div>
                  <div className="text-right">
                    <div className="text-[7px] text-yellow-500/50 font-mono mb-1">RD-{h.round}</div>
                    <div className="text-[8px] text-slate-700 font-mono">
                      {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-slate-600 text-xs font-bold uppercase italic">No entries yet</div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}