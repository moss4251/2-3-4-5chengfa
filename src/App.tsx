/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sound } from './sound';

type FeedbackType = 'correct' | 'wrong' | 'timeout' | null;

interface Question {
  f1: number;
  f2: number;
  answer: number;
}

// Online network running boy GIF resources with local fallback
const RUNNER_NORMAL_URL =
  'https://upload.wikimedia.org/wikipedia/commons/8/8d/Man_Running_GIF_Animation_Loop.gif';
const RUNNER_SPRINT_URL =
  'https://upload.wikimedia.org/wikipedia/commons/d/d1/Man_Running_Scared_GIF_Animation_Loop.gif';

export default function App() {
  // Available tables: 2, 3, 4, 5
  const [activeTables, setActiveTables] = useState<number[]>([2, 3, 4, 5]);

  // Lottery pool: numbers 1 to 45
  const [remainingPool, setRemainingPool] = useState<number[]>(() =>
    Array.from({ length: 45 }, (_, i) => i + 1)
  );
  const [drawnList, setDrawnList] = useState<number[]>([]);
  const [currentNum, setCurrentNum] = useState<number | null>(null);

  // Lottery rolling animation state
  const [isRolling, setIsRolling] = useState(false);
  const [rollDisplay, setRollDisplay] = useState<number | null>(null);

  // Question & Answering state
  const [question, setQuestion] = useState<Question | null>(null);
  const [userInput, setUserInput] = useState<string>('');
  const [feedback, setFeedback] = useState<FeedbackType>(null);

  // 10s Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Stats
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);

  // Sound toggle
  const [isSoundOn, setIsSoundOn] = useState<boolean>(true);

  // Direct DOM Refs for stepless (无极) 60fps/120fps continuous animation
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const runnerRef = useRef<HTMLDivElement | null>(null);
  const runnerImgRef = useRef<HTMLImageElement | null>(null);
  const timerTextRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const timerRafRef = useRef<number | null>(null);
  const timerStartRef = useRef<number>(0);

  // Trigger confetti burst
  const triggerConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      decay: number;
    }> = [];

    const colors = ['#10b981', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 9;
      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.015 + Math.random() * 0.02,
      });
    }

    let animId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.alpha -= p.decay;
        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      if (alive) {
        animId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    animId = requestAnimationFrame(render);
  }, []);

  // Generate random multiplication question
  const generateQuestion = useCallback(() => {
    const validTables = activeTables.length > 0 ? activeTables : [2, 3, 4, 5];
    const table = validTables[Math.floor(Math.random() * validTables.length)];
    const multiplier = Math.floor(Math.random() * 9) + 1;
    const swap = Math.random() > 0.5;
    const f1 = swap ? multiplier : table;
    const f2 = swap ? table : multiplier;
    return {
      f1,
      f2,
      answer: f1 * f2,
    };
  }, [activeTables]);

  // Handle timeout event
  const handleTimeout = useCallback(() => {
    setIsTimerRunning(false);
    setFeedback('timeout');
    setWrongCount((prev) => prev + 1);
    sound.playTimeout();

    // Set UI to final 0 state
    if (progressBarRef.current) {
      progressBarRef.current.style.width = '0%';
      progressBarRef.current.style.backgroundColor = '#f43f5e';
    }
    if (timerTextRef.current) {
      timerTextRef.current.textContent = '0.0s';
      timerTextRef.current.className =
        'font-mono font-black text-3xl sm:text-4xl tabular-nums text-rose-500';
    }
    if (runnerRef.current) {
      runnerRef.current.style.left = '96%';
    }
  }, []);

  // Stepless (无极递减) requestAnimationFrame loop
  useEffect(() => {
    if (!isTimerRunning) {
      if (timerRafRef.current) {
        cancelAnimationFrame(timerRafRef.current);
      }
      return;
    }

    let lastTickSec = 4;
    let isSprinting = false;

    const update = (now: number) => {
      const elapsed = (now - timerStartRef.current) / 1000;
      const remaining = Math.max(0, 10.0 - elapsed);
      const ratio = remaining / 10.0; // 1.0 -> 0.0

      // 1. Update progress bar width steplessly with direct DOM style (no CSS transition delay)
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${ratio * 100}%`;
        if (remaining > 5.0) {
          progressBarRef.current.style.backgroundColor = '#10b981'; // emerald
        } else if (remaining > 2.5) {
          progressBarRef.current.style.backgroundColor = '#f59e0b'; // amber
        } else {
          progressBarRef.current.style.backgroundColor = '#f43f5e'; // rose
        }
      }

      // 2. Update Runner position steplessly above the bar: moves smoothly across track from 4% to 96%
      if (runnerRef.current) {
        const runnerX = 4 + (1 - ratio) * 92;
        runnerRef.current.style.left = `${runnerX}%`;
      }

      // 3. Switch to sprint animation when under 2.5s
      if (remaining <= 2.5 && !isSprinting) {
        isSprinting = true;
        if (runnerImgRef.current) {
          runnerImgRef.current.src = RUNNER_SPRINT_URL;
        }
      }

      // 4. Update digital countdown text
      if (timerTextRef.current) {
        timerTextRef.current.textContent = `${remaining.toFixed(1)}s`;
        if (remaining <= 2.5) {
          timerTextRef.current.className =
            'font-mono font-black text-3xl sm:text-4xl tabular-nums text-rose-400';
        } else if (remaining <= 5.0) {
          timerTextRef.current.className =
            'font-mono font-black text-3xl sm:text-4xl tabular-nums text-amber-400';
        } else {
          timerTextRef.current.className =
            'font-mono font-black text-3xl sm:text-4xl tabular-nums text-emerald-400';
        }
      }

      // 5. Sound ticks in last 3 seconds
      const currSec = Math.ceil(remaining);
      if (currSec <= 3 && currSec > 0 && currSec < lastTickSec) {
        lastTickSec = currSec;
        sound.playTick();
      }

      if (remaining <= 0) {
        handleTimeout();
      } else {
        timerRafRef.current = requestAnimationFrame(update);
      }
    };

    timerStartRef.current = performance.now();
    timerRafRef.current = requestAnimationFrame(update);

    return () => {
      if (timerRafRef.current) {
        cancelAnimationFrame(timerRafRef.current);
      }
    };
  }, [isTimerRunning, handleTimeout]);

  // Lottery Draw
  const handleDraw = useCallback(() => {
    if (isRolling || remainingPool.length === 0) return;

    setIsTimerRunning(false);
    setFeedback(null);
    setUserInput('');
    setIsRolling(true);

    // Reset bar and runner to start
    if (progressBarRef.current) {
      progressBarRef.current.style.width = '100%';
      progressBarRef.current.style.backgroundColor = '#10b981';
    }
    if (runnerRef.current) {
      runnerRef.current.style.left = '4%';
    }
    if (runnerImgRef.current) {
      runnerImgRef.current.src = RUNNER_NORMAL_URL;
    }
    if (timerTextRef.current) {
      timerTextRef.current.textContent = '10.0s';
      timerTextRef.current.className =
        'font-mono font-black text-3xl sm:text-4xl tabular-nums text-emerald-400';
    }

    const rollDuration = 700;
    const startTime = performance.now();

    const rollInterval = setInterval(() => {
      const randomCandidate =
        remainingPool[Math.floor(Math.random() * remainingPool.length)];
      setRollDisplay(randomCandidate);
      sound.playRoll();

      if (performance.now() - startTime >= rollDuration) {
        clearInterval(rollInterval);

        const pickedIndex = Math.floor(Math.random() * remainingPool.length);
        const selected = remainingPool[pickedIndex];

        setRemainingPool((prev) => prev.filter((n) => n !== selected));
        setDrawnList((prev) => [...prev, selected]);
        setCurrentNum(selected);
        setRollDisplay(selected);
        setIsRolling(false);
        sound.playLock();
        sound.speakNumber(selected);

        const q = generateQuestion();
        setQuestion(q);

        setIsTimerRunning(true);
      }
    }, 60);
  }, [isRolling, remainingPool, generateQuestion]);

  // Grade as Correct
  const markCorrect = useCallback(() => {
    if (!question || feedback !== null) return;
    setIsTimerRunning(false);
    setFeedback('correct');
    setCorrectCount((prev) => prev + 1);
    sound.playSuccess();
    triggerConfetti();
  }, [question, feedback, triggerConfetti]);

  // Grade as Wrong
  const markWrong = useCallback(() => {
    if (!question || feedback !== null) return;
    setIsTimerRunning(false);
    setFeedback('wrong');
    setWrongCount((prev) => prev + 1);
    sound.playError();
  }, [question, feedback]);

  // Submit typed answer
  const handleSubmitInput = useCallback(() => {
    if (!question || feedback !== null || userInput.trim() === '') return;
    const parsed = parseInt(userInput, 10);
    if (parsed === question.answer) {
      markCorrect();
    } else {
      markWrong();
    }
  }, [question, feedback, userInput, markCorrect, markWrong]);

  // Number pad input
  const handleKeypadDigit = (digit: string) => {
    if (!isTimerRunning && feedback !== null) return;
    if (userInput.length >= 3) return;
    const nextVal = userInput + digit;
    setUserInput(nextVal);

    if (question) {
      const expectedLen = question.answer.toString().length;
      if (nextVal.length === expectedLen) {
        if (parseInt(nextVal, 10) === question.answer) {
          setIsTimerRunning(false);
          setFeedback('correct');
          setCorrectCount((prev) => prev + 1);
          sound.playSuccess();
          triggerConfetti();
        }
      }
    }
  };

  const handleKeypadBackspace = () => {
    if (feedback !== null) return;
    setUserInput((prev) => prev.slice(0, -1));
  };

  // Reset entire pool (1~45)
  const handleReset = () => {
    setIsTimerRunning(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setRemainingPool(Array.from({ length: 45 }, (_, i) => i + 1));
    setDrawnList([]);
    setCurrentNum(null);
    setRollDisplay(null);
    setQuestion(null);
    setUserInput('');
    setFeedback(null);
    setCorrectCount(0);
    setWrongCount(0);

    if (progressBarRef.current) {
      progressBarRef.current.style.width = '100%';
      progressBarRef.current.style.backgroundColor = '#10b981';
    }
    if (runnerRef.current) {
      runnerRef.current.style.left = '4%';
    }
    if (runnerImgRef.current) {
      runnerImgRef.current.src = RUNNER_NORMAL_URL;
    }
    if (timerTextRef.current) {
      timerTextRef.current.textContent = '10.0s';
      timerTextRef.current.className =
        'font-mono font-black text-3xl sm:text-4xl tabular-nums text-emerald-400';
    }
  };

  // Sound toggle
  const toggleSound = () => {
    const next = !isSoundOn;
    setIsSoundOn(next);
    sound.enabled = next;
    if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  // Toggle table filter
  const toggleTable = (num: number) => {
    if (activeTables.includes(num)) {
      if (activeTables.length > 1) {
        setActiveTables(activeTables.filter((t) => t !== num));
      }
    } else {
      setActiveTables([...activeTables, num].sort());
    }
  };

  const selectAllTables = () => {
    setActiveTables([2, 3, 4, 5]);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!isRolling) {
          if (!question || feedback !== null) {
            handleDraw();
          }
        }
      } else if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeypadDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeypadBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (question && feedback === null && userInput.length > 0) {
          handleSubmitInput();
        } else if (!isRolling && (feedback !== null || !question)) {
          handleDraw();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-3 sm:p-5 select-none font-sans">
      {/* Overlay Canvas for Confetti */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-50"
      />

      {/* Top Bar: Table Selectors & Control Buttons */}
      <div className="w-full max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-lg">
        {/* Table Filter Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {[2, 3, 4, 5].map((t) => {
            const active = activeTables.includes(t);
            return (
              <button
                key={t}
                onClick={() => toggleTable(t)}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-lg font-black transition-all cursor-pointer ${
                  active
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30 scale-105'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            );
          })}
          <button
            onClick={selectAllTables}
            className={`px-3 h-10 sm:h-11 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTables.length === 4
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            全部
          </button>
        </div>

        {/* Counters & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 text-sm sm:text-base font-mono px-3 py-1.5 bg-slate-950/70 rounded-xl border border-slate-800">
            <span className="text-emerald-400 font-bold">✓ {correctCount}</span>
            <span className="text-slate-600">/</span>
            <span className="text-rose-400 font-bold">✗ {wrongCount}</span>
            <span className="text-slate-600">|</span>
            <span className="text-cyan-300 font-bold">
              {remainingPool.length} / 45
            </span>
          </div>

          <button
            onClick={toggleSound}
            className={`px-3 h-10 sm:h-11 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              isSoundOn
                ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'bg-slate-800/40 text-slate-500'
            }`}
          >
            {isSoundOn ? '声音' : '静音'}
          </button>

          <button
            onClick={handleReset}
            className="px-3.5 h-10 sm:h-11 rounded-xl text-sm font-bold bg-slate-800 text-slate-300 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-800/60 border border-transparent transition-all cursor-pointer"
          >
            重置
          </button>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="w-full max-w-4xl mx-auto my-3 flex-1 flex flex-col justify-center">
        <div className="relative bg-slate-900 border border-slate-800/90 rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col items-center justify-between min-h-[380px] sm:min-h-[430px]">
          {/* Top Status Row: Number Badge & Countdown */}
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (currentNum !== null) {
                    sound.speakNumber(currentNum);
                  }
                }}
                className={`w-20 h-14 sm:w-28 sm:h-16 rounded-2xl flex items-center justify-center font-black font-mono text-2xl sm:text-4xl border transition-all ${
                  isRolling
                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 animate-pulse'
                    : currentNum !== null
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/20 scale-105 cursor-pointer active:scale-95'
                    : 'bg-slate-950/60 border-slate-800 text-slate-600'
                }`}
              >
                {isRolling
                  ? `#${rollDisplay ?? '?'}`
                  : currentNum !== null
                  ? `#${currentNum}`
                  : '#--'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div
                ref={timerTextRef}
                className="font-mono font-black text-3xl sm:text-4xl tabular-nums text-emerald-400"
              >
                10.0s
              </div>
            </div>
          </div>

          {/* Stepless Time Bar & Running Boy Track */}
          <div className="w-full my-3 sm:my-4 relative">
            {/* Running Boy Lane placed directly above the time bar */}
            <div className="relative h-14 sm:h-16 w-full overflow-visible">
              {/* Finish Line Flag on the far right */}
              <div className="absolute right-0 bottom-0 flex flex-col items-center z-10 select-none">
                <span className="text-2xl sm:text-3xl leading-none">🏁</span>
              </div>

              {/* Running Boy positioned dynamically across the track */}
              <div
                ref={runnerRef}
                className="absolute bottom-0 -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center"
                style={{ left: '4%' }}
              >
                <div className="relative flex items-center justify-center">
                  <img
                    ref={runnerImgRef}
                    src={RUNNER_NORMAL_URL}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/runner.gif';
                    }}
                    alt=""
                    className={`h-12 sm:h-15 w-auto object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)] ${
                      !isTimerRunning && feedback === null ? 'opacity-85' : ''
                    }`}
                  />
                  {isTimerRunning && (
                    <span className="absolute -left-3 bottom-0 text-xs sm:text-sm animate-pulse select-none">
                      💨
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stepless Continuous Decreasing Time Bar (Zero transition lag) */}
            <div className="w-full h-3 sm:h-3.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 shadow-inner">
              <div
                ref={progressBarRef}
                className="h-full rounded-full"
                style={{
                  width: '100%',
                  backgroundColor: '#10b981',
                  transition: 'none',
                }}
              />
            </div>
          </div>

          {/* Central Math Equation */}
          <div className="my-auto py-2 text-center flex flex-col items-center">
            {question ? (
              <div className="flex items-center justify-center gap-2 sm:gap-4 font-mono font-black text-5xl sm:text-7xl md:text-8xl tracking-tight">
                <span className="text-slate-100">{question.f1}</span>
                <span className="text-cyan-400">×</span>
                <span className="text-slate-100">{question.f2}</span>
                <span className="text-slate-500">=</span>
                {feedback === null ? (
                  <span
                    className={`inline-block min-w-[1.2ch] px-2 py-0.5 rounded-2xl bg-slate-950/80 border-2 ${
                      userInput ? 'text-amber-300 border-amber-400/50' : 'text-slate-600 border-slate-700'
                    }`}
                  >
                    {userInput || '?'}
                  </span>
                ) : (
                  <span
                    className={`font-black ${
                      feedback === 'correct'
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {question.answer}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3 font-mono font-black text-5xl sm:text-7xl text-slate-700">
                <span>?</span>
                <span>×</span>
                <span>?</span>
                <span>=</span>
                <span>?</span>
              </div>
            )}

            {/* Necessary Interactive Feedback Badges */}
            <div className="h-10 mt-3 flex items-center justify-center">
              {feedback === 'correct' && (
                <div className="px-5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-black text-xl sm:text-2xl flex items-center gap-2 animate-bounce">
                  <span>✓</span>
                  <span>正确</span>
                </div>
              )}
              {feedback === 'wrong' && (
                <div className="px-5 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 font-black text-xl sm:text-2xl flex items-center gap-2">
                  <span>✗</span>
                  <span>错误</span>
                </div>
              )}
              {feedback === 'timeout' && (
                <div className="px-5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 font-black text-xl sm:text-2xl flex items-center gap-2">
                  <span>⏱</span>
                  <span>超时</span>
                </div>
              )}
              {remainingPool.length === 0 && !question && (
                <div className="px-5 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 font-black text-xl flex items-center gap-2">
                  <span>完成</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Oral Grading Buttons + Primary Draw Button */}
          <div className="w-full flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-2">
            <button
              onClick={handleDraw}
              disabled={isRolling || remainingPool.length === 0}
              className={`min-w-[140px] sm:min-w-[180px] h-13 sm:h-15 rounded-2xl font-black text-xl sm:text-2xl transition-all cursor-pointer flex items-center justify-center ${
                remainingPool.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : isRolling
                  ? 'bg-amber-500 text-slate-950 scale-95'
                  : question === null
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-xl shadow-cyan-500/30 hover:scale-105 active:scale-95'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-xl shadow-cyan-500/30 hover:scale-105 active:scale-95'
              }`}
            >
              {question === null ? '抽签' : '下一个'}
            </button>

            {question && feedback === null && (
              <>
                <button
                  onClick={markCorrect}
                  className="px-5 sm:px-6 h-13 sm:h-15 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg sm:text-xl shadow-lg shadow-emerald-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  正确
                </button>
                <button
                  onClick={markWrong}
                  className="px-5 sm:px-6 h-13 sm:h-15 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-lg sm:text-xl shadow-lg shadow-rose-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  错误
                </button>
              </>
            )}
          </div>
        </div>

        {/* Numeric Keypad for direct testing / student input */}
        <div className="w-full max-w-sm mx-auto mt-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-2.5 shadow-xl grid grid-cols-4 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleKeypadDigit(digit)}
              className="h-12 sm:h-13 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-cyan-500 active:text-slate-950 text-slate-100 font-mono font-black text-xl transition-all cursor-pointer"
            >
              {digit}
            </button>
          ))}
          <button
            onClick={handleKeypadBackspace}
            className="h-12 sm:h-13 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 font-mono font-black text-xl transition-all cursor-pointer"
          >
            ⌫
          </button>
          <button
            onClick={() => handleKeypadDigit('0')}
            className="h-12 sm:h-13 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-cyan-500 active:text-slate-950 text-slate-100 font-mono font-black text-xl transition-all cursor-pointer"
          >
            0
          </button>
          <button
            onClick={handleSubmitInput}
            disabled={userInput === '' || feedback !== null}
            className={`h-12 sm:h-13 rounded-xl font-black text-base transition-all cursor-pointer ${
              userInput !== '' && feedback === null
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-slate-800/60 text-slate-600 cursor-not-allowed'
            }`}
          >
            提交
          </button>
        </div>
      </div>

      {/* Bottom 1~45 Pool Status Matrix: Pure Numbers Only */}
      <div className="w-full max-w-4xl mx-auto bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 shadow-md mt-2">
        <div className="grid grid-cols-9 sm:grid-cols-15 gap-1.5 sm:gap-2">
          {Array.from({ length: 45 }, (_, i) => i + 1).map((num) => {
            const isDrawn = drawnList.includes(num);
            const isCurrent = currentNum === num;

            return (
              <div
                key={num}
                className={`h-7 sm:h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs sm:text-sm transition-all ${
                  isCurrent
                    ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-300 font-black scale-110 shadow-lg shadow-cyan-500/40 z-10'
                    : isDrawn
                    ? 'bg-slate-950/60 text-slate-700 line-through'
                    : 'bg-slate-800/80 text-slate-300'
                }`}
              >
                {num}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
