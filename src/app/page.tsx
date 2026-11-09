import { GameContainer } from '@/components/game/GameContainer';

export const metadata = {
  title: 'Teste',
  description: 'Teste: um jogo roguelite de sobrevivência em Next.js, React e HTML5 Canvas.',
};

export default function Home() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-black select-none touch-none">
      <GameContainer />
    </main>
  );
}
