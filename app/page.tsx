'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [ticketCount, setTicketCount] = useState(0);
  const [adsToday, setAdsToday] = useState(0);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [stats, setStats] = useState<{ number: number; count: number }[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [winningNumbers, setWinningNumbers] = useState<number[]>([]);

  useEffect(() => {
    // 세션 체크 및 유저 상태 감지
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        fetchUserData(session.user.id);
      }
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUserData(session.user.id);
    });

    fetchGlobalData();
    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    const { data: balance } = await supabase.from('user_balances').select('*').eq('id', userId).maybeSingle();
    if (balance) {
      setTicketCount(balance.ticket_count);
      setAdsToday(balance.ads_watched_today);
    } else {
      await supabase.from('user_balances').insert({ id: userId, ticket_count: 0 });
    }

    const { data: userDraws } = await supabase.from('lucky_draws').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (userDraws) setHistory(userDraws);
  };

  const fetchGlobalData = async () => {
    const { data: wins } = await supabase.from('winning_numbers').select('*').order('draw_date', { ascending: false }).limit(1);
    if (wins && wins.length > 0) setWinningNumbers(wins[0].numbers);

    const { data: allDraws } = await supabase.from('lucky_draws').select('selected_numbers');
    if (allDraws) {
      const counts: { [key: number]: number } = {};
      allDraws.forEach(d => d.selected_numbers?.forEach((n: number) => counts[n] = (counts[n] || 0) + 1));
      const sorted = Object.entries(counts).map(([num, count]) => ({ number: Number(num), count })).sort((a, b) => b.count - a.count).slice(0, 5);
      setStats(sorted);
    }
  };

  // [추가] 자동 선택 기능
  const handleAutoSelect = () => {
    const randomNums: number[] = [];
    while (randomNums.length < 5) {
      const n = Math.floor(Math.random() * 28) + 1;
      if (!randomNums.includes(n)) randomNums.push(n);
    }
    setSelectedNumbers(randomNums.sort((a, b) => a - b));
  };

  // [추가] 구글 로그인 / 로그아웃
  const handleLogin = () => supabase.auth.signInWithOAuth({ provider: 'google' });
  const handleLogout = () => {
    supabase.auth.signOut();
    setUser(null);
    setTicketCount(0);
  };

  const handleWatchAd = async () => {
    if (!user) return alert('로그인이 필요합니다.');
    setLoading(true);
    const { data, error }: any = await supabase.rpc('reward_ad_tickets', { target_user_id: user.id });
    if (data?.success) {
      alert(data.message);
      fetchUserData(user.id);
    } else alert(data?.message || '오류 발생');
    setLoading(false);
  };

  const toggleNumber = (n: number) => {
    if (selectedNumbers.includes(n)) setSelectedNumbers(selectedNumbers.filter(num => num !== n));
    else if (selectedNumbers.length < 5) setSelectedNumbers([...selectedNumbers, n].sort((a, b) => a - b));
  };

  const handleSubmit = async () => {
    if (!user) return alert('로그인이 필요합니다.');
    if (ticketCount <= 0) return alert('응모권이 부족합니다.');
    setLoading(true);
    const { error: drawError } = await supabase.from('lucky_draws').insert({ user_id: user.id, selected_numbers: selectedNumbers });
    if (!drawError) {
      await supabase.from('user_balances').update({ ticket_count: ticketCount - 1 }).eq('id', user.id);
      alert('응모 완료!');
      setSelectedNumbers([]);
      fetchUserData(user.id);
      fetchGlobalData();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 font-sans pb-24">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* 상단: 로그인/로그아웃 및 내 티켓 */}
        <header className="flex justify-between items-center py-2">
          <h1 className="text-xl font-black text-yellow-500 italic uppercase">Lucky 5/28</h1>
          {!user ? (
            <button onClick={handleLogin} className="px-4 py-2 bg-white text-black text-xs font-bold rounded-full">LOGIN</button>
          ) : (
            <button onClick={handleLogout} className="text-xs text-slate-500 font-bold underline">LOGOUT</button>
          )}
        </header>

        {user && (
          <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl flex justify-between items-center">
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">My Tickets</p>
              <h2 className="text-3xl font-black text-yellow-500 italic">{ticketCount} EA</h2>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Today Ads</p>
              <p className="font-bold text-slate-300">{adsToday} <span className="text-slate-600">/ 20</span></p>
            </div>
          </div>
        )}

        <section className="bg-slate-900 p-4 rounded-3xl border border-slate-800">
           <button 
            onClick={handleWatchAd}
            disabled={loading || !user || adsToday >= 20}
            className="w-full py-4 bg-slate-950 border border-yellow-500/30 text-yellow-500 rounded-2xl font-black text-sm hover:bg-yellow-500 hover:text-black transition-all disabled:opacity-30"
          >
            {adsToday >= 20 ? 'DAILY LIMIT REACHED' : 'WATCH AD (+5 TICKETS)'}
          </button>
        </section>

        {/* 당첨 번호 표시 */}
        <section className="text-center space-y-4">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Latest Winning Numbers</p>
          <div className="flex justify-center gap-2">
            {winningNumbers.length > 0 ? winningNumbers.map((n, i) => (
              <div key={i} className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center text-black font-black">{n}</div>
            )) : <p className="text-slate-600 text-xs">Waiting for draw...</p>}
          </div>
        </section>

        {/* 번호 선택판 및 자동선택 */}
        <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black text-white uppercase">Pick 5 Numbers</h3>
            <button onClick={handleAutoSelect} className="text-[10px] font-black text-yellow-500 underline uppercase tracking-tighter">Auto Select</button>
          </div>
          <div className="grid grid-cols-7 gap-2 mb-8">
            {Array.from({ length: 28 }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => toggleNumber(n)}
                className={`aspect-square rounded-xl text-xs font-black transition-all ${selectedNumbers.includes(n) ? 'bg-yellow-500 text-black scale-110' : 'bg-slate-950 text-slate-500 border border-slate-800'}`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedNumbers.length !== 5 || ticketCount <= 0}
            className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black uppercase tracking-widest disabled:bg-slate-800 disabled:text-slate-600 transition-all"
          >
            {ticketCount <= 0 ? 'Need Tickets' : 'Submit Entry'}
          </button>
        </section>

        {/* 하단 데이터 영역 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800/50">
            <h3 className="text-[9px] font-black text-slate-500 uppercase mb-4">Hot Numbers</h3>
            {stats.map((s, i) => (
              <div key={i} className="flex justify-between text-[10px] mb-2">
                <span className="font-bold text-yellow-500">#{s.number}</span>
                <span className="text-slate-500">{s.count} pts</span>
              </div>
            ))}
          </div>
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800/50 overflow-hidden">
            <h3 className="text-[9px] font-black text-slate-500 uppercase mb-4">My History</h3>
            <div className="space-y-2 h-20 overflow-y-auto custom-scrollbar">
              {history.map((h, i) => (
                <p key={i} className="text-[9px] text-slate-400 font-mono">{h.selected_numbers.join(', ')}</p>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}