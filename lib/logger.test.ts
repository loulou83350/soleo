import { describe, it, expect, vi, afterEach } from 'vitest';
import { logger } from './logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logger', () => {
  it('logue un message info en JSON structuré', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('test message', { userId: '123' });
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.level).toBe('info');
    expect(output.message).toBe('test message');
    expect(output.userId).toBe('123');
    expect(output.timestamp).toBeDefined();
  });

  it('logue une erreur sur console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('erreur critique', { code: 500 });
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.level).toBe('error');
    expect(output.code).toBe(500);
  });

  it('withRequestId ajoute le requestId à chaque log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const reqLogger = logger.withRequestId('req-abc-123');
    reqLogger.info('action utilisateur');
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.requestId).toBe('req-abc-123');
    expect(output.message).toBe('action utilisateur');
  });

  it('logue un warning sur console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('attention', { context: 'test' });
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.level).toBe('warn');
  });
});
