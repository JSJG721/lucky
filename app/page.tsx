'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';

export default function Home() {
  // --- [상태 관리] ---
  const [user, setUser] = useState<any>(null);
  const [ticketCount, setTicketCount] = useState(0);
  const [adsToday, setAdsToday] = useState(0);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [winningNumbers, setWinningNumbers] = useState<number[]>([]);
  const [currentRound, setCurrentRound] = useState<number | null>(null);

  // --- [초기 로드 및 인증 감시] ---
  useEffect(() => {
    const init = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      // 세션이 없거나 에러가 있으면 유저 정보를 null로 강제 초기화 (로그아웃 버튼 버그 방지)
      if (error || !session) {
        setUser(null);
      } else {
        setUser(session.user);
        await fetchUserData(session.user.id);
      }
      
      await fetchGlobalData();
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
        setLoading(false);
      }
    });
  
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // --- [데이터 통신 함수] ---
  const fetchUserData = async (userId: string) => {
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
  };

  const fetchGlobalData = async () => {
    const { data: wins } = await supabase
      .from('winning_numbers')
      .select('*')
      .order('draw_date', { ascending: false })
      .limit(1);
    
    if (wins && wins.length > 0) {
      setWinningNumbers(wins[0].numbers.map((n: any) => Number(n)));
      setCurrentRound(wins[0].round); // DB에서 가져온 최신 회차 저장
    }
  };

  // --- [액션 함수] ---
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      // 로컬 세션을 우선적으로 삭제하여 즉시 반영
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error("Logout Error:", error);
    } finally {
      // 상태 강제 초기화 (무한 WAIT 방지)
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
    const { data, error }: any = await supabase.rpc('reward_ad_tickets', { 
      target_user_id: user.id 
    });

    if (data?.success) {
      alert(data.message);
      setTimeout(() => fetchUserData(user.id), 500);
    } else {
      alert(data?.message || '보상 지급 실패');
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!currentRound) {
      alert('회차 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      await fetchGlobalData();
      return;
    }

    if (!user || ticketCount <= 0 || selectedNumbers.length !== 5) return;
    
    setLoading(true);
    
    const { error: drawError } = await supabase.from('lucky_draws').insert({ 
      user_id: user.id, 
      selected_numbers: selectedNumbers,
      round: currentRound // 현재 회차 정보를 함께 저장
    });

    if (!drawError) {
      await supabase.from('user_balances').update({ 
        ticket_count: ticketCount - 1 
      }).eq('id', user.id);
      
      alert('응모 완료!');
      setSelectedNumbers([]);
      await fetchUserData(user.id);
    } else {
      console.error("Submit Error:", drawError);
      alert("응모 실패: " + drawError.message);
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

  // --- [당첨 확인 로직] ---
  const checkIsWinning = (entryRound: number | null, num: number) => {
    // 1. 당첨번호나 현재회차 정보가 없으면 false
    if (!winningNumbers || winningNumbers.length === 0 || !currentRound) return false;

    // 2. 티켓의 회차와 현재 발표된 회차가 다르면 당첨 표시 안 함 (어제 번호 방지)
    if (!entryRound || entryRound !== currentRound) {
      return false;
    }

    // 3. 같은 회차일 때만 숫자 포함 여부 확인
    return winningNumbers.includes(num);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 font-sans pb-10">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* 1. 헤더 */}
        <header className="flex justify-between items-center py-2">
          <h1 className="text-xl font-black text-yellow-500 italic uppercase tracking-tighter">Lucky 5/28</h1>
          {!user ? (
            <button onClick={handleLogin} className="px-4 py-2 bg-white text-black text-xs font-bold rounded-full">LOGIN</button>
          ) : (
            <button 
              onClick={handleLogout} 
              disabled={loading}
              className="text-xs text-slate-500 font-bold underline px-3 py-2 hover:text-white transition-colors"
            >
              {loading ? 'WAIT...' : 'LOGOUT'}
            </button>
          )}
        </header>

        {/* 2. 당첨 번호 표시 */}
        <section className="bg-slate-900 p-6 rounded-[2rem] border border-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.05)]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
              <h3 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Last Winning Numbers</h3>
            </div>
            <span className="text-[9px] text-slate-500 font-mono italic">ROUND {currentRound}</span>
          </div>
          <div className="flex justify-center gap-3">
            {winningNumbers.length > 0 ? (
              winningNumbers.map((num, idx) => (
                <div key={idx} className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-black flex items-center justify-center font-black text-sm shadow-lg">
                  {num}
                </div>
              ))
            ) : (
              <div className="py-2 text-slate-600 text-[10px] font-bold uppercase italic">Loading results...</div>
            )}
          </div>
        </section>

        {/* 3. 내 정보 섹션 */}
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

        {/* 4. 광고 버튼 */}
        <button 
          onClick={handleWatchAd}
          disabled={loading || !user || adsToday >= 20}
          className="w-full py-4 bg-yellow-500 text-black rounded-2xl font-black text-sm disabled:bg-slate-800 disabled:text-slate-600 transition-all shadow-lg shadow-yellow-900/10"
        >
          {adsToday >= 20 ? 'DAILY LIMIT REACHED' : 'WATCH AD (+5 TICKETS)'}
        </button>

        {/* 5. 번호 선택판 */}
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
                className={`aspect-square rounded-xl text-xs font-black transition-all ${selectedNumbers.includes(n) ? 'bg-yellow-500 text-black scale-110 shadow-lg shadow-yellow-500/20' : 'bg-slate-950 text-slate-600 border border-slate-800'}`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedNumbers.length !== 5 || ticketCount <= 0}
            className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black uppercase tracking-widest disabled:bg-slate-800 disabled:text-slate-600 transition-all active:scale-95"
          >
            {ticketCount <= 0 ? 'Need Tickets' : 'Submit Entry'}
          </button>
        </section>

        {/* 6. 응모 내역 */}
        <section className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6">History</h3>
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
            {history.length > 0 ? history.map((h, i) => (
              <div key={i} className="p-4 bg-slate-950 rounded-3xl border border-slate-800 flex justify-between items-center">
                <div className="flex gap-2">
                  {h.selected_numbers.map((num: number, idx: number) => {
                    // [핵심 수정] h.created_at 대신 h.round를 인자로 전달
                    const matched = checkIsWinning(h.round, num);
                    return (
                      <span 
                        key={idx} 
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black border transition-all ${
                          matched 
                            ? 'bg-yellow-500 border-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.5)]' 
                            : 'bg-slate-900 border-slate-800 text-slate-500'
                        }`}
                      >
                        {num}
                      </span>
                    );
                  })}
                </div>
                <div className="text-right">
                  <div className="text-[7px] text-yellow-500/50 font-mono mb-1">RD-{h.round || 'OLD'}</div>
                  <div className="text-[8px] text-slate-700 font-mono uppercase">
                    {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )) : (
              <div className="py-10 text-center text-slate-600 text-xs font-bold uppercase">No entries yet</div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}