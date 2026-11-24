import type { Metadata } from 'next';
import WaterSortGame from './WaterSortGame';

export const metadata: Metadata = {
  title: '액체 따르기 퍼즐',
  description: '같은 색 액체를 한 병에 모으는 가벼운 퍼즐 게임',
};

export default function WaterSortPage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <WaterSortGame />
    </main>
  );
}
