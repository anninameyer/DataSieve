import type { Summary } from './core';

export type PlotScale = 'none' | 'log10' | 'zscore';
export interface ProcessingSettings {
  scale: PlotScale;
  scope: 'figure' | 'analysis';
  pseudocount: number;
}
export const defaultProcessing: ProcessingSettings = {
  scale: 'none',
  scope: 'figure',
  pseudocount: 0,
};
export interface ProcessingInput {
  scale: PlotScale;
  scope: 'figure' | 'analysis';
  addPseudocount: boolean;
  pseudocount: string;
}
export const defaultProcessingInput: ProcessingInput = {
  scale: 'none',
  scope: 'figure',
  addPseudocount: false,
  pseudocount: '',
};
export function processingSettings(input: ProcessingInput): ProcessingSettings {
  return {
    scale: input.scale,
    scope: input.scope,
    pseudocount:
      input.scale === 'log10' && input.addPseudocount
        ? input.pseudocount.trim()
          ? Number(input.pseudocount)
          : NaN
        : 0,
  };
}
export interface ProcessingRecord extends ProcessingSettings {
  originalSummary: Summary;
  error: string;
  formula: string;
  boundPositions: { min: number | null; max: number | null };
}
