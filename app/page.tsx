'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [ticketCount, setTicketCount] = useState(0); // 보유 응모권
  const [adsToday, setAdsToday] = useState(0);      // 오늘 본 광고 횟수
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 기존 기능용 상태
  const [stats, setStats] = useState<{ number: number; count: number }[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [winningNumbers, setWinningNumbers] = useState<number[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserData(session.user.id);
      }
    });
    fetchGlobalData();
  }, []);

  // 1. 유저 관련 데이터 통합 로드 (응모권 + 내 참여 내역)
  const fetchUserData = async (userId: string) => {
    // 응모권 정보 가져오기
    const { data: balance } = await supabase
      .from('user_balances')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (balance) {
      setTicketCount(balance.ticket_count);
      setAdsToday(balance.ads_watched_today);
    } else {
      // 최초 접속자라면 balance 생성
      await supabase.from('user_balances').insert({ id: userId, ticket_count: 0 });
    }

    // 내 참여 내역 가져오기
    const { data: userDraws } = await supabase
      .from('lucky_draws')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (userDraws) setHistory(userDraws);
  };

  // 2. 전역 데이터 로드 (통계 + 당첨 번호)
  const fetchGlobalData = async () => {
    // 오늘/최근 당첨 번호
    const { data: wins } = await supabase.from('winning_numbers').select('*').order('draw_date', { ascending: false }).limit(1);
    if (wins && wins.length > 0) setWinningNumbers(wins[0].numbers);

    // 전체 통계 (인기 번호)
    const { data: allDraws } = await supabase.from('lucky_draws').select('selected_numbers');
    if (allDraws) {
      const counts: { [key: number]: number } = {};
      allDraws.forEach(d => d.selected_numbers?.forEach((n: number) => counts[n] = (counts[n] || 0) + 1));
      const sorted = Object.entries(counts)
        .map(([num, count]) => ({ number: Number(num), count }))
        .sort((a, b) => b.count - a.count).slice(0, 5);
      setStats(sorted);
    }
  };

  // 3. 광고 보상 함수 (RPC 호출)
  const handleWatchAd = async () => {
    if (!user) return alert('로그인이 필요합니다.');
    setLoading(true);
    
    const { data, error }: any = await supabase.rpc('reward_ad_tickets', { 
      target_user_id: user.id 
    });

    if (data?.success) {
      alert(data.message);
      fetchUserData(user.id); // 지갑 정보 갱신
    } else {
      alert(data?.message || '광고 시청 처리 중 오류가 발생했습니다.');
    }
    setLoading(false);
  };

  // 4. 번호 선택 토글
  const toggleNumber = (n: number) => {
    if (selectedNumbers.includes(n)) {
      setSelectedNumbers(selectedNumbers.filter(num => num !== n));
    } else if (selectedNumbers.length < 5) {
      setSelectedNumbers([...selectedNumbers, n].sort((a, b) => a - b));
    }
  };

  // 5. 최종 응모 (티켓 차감 포함)
  const handleSubmit = async () => {
    if (!user) return alert('로그인이 필요합니다.');
    if (ticketCount <= 0) return alert('응모권이 부족합니다. 광고를 시청해주세요!');
    if (selectedNumbers.length !== 5) return alert('5개의 번호를 선택해주세요.');

    setLoading(true);
    // 응모 저장
    const { error: drawError } = await supabase.from('lucky_draws').insert({
      user_id: user.id,
      selected_numbers: selectedNumbers,
    });

    if (!drawError) {
      // 티켓 차감
      await supabase.from('user_balances').update({ ticket_count: ticketCount - 1 }).eq('id', user.id);
      alert('응모 완료!');
      setSelectedNumbers([]);
      fetchUserData(user.id); // 차감된 티켓 수 갱신
      fetchGlobalData(); // 통계 갱신
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 font-sans pb-24">
      <div className="max-w-md mx-auto space-y-8">
        
        {/* 상단: 내 지갑 상태 (추가됨) */}
        <header className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">My Tickets</p>
            <h2 className="text-3xl font-black text-yellow-500 italic">{ticketCount}</h2>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Daily Ads</p>
            <p className="font-bold text-slate-300">{adsToday} <span className="text-slate-600">/ 20</span></p>
          </div>
        </header>

        {/* 광고 시청 섹션 (추가됨) */}
        <section className="bg-slate-900 p-4 rounded-3xl border border-slate-800">
           <button 
            onClick={handleWatchAd}
            disabled={loading || adsToday >= 20}
            className="w-full py-4 bg-slate-950 border border-yellow-500/30 text-yellow-500 rounded-2xl font-black text-sm hover:bg-yellow-500 hover:text-black transition-all disabled:opacity-30"
          >
            {adsToday >= 20 ? 'DAILY LIMIT REACHED' : 'WATCH AD (+5 TICKETS)'}
          </button>
        </section>

        {/* 당첨 번호 섹션 (기존 유지) */}
        <section className="text-center space-y-4">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Latest Winning Numbers</p>
          <div className="flex justify-center gap-2">
            {winningNumbers.length > 0 ? winningNumbers.map((n, i) => (
              <div key={i} className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-black font-black shadow-[0_0_20px_rgba(234,179,8,0.3)]">{n}</div>
            )) : <p className="text-slate-600">Waiting for draw...</p>}
          </div>
        </section>

        {/* 번호 선택판 (기존 유지) */}
        <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
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
            className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black uppercase tracking-widest disabled:bg-slate-800 disabled:text-slate-600 transition-all shadow-xl"
          >
            {ticketCount <= 0 ? 'Need Tickets' : 'Submit Entry'}
          </button>
        </section>

        {/* 통계 및 내역 (기존 유지) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800/50">
            <h3 className="text-[9px] font-black text-slate-500 uppercase mb-4">Hot Numbers</h3>
            {stats.map((s, i) => (
              <div key={i} className="flex justify-between text-xs mb-2">
                <span className="font-bold text-yellow-500">#{s.number}</span>
                <span className="text-slate-500">{s.count} times</span>
              </div>
            ))}
          </div>
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800/50 overflow-hidden">
            <h3 className="text-[9px] font-black text-slate-500 uppercase mb-4">My History</h3>
            <div className="space-y-2 h-24 overflow-y-auto custom-scrollbar">
              {history.map((h, i) => (
                <p key={i} className="text-[10px] text-slate-400 font-mono">{h.selected_numbers.join(', ')}</p>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}