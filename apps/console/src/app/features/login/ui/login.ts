import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgOptimizedImage } from '@angular/common';
import { STRINGS } from '../../../core/strings';
import { LoginStore } from '../model/login-store';

interface FloatingPath {
  readonly id: number;
  readonly d: string;
  readonly width: number;
  readonly opacity: number;
  readonly duration: number;
  readonly delay: number;
}

@Component({
  selector: 'mapit-login',
  imports: [FormsModule, NgOptimizedImage],
  providers: [LoginStore],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  protected readonly store = inject(LoginStore);
  protected readonly strings = STRINGS;

  /** Coordenadas y parámetros para las curvas dinámicas SVG (FloatingPaths) */
  protected readonly pathsTop: readonly FloatingPath[] = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5} -${189 + i * 6}C-${380 - i * 5} -${189 + i * 6} -${312 - i * 5} ${216 - i * 6} ${152 - i * 5} ${343 - i * 6}C${616 - i * 5} ${470 - i * 6} ${684 - i * 5} ${875 - i * 6} ${684 - i * 5} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
    opacity: 0.12 + (i % 12) * 0.025,
    duration: 18 + (i % 8) * 1.5,
    delay: (i % 6) * 0.5,
  }));

  protected readonly pathsBottom: readonly FloatingPath[] = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 + i * 5} -${189 + i * 6}C-${380 + i * 5} -${189 + i * 6} -${312 + i * 5} ${216 - i * 6} ${152 + i * 5} ${343 - i * 6}C${616 + i * 5} ${470 - i * 6} ${684 + i * 5} ${875 - i * 6} ${684 + i * 5} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
    opacity: 0.12 + (i % 12) * 0.025,
    duration: 20 + (i % 7) * 1.5,
    delay: (i % 5) * 0.6,
  }));
}
