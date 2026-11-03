import { expect, it } from 'vitest';
import { criarAnaliseExtensa } from '../../test/analiseExtensa';
import { filtrarAnalise } from './filtrarAnalise';

it('filtra registros de todas as seções, inclusive o grupo zero, e preserva métricas globais', () => {
  const analise = criarAnaliseExtensa();
  const filtrada = filtrarAnalise(analise, 'estacao-1');
  expect(filtrada.alerts).toHaveLength(27);
  expect(filtrada.anomalies.episodes).toHaveLength(16);
  expect(filtrada.classification.current).toEqual({ 'estacao-1': 'Boa' });
  expect(filtrada.clusters.points).toHaveLength(724);
  expect(filtrada.clusters.profiles.map((p) => p.cluster)).toEqual([0]);
  expect(filtrada.trends).toHaveLength(6);
  expect(filtrada.classification.accuracy).toBe(analise.classification.accuracy);
  expect(filtrada.anomalies.evaluation).toBe(analise.anomalies.evaluation);
  expect(filtrada.clusters.profiles[0]).toBe(analise.clusters.profiles[0]);
  expect(analise.alerts).toHaveLength(157);
  expect(analise.clusters.points).toHaveLength(4340);
  expect(filtrarAnalise(analise, '')).toBe(analise);
});
