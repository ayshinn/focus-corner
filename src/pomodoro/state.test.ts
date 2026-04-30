import { describe, expect, it, vi } from 'vitest';
import { createPomodoro, formatRemaining, phaseLabel, type Durations } from './state';

const D: Durations = {
  workMs: 25 * 60 * 1000,
  shortBreakMs: 5 * 60 * 1000,
  longBreakMs: 15 * 60 * 1000,
};

describe('pomodoro state machine', () => {
  it('starts idle with no remaining time', () => {
    const s = createPomodoro(D);
    expect(s.getState()).toEqual({
      phase: 'idle',
      remainingMs: 0,
      running: false,
      completedWorkCycles: 0,
    });
  });

  it('start from idle enters work phase running', () => {
    const s = createPomodoro(D);
    s.start();
    const st = s.getState();
    expect(st.phase).toBe('work');
    expect(st.running).toBe(true);
    expect(st.remainingMs).toBe(D.workMs);
  });

  it('tick decrements remaining while running', () => {
    const s = createPomodoro(D);
    s.start();
    s.tick(1000);
    expect(s.getState().remainingMs).toBe(D.workMs - 1000);
  });

  it('tick is a no-op when paused', () => {
    const s = createPomodoro(D);
    s.start();
    s.pause();
    s.tick(5000);
    expect(s.getState().remainingMs).toBe(D.workMs);
  });

  it('tick is a no-op when idle', () => {
    const s = createPomodoro(D);
    s.tick(5000);
    expect(s.getState().remainingMs).toBe(0);
  });

  it('natural work end increments cycle, halts running, fires onIntervalEnd', () => {
    const onIntervalEnd = vi.fn();
    const s = createPomodoro(D, { onIntervalEnd });
    s.start();
    s.tick(D.workMs);
    const st = s.getState();
    expect(st.remainingMs).toBe(0);
    expect(st.running).toBe(false);
    expect(st.phase).toBe('work');
    expect(st.completedWorkCycles).toBe(1);
    expect(onIntervalEnd).toHaveBeenCalledTimes(1);
    expect(onIntervalEnd).toHaveBeenCalledWith('work');
  });

  it('start after natural work end advances to short break', () => {
    const s = createPomodoro(D);
    s.start();
    s.tick(D.workMs);
    s.start();
    const st = s.getState();
    expect(st.phase).toBe('short_break');
    expect(st.remainingMs).toBe(D.shortBreakMs);
    expect(st.running).toBe(true);
  });

  it('every 4th completed work cycle yields a long break', () => {
    const s = createPomodoro(D);
    for (let i = 0; i < 4; i += 1) {
      s.start();
      s.tick(D.workMs);
      // Now in completed work; advance to break
      s.start();
      s.tick(i === 3 ? D.longBreakMs : D.shortBreakMs);
      // Confirm correct break for the i-th cycle
      const st = s.getState();
      if (i === 3) {
        expect(st.phase).toBe('long_break');
      } else {
        expect(st.phase).toBe('short_break');
      }
    }
    expect(s.getState().completedWorkCycles).toBe(4);
  });

  it('skip from work goes to short break and does not count cycle', () => {
    const s = createPomodoro(D);
    s.start();
    s.tick(60_000);
    s.skip();
    const st = s.getState();
    expect(st.phase).toBe('short_break');
    expect(st.remainingMs).toBe(D.shortBreakMs);
    expect(st.running).toBe(false);
    expect(st.completedWorkCycles).toBe(0);
  });

  it('skip from break returns to work', () => {
    const s = createPomodoro(D);
    s.start();
    s.tick(D.workMs);
    s.start();
    s.skip();
    expect(s.getState().phase).toBe('work');
    expect(s.getState().remainingMs).toBe(D.workMs);
    expect(s.getState().running).toBe(false);
  });

  it('skip from idle starts work paused', () => {
    const s = createPomodoro(D);
    s.skip();
    const st = s.getState();
    expect(st.phase).toBe('work');
    expect(st.running).toBe(false);
    expect(st.remainingMs).toBe(D.workMs);
  });

  it('pause then start resumes without resetting remaining', () => {
    const s = createPomodoro(D);
    s.start();
    s.tick(60_000);
    s.pause();
    expect(s.getState().running).toBe(false);
    s.start();
    expect(s.getState().running).toBe(true);
    expect(s.getState().remainingMs).toBe(D.workMs - 60_000);
  });

  it('reset clears state to idle', () => {
    const s = createPomodoro(D);
    s.start();
    s.tick(D.workMs);
    s.reset();
    expect(s.getState()).toEqual({
      phase: 'idle',
      remainingMs: 0,
      running: false,
      completedWorkCycles: 0,
    });
  });

  it('subscribe gets notified on state change', () => {
    const s = createPomodoro(D);
    const listener = vi.fn();
    s.subscribe(listener);
    s.start();
    expect(listener).toHaveBeenCalled();
    expect(listener.mock.calls[0]?.[0]?.phase).toBe('work');
  });

  it('setDurations affects future intervals only', () => {
    const s = createPomodoro(D);
    s.start();
    s.tick(60_000);
    s.setDurations({ ...D, workMs: 1000 });
    expect(s.getState().remainingMs).toBe(D.workMs - 60_000);
    s.skip();
    s.skip();
    expect(s.getState().phase).toBe('work');
    expect(s.getState().remainingMs).toBe(1000);
  });
});

describe('formatRemaining', () => {
  it('formats minutes:seconds with ceiling', () => {
    expect(formatRemaining(0)).toBe('00:00');
    expect(formatRemaining(1000)).toBe('00:01');
    expect(formatRemaining(59_999)).toBe('01:00');
    expect(formatRemaining(25 * 60 * 1000)).toBe('25:00');
    expect(formatRemaining(-100)).toBe('00:00');
  });
});

describe('phaseLabel', () => {
  it('returns human labels', () => {
    expect(phaseLabel('idle')).toBe('Idle');
    expect(phaseLabel('work')).toBe('Work');
    expect(phaseLabel('short_break')).toBe('Short Break');
    expect(phaseLabel('long_break')).toBe('Long Break');
  });
});
