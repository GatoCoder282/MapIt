import { TestBed } from '@angular/core/testing';
import type { AccessibleEstablishment } from '@mapit/api-client';

import { EstablishmentSelector } from './establishment-selector';

const establishment: AccessibleEstablishment = {
  id: 'venue-1',
  name: 'Casa Norte',
  slug: 'casa-norte',
  address: 'Calle 10',
  timezone: 'America/Montevideo',
  canManagePayments: false,
  canCheckIn: true,
};

describe('EstablishmentSelector', () => {
  beforeEach(async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open');
      },
    });
    await TestBed.configureTestingModule({ imports: [EstablishmentSelector] }).compileComponents();
  });

  it('allows child radio clicks to activate the choice and continue', () => {
    const fixture = TestBed.createComponent(EstablishmentSelector);
    fixture.componentRef.setInput('establishments', [establishment]);
    fixture.componentRef.setInput('status', 'ready');
    const confirmed = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const continueButton = host.querySelector<HTMLButtonElement>('[data-testid="continue"]')!;
    expect(continueButton.disabled).toBe(true);
    const radio = host.querySelector<HTMLInputElement>('input[type="radio"]')!;
    const childClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    radio.dispatchEvent(childClick);
    expect(childClick.defaultPrevented).toBe(false);
    expect(radio.checked).toBe(true);
    fixture.detectChanges();
    expect(continueButton.disabled).toBe(false);
    continueButton.click();
    expect(confirmed).toHaveBeenCalledWith('venue-1');
  }, 15000);

  it('keeps the mandatory dialog open on native cancel', () => {
    const fixture = TestBed.createComponent(EstablishmentSelector);
    fixture.componentRef.setInput('establishments', [establishment]);
    fixture.componentRef.setInput('status', 'ready');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const dialog = host.querySelector<HTMLDialogElement>('dialog')!;
    const cancel = new Event('cancel', { cancelable: true });
    const dismissed = vi.fn();
    fixture.componentInstance.dismissed.subscribe(dismissed);
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dismissed).not.toHaveBeenCalled();
  });

  it('emits dismissal on native cancel only when dismissal is allowed', () => {
    const fixture = TestBed.createComponent(EstablishmentSelector);
    fixture.componentRef.setInput('establishments', [establishment]);
    fixture.componentRef.setInput('status', 'ready');
    fixture.componentRef.setInput('canDismiss', true);
    const dismissed = vi.fn();
    fixture.componentInstance.dismissed.subscribe(dismissed);
    fixture.detectChanges();

    const cancel = new Event('cancel', { cancelable: true });
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector('dialog')!.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dismissed).toHaveBeenCalledOnce();
  });

  it('includes both the venue name and address in the radio label', () => {
    const fixture = TestBed.createComponent(EstablishmentSelector);
    fixture.componentRef.setInput('establishments', [establishment]);
    fixture.componentRef.setInput('status', 'ready');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const radio = host.querySelector<HTMLInputElement>('input[type="radio"]')!;
    const label = radio.labels?.item(0);
    expect(radio.hasAttribute('aria-label')).toBe(false);
    expect(label?.textContent).toContain('Casa Norte');
    expect(label?.textContent).toContain('Calle 10');
  });

  it('moves initial focus to a visibly focusable heading when no radio is available', () => {
    const fixture = TestBed.createComponent(EstablishmentSelector);
    fixture.componentRef.setInput('establishments', []);
    fixture.componentRef.setInput('status', 'error');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const heading = host.querySelector<HTMLHeadingElement>('#selector-title')!;
    expect(document.activeElement).toBe(heading);
    expect(heading.tabIndex).toBe(-1);
  });

  it('does not dismiss when the backdrop is clicked', () => {
    const fixture = TestBed.createComponent(EstablishmentSelector);
    fixture.componentRef.setInput('establishments', [establishment]);
    fixture.componentRef.setInput('status', 'ready');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const dialog = host.querySelector<HTMLDialogElement>('dialog')!;
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.open).toBe(true);
  });

  it('renders loading, error and empty states without enabling continue', () => {
    const fixture = TestBed.createComponent(EstablishmentSelector);
    fixture.componentRef.setInput('establishments', []);
    fixture.componentRef.setInput('status', 'loading');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Cargando');

    fixture.componentRef.setInput('status', 'error');
    fixture.detectChanges();
    expect(host.textContent).toContain('No se pudieron cargar');

    fixture.componentRef.setInput('status', 'ready');
    fixture.detectChanges();
    expect(host.textContent).toContain('No tienes establecimientos');
    expect(host.querySelector<HTMLButtonElement>('[data-testid="continue"]')!.disabled).toBe(true);
  });

  it('exposes retry and safe sign-out actions from an error state', () => {
    const fixture = TestBed.createComponent(EstablishmentSelector);
    fixture.componentRef.setInput('establishments', []);
    fixture.componentRef.setInput('status', 'error');
    const retry = vi.fn();
    const signOut = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);
    fixture.componentInstance.signOut.subscribe(signOut);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>('button'));
    buttons.find((button) => button.textContent?.includes('Reintentar'))?.click();
    buttons.find((button) => button.textContent?.includes('Cerrar sesión'))?.click();
    expect(retry).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('uses truthful generic imagery and never renders a venue type', () => {
    const fixture = TestBed.createComponent(EstablishmentSelector);
    fixture.componentRef.setInput('establishments', [establishment]);
    fixture.componentRef.setInput('status', 'ready');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('[data-testid="venue-thumbnail"]')).not.toBeNull();
    expect(host.textContent).toContain('Casa Norte');
    expect(host.textContent).toContain('Calle 10');
    expect(host.textContent).not.toContain('Restaurante');
  });
});
