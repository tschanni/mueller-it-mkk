import React, { useEffect, useRef, useState } from 'react';
import './pong.css';
import logoUrl from '../CompanyPage/mueller-it-mkk-logo.png';

const WIDTH = 800;
const HEIGHT = 600;
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 100;
const BALL_SIZE = 10;
const PADDLE_SPEED = 6;
const BALL_SPEED = 5;

export const Pong: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const keysRef = useRef<{ [k: string]: boolean }>({});
  const [scores, setScores] = useState({ left: 0, right: 0 });
  const [running, setRunning] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBeep = (freq: number, durationMs: number, type: OscillatorType = 'square') => {
    try {
      const ctx = (audioCtxRef.current ||= new (window.AudioContext || (window as any).webkitAudioContext)());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      osc.start(now);
      osc.stop(now + durationMs / 1000);
    } catch {}
  };

  const stateRef = useRef({
    leftY: HEIGHT / 2 - PADDLE_HEIGHT / 2,
    rightY: HEIGHT / 2 - PADDLE_HEIGHT / 2,
    ballX: WIDTH / 2 - BALL_SIZE / 2,
    ballY: HEIGHT / 2 - BALL_SIZE / 2,
    ballVX: BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
    ballVY: BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
  });

  const resetBall = (toRight: boolean) => {
    stateRef.current.ballX = WIDTH / 2 - BALL_SIZE / 2;
    stateRef.current.ballY = HEIGHT / 2 - BALL_SIZE / 2;
    stateRef.current.ballVX = BALL_SPEED * (toRight ? 1 : -1);
    stateRef.current.ballVY = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
  };

  const resetGame = () => {
    setScores({ left: 0, right: 0 });
    stateRef.current.leftY = HEIGHT / 2 - PADDLE_HEIGHT / 2;
    stateRef.current.rightY = HEIGHT / 2 - PADDLE_HEIGHT / 2;
    resetBall(Math.random() > 0.5);
    setRunning(false);
  };

  const startGame = async () => {
    try {
      const ctx = (audioCtxRef.current ||= new (window.AudioContext || (window as any).webkitAudioContext)());
      // resume for browsers that require user gesture
      // @ts-ignore
      if (ctx.state === 'suspended' && ctx.resume) await ctx.resume();
    } catch {}
    if (!running) setRunning(true);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'KeyW' || e.code === 'KeyS') {
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      delete keysRef.current[e.code];
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // render background
      ctx.fillStyle = '#008080';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // draw faint logo centered
      const img = new Image();
      img.src = logoUrl;
      img.onload = () => {
        const scale = Math.min(WIDTH * 0.6 / img.width, HEIGHT * 0.6 / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (WIDTH - w) / 2;
        const y = (HEIGHT - h) / 2;
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.drawImage(img, x, y, w, h);
        ctx.restore();
      };

      // move paddles
      if (keysRef.current['ArrowUp']) stateRef.current.rightY = Math.max(0, stateRef.current.rightY - PADDLE_SPEED);
      if (keysRef.current['ArrowDown']) stateRef.current.rightY = Math.min(HEIGHT - PADDLE_HEIGHT, stateRef.current.rightY + PADDLE_SPEED);
      if (keysRef.current['KeyW']) stateRef.current.leftY = Math.max(0, stateRef.current.leftY - PADDLE_SPEED);
      if (keysRef.current['KeyS']) stateRef.current.leftY = Math.min(HEIGHT - PADDLE_HEIGHT, stateRef.current.leftY + PADDLE_SPEED);

      // move ball
      stateRef.current.ballX += stateRef.current.ballVX;
      stateRef.current.ballY += stateRef.current.ballVY;

      // collide top/bottom
      if (stateRef.current.ballY <= 0 || stateRef.current.ballY + BALL_SIZE >= HEIGHT) {
        stateRef.current.ballVY *= -1;
        playBeep(600, 80);
      }

      // collide with left paddle
      if (
        stateRef.current.ballX <= PADDLE_WIDTH &&
        stateRef.current.ballY + BALL_SIZE >= stateRef.current.leftY &&
        stateRef.current.ballY <= stateRef.current.leftY + PADDLE_HEIGHT
      ) {
        stateRef.current.ballVX = Math.abs(stateRef.current.ballVX);
        playBeep(500, 80);
      }
      // collide with right paddle
      if (
        stateRef.current.ballX + BALL_SIZE >= WIDTH - PADDLE_WIDTH &&
        stateRef.current.ballY + BALL_SIZE >= stateRef.current.rightY &&
        stateRef.current.ballY <= stateRef.current.rightY + PADDLE_HEIGHT
      ) {
        stateRef.current.ballVX = -Math.abs(stateRef.current.ballVX);
        playBeep(500, 80);
      }

      // score
      if (stateRef.current.ballX < -BALL_SIZE) {
        setScores((s) => ({ ...s, right: s.right + 1 }));
        playBeep(300, 150, 'sawtooth');
        resetBall(true);
      } else if (stateRef.current.ballX > WIDTH + BALL_SIZE) {
        setScores((s) => ({ ...s, left: s.left + 1 }));
        playBeep(300, 150, 'sawtooth');
        resetBall(false);
      }

      // render midline, paddles, ball, score
      ctx.fillStyle = '#008080'; // teal retro background
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // midline
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(WIDTH / 2, 0);
      ctx.lineTo(WIDTH / 2, HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      // paddles
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, stateRef.current.leftY, PADDLE_WIDTH, PADDLE_HEIGHT);
      ctx.fillRect(WIDTH - PADDLE_WIDTH, stateRef.current.rightY, PADDLE_WIDTH, PADDLE_HEIGHT);

      // ball
      ctx.fillRect(stateRef.current.ballX, stateRef.current.ballY, BALL_SIZE, BALL_SIZE);

      // score text
      ctx.font = '20px monospace';
      ctx.fillText(String(scores.left), WIDTH / 2 - 60, 30);
      ctx.fillText(String(scores.right), WIDTH / 2 + 40, 30);

      if (running) {
        requestRef.current = window.requestAnimationFrame(draw);
      }
    };

    requestRef.current = window.requestAnimationFrame(draw);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [running, scores.left, scores.right]);

  return (
    <div className="pong-container">
      <div className="pong-toolbar">
        <button className="btn" onClick={startGame}>Start</button>
        <button className="btn" onClick={resetGame}>Reset</button>
        <div className="hint">Left: W/S, Right: ↑/↓</div>
      </div>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="pong-canvas" />
      {/* WebAudio generates sounds programmatically */}
    </div>
  );
};

export default Pong;
