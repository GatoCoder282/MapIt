/**
 * Evaluación de fortaleza de contraseña.
 *
 * Traducción del hook React `usePasswordStrength` de la referencia recibida
 * a funciones puras en español. Sin estado ni efectos: solo datos de entrada
 * y salida, para que el componente de UI pueda animar el resultado.
 */

import { STRINGS } from '../../../core/strings';

export interface PasswordRule {
  id: string;
  label: string;
  test: (value: string) => boolean;
}

export interface EvaluatedRule extends PasswordRule {
  met: boolean;
}

export interface PasswordStrengthResult {
  score: number;
  max: number;
  label: string;
  rules: EvaluatedRule[];
  guessable: boolean;
}

const COMMON =
  /^(?:password|passw0rd|qwerty|letmein|welcome|admin|iloveyou|monkey|dragon|abc123|111111|123123|123456)/i;
const RUN = /(.)\1{3,}/;
const RUN_UP = /(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|defg|qwer|wert|erty|asdf)/i;
const SYMBOL = /[!-/:-@[-`{-~]/;

export function passwordRules(): readonly PasswordRule[] {
  const text = STRINGS.login.passwordStrength;
  return [
    { id: 'length', label: text.length, test: (v) => v.length >= 8 },
    {
      id: 'case',
      label: text.casing,
      test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v),
    },
    { id: 'digit', label: text.digit, test: (v) => /\d/.test(v) },
    { id: 'symbol', label: text.symbol, test: (v) => SYMBOL.test(v) },
  ];
}

export function passwordStrengthLabels(): readonly string[] {
  return STRINGS.login.passwordStrength.labels;
}

export function evaluatePassword(value: string): PasswordStrengthResult {
  const labels = passwordStrengthLabels();
  const rules = passwordRules().map((rule) => ({ ...rule, met: rule.test(value) }));
  const passed = rules.filter((r) => r.met).length;
  const guessable =
    value.length > 0 && (COMMON.test(value) || RUN.test(value) || RUN_UP.test(value));

  const score =
    value.length === 0 ? 0 : guessable ? 1 : Math.min(rules.length, Math.max(1, passed));

  return {
    score,
    max: rules.length,
    label: labels[Math.min(score, labels.length - 1)] ?? STRINGS.login.passwordStrength.labels[0],
    rules,
    guessable,
  };
}
