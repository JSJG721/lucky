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

  // 1. 회차 및 당첨 번호 로드 (최우선 순위)
  const fetchGlobalData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('winning_numbers')
        .select('round, numbers')
        .order('round', { ascending: false })
        .limit(1)
        .maybeSingle(); // 에러 방지를 위해 maybeSingle 사용
      
      if (data) {
        setWinningNumbers(data.numbers.map((n: any) => Number(n)));
        setCurrentRound(Number(data.round));
        return Number(data.round);
      }
      return null;
    } catch (e) {
      console.error("Global Data Load Error:", e);
      return null;
    }
  }, []);

  // 2. 유저 밸런스 및 응모 내역 로드
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
      console.error("User Data Load Error:", e);
    }
  }, []);

  // 3. 초기 세션 체크 및 초기화
  useEffect(() => {
    const init = async () => {
      try {
        // 회차 정보부터 로드
        await fetchGlobalData();

        // 세션 확인
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          // 세션 에러가 있거나 없으면 로컬 스토리지 정리 (무한 로딩 방지)
          localStorage.removeItem('sb-yodtvsql...-auth-token'); // 본인의 supabase 프로젝트 ID가 포함된 키
          setUser(null);
        } else {
          setUser(session.user);
          await fetchUserData(session.user.id);
        }
      } catch (e) {
        console.error("Init logic error:", e);
      } finally {
        setIsInitialLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
        await fetchUserData(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        handleStateReset();
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchGlobalData, fetchUserData]);

  // 상태 초기화 함수
  const handleStateReset = () => {
    setUser(null);
    setTicketCount(0);
    setAdsToday(0);
    setHistory([]);
    setSelectedNumbers([]);
    // 로컬 스토리지 강제 정리 (이게 핵심입니다)
    Object.keys(localStorage).forEach(key => {
      if (key.includes('supabase.auth.token') || key.includes('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
  };

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
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Sign out error:", e);
    } finally {
      handleStateReset();
      setLoading(false);
      window.location.reload(); // 세션 완전 초기화를 위해 새로고침
    }
  };

  const handleWatchAd = async () => {
    if (!user) return alert('로그인이 필요합니다.');
    setLoading(true);
    try {
      const { data }: any = await supabase.rpc('reward_ad_tickets', { 
        target_user_id: user.id 
      });
      if (data?.success) {
        alert(data.message);
        await fetchUserData(user.id);
      } else {
        alert(data?.message || '광고 보상 실패');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);

    // 회차 정보 재확인
    let activeRound = currentRound;
    if (!activeRound) {
      activeRound = await fetchGlobalData();
    }

    if (!activeRound) {
      alert('회차 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      setLoading(false);
      return;
    }

    if (!user) return alert('로그인이 필요합니다.');
    if (ticketCount <= 0) return alert('응모권이 부족합니다.');
    if (selectedNumbers.length !== 5) return alert('번호 5개를 선택해주세요.');

    try {
      const { error: drawError } = await supabase.from('lucky_draws').insert({ 
        user_id: user.id, 
        selected_numbers: selectedNumbers,
        round: activeRound
      });

      if (!drawError) {
        await supabase.from('user_balances').update({ 
          ticket_count: ticketCount - 1 
        }).eq('id', user.id);
        
        alert('응모 완료!');
        setSelectedNumbers([]);
        await fetchUserData(user.id);
      } else {
        throw drawError;
      }
    } catch (e) {
      alert('응모 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // --- [UI 부분 생략 없이 유지] ---

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

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-yellow-500 font-black italic">LOADING SESSION...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 font-sans pb-10">
      <div className="max-w-md mx-auto space-y-6">
        <header className="flex justify-between items-center py-2">
          <h1 className="text-xl font-black text-yellow-500 italic uppercase tracking-tighter">Lucky 5/28</h1>
          {!user ? (
            <button onClick={handleLogin} className="px-4 py-2 bg-white text-black text-xs font-bold rounded-full">LOGIN</button>
          ) : (
            <button onClick={handleLogout} className="text-xs text-slate-500 font-bold underline px-3 py-2">{loading ? 'WAIT...' : 'LOGOUT'}</button>
          )}
        </header>

        <section className="bg-slate-900 p-6 rounded-[2rem] border border-yellow-500/20 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Winning Numbers</h3>
            <span className="text-[9px] text-slate-500 font-mono italic">ROUND {currentRound || '??'}</span>
          </div>
          <div className="flex justify-center gap-3">
            {winningNumbers.length > 0 ? winningNumbers.map((num, idx) => (
              <div key={idx} className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-black flex items-center justify-center font-black text-sm shadow-lg">
                {num}
              </div>
            )) : <div className="text-slate-500 text-xs">정보를 불러오는 중...</div>}
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

        <button 
          onClick={handleWatchAd}
          disabled={loading || !user || adsToday >= 20}
          className="w-full py-4 bg-yellow-500 text-black rounded-2xl font-black text-sm disabled:bg-slate-800 disabled:text-slate-600 shadow-lg"
        >
          {adsToday >= 20 ? 'DAILY LIMIT REACHED' : 'WATCH AD (+5 TICKETS)'}
        </button>

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
            className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black uppercase tracking-widest disabled:bg-slate-800 disabled:text-slate-600 shadow-xl"
          >
            {ticketCount <= 0 ? 'Need Tickets' : 'Submit Entry'}
          </button>
        </section>

        <section className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6">History</h3>
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
            {history.map((h, i) => (
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
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}